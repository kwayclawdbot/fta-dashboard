/**
 * Belt colour, as the ARTBOARDS draw it.
 *
 * Board "22 Belts" paints each belt ring/bar with a colour that is already a v3
 * semantic role in both themes — verified against the light twin, which flips
 * every one of them except Blue and Purple (those are theme-literal in the
 * mockups, and tokens.css emits no light override for --info/--violet either):
 *
 *   White  #F4F0EC / #1A1614  →  --text
 *   Yellow #FFC24B / #D99A00  →  --gold
 *   Green  #4AE383 / #0BA05A  →  --positive
 *   Blue   #3D8BFF / #3D8BFF  →  --info
 *   Purple #A66BFF / #A66BFF  →  --violet
 *   Black  #F4F0EC / #1A1614  →  --text  (the ★ badge is what separates it)
 *
 * NOTE — this is NOT `BELTS[key].hex` from src/lib/belts.ts. That module carries
 * the OLD app's belt hexes (#E8EAF0 / #E39A2B / #3B82F6 / #8B5CF6 / #1F2430),
 * which are a different palette and are declared theme-independent. The artboard
 * is the visual source of truth in ui-v3, so the tone comes from here and the
 * belt IDENTITY (which belt, which order) comes from src/lib/belts.ts.
 */

export type BeltTone = "white" | "yellow" | "green" | "blue" | "purple" | "black";

const TONE_VAR: Record<BeltTone, string> = {
  white: "var(--text)",
  yellow: "var(--gold)",
  green: "var(--positive)",
  blue: "var(--info)",
  purple: "var(--violet)",
  black: "var(--text)",
};

/** The CSS colour expression for a belt's ring, bar, swatch and chip. */
export function beltToneVar(tone: BeltTone): string {
  return TONE_VAR[tone];
}

/**
 * Text colour that sits ON a filled belt chip. Board 22 draws three:
 * Blue → #fff in BOTH themes (literal), Yellow → --accent-on, Black → --bg.
 * White and Green are never drawn as filled chips, so they follow Yellow.
 */
export function beltChipInkVar(tone: BeltTone): string {
  if (tone === "blue" || tone === "purple") return "#fff";
  if (tone === "black" || tone === "white") return "var(--bg)";
  return "var(--accent-on)";
}
