/**
 * Belt — the drawn belt object.
 *
 * The rank ladder used to render as a coloured lozenge with a ⊖ glyph in it,
 * which is a CHIP, not an object: nothing about it said "belt", and the Black
 * belt disappeared entirely on the dark page. This is the drawn replacement,
 * built to the illustration brief that governs every mark in src/components/art:
 *
 *   · ONE line weight (2px, non-scaling) — no hairlines, no tapering
 *   · ONE flat fill per object — no gradients, no shadows, no texture
 *   · slight top-down view: the band arcs away at both ends, the tails fall
 *     forward and to the right, so the belt reads as tied and worn rather than
 *     laid flat like a sticker
 *   · degree notches stitched across the front tail (Blue II gets two)
 *   · locked = the same drawing with no fill and the line at 40%
 *
 * BLACK IS A SPECIAL CASE. Its fill (#1F2430) is very close to the dark page,
 * so the outline alone cannot carry it. Black takes a warm-grey highlight edge
 * (--belt-black-edge) instead of its own border hex, which is what makes the
 * apex belt read as an object on obsidian instead of a hole in the page.
 *
 * Everything is inline SVG with `currentColor` fallbacks and intrinsic belt
 * hexes for the fills (a blue belt is blue in every theme — see lib/belts.ts).
 */
import { BELTS, type BeltKey, type BeltRank } from "@/lib/belts";

/* The warm grey that keeps the Black belt visible on the night page. Not a
   theme token: the belt is intrinsic, so the rescue edge is too. */
const BLACK_EDGE = "#9A9082";

export interface BeltProps {
  /** The belt to draw. Pass `rank` instead to get degree notches for free. */
  belt?: BeltKey;
  /** A resolved rank — supplies both the belt and its degree. */
  rank?: BeltRank;
  /** 1-based degree; draws that many notches on the tail. 1 → no notch. */
  degree?: number;
  /** Rendered width in px. Height follows the 64:44 aspect. */
  size?: number;
  /** Not yet earned: line-only at 40%, no fill. */
  locked?: boolean;
  /** Accessible name. Omit for a decorative mark inside a labelled row. */
  title?: string;
  className?: string;
}

/**
 * A tied belt, drawn once and tinted five ways.
 *
 * Geometry (viewBox 64 × 44):
 *   band  — two wings leaving the knot, each arcing DOWN at the far end so the
 *           belt sits around a body rather than across a table
 *   knot  — the square-ish centre with its single crossing line
 *   tails — two straps falling from under the knot, the near one wider and
 *           carrying the degree notches
 */
export function Belt({
  belt,
  rank,
  degree,
  size = 40,
  locked = false,
  title,
  className = "",
}: BeltProps) {
  const key: BeltKey = rank?.belt.key ?? belt ?? "white";
  const def = BELTS[key];
  const notches = Math.max(0, (degree ?? rank?.degree ?? 1) - 1);

  const stroke = locked ? "currentColor" : key === "black" ? BLACK_EDGE : def.borderHex;
  const fill = locked ? "none" : def.hex;
  const strokeOpacity = locked ? 0.4 : 1;

  // Notch rows down the near tail, spaced so two never crowd the hem.
  const NOTCH_Y = [34, 36.6, 39.2];

  return (
    <svg
      width={size}
      height={Math.round((size * 44) / 64)}
      viewBox="0 0 64 44"
      fill="none"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <g
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      >
        {/* far wing (left) */}
        <path d="M3 17.5C9.5 14.8 16.5 13.5 23 13.5V27.5C16.5 27.5 9.5 28.8 3 31.5Z" fill={fill} />
        {/* far wing (right) */}
        <path d="M61 17.5C54.5 14.8 47.5 13.5 41 13.5V27.5C47.5 27.5 54.5 28.8 61 31.5Z" fill={fill} />
        {/* near tail — the one that carries the degrees */}
        <path d="M27 27.5L24.5 41L31.5 42L33 27.5Z" fill={fill} />
        {/* far tail, falling behind and to the right */}
        <path d="M34.5 27.5L38.5 39.5L44.5 37L39.5 26.5Z" fill={fill} />
        {/* the knot, over both tails */}
        <path
          d="M23.5 12.5H40.5C41.6 12.5 42.5 13.4 42.5 14.5V26.5C42.5 27.6 41.6 28.5 40.5 28.5H23.5C22.4 28.5 21.5 27.6 21.5 26.5V14.5C21.5 13.4 22.4 12.5 23.5 12.5Z"
          fill={fill}
        />
        {/* the crossing — what makes the knot a knot and not a buckle */}
        <path d="M27.5 12.8L36.5 28.2" />
        {/* degree notches, stitched across the near tail */}
        {NOTCH_Y.slice(0, notches).map((y) => {
          const t = (y - 27.5) / 14.5;
          return (
            <path
              key={y}
              d={`M${(27 - 2.5 * t + 1.1).toFixed(2)} ${y}L${(33 - 1.5 * t - 1.1).toFixed(2)} ${(y + 0.4).toFixed(2)}`}
            />
          );
        })}
      </g>
    </svg>
  );
}

/**
 * The belt drawn small, beside a word — the inline replacement for the ⊖
 * lozenge in ladders, leaderboards and rows. Below ~22px the notches stop
 * resolving, so they are dropped rather than drawn as mush.
 */
export function BeltMark({
  size = 22,
  ...props
}: BeltProps) {
  return <Belt {...props} size={size} degree={size < 24 ? 1 : props.degree} />;
}

export default Belt;
