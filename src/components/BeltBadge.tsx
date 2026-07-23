import { beltForXp, type BeltRank } from "@/lib/belts";

/**
 * Belt name pill — the spelled-out belt indicator for leaderboards, the public
 * profile, and /progress. Distinct from TierBadge (purchased FIC/FTA axis) and
 * AgeBadge (kid/teen/adult): this is the EARNED belt, colored by the belt itself
 * so it reads the same in light and dark. White gets a border; black gets a
 * lighter inner ring so the swatch stays visible on both themes.
 *
 * For the subtle "everywhere" indicator on avatars use <BeltDot/> instead — this
 * pill carries the full word and is used only where a spelled-out belt belongs.
 */

const SIZES = {
  xs: "text-[9px] px-1.5 py-px gap-1 rounded",
  sm: "text-[10px] px-2 py-0.5 gap-1 rounded-md",
  md: "text-[11px] px-2.5 py-1 gap-1.5 rounded-md",
} as const;

const SWATCH: Record<keyof typeof SIZES, string> = {
  xs: "w-2 h-2",
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
};

export function BeltBadge({
  rank,
  xp,
  size = "sm",
  className = "",
}: {
  /** Provide a resolved rank, or an xp total to resolve one. */
  rank?: BeltRank;
  xp?: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const r = rank ?? beltForXp(xp ?? 0);
  const { belt } = r;
  return (
    <span
      title={`${r.label} · Level ${r.level.level} (${r.level.name})`}
      className={`inline-flex items-center font-display font-bold uppercase tracking-wide shrink-0 ${SIZES[size]} ${className}`}
      style={{
        backgroundColor: `${belt.hex}22`,
        color: belt.hex,
        border: `1px solid ${belt.borderHex}55`,
      }}
    >
      <span
        className={`rounded-full shrink-0 ${SWATCH[size]}`}
        style={{ backgroundColor: belt.hex, border: `1px solid ${belt.borderHex}` }}
      />
      {r.short}
    </span>
  );
}

export default BeltBadge;
