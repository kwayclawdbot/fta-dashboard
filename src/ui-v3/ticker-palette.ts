/**
 * Ticker tile palette — read out of the mockup artboards, not invented.
 *
 * Every ticker tile in the mockups is a rounded square painted in the issuer's
 * own brand pair (a very dark ground + the brand hue as the letter). Those two
 * hexes are THEME-LITERAL: the light artboards keep the identical values, which
 * is why they are hard-coded here instead of being routed through a token.
 *
 * The one exception is AAPL, which the artboards paint with the semantic
 * surface/text-muted pair in both themes — i.e. "no brand color" is itself a
 * documented state. That is the NEUTRAL entry below, and it is also the
 * fallback for any ticker the mockups never drew.
 *
 * Sourced from `.planning/design-project-v2/mockups/Cheat Code App.dc.html`
 * (cross-checked against the Light twin).
 */

export interface TickerPaint {
  /** Tile ground. */
  bg: string;
  /** The letter. */
  fg: string;
}

/** The artboards' "unbranded ticker" pair — semantic, so it flips with theme. */
const NEUTRAL: TickerPaint = { bg: "var(--surface)", fg: "var(--text-muted)" };

const BRAND: Record<string, TickerPaint> = {
  NVDA: { bg: "#101408", fg: "#76B900" },
  TSLA: { bg: "#1A0E10", fg: "#E82127" },
  PLTR: { bg: "#0E1216", fg: "#3D8BFF" },
  SMCI: { bg: "#0E1216", fg: "#3D8BFF" },
  AMD: { bg: "#140E14", fg: "#ED1C24" },
  AMZN: { bg: "#141208", fg: "#FF9900" },
  NFLX: { bg: "#1A0E10", fg: "#E50914" },
  AAPL: NEUTRAL,
};

/**
 * Paint for a ticker tile. Unknown tickers get the artboards' neutral pair —
 * we never synthesise a brand color for a name the design never drew.
 */
export function tickerPaint(ticker: string): TickerPaint {
  return BRAND[ticker.toUpperCase()] ?? NEUTRAL;
}

/** The glyph the artboards put in the tile: the ticker's first letter. */
export function tickerGlyph(ticker: string): string {
  return ticker.trim().charAt(0).toUpperCase();
}
