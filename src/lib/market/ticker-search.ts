/**
 * Ticker suggest — ranking + dedupe over the clean screener universe.
 *
 * WHY THIS EXISTS
 * The old suggest hit Polygon's fuzzy reference search (`?search=`), which ranks
 * by its own opaque relevance and returns the raw firehose: warrants, units,
 * OTC shells and foreign cross-listings all match "TSLA"/"TESLA", and with an
 * 8-row cap the real Tesla common stock was routinely buried — or absent. It
 * also carried no exchange / type / market-cap signal to rank by.
 *
 * The fix ranks against `screener_metrics`, which is ALREADY the clean universe:
 * only common stock (CS/ADRC) + labelled ETFs on NYSE / Nasdaq / AMEX / Arca /
 * Cboe — warrants, units, preferreds, rights and OTC are excluded at ingestion,
 * one row per primary listing (so cross-listings can't duplicate). Ranking is
 * deterministic and pure, so it's unit-testable (see ticker-search.test.ts, the
 * 20-major regression) and identical on every search bar that hits the route.
 *
 * RANK ORDER (best first):
 *   0  exact ticker match            ("TSLA" → TSLA)
 *   1  ticker prefix match           ("TS"   → TSLA, TSM, …)
 *   2  company-name word-start match ("app"  → Apple, Applied Materials)
 *   3  company-name substring match  ("pple" → Apple)
 * Within a tier: common stock before ETF, then market cap desc (null last),
 * then ticker A-Z. Result: majors surface first, obscure listings sink.
 */

/** A candidate row pulled from screener_metrics for ranking. */
export interface SearchCandidate {
  ticker: string;
  name: string | null;
  exchange: string | null; // friendly ("NASDAQ") — normalised on output
  type: string | null; // 'common' | 'etf'
  mcap: number | null;
}

/**
 * The shaped suggestion. `exchange` is the raw friendly value from the row; the
 * route canonicalises it through formatExchange() at the edge (keeps this module
 * pure / dependency-free so the ranking stays trivially unit-testable).
 */
export interface RankedHit {
  ticker: string;
  name: string;
  exchange: string | null;
  type: string | null;
}

const WORD_START = /[^a-z0-9]/i;

function nameTier(name: string, q: string): number {
  const lname = name.toLowerCase();
  if (!lname.includes(q)) return 4; // no name match at all
  // Word-start match (start of string OR after a non-alphanumeric boundary).
  if (lname.startsWith(q)) return 2;
  const idx = lname.indexOf(q);
  if (idx > 0 && WORD_START.test(lname[idx - 1])) return 2;
  return 3; // mid-word substring
}

/** Rank tier for one candidate against an upper-cased query. Lower = better. */
function tierOf(c: SearchCandidate, qUpper: string): number {
  const t = c.ticker.toUpperCase();
  if (t === qUpper) return 0;
  if (t.startsWith(qUpper)) return 1;
  return c.name ? nameTier(c.name, qUpper.toLowerCase()) : 4;
}

/**
 * Rank + dedupe candidates for a query, returning up to `limit` shaped hits.
 * Candidates are assumed to already be the ticker/name matches for the query
 * (the caller filters at the DB layer); this imposes the priority order.
 */
export function rankTickerHits(
  candidates: SearchCandidate[],
  query: string,
  limit = 8
): RankedHit[] {
  const qUpper = query.trim().toUpperCase();
  if (!qUpper) return [];

  // Dedupe by ticker (defensive — the source is already one row per ticker).
  const seen = new Set<string>();
  const scored = candidates
    .filter((c) => {
      if (seen.has(c.ticker)) return false;
      seen.add(c.ticker);
      return true;
    })
    .map((c) => ({ c, tier: tierOf(c, qUpper) }))
    .filter((x) => x.tier < 4); // drop non-matches

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    // common (0) before etf (1) before unknown (2)
    const ra = a.c.type === "common" ? 0 : a.c.type === "etf" ? 1 : 2;
    const rb = b.c.type === "common" ? 0 : b.c.type === "etf" ? 1 : 2;
    if (ra !== rb) return ra - rb;
    const ma = a.c.mcap ?? -1;
    const mb = b.c.mcap ?? -1;
    if (ma !== mb) return mb - ma; // market cap desc, null last
    return a.c.ticker.localeCompare(b.c.ticker);
  });

  return scored.slice(0, limit).map(({ c }) => ({
    ticker: c.ticker,
    name: c.name ?? c.ticker,
    exchange: c.exchange,
    type: c.type,
  }));
}
