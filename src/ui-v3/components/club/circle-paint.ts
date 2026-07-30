import { tickerGlyph, tickerPaint, type TickerPaint } from "@/ui-v3/ticker-palette";

/**
 * The paint and glyph for a Circle's 96px disc.
 *
 * A Circle WITH a ticker is drawn in that issuer's mockup-derived brand pair —
 * the artboards' NVDA disc is #101408/#76B900 and its Tesla disc is
 * #1A0E10/#E82127, i.e. exactly the ticker-tile palette, theme-literal in both
 * twins.
 *
 * A Circle WITHOUT a ticker is a different case from "a ticker we have no brand
 * for": there is no issuer at all. The artboards fill those discs with a tinted
 * ground and an emoji, and no emoji column exists — so the disc takes the
 * artboards' own neutral filled-disc ground, `--surface-2` over `--text-muted`
 * (the same pair every initials disc uses), and shows the topic's initial.
 *
 * `--surface-2` rather than ticker-palette's NEUTRAL (`--surface`/`--text-muted`)
 * because at 96px in the light twin `--surface` is #FFFFFF, which reads as a
 * blank hole rather than a filled object.
 */
const NO_ISSUER: TickerPaint = { bg: "var(--surface-2)", fg: "var(--text-muted)" };

export function circlePaint(ticker: string | null): TickerPaint {
  return ticker ? tickerPaint(ticker) : NO_ISSUER;
}

export function circleGlyph(ticker: string | null, topic: string): string {
  return ticker ? tickerGlyph(ticker) : topic.trim().charAt(0).toUpperCase();
}
