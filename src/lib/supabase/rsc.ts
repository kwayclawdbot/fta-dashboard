import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProjectJwks } from "@/lib/supabase/jwks";
import { getFamilyTierState, type FamilyTierState } from "@/lib/tier";

/**
 * REQUEST-SCOPED SESSION LAYER (speed wave).
 *
 * Two structural costs this file removes, both measured against production
 * (Supabase behind Cloudflare; every call below was 300–500ms from the vantage
 * point the perf audit was taken from):
 *
 * 1. `auth.getUser()` IS A NETWORK CALL. It posts the access token to GoTrue
 *    (/auth/v1/user) and waits for a round trip — measured 309–340ms, EVERY
 *    call. A single authenticated page render was making four to five of them:
 *    middleware, the dashboard layout, the page, and then again inside each
 *    server-side seed builder (resolveClubCtx, getDiscoverExtras,
 *    getCommunityBoardSeed, getFamilyContext). That is over a second of pure
 *    auth latency before any real data is read.
 *
 *    This project signs access tokens with an ASYMMETRIC key (ES256, JWKS
 *    published at /auth/v1/.well-known/jwks.json), so `auth.getClaims()`
 *    verifies the signature LOCALLY with WebCrypto against a cached JWK —
 *    measured 0–1ms warm, ~67ms on the very first call of a cold instance
 *    (the one-time JWKS fetch). It is the same cryptographic guarantee the
 *    server gives: a forged or tampered token fails verification. The only
 *    behavioural difference is that a token revoked mid-life stays valid until
 *    it expires (≤1h), which is exactly the trade the Supabase SSR guidance
 *    makes for a token check on a hot path.
 *
 *    IMPORTANT: `getClaims()` with no argument goes through `getSession()`
 *    first, so an EXPIRED cookie is still refreshed exactly as before, and if
 *    the project ever falls back to symmetric (HS256) signing the helper
 *    transparently calls `getUser()` itself. Nothing fails open.
 *
 * 2. THE SAME ROWS WERE READ THREE TIMES. The layout, the page and each seed
 *    builder independently read `profiles` for this user, and independently
 *    resolved the family tier. React's `cache()` is request-scoped, so wrapping
 *    them here collapses each to ONE round trip per request no matter how many
 *    call sites ask. The columns selected are the UNION of what every caller
 *    needed, so no call site loses a field.
 *
 * Nothing here is cross-request cache: `cache()` lives and dies with a single
 * render pass. Per-user data therefore can never leak between members.
 */

/** The subset of the auth user every server caller in this app actually uses. */
export interface SessionUser {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
}

/** Profile columns — the UNION of what the layout, the club/discover/alerts
 *  seeds and the family context each used to select for themselves. */
export interface SessionProfile {
  id: string;
  role: string | null;
  age_group: string | null;
  track: string | null;
  display_name: string | null;
  avatar_url: string | null;
  onboarding_complete: boolean | null;
  family_id: string | null;
}

const PROFILE_COLS =
  "id, role, age_group, track, display_name, avatar_url, onboarding_complete, family_id";

/** ONE supabase server client per request (creating it also awaits cookies()). */
export const getRequestClient = cache(
  async (): Promise<SupabaseClient> => createClient()
);

/**
 * The authenticated member, verified LOCALLY from the signed JWT. One
 * verification per request; null when there is no (valid) session.
 */
export const getRequestUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const [supabase, jwksKeys] = await Promise.all([
      getRequestClient(),
      // Module-scope key set (src/lib/supabase/jwks.ts) — without it the
      // per-request client would fetch the JWKS on every render and this would
      // not be a local check at all.
      getProjectJwks(),
    ]);
    const { data, error } = await supabase.auth.getClaims(
      undefined,
      jwksKeys ? { jwks: { keys: jwksKeys } } : undefined
    );
    const claims = data?.claims;
    if (error || !claims?.sub) return null;
    return {
      id: claims.sub,
      email: (claims.email as string | undefined) ?? null,
      user_metadata: (claims.user_metadata as Record<string, unknown>) ?? {},
    };
  } catch {
    return null;
  }
});

/** This member's profile row — ONE read per request, shared by every caller. */
export const getRequestProfile = cache(
  async (): Promise<SessionProfile | null> => {
    const user = await getRequestUser();
    if (!user) return null;
    const supabase = await getRequestClient();
    const { data } = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", user.id)
      .maybeSingle();
    return (data as SessionProfile | null) ?? null;
  }
);

