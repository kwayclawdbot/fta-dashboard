/**
 * THE MOVE — one formatter for "a price changed by this much".
 *
 * Three surfaces each wrote their own version of `up ? "▲" : "▼"` plus
 * `Math.abs(pct).toFixed(1)`, and all three inherited the same defect: a move
 * of -0.02% is not >= 0, so it takes the DOWN branch, and 0.02 rounded to one
 * decimal is 0.0. The screen then reads "▼0.0%" — a down arrow on a number that
 * says nothing moved, which is the one thing a price display must never do.
 *
 * The fix is a FLAT band, not a rounding tweak: any move that rounds to zero at
 * the precision being shown IS flat at that precision, and flat gets no arrow,
 * no sign and no price colour. Below the band the number is honest and the
 * glyph is honest together.
 */

export type MoveTone = "up" | "down" | "flat";

/** Anything that rounds to 0.0% at one decimal. */
const FLAT_BAND = 0.05;

export function moveTone(pct: number | null | undefined): MoveTone {
  if (pct == null || !Number.isFinite(pct) || Math.abs(pct) < FLAT_BAND) return "flat";
  return pct > 0 ? "up" : "down";
}

/** ▲ / ▼ / nothing. Decorative — always pair with a real text label for AT. */
export function moveGlyph(pct: number | null | undefined): string {
  const tone = moveTone(pct);
  return tone === "up" ? "▲" : tone === "down" ? "▼" : "";
}

/** Tailwind text class for the move. Flat is NEVER a price colour. */
export function moveToneClass(pct: number | null | undefined): string {
  const tone = moveTone(pct);
  return tone === "up"
    ? "text-price-up"
    : tone === "down"
      ? "text-price-down"
      : "text-soft";
}

/** "1.4%" — magnitude only, for use beside `moveGlyph`. Flat prints "0.0%". */
export function moveMagnitude(
  pct: number | null | undefined,
  digits = 1
): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${Math.abs(pct).toFixed(digits)}%`;
}

/** "▲1.4%" / "▼0.8%" / "0.0%" — the whole thing, glyph included. */
export function formatMove(pct: number | null | undefined, digits = 1): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${moveGlyph(pct)}${moveMagnitude(pct, digits)}`;
}
