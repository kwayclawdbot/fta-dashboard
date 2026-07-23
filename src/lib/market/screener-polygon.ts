/**
 * Server-only Polygon helpers for the screener cron (LANE 6). Kept separate
 * from src/lib/market/polygon.ts (which powers per-symbol UI proxies) so the two
 * lanes never collide — this file is additive and cron-only.
 *
 * The API key lives in POLYGON_API_KEY and never leaves the server. The screener
 * design is rate-limit-frugal by construction:
 *   - grouped-daily = ONE call returns EVERY US ticker's OHLCV for a day.
 *   - ticker-details (mcap/name/sector) is fetched only for the liquidity-
 *     filtered candidate set, paced politely, and cached in screener_metrics.
 */

const BASE = "https://api.polygon.io";

function apiKey(): string | null {
  return process.env.POLYGON_API_KEY?.trim() || null;
}

export function screenerConfigured(): boolean {
  return !!apiKey();
}

/** One grouped-daily bar: T=ticker, o/h/l/c prices, v volume. */
export interface GroupedBar {
  T: string;
  o: number;
  c: number;
  v: number;
}

async function getJson<T>(path: string): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apiKey=${key}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429) return null; // rate-limited → caller paces/retries
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The last `count` weekday dates ending at `end` (inclusive), NEWEST → OLDEST.
 * Weekends are skipped; market holidays simply return an empty grouped-daily,
 * which the caller drops. `count` should over-provision (calendar ≠ trading).
 */
export function recentWeekdays(count: number, end = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(end);
  while (out.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(ymd(d));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

/**
 * Grouped daily bars for a whole market day. adjusted=true for split-adjusted
 * closes. Returns [] on a holiday/empty day, null only on a hard fetch failure.
 */
export async function getGroupedDaily(date: string): Promise<GroupedBar[] | null> {
  const data = await getJson<{
    resultsCount?: number;
    results?: { T: string; o: number; c: number; v: number }[];
  }>(`/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true`);
  if (!data) return null;
  const rows = data.results || [];
  return rows.map((r) => ({ T: r.T, o: r.o, c: r.c, v: r.v }));
}

/** One row of the reference-tickers list (cheap, paginated — no mcap). */
export interface ReferenceTicker {
  ticker: string;
  name: string | null;
  primaryExchange: string | null; // MIC, e.g. 'XNYS' | 'XNAS' | 'XASE' | 'ARCX' | 'BATS'
  type: string | null; // 'CS' | 'ETF' | 'ADRC' | …
}

/**
 * Fetch the FULL active US-stock reference list (name / exchange / type for every
 * ticker), following `next_url` pagination. ~13 pages of 1000; a handful of calls.
 * This is how the cron classifies the universe and discovers new listings — it
 * does NOT return market cap (that needs the per-ticker details call).
 */
export async function getAllReferenceTickers(
  maxPages = 20
): Promise<ReferenceTicker[]> {
  const key = apiKey();
  if (!key) return [];
  const out: ReferenceTicker[] = [];
  let url:
    | string
    | null = `${BASE}/v3/reference/tickers?market=stocks&active=true&limit=1000`;
  let pages = 0;
  while (url && pages < maxPages) {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}apiKey=${key}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (!res) break;
    if (res.status === 429) {
      await sleep(1500);
      continue;
    }
    if (!res.ok) break;
    const data = (await res.json()) as {
      results?: {
        ticker: string;
        name?: string;
        primary_exchange?: string;
        type?: string;
      }[];
      next_url?: string;
    };
    for (const r of data.results || []) {
      out.push({
        ticker: r.ticker,
        name: r.name ?? null,
        primaryExchange: r.primary_exchange ?? null,
        type: r.type ?? null,
      });
    }
    pages++;
    url = data.next_url ?? null;
    await sleep(60);
  }
  return out;
}

export interface TickerDetail {
  ticker: string;
  name: string | null;
  marketCap: number | null;
  sector: string | null;
}

/** Single-ticker details: market cap + name + sector (sic_description). */
export async function getTickerDetail(ticker: string): Promise<TickerDetail | null> {
  const data = await getJson<{
    results?: {
      ticker: string;
      name?: string;
      market_cap?: number;
      sic_description?: string;
    };
  }>(`/v3/reference/tickers/${ticker}`);
  const r = data?.results;
  if (!r) return null;
  return {
    ticker: r.ticker,
    name: r.name ?? null,
    marketCap: r.market_cap ?? null,
    sector: r.sic_description ?? null,
  };
}

/** Small sleep for polite pacing between detail-call batches. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
