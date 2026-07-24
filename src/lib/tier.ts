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

// ── Mode-aware display relabel (Cheat Code Club umbrella) ────────────────────
// The DB program (free|fic|fta) is fixed; how its NAME renders depends on the
// viewer's member mode (src/lib/mode.ts). The same fic membership reads as
// "Club" in the individual door and "FIC" in the family door — one membership,
// two brand identities under the Cheat Code Club umbrella. FTA is an add-on
// tier on top of either: its chip stays the gold "FTA", long-form "Club + FTA".
// Chip STYLING (gold / sand / outline) always comes from TIER_CONFIG — only the
// label + accessible name are mode-aware. Defaults to "family" so any surface
// that doesn't yet thread mode keeps the current FIC-flavored labels.

export interface TierDisplay {
  /** Short chip label. */
  label: string;
  /** Full membership name (chip title / long-form copy). */
  name: string;
}

export function tierDisplay(
  tier: FamilyTier,
  mode: MemberMode = "family"
): TierDisplay {
  if (tier === "fta") return { label: "FTA", name: "Club + FTA" };
  if (tier === "free")
    return { label: TIER_CONFIG.free.label, name: TIER_CONFIG.free.name };
  // fic — the membership that carries the umbrella brand split.
  return mode === "individual"
    ? { label: "Club", name: "Cheat Code Club" }
    : { label: "FIC", name: "Family Investing Club" };
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

function normalizeTier(value: unknown): FamilyTier {
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
