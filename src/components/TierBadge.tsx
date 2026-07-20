import { TIER_CONFIG, type FamilyTier } from "@/lib/tier";

/**
 * Membership tier chip — the ONE badge component for FIC/FTA everywhere
 * (community feed, top bar, leaderboard, family pages, admin).
 *
 * Visually distinct from XP-level text (earned axis): this is a compact
 * uppercase display-font chip. FTA reads premium (gold, white text); FIC is a
 * quiet neutral chip — present, never punished.
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
  className = "",
}: {
  tier: FamilyTier;
  size?: keyof typeof SIZES;
  /** Set false to render nothing for FIC (premium-only contexts). */
  showFic?: boolean;
  className?: string;
}) {
  if (tier === "fic" && !showFic) return null;
  const cfg = TIER_CONFIG[tier];
  return (
    <span
      title={cfg.name}
      className={`inline-flex items-center font-display font-bold uppercase tracking-wider shrink-0 ${SIZES[size]} ${cfg.chip} ${className}`}
    >
      {cfg.label}
    </span>
  );
}

/** Gold avatar ring classes for premium members ("" for FIC). */
export function tierRingClass(tier: FamilyTier | null | undefined): string {
  return tier ? TIER_CONFIG[tier].avatarRing : "";
}
