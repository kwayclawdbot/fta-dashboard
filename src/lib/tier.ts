import type { SupabaseClient } from "@supabase/supabase-js";
// Type-only import — no runtime cycle (mode.ts imports register.ts, never tier.ts).
import type { MemberMode } from "@/lib/mode";

/**
 * Membership tier (paid axis) — FIC vs FTA.
 *
 * This is deliberately separate from the XP level ladder in `src/lib/xp.ts`
 * (Explorer → Playbook Pro), which is EARNED. Tier is PURCHASED, lives on the
 * family, and every member (kids included) inherits it via profiles.family_id.
 *
 * Source of truth: the `enrollments` table (family_id, program 'fic'|'fta',
 * status 'active'). A family with an active FTA enrollment is tier 'fta';
 * everyone else renders as 'fic'. The `family_tiers` view (migration 029)
 * exposes exactly {family_id, tier} to all authenticated users so badges can
 * be shown cross-family without widening enrollments RLS.
 */

export type FamilyTier = "free" | "fic" | "fta";
export type ProgramKey = "fic" | "fta";
/** Legacy values still used by courses.min_tier / live_sessions.min_tier. */
export type SessionTier = "challenge" | "academy";
export type ContentTrack = "kids" | "teens" | "adults" | "all";

// ── Display config ──────────────────────────────────────────────────────────

export const TIER_CONFIG: Record<
  FamilyTier,
  {
    label: string;
    name: string;
    premium: boolean;
    /** Compact badge chip classes (warm-paper design system). */
    chip: string;
    /** Avatar ring for premium presence (empty string = no ring). */
    avatarRing: string;
  }
> = {
  fta: {
    label: "FTA",
    name: "Family Trading Academy",
    premium: true,
    // Constant METALLIC gold (.chip-metal-gold) + a fixed gold ring — NOT the
    // themeable gold-* ramp, so an FTA member browsing in Club mode (where the
    // ramp remaps to volt orange) still sees a distinctly gold premium badge.
    chip: "chip-metal-gold shadow-soft",
    avatarRing: "ring-2 ring-[#E6B84D] ring-offset-1 ring-offset-white",
  },
  fic: {
    label: "FIC",
    name: "Family Investing Club",
    premium: false,
    chip: "bg-sand text-soft",
    avatarRing: "",
  },
  // Free tier — social-funnel signups. A quiet neutral OUTLINE chip ("Guest"),
  // deliberately distinct from FIC's filled sand: clearly not-yet-a-member, but
  // never punished. Ghosted outline reads calm and adult; the app nudges them
  // toward joining FIC without shaming the badge itself.
  free: {
    label: "Guest",
    name: "Free member",
    premium: false,
    chip: "border border-soft/40 bg-transparent text-soft",
    avatarRing: "",
  },
};

// ── Access matrix ────────────────────────────────────────────────────────────
// One place that answers "what does each tier unlock". FTA is a superset of
// FIC. Track locks (kids only see their own track) are ROLE/age-based, not
// tier-based — both tiers span every family track.

export const TIER_ACCESS: Record<
  FamilyTier,
  {
    programs: readonly ProgramKey[];
    sessionTiers: readonly SessionTier[];
    tracks: readonly ContentTrack[];
  }
> = {
  // Free members unlock NO paid content programs or member live sessions. Track
  // access stays age-based (unused here since they have no course/session
  // access), matching the shape of the other tiers.
  free: {
    programs: [],
    sessionTiers: [],
    tracks: ["kids", "teens", "adults", "all"],
  },
  fic: {
    programs: ["fic"],
    sessionTiers: ["challenge"],
    tracks: ["kids", "teens", "adults", "all"],
  },
  fta: {
    programs: ["fic", "fta"],
    sessionTiers: ["challenge", "academy"],
    tracks: ["kids", "teens", "adults", "all"],
  },
};

export function isPremium(tier: FamilyTier): boolean {
  return TIER_CONFIG[tier].premium;
}

