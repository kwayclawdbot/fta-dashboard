import { beltForXp, type BeltRank } from "@/lib/belts";
import { BeltMark } from "@/components/art";

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

/**
 * THE PILL KEEPS ITS PILL, BUT LOSES THE DOT WHERE THERE IS ROOM FOR A BELT.
 *
 * A round colour swatch is the same mark a status dot, an unread pip and a
 * legend key use — it says "a colour lives here", never "a belt lives here".
 * Where the pill is big enough to resolve the drawn belt, it draws the drawn
 * belt instead, so the rank object is the SAME object in the ladder, the
 * leaderboard and the chip next to a name.
 *
 * `xs` is the exception and stays a dot. At 9px type the pill is ~14px tall;
 * a belt drawn into that is a smudge, and a smudge is worse than an honest
 * dot. Pass `mark` explicitly to override in either direction.
 */
const MARK_WIDTH: Record<keyof typeof SIZES, number> = {
  xs: 14,
  sm: 16,
  md: 20,
};

/**
 * THE TWO ENDS OF THE LADDER CANNOT COLOUR THEIR OWN LABEL. Every other belt
 * hex is a mid-tone that reads on both papers, so the pill can tint itself and
 * write the word in its own colour. White (#E8EAF0) and Black (#1F2430) cannot:
 * on the light board the White Belt chip was near-white text on a near-white
 * card at a 15%-alpha hairline — the audit found it completely invisible — and
 * Black has the mirror-image problem on the night board.
 *
 * So the two neutral belts drop the self-colouring and take the surface's own
 * ink plus a FULL-opacity edge in the belt's border hex. The swatch dot still
 * carries the actual belt colour, which is what the belt colour is FOR, and the
 * chip stays legible in both themes without a `dark:` variant.
 */
const NEUTRAL_BELTS = new Set(["white", "black"]);

export function BeltBadge({
  rank,
  xp,
  size = "sm",
  mark,
  className = "",
}: {
  /** Provide a resolved rank, or an xp total to resolve one. */
  rank?: BeltRank;
  xp?: number;
  size?: keyof typeof SIZES;
  /** Draw the belt object instead of the colour dot. Defaults on above `xs`. */
  mark?: boolean;
  className?: string;
}) {
  const r = rank ?? beltForXp(xp ?? 0);
  const { belt } = r;
  const neutral = NEUTRAL_BELTS.has(belt.key);
  const drawBelt = mark ?? size !== "xs";
  return (
    <span
      title={`${r.label} · Level ${r.level.level} (${r.level.name})`}
      className={`inline-flex items-center font-display font-bold uppercase tracking-wide shrink-0 ${SIZES[size]} ${
        neutral ? "text-ink" : ""
      } ${className}`}
      style={{
        backgroundColor: neutral ? "transparent" : `${belt.hex}22`,
        ...(neutral ? null : { color: belt.hex }),
        border: `1px solid ${belt.borderHex}${neutral ? "" : "55"}`,
      }}
    >
      {drawBelt ? (
        <BeltMark belt={belt.key} degree={r.degree} size={MARK_WIDTH[size]} className="shrink-0" />
      ) : (
        <span
          className={`rounded-full shrink-0 ${SWATCH[size]}`}
          style={{ backgroundColor: belt.hex, border: `1px solid ${belt.borderHex}` }}
        />
      )}
      {r.short}
    </span>
  );
}

export default BeltBadge;
