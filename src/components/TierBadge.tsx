import { TIER_CONFIG, tierDisplay, type FamilyTier } from "@/lib/tier";
import type { MemberMode } from "@/lib/mode";

/**
 * Membership tier chip — the ONE badge component for the umbrella tiers
 * everywhere (community feed, top bar, leaderboard, family pages, admin).
 *
 * Visually distinct from XP-level text (earned axis): this is a compact
 * uppercase display-font chip. FTA reads premium (gold, white text); the fic
 * membership is a quiet neutral chip — present, never punished. The LABEL is
 * mode-aware (Cheat Code Club umbrella): fic reads "Club" in the individual
 * door, "FIC" in the family door; the chip styling never changes. `mode`
 * defaults to "family" so cross-user surfaces keep the familiar FIC label.
 */

const SIZES = {
  xs: "text-[9px] px-1 py-px rounded",
  sm: "text-[10px] px-1.5 py-0.5 rounded",
  md: "text-[11px] px-2 py-0.5 rounded-md",
} as const;

export default function TierBadge({
  tier,
  size = "sm",
  showFic = true,
  mode = "family",
  className = "",
}: {
  tier: FamilyTier;
  size?: keyof typeof SIZES;
  /** Set false to render nothing for FIC (premium-only contexts). */
  showFic?: boolean;
  /** Viewer's brand mode — relabels the fic chip Club↔FIC. */
  mode?: MemberMode;
  className?: string;
}) {
  if (tier === "fic" && !showFic) return null;
  const cfg = TIER_CONFIG[tier];
  const { label, name } = tierDisplay(tier, mode);
  return (
    <span
      title={name}
      className={`inline-flex items-center font-display font-bold uppercase tracking-wider shrink-0 ${SIZES[size]} ${cfg.chip} ${className}`}
    >
      {label}
    </span>
  );
}

/** Gold avatar ring classes for premium members ("" for FIC). */
export function tierRingClass(tier: FamilyTier | null | undefined): string {
  return tier ? TIER_CONFIG[tier].avatarRing : "";
}
