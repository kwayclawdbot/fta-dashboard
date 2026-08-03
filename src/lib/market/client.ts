/**
 * Client-side helpers for the /api/market/* routes. These never touch the
 * Polygon key (it lives only on the server) — they just fetch our own cached
 * proxy routes and shape the JSON. Every call fails soft (returns null / []),
 * so the UI degrades to static content instead of showing broken boxes.
 */

export interface MarketQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  prevClose: number | null;
  updated: number | null;
  delayed: boolean;
  /**
   * TRUE when the session had no print and `price` is the previous close
   * standing in for the mark (weekends, evenings, pre-market before the first
   * trade). The number is real, it just isn't today's. Optional so older
   * cached payloads still typecheck.
   */
  stale?: boolean;
}

export interface MarketCompany {
  symbol: string;
  name: string | null;
  description: string | null;
  marketCap: number | null;
  marketCapText: string | null;
  homepage: string | null;
  primaryExchange: string | null;
  sector: string | null;
  logoUrl: string | null;
}

export interface MarketBar {
  t: number;
  c: number;
}

export interface TickerHit {
  ticker: string;
  name: string;
  /** Canonical exchange label ("Nasdaq") — present from the suggest route. */
  exchange?: string | null;
  /** 'common' | 'etf' — lets suggest UIs badge ETFs. */
  type?: string | null;
}

/** Client-safe mirror of the server FinancialPeriod (Kai report charts). */
export interface FinancialPeriod {
  label: string;
  revenue: number | null;
  netIncome: number | null;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** One live-ish (delayed ~15m) quote. */
export async function fetchQuote(
  symbol: string,
  signal?: AbortSignal
): Promise<MarketQuote | null> {
  const d = await getJson<{ quote: MarketQuote }>(
    `/api/market/quote?symbol=${encodeURIComponent(symbol)}`,
    signal
  );
  return d?.quote ?? null;
}

/** Batch quotes — one request for a whole watchlist board. */
export async function fetchQuotes(
  symbols: string[],
  signal?: AbortSignal
): Promise<Record<string, MarketQuote>> {
  if (symbols.length === 0) return {};
  const d = await getJson<{ quotes: Record<string, MarketQuote> }>(
    `/api/market/quote?symbols=${encodeURIComponent(symbols.join(","))}`,
    signal
  );
  return d?.quotes ?? {};
}

/** Company profile (+ optional bundled quote). */
export async function fetchCompany(
  symbol: string,
  withQuote = false,
  signal?: AbortSignal
): Promise<{ company: MarketCompany; quote?: MarketQuote | null } | null> {
  const d = await getJson<{ company: MarketCompany; quote?: MarketQuote | null }>(
    `/api/market/company?symbol=${encodeURIComponent(symbol)}${withQuote ? "&quote=1" : ""}`,
    signal
  );
  return d ?? null;
}

/** Daily closing bars for a sparkline. */
export async function fetchBars(
  symbol: string,
  range = "3m",
  signal?: AbortSignal
): Promise<MarketBar[]> {
  const d = await getJson<{ bars: MarketBar[] }>(
    `/api/market/bars?symbol=${encodeURIComponent(symbol)}&range=${range}`,
    signal
  );
  return d?.bars ?? [];
}

export interface NewsHeadline {
  title: string;
  url: string;
  publisher: string | null;
  published: string | null;
  description: string | null;
}

/** Recent third-party headlines (attribution-only link cards). */
export async function fetchNews(
  symbol: string,
  limit = 6,
  signal?: AbortSignal
): Promise<NewsHeadline[]> {
  const d = await getJson<{ news: NewsHeadline[] }>(
    `/api/market/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`,
    signal
  );
  return d?.news ?? [];
}

/** Ticker lookup/validation for the add-flow. */
export async function searchTickers(
  q: string,
  signal?: AbortSignal
): Promise<TickerHit[]> {
  if (q.trim().length < 1) return [];
  const d = await getJson<{ results: TickerHit[] }>(
    `/api/market/search?q=${encodeURIComponent(q)}`,
    signal
  );
  return d?.results ?? [];
}

/* ---------- formatting helpers (shared by every price surface) ---------- */

export function formatPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatChangePct(v: number | null | undefined): string {
  if (v == null) return "";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

/** Market-semantic direction color (locked green-team / red-team). */
export function changeTone(
  v: number | null | undefined
): "up" | "down" | "flat" {
  if (v == null || v === 0) return "flat";
  return v > 0 ? "up" : "down";
}
