/**
 * ONE shared exchange-label formatter (Lane: ticker/search fixes).
 *
 * Two kinds of raw values reach the UI and must never be shown as-is:
 *   • Polygon MIC codes stored on research_fundamentals.exchange
 *     (XNAS / XNYS / ARCX / BATS / XASE / OTCM …) — the research masthead.
 *   • The screener's own upper-case friendly names (NASDAQ / AMEX …) which we
 *     also normalise to a single canonical casing so every surface reads alike.
 *
 * Canonical display names (owner-specified):
 *   XNAS → Nasdaq   XNYS → NYSE   ARCX → NYSE Arca   BATS → Cboe
 *   XASE → NYSE American   OTCM → OTC
 *
 * The data itself is CORRECT (JPM really is XNYS = NYSE); this is a pure display
 * mapping, applied at every user-facing edge so no raw MIC ever leaks.
 */

const CANONICAL: Record<string, string> = {
  // Polygon MICs
  XNAS: "Nasdaq",
  XNYS: "NYSE",
  ARCX: "NYSE Arca",
  BATS: "Cboe",
  XASE: "NYSE American",
  OTCM: "OTC",
  XOTC: "OTC",
  // Screener friendly names (upper-case) → canonical casing
  NASDAQ: "Nasdaq",
  NYSE: "NYSE",
  AMEX: "NYSE American",
  "NYSE ARCA": "NYSE Arca",
  CBOE: "Cboe",
  OTC: "OTC",
};

/**
 * Map any raw exchange value (MIC or friendly name, any casing) to its canonical
 * user-facing label. Unknown / null values return the trimmed input (so a stray
 * code is at least tidy) or null.
 */
export function formatExchange(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase();
  return CANONICAL[key] ?? raw.trim();
}
