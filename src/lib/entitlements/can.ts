/**
 * ENTITLEMENTS — the central server-side gate.
 *
 * `can(state, feature)` is the ONE place that answers "does this member get this
 * feature?" for the tier/entitlement axis. It sits over the existing derivation
 * (enrollments → family_tiers → effectiveClubTier + challenge_pass), unifying it
 * so UI, API routes and page guards all consult a single verdict instead of each
 * re-deriving `tier === 'free'` inconsistently.
 *
 * It is a PURE function of an EntitlementState snapshot. Compute the snapshot
 * once on the server (getEntitlements) and thread it — never re-fetch per gate.
 *
 * Kid walls COMPOSE, they don't merge: can() knows nothing about kid/teen. Each
 * surface applies BOTH can() AND its own age check.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  effectiveClubTier,
  type FamilyTier,
} from "@/lib/tier";
import { deriveRegister, type Register, type RegisterProfile } from "@/lib/register";
import { FEATURE_ACCESS, type Feature } from "@/lib/entitlements/features";

/** A member's Challenge Pass window (temporary full Club until it expires). */
export interface ChallengeState {
  /** Pass is present and not yet expired. */
  active: boolean;
  /** ISO expiry (challenge end), or null. */
  expiresAt: string | null;
  /** Whole days from now to expiry (server-computed, floored at 0). */
  daysRemaining: number;
}

/**
 * The entitlement snapshot every gate reads. Compute once per request via
 * getEntitlements; pass to can() and to the client <EntitlementsProvider>.
 */
export interface EntitlementState {
  /** Effective CLUB tier — a lapsed FTA family reads 'free' here. Drives every
   *  club-level gate. */
  tier: FamilyTier;
  /** REAL tier — 'fta' stays 'fta' even when the Club window has lapsed. Drives
   *  FTA-hub gates (lifetime academy access is never revoked). */
  realTier: FamilyTier;
  /** age register — kept for COMPOSING kid/teen walls, never merged into can(). */
  register: Register;
  /** fta family past its 12-month Club window with no other Club source. */
  clubLapsed: boolean;
  /** Challenge Pass window, or null if the member has none. */
  challenge: ChallengeState | null;
}

/**
 * The core gate. True ⇒ render the real feature. False ⇒ render the contextual
 * wall (see paywall.ts). A Challenge Pass holder reads tier 'fic', so can()
 * returns true for club features — the surface additionally shows the pass
 * countdown ribbon instead of a wall (state.challenge drives that, not can()).
 */
export function can(state: EntitlementState, feature: Feature): boolean {
  const level = FEATURE_ACCESS[feature];
  if (level === "free") return true;
  if (level === "fta") return state.realTier === "fta";
  // level === "club": Cheat Code Club or FTA (a superset). Effective club tier
  // already folds the Club clock, so a lapsed FTA family (tier 'free') is walled
  // out of club surfaces while keeping FTA-hub access via realTier.
  return state.tier === "fic" || state.tier === "fta";
}

/** Convenience: is this member on a paid Club plan (Club or FTA, not lapsed)? */
export function hasClub(state: EntitlementState): boolean {
  return state.tier === "fic" || state.tier === "fta";
}

/** True while the member holds an unexpired Challenge Pass (show the ribbon). */
export function onChallengePass(state: EntitlementState): boolean {
  return !!state.challenge?.active;
}

// ── Server snapshot builder ───────────────────────────────────────────────────

function daysUntil(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/**
 * Build the EntitlementState for a member, server-side, in as few queries as
 * possible. Reuses the family_tiers view (tier + club_lapsed) and the same
 * challenge_pass lookup the dashboard layout does — one authority.
 *
 * Pass `profile` (role/age_group/track/family_id) if you already have it to skip
 * a fetch. If neither profile nor familyId is known, the caller should pass the
 * userId so we can resolve the family.
 */
export async function getEntitlements(
  supabase: SupabaseClient,
  opts: {
    userId?: string | null;
    familyId?: string | null;
    profile?: (RegisterProfile & { family_id?: string | null }) | null;
  }
): Promise<EntitlementState> {
  let profile = opts.profile ?? null;
  let familyId = opts.familyId ?? profile?.family_id ?? null;

  if (!profile && opts.userId) {
    const { data } = await supabase
      .from("profiles")
      .select("role, age_group, track, family_id")
      .eq("id", opts.userId)
      .maybeSingle();
    profile = data ?? null;
    familyId = familyId ?? data?.family_id ?? null;
  }

  const register = deriveRegister(profile);

  // Real tier + Club-clock lapse in one query (family_tiers view, migration 127).
  let realTier: FamilyTier = "fic";
  let clubLapsed = false;
  if (familyId) {
    const { data } = await supabase
      .from("family_tiers")
      .select("tier, club_lapsed")
      .eq("family_id", familyId)
      .maybeSingle();
    realTier =
      data?.tier === "fta" ? "fta" : data?.tier === "free" ? "free" : "fic";
    clubLapsed = data?.club_lapsed === true;
  }
  const tier = effectiveClubTier(realTier, clubLapsed);

  // Challenge Pass window — only meaningful when the effective tier is 'fic'
  // (an unexpired pass resolves to 'fic' in family_tiers; once expired the tier
  // is already 'free' and there is nothing to surface).
  let challenge: ChallengeState | null = null;
  if (familyId && tier === "fic") {
    const { data: pass } = await supabase
      .from("enrollments")
      .select("expires_at")
      .eq("family_id", familyId)
      .eq("program", "challenge_pass")
      .eq("status", "active")
      .not("expires_at", "is", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    const expiresAt = (pass?.expires_at as string | null) ?? null;
    if (expiresAt) {
      challenge = {
        active: true,
        expiresAt,
        daysRemaining: daysUntil(expiresAt),
      };
    }
  }

  return { tier, realTier, register, clubLapsed, challenge };
}