// ── FTA year-1 Club clock (Challenge $1,500 offer) ───────────────────────────
// The $1,500 Challenge grants FTA academy access for LIFE + Cheat Code Club for
// 12 months (enrollments.club_until). When that window closes with no other Club
// source (no paid fic, no unexpired challenge_pass), the family stays tier 'fta'
// but `club_lapsed` is true: FTA hub access (/fta/**, FTA courses, recordings,
// FTA chat) is PRESERVED while every fic-level Club surface (community write,
// watchlist, Kai chat, alerts, screener) is stripped down to the free tier.
//
// One central derivation — effectiveClubTier — is the single knob every
// Club-level gate reads. FTA-hub gates keep reading the real tier. Never scatter
// `if (clubLapsed)` conditionals across consumers; funnel them through here.

export interface FamilyTierState {
  /** Real membership tier (fta stays fta even when the Club window has lapsed). */
  tier: FamilyTier;
  /** fta family past its 12-month Club window with no other Club source. */
  clubLapsed: boolean;
}

/**
 * The tier a CLUB-LEVEL surface should gate against. For a lapsed FTA member the
 * real tier is still 'fta' but Club access is revoked, so this collapses to
 * 'free' — driving every existing `tier === 'free'` / cap-by-tier lock without
 * touching FTA-hub gates (which keep using the real tier). A no-op for everyone
 * whose Club is active (clubLapsed false ⇒ returns the tier unchanged).
 */
export function effectiveClubTier(
  tier: FamilyTier,
  clubLapsed: boolean | null | undefined
): FamilyTier {
  return clubLapsed ? "free" : tier;
}

/**
 * Program access with the Club clock applied. FTA-program content is PRESERVED
 * for a lapsed member (they own FTA for life); fic-program content follows the
 * effective Club tier (free ⇒ locked). Use at course call-sites that must honor
 * the "keep FTA academy, drop Club" split.
 */
export function canAccessProgramEffective(
  tier: FamilyTier,
  clubLapsed: boolean | null | undefined,
  program: ProgramKey | null | undefined
): boolean {
  if (!program) return true;
  if (program === "fta") return canAccessProgram(tier, "fta"); // lifetime FTA
  return canAccessProgram(effectiveClubTier(tier, clubLapsed), program);
}

/**
 * Live-session access with the Club clock applied. 'academy' (FTA) sessions +
 * recordings stay open for a lapsed member; 'challenge' (fic) sessions follow
 * the effective Club tier.
 */
export function canAccessSessionEffective(
  tier: FamilyTier,
  clubLapsed: boolean | null | undefined,
  minTier: SessionTier | null | undefined
): boolean {
  if (!minTier) return true;
  if (minTier === "academy") return canAccessSession(tier, "academy");
  return canAccessSession(effectiveClubTier(tier, clubLapsed), minTier);
}

// ── Membership display name (Cheat Code Club umbrella) ───────────────────────
// The DB program (free|fic|fta) is fixed; this is the ONE place that says what a
// member's badge is CALLED. It used to split on member mode — "Club" at the
// individual door, "FIC" at the family door — which put two product names on a
// single $99 membership and let /pricing and /upgrade disagree about what the
// member was buying. There is one membership and one name: Cheat Code Club.
// Family Investing Club is FAMILY MODE within the Club (src/lib/mode.ts) — the
// shell wordmark and the family context, not a competing product, and never a
// price tag of its own. FTA is an add-on on top: gold "FTA", long-form
// "Club + FTA". Chip STYLING (gold / sand / outline) always comes from
// TIER_CONFIG; only the label + accessible name come from here.

export interface TierDisplay {
  /** Short chip label. */
  label: string;
  /** Full membership name (chip title / long-form copy). */
  name: string;
}

export function tierDisplay(
  tier: FamilyTier,
  // Retained for call-site compatibility (positional; TierBadge still passes the
  // viewer's mode). It no longer selects a brand — see the note above.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _mode: MemberMode = "family"
): TierDisplay {
  if (tier === "fta") return { label: "FTA", name: "Club + FTA" };
  if (tier === "free")
    return { label: TIER_CONFIG.free.label, name: TIER_CONFIG.free.name };
  // fic — the $99 membership. ONE name, in every mode.
  return { label: "Club", name: "Cheat Code Club" };
}

