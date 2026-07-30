import type { BeltKey } from "@/lib/belts";

/**
 * Belt paint — read out of the Club artboards, not invented.
 *
 * The artboards draw a member's belt in two places, and only for some belts:
 *
 *   "04 Club Feed"     the belt chip beside a name.
 *                      Black Belt → bg #F4F0EC / text #0D0B0E   (light: #1A1614 / #F7F4EF)
 *                        → that pair IS var(--text) / var(--bg) in both themes.
 *                      Blue Belt  → bg #3D5AFE / text #FFFFFF   (identical in the light twin)
 *                        → theme-literal, so it is hard-coded here, exactly as
 *                          src/ui-v3/ticker-palette.ts hard-codes issuer brand pairs.
 *
 *   "23 Inside Circle" the ring around a note author's avatar.
 *                      #F4F0EC (= --text)  #3D8BFF (= --info)  #FFC24B (= --gold)
 *
 * Cross-referencing the two: the black belt's chip ground and its ring are the
 * same colour (--text), and the blue belt's ring is the semantic --info. So the
 * ring IS the belt colour. On that rule:
 *
 *   black  → --text     (artboard: chip ground AND ring)
 *   blue   → --info     (artboard: ring)
 *   yellow → --gold     (artboard: ring)
 *   purple → --violet   (NOT drawn by any artboard; --violet is the semantic role
 *                        the extractor derived from the mockups, so it is the only
 *                        non-inventing choice available)
 *   white  → --text-muted (NOT drawn; the neutral end of the artboards' text ramp)
 *
 * The artboard's fourth ring, #4AE383 (--positive), belongs to no belt — the
 * ladder is white/yellow/blue/purple/black — so it is deliberately unassigned.
 * The green ring is the one unexplained value in this region and is flagged.
 */

export interface BeltPaint {
  /** Chip ground. */
  bg: string;
  /** Chip text. */
  fg: string;
  /** Avatar ring, and the note author's name. */
  ring: string;
}

const PAINT: Record<BeltKey, BeltPaint> = {
  white: { bg: "var(--surface-2)", fg: "var(--text)", ring: "var(--text-muted)" },
  yellow: { bg: "var(--gold)", fg: "var(--accent-on)", ring: "var(--gold)" },
  // Theme-literal: the light artboard keeps #3D5AFE / #FFFFFF unchanged.
  blue: { bg: "#3D5AFE", fg: "#FFFFFF", ring: "var(--info)" },
  purple: { bg: "var(--violet)", fg: "var(--accent-on)", ring: "var(--violet)" },
  black: { bg: "var(--text)", fg: "var(--bg)", ring: "var(--text)" },
};

/** Paint for a belt. */
export function beltPaint(key: BeltKey): BeltPaint {
  return PAINT[key];
}