/**
 * Real tier + Club-clock lapse for a family — ONE read per family per request.
 * Identical semantics to calling getFamilyTierState(supabase, family_id)
 * directly (including the no-family default), just not re-fetched per surface.
 *
 * It takes the family id rather than deriving it, deliberately. React's
 * `cache()` is a PASS-THROUGH when there is no render scope (route handlers),
 * so a version that called getRequestProfile() itself would issue a second
 * profile read on that path. Keyed on the argument, this is deduped where a
 * scope exists and costs exactly one read where it does not — no path is ever
 * worse off than before.
 */
export const getRequestTierState = cache(
  async (familyId: string | null | undefined): Promise<FamilyTierState> => {
    const supabase = await getRequestClient();
    return getFamilyTierState(supabase, familyId);
  }
);

/**
 * HOW MANY PEOPLE ARE ACTUALLY IN THIS FAMILY — one cached count per family per
 * request (`head: true`, so the rows never cross the wire).
 *
 * This exists because the "solo member" verdict used to be read entirely off the
 * signup questionnaire (`family_profiles.household`), and a questionnaire is a
 * statement of intent, not a fact. A parent who answered `{adults:1, kids:0}` —
 * or whose wizard default was never corrected — and THEN added a real teen was
 * still classified solo, which stripped Family out of their navigation entirely
 * while their child sat in `profiles` on the same `family_id`.
 *
 * Membership is the fact. The household JSON may only break a tie (one row: is
 * this a deliberate solo, or a parent who hasn't invited anyone yet?) — it may
 * never overrule a household that demonstrably has more than one member. See
 * isSoloAccount() in src/lib/register.ts.
 *
 * Returns null when there is no family, or when the count could not be read —
 * null means "unknown", and the caller keeps its previous behaviour rather than
 * guessing in either direction.
 */
export const getRequestFamilyMemberCount = cache(
  async (familyId: string | null | undefined): Promise<number | null> => {
    if (!familyId) return null;
    const supabase = await getRequestClient();
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId);
    if (error) return null;
    return count ?? null;
  }
);

/* ══════════════════════════════════════════════════════════════════════════
   THE HOME BOOT — one round trip for the whole /dashboard render
   ══════════════════════════════════════════════════════════════════════════ */

/** The next lesson `get_home_state` reports, as Home reads it. */
export interface HomeBootToday {
  lesson_id: string;
  title: string;
  module_id: string;
  module_title: string;
  course_slug: string;
  course_title: string;
}

export interface HomeBoot {
  profile: SessionProfile & { username: string | null };
  family: {
    id: string | null;
    door: string | null;
    tier: string;
    club_lapsed: boolean;
    club_until: string | null;
    challenge_expires_at: string | null;
    is_vip: boolean;
    household: unknown;
    household_completed_at: string | null;
    member_count: number;
  };
  home_state: { program: "fic" | "fta" | null; today: HomeBootToday | null } | null;
  xp: number;
  streak: { days: number; acted_today: boolean };
  course_progress: { slug: string; done: number; total: number } | null;
  cards_due: number;
  watch_triggered: number;
  unread_notifications: number;
  watchlist: string[];
}

/**
 * EVERYTHING /dashboard NEEDS, IN ONE ROUND TRIP (migration 217).
 *
 * Three independent pieces of the Home render each used to resolve the member's
 * family and then fan out from it:
 *
 *   · the (dashboard) layout — family_tiers, an enrollments read for the
 *     challenge pass, challenge_vips, family_profiles, a member count and
 *     families.door (plus a seventh enrollments read when the Club has lapsed);
 *   · resolveHomeRoute      — get_home_state, xp_for_users, the tier again,
 *     family_profiles again and the challenge-pass enrollment again;
 *   · buildTodayLoop        — get_home_state a THIRD time, a 400-day xp_events
 *     scan for the streak, flashcard_reviews, watch_current_state, and a
 *     two-query course-progress read.
 *
 * Roughly seventeen HTTP round trips, several of them literally the same query,
 * for a set of facts that are one join apart inside Postgres. `get_home_boot`
 * answers all of it at once; `cache()` makes it ONE call no matter how many of
 * the three ask.
 *
 * THE TIMEZONE ARGUMENT IS LOAD-BEARING. The streak is defined in LOCAL calendar
 * days (src/lib/streak.ts), so the server's own UTC offset is passed in and the
 * function shifts `xp_events.created_at` by it — the same day boundary
 * `dayKeyLocal()` would have drawn.
 *
 * Returns null when there is no session, or when the read fails: every caller
 * treats that as "fall back to the path you had", so a boot failure degrades
 * rather than breaking a surface.
 */
export const getRequestHomeBoot = cache(async (): Promise<HomeBoot | null> => {
  try {
    const supabase = await getRequestClient();
    const { data, error } = await supabase.rpc("get_home_boot", {
      p_tz_offset_minutes: new Date().getTimezoneOffset(),
    });
    if (error || !data) return null;
    return data as HomeBoot;
  } catch {
    return null;
  }
});