/** Can this tier open content belonging to a program (courses.program)? */
export function canAccessProgram(
  tier: FamilyTier,
  program: ProgramKey | null | undefined
): boolean {
  if (!program) return true; // legacy/untagged content is not tier-gated
  return TIER_ACCESS[tier].programs.includes(program);
}

/** Alias reading better at course call-sites. */
export function canAccessCourse(
  tier: FamilyTier,
  program: ProgramKey | null | undefined
): boolean {
  return canAccessProgram(tier, program);
}

/** Can this tier join/watch a live session gated by live_sessions.min_tier? */
export function canAccessSession(
  tier: FamilyTier,
  minTier: SessionTier | null | undefined
): boolean {
  if (!minTier) return true;
  return TIER_ACCESS[tier].sessionTiers.includes(minTier);
}

/** Tier-level track access (today: both tiers span all family tracks). */
export function canAccessTrack(tier: FamilyTier, track: ContentTrack): boolean {
  return TIER_ACCESS[tier].tracks.includes(track);
}

/** Derive a tier from a set of active enrollment programs. */
export function tierFromPrograms(
  programs: readonly string[] | null | undefined
): FamilyTier {
  return programs?.includes("fta") ? "fta" : "fic";
}

/** The one place a raw `family_tiers.tier` string becomes a FamilyTier. Exported
 *  because the boot RPC (migration 217) returns the same column and must land on
 *  the same verdict — including its "anything unrecognised is 'fic'" default. */
export function normalizeTier(value: unknown): FamilyTier {
  if (value === "fta") return "fta";
  if (value === "free") return "free";
  return "fic";
}

/** True for the social-funnel free tier (read-only community, locked academy). */
export function isFreeTier(tier: FamilyTier): boolean {
  return tier === "free";
}

// ── Fetchers (family_tiers view, migration 029) ─────────────────────────────

/** Tier for one family. No family (or fetch failure) renders as 'fic'. */
export async function getFamilyTier(
  supabase: SupabaseClient,
  familyId: string | null | undefined
): Promise<FamilyTier> {
  if (!familyId) return "fic";
  const { data } = await supabase
    .from("family_tiers")
    .select("tier")
    .eq("family_id", familyId)
    .maybeSingle();
  return normalizeTier(data?.tier);
}

/**
 * Real tier + Club-clock lapse for one family, in ONE query. Use this anywhere
 * the Club renewal banner / lapsed gating needs to be surfaced. FTA-hub gates
 * read `state.tier`; Club-level gates read `effectiveClubTier(state)` (or the
 * getClubTier convenience below).
 */
export async function getFamilyTierState(
  supabase: SupabaseClient,
  familyId: string | null | undefined
): Promise<FamilyTierState> {
  if (!familyId) return { tier: "fic", clubLapsed: false };
  const { data } = await supabase
    .from("family_tiers")
    .select("tier, club_lapsed")
    .eq("family_id", familyId)
    .maybeSingle();
  return {
    tier: normalizeTier(data?.tier),
    clubLapsed: data?.club_lapsed === true,
  };
}

/**
 * The tier a CLUB-LEVEL surface should gate against — real tier folded through
 * the Club clock, so a lapsed FTA family reads 'free'. Drop-in replacement for
 * getFamilyTier at every fic-level gate (community write, watchlist, Kai chat,
 * alerts, screener, games, news, research, settings). Identical to getFamilyTier
 * for anyone whose Club is active.
 */
export async function getClubTier(
  supabase: SupabaseClient,
  familyId: string | null | undefined
): Promise<FamilyTier> {
  const { tier, clubLapsed } = await getFamilyTierState(supabase, familyId);
  return effectiveClubTier(tier, clubLapsed);
}

/**
 * Tier map for many families in ONE query — use this for feeds/lists
 * (community messages, admin tables) so tier display never becomes an
 * N+1 per row.
 */
export async function getFamilyTierMap(
  supabase: SupabaseClient,
  familyIds: ReadonlyArray<string | null | undefined>
): Promise<Record<string, FamilyTier>> {
  const ids = [...new Set(familyIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from("family_tiers")
    .select("family_id, tier")
    .in("family_id", ids);
  const map: Record<string, FamilyTier> = {};
  for (const row of data || []) {
    map[row.family_id as string] = normalizeTier(row.tier);
  }
  return map;
}
