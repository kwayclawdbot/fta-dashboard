import { getRequestHomeBoot, getRequestUser } from "@/lib/supabase/rsc";
import { normalizeTier } from "@/lib/tier";
import { deriveRegister, isSoloProfile, type Register } from "@/lib/register";
import type { LearningPickup } from "@/components/clubhome/ClubHomeV2";

/**
 * Home route resolution — SERVER SIDE (CONVERGENCE S2).
 *
 * The persona round-1 resolution (auth → profile → home_state → tier → register
 * → solo verdict) used to run entirely on the client before the first content
 * paint, which cost ~1.4s FCP on the Club home. This resolves the paint-critical
 * slice on the server so the Club home shell + header stream immediately; the
 * live section data still hydrates client-side via the batched GET /api/club/home.
 *
 * Only the CLUB-SOLO surface (the one S2 owns) takes the server fast-path. The
 * family / kid / free personas fall through to the existing client component
 * UNCHANGED — this file deliberately returns `kind:"client"` for them so their
 * behavior is byte-identical to before.
 */

interface HomeStateRow {
  program: "fic" | "fta" | null;
  today: {
    lesson_id: string;
    title: string;
    module_id: string;
    module_title: string;
    course_slug: string;
    course_title: string;
  } | null;
}

/* The profile shape this file needs (display_name, family_id, role, age_group,
   track) is a subset of SessionProfile, which getRequestProfile() returns — so
   the local interface it used to declare would only be a second place to keep
   in sync. */

export type HomeRoute =
  | { kind: "client" }
  | { kind: "free"; firstName: string }
  | {
      kind: "club";
      /** The member's auth id — the loop payload (src/lib/club/today.ts) needs
       *  it and it is already resolved here, so nothing re-reads the session. */
      userId: string;
      firstName: string;
      register: Register;
      learning: LearningPickup | null;
      challengeExpiresAt: string | null;
      /**
       * Lifetime XP, for Home's closing belt strip (canvas board 01 "YOU").
       * `null` means the read did not land — NOT zero. A real zero is a real
       * White Belt at 0 XP and renders as such; null renders the honest
       * "your rank starts with your first rep" state instead.
       */
      xp: number | null;
    };

/**
 * Resolve where a Home request should go. Returns `kind:"client"` whenever the
 * fast-path can't be taken safely (any query fails, no session, not a solo
 * member) so the untouched client path handles it — never a wrong render.
 */
export async function resolveHomeRoute(): Promise<HomeRoute> {
  try {
    // SPEED: the session is a LOCAL signature check, and everything else this
    // route needs — profile, tier, the challenge-pass window, the household
    // shape, `get_home_state` and lifetime XP — arrives in the SINGLE
    // `get_home_boot` payload the dashboard layout has already requested. It is
    // request-scoped (React `cache()`), so this costs zero additional round
    // trips; the five-way parallel batch it replaced was itself duplicating
    // three of the layout's own reads.
    //
    // The boot's `xp` is the grouped SUM computed in Postgres, the same thing
    // `xp_for_users` (migration 118) returned — a client-side sum over
    // `xp_events` is capped by PostgREST's max-rows and would silently
    // under-report a long-standing member's belt.
    const [user, boot] = await Promise.all([getRequestUser(), getRequestHomeBoot()]);
    if (!user) return { kind: "client" };
    if (!boot?.profile) return { kind: "client" };

    const prof = boot.profile;
    const firstName = prof.display_name?.split(" ")[0] || "";
    const familyId = prof.family_id;

    // The solo gate needs NO query — role and family_id are already in `prof`.
    const isParentRole = prof.role === "parent" || prof.role === "admin";
    const needSolo = isParentRole && !!familyId;

    // The free/fic/fta verdict is unchanged: the REAL tier, with the Club-clock
    // lapse deliberately NOT folded in, exactly as before.
    const tier = normalizeTier(boot.family.tier);

    // FREE → the dedicated free home. Resolved server-side so it paints without
    // a client round trip (identical destination to the client short-circuit).
    if (tier === "free") return { kind: "free", firstName };

    // CLUB-SOLO fast-path — mirrors the client's isSolo gate exactly: a parent/
    // admin with a family_id and a COMPLETED solo household profile. Anything
    // else (families, kids, teens) falls through to the untouched client.
    if (!needSolo) return { kind: "client" };
    if (
      !isSoloProfile({
        household: boot.family.household as never,
        completed_at: boot.family.household_completed_at,
      })
    ) {
      return { kind: "client" };
    }

    // Solo Club member → server-render ClubHomeV2 with resolved props.
    const hs = boot.home_state as HomeStateRow | null;
    const learning: LearningPickup | null =
      hs?.program && hs.today
        ? {
            title: hs.today.title,
            href: `/courses/${hs.today.course_slug}/${hs.today.module_id}/${hs.today.lesson_id}`,
            context: `${hs.today.module_title} · ${hs.today.course_title}`,
          }
        : null;

    // A missing row is 0 XP (White Belt) — that is a real rank, not an absence.
    // Only a FAILED boot is null, and only that renders the honest empty state
    // (it is caught above and routes to the client, so it cannot reach here).
    const xp = Number(boot.xp ?? 0) || 0;

    return {
      kind: "club",
      userId: user.id,
      firstName,
      // Active 5-Day Challenge pass window; null is the common case.
      challengeExpiresAt: boot.family.challenge_expires_at ?? null,
      register: deriveRegister(prof),
      learning,
      xp,
    };
  } catch {
    // Any failure → the untouched client resolves it (no regression).
    return { kind: "client" };
  }
}
