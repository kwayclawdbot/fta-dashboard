/**
 * Server-only Polygon.io client for the FIC live-market layer.
 *
 * The API key lives in POLYGON_API_KEY and NEVER reaches the client — every
 * consumer goes through the /api/market/* route handlers, which import this
 * module. Company logos are proxied (bytes streamed) so the branding URL (which
 * requires the key appended) is never exposed either.
 *
 * Entitlements verified against the live key (2026-07-20):
 *   - v2 aggs prev-close                     ✓
 *   - v2 aggs range (daily bars, sparkline)  ✓
 *   - v3 reference tickers/{t} (details)     ✓  name/description/market_cap/branding
 *   - v1 company-branding images (icon/logo) ✓  webp/svg, ~3KB (key appended)
 *   - v3 reference tickers?search=           ✓  ticker lookup/validation
 *   - v2 snapshot single + multi-ticker      ✓  todaysChange(Perc), day, prevDay, lastTrade
 *   - feed status: DELAYED (~15 min)         → labelled "delayed" everywhere
 *
 * Caching is mandatory (a classroom of families must not hammer rate limits):
 * a warm-instance in-memory TTL cache here + Cache-Control s-maxage on the
 * routes (quotes ~60s, company/logo ~24h, bars ~15min).
 */

const BASE = "https://api.polygon.io";

function apiKey(): string | null {
  return process.env.POLYGON_API_KEY || null;
}

/* ---------- warm-instance TTL cache ---------- */

interface CacheEntry {
  value: unknown;
  expires: number;
}
const cache = new Map<string, CacheEntry>();

function getCached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function setCached(key: string, value: unknown, ttlMs: number): void {
  // Soft cap so a long-running instance never leaks unbounded memory.
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

/**
 * Fetch + cache a Polygon JSON endpoint. `path` must already include a leading
 * slash and any query params EXCEPT apiKey (appended here). Returns null on any
 * error so callers degrade gracefully instead of throwing.
 */
async function fetchJson<T>(
  path: string,
  ttlMs: number
): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;

  const cacheKey = `json:${path}`;
  const cached = getCached<T>(cacheKey);
  if (cached !== undefined) return cached;

  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apiKey=${key}`;
  try {
    const res = await fetch(url, {
      // We manage caching ourselves; keep Next's fetch cache out of it.
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    setCached(cacheKey, data, ttlMs);
    return data;
  } catch {
    return null;
  }
}

export function isConfigured(): boolean {
  return !!apiKey();
}

export function normalizeSymbol(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  // Tickers: 1-6 letters, optional dot class (e.g. BRK.B). Reject anything else
  // so a malformed symbol never becomes a Polygon call.
  if (!/^[A-Z]{1,6}(\.[A-Z]{1,2})?$/.test(s)) return null;
  return s;
}

/* ---------- shaped responses (client-safe: no key, no raw firehose) ---------- */

export interface Quote {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  prevClose: number | null;
  updated: number | null; // ms epoch
  delayed: boolean;
}

interface SnapshotTicker {
  ticker: string;
  todaysChange?: number;
  todaysChangePerc?: number;
  updated?: number; // ns epoch
  day?: { c?: number; o?: number };
  prevDay?: { c?: number };
  lastTrade?: { p?: number; t?: number };
  min?: { c?: number };
}

function shapeSnapshot(t: SnapshotTicker): Quote {
  const price =
    t.lastTrade?.p ?? t.min?.c ?? (t.day?.c && t.day.c > 0 ? t.day.c : null);
  const prevClose = t.prevDay?.c ?? null;
  const change = t.todaysChange ?? null;
  const changePercent = t.todaysChangePerc ?? null;
  return {
    symbol: t.ticker,
    price: price ?? null,
    change,
    changePercent,
    prevClose,
    updated: t.updated ? Math.floor(t.updated / 1e6) : null,
    delayed: true, // key feed is DELAYED (~15 min)
  };
}

/** Live-ish quote for one symbol via the snapshot endpoint. */
export async function getQuote(symbol: string): Promise<Quote | null> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return null;
  const data = await fetchJson<{ ticker?: SnapshotTicker; status?: string }>(
    `/v2/snapshot/locale/us/markets/stocks/tickers/${sym}`,
    60_000 // ~60s
  );
  if (!data?.ticker) return null;
  return shapeSnapshot(data.ticker);
}

/** Batch quotes — one Polygon call for many symbols (rate-limit friendly). */
export async function getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const syms = Array.from(
    new Set(symbols.map(normalizeSymbol).filter((s): s is string => !!s))
  );
  const out: Record<string, Quote> = {};
  if (syms.length === 0) return out;
  const data = await fetchJson<{ tickers?: SnapshotTicker[] }>(
    `/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${syms.join(",")}`,
    60_000
  );
  for (const t of data?.tickers || []) out[t.ticker] = shapeSnapshot(t);
  return out;
}

export interface Company {
  symbol: string;
  name: string | null;
  description: string | null;
  marketCap: number | null;
  marketCapText: string | null;
  homepage: string | null;
  primaryExchange: string | null;
  sector: string | null;
  /** City, State — for the Ziggma-style company profile card (research page). */
  address: string | null;
  employees: number | null;
  listDate: string | null; // ISO date the ticker started trading
  hasLogo: boolean;
  hasIcon: boolean;
}

interface TickerDetails {
  results?: {
    ticker: string;
    name?: string;
    description?: string;
    market_cap?: number;
    homepage_url?: string;
    primary_exchange?: string;
    sic_description?: string;
    total_employees?: number;
    list_date?: string;
    address?: { address1?: string; city?: string; state?: string; postal_code?: string };
    branding?: { logo_url?: string; icon_url?: string };
  };
}

function marketCapText(v: number | null | undefined): string | null {
  if (!v || v <= 0) return null;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

async function getTickerDetails(symbol: string): Promise<TickerDetails["results"] | null> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return null;
  const data = await fetchJson<TickerDetails>(
    `/v3/reference/tickers/${sym}`,
    24 * 60 * 60_000 // 24h
  );
  return data?.results ?? null;
}

/** Company profile for Company-of-the-Week + watchlist cards. */
export async function getCompany(symbol: string): Promise<Company | null> {
  const r = await getTickerDetails(symbol);
  if (!r) return null;
  return {
    symbol: r.ticker,
    name: r.name ?? null,
    description: r.description ?? null,
    marketCap: r.market_cap ?? null,
    marketCapText: marketCapText(r.market_cap),
    homepage: r.homepage_url ?? null,
    primaryExchange: r.primary_exchange ?? null,
    sector: r.sic_description ?? null,
    address:
      r.address?.city && r.address?.state
        ? `${r.address.city}, ${r.address.state}`
        : (r.address?.city ?? r.address?.state ?? null),
    employees: r.total_employees ?? null,
    listDate: r.list_date ?? null,
    hasLogo: !!r.branding?.logo_url,
    hasIcon: !!r.branding?.icon_url,
  };
}

export interface LogoImage {
  bytes: ArrayBuffer;
  contentType: string;
}

/**
 * Fetch a company's branding image bytes (icon by default — square, ~3KB).
 * The branding URL requires the API key appended; we fetch server-side and hand
 * back raw bytes so the /api/market/logo route can stream them, key-free.
 */
export async function getLogoImage(
  symbol: string,
  kind: "icon" | "logo" = "icon"
): Promise<LogoImage | null> {
  const key = apiKey();
  if (!key) return null;
  const r = await getTickerDetails(symbol);
  const url = kind === "logo" ? r?.branding?.logo_url : r?.branding?.icon_url;
  const fallback = kind === "logo" ? r?.branding?.icon_url : r?.branding?.logo_url;
  const chosen = url || fallback;
  if (!chosen) return null;

  const cacheKey = `logo:${chosen}`;
  const cached = getCached<LogoImage>(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(`${chosen}?apiKey=${key}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const bytes = await res.arrayBuffer();
    const img: LogoImage = { bytes, contentType };
    setCached(cacheKey, img, 24 * 60 * 60_000);
    return img;
  } catch {
    return null;
  }
}

export interface Bar {
  t: number; // ms epoch
  c: number; // close
}

/** Daily closing bars for a lightweight local sparkline (kills the TV iframe). */
export async function getBars(
  symbol: string,
  days = 90
): Promise<Bar[] | null> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return null;
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const data = await fetchJson<{
    results?: { t: number; c: number }[];
    status?: string;
  }>(
    `/v2/aggs/ticker/${sym}/range/1/day/${fmt(start)}/${fmt(end)}?adjusted=true&sort=asc&limit=200`,
    15 * 60_000 // 15 min
  );
  if (!data?.results) return null;
  return data.results.map((b) => ({ t: b.t, c: b.c }));
}

export interface OHLCBar {
  t: number; // ms epoch (bar start)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/**
 * Intraday (and daily) OHLCV aggregates for the Simbot Live Market engine.
 *
 * Empirically verified against the live key (2026-07-23): the plan serves
 * 1/5/15-minute, 1-hour and 1-day aggregates, all flagged DELAYED (~15 min),
 * including pre/post extended-hours bars. This is the real-data feed that drives
 * Simbot's actual candlestick engine in Live mode.
 *
 * Each timeframe has its own lookback window, bar cap and cache TTL — intraday
 * refreshes every 30-60s (a new bar only closes that often anyway), daily is
 * cached ~15 min. `getBars` (daily close-only sparkline) is intentionally left
 * untouched so existing screener/watchlist/research consumers are unaffected.
 */
export type Timeframe = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1w";

interface TfSpec {
  multiplier: number;
  timespan: "minute" | "hour" | "day" | "week";
  lookbackDays: number; // calendar days of history to request
  ttlMs: number; // server cache TTL
  maxBars: number; // trim to the most-recent N bars (payload cap)
}

const TF_SPECS: Record<Timeframe, TfSpec> = {
  "1m": { multiplier: 1, timespan: "minute", lookbackDays: 3, ttlMs: 30_000, maxBars: 800 },
  "3m": { multiplier: 3, timespan: "minute", lookbackDays: 6, ttlMs: 45_000, maxBars: 800 },
  "5m": { multiplier: 5, timespan: "minute", lookbackDays: 12, ttlMs: 45_000, maxBars: 800 },
  "15m": { multiplier: 15, timespan: "minute", lookbackDays: 40, ttlMs: 60_000, maxBars: 800 },
  "30m": { multiplier: 30, timespan: "minute", lookbackDays: 90, ttlMs: 60_000, maxBars: 800 },
  "1h": { multiplier: 1, timespan: "hour", lookbackDays: 180, ttlMs: 60_000, maxBars: 800 },
  "1d": { multiplier: 1, timespan: "day", lookbackDays: 500, ttlMs: 15 * 60_000, maxBars: 800 },
  "1w": { multiplier: 1, timespan: "week", lookbackDays: 2000, ttlMs: 30 * 60_000, maxBars: 800 },
};

export function isIntradayTimeframe(tf: string): tf is Timeframe {
  return tf in TF_SPECS;
}

/** The TTL a given timeframe is cached at — used to set the route's Cache-Control. */
export function tfCacheSeconds(tf: string): number {
  const spec = TF_SPECS[tf as Timeframe];
  return spec ? Math.round(spec.ttlMs / 1000) : 60;
}

/** Real OHLCV aggregates for one symbol at one timeframe (delayed ~15 min). */
export async function getOHLCBars(
  symbol: string,
  tf: string
): Promise<OHLCBar[] | null> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return null;
  const spec = TF_SPECS[tf as Timeframe];
  if (!spec) return null;

  const end = new Date();
  const start = new Date(end.getTime() - spec.lookbackDays * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const data = await fetchJson<{
    results?: { t: number; o: number; h: number; l: number; c: number; v: number }[];
    status?: string;
  }>(
    `/v2/aggs/ticker/${sym}/range/${spec.multiplier}/${spec.timespan}/${fmt(
      start
    )}/${fmt(end)}?adjusted=true&sort=asc&limit=50000`,
    spec.ttlMs
  );
  if (!data?.results || data.results.length === 0) return null;
  const bars = data.results.map((b) => ({
    t: b.t,
    o: b.o,
    h: b.h,
    l: b.l,
    c: b.c,
    v: b.v,
  }));
  // Keep only the most-recent maxBars to bound the payload.
  return bars.length > spec.maxBars ? bars.slice(-spec.maxBars) : bars;
}

export type MarketState =
  | "open"
  | "closed"
  | "extended-hours"
  | "pre-market"
  | "unknown";

/** US equities market state (for honest "market closed — last session" labels). */
export async function getMarketState(): Promise<MarketState> {
  const data = await fetchJson<{
    market?: string;
    exchanges?: { nasdaq?: string; nyse?: string };
  }>(`/v1/marketstatus/now`, 60_000);
  if (!data) return "unknown";
  const m = data.market || data.exchanges?.nasdaq;
  if (m === "open") return "open";
  if (m === "extended-hours") return "extended-hours";
  if (m === "closed") return "closed";
  if (m && /pre/i.test(m)) return "pre-market";
  return m ? "unknown" : "closed";
}

export interface FinancialPeriod {
  label: string;        // e.g. "Q3 2024"
  revenue: number | null;
  netIncome: number | null;
}

interface FinancialsResult {
  results?: {
    fiscal_period?: string;
    fiscal_year?: string;
    financials?: {
      income_statement?: {
        revenues?: { value?: number };
        net_income_loss?: { value?: number };
      };
    };
  }[];
}

/**
 * Quarterly income-statement highlights (revenue, net income) for the "The
 * Numbers" report chart. Degrades to null if the key isn't entitled for the
 * financials endpoint — the report renders the price chart only in that case.
 */
export async function getFinancials(
  symbol: string,
  limit = 8
): Promise<FinancialPeriod[] | null> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return null;
  const data = await fetchJson<FinancialsResult>(
    `/vX/reference/financials?ticker=${sym}&timeframe=quarterly&order=desc&sort=period_of_report_date&limit=${limit}`,
    24 * 60 * 60_000
  );
  if (!data?.results || data.results.length === 0) return null;
  const periods: FinancialPeriod[] = data.results.map((r) => ({
    label:
      r.fiscal_period && r.fiscal_year
        ? `${r.fiscal_period} ${r.fiscal_year}`
        : "",
    revenue: r.financials?.income_statement?.revenues?.value ?? null,
    netIncome: r.financials?.income_statement?.net_income_loss?.value ?? null,
  }));
  // Oldest → newest for a left-to-right time axis.
  periods.reverse();
  // Keep only periods that carry at least a revenue figure.
  const usable = periods.filter((p) => p.revenue != null && p.label);
  return usable.length >= 2 ? usable : null;
}

/* ---------- robust fundamentals (research page — Lane 9) ---------- */

/** One reported period's standardized statement highlights. */
export interface FundQuarter {
  label: string;                 // "Q3 2024"
  endDate: string | null;        // period_of_report_date
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;            // diluted preferred, basic fallback
  assets: number | null;
  currentAssets: number | null;
  liabilities: number | null;
  currentLiabilities: number | null;
  equity: number | null;
  opCashFlow: number | null;
}

export interface FundAnnual {
  label: string;                 // "2024"
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
}

export interface DividendItem {
  exDate: string | null;
  cashAmount: number | null;
}

export interface Fundamentals {
  quarterly: FundQuarter[];      // oldest → newest, up to 8
  annual: FundAnnual[];          // oldest → newest, up to 5
  dividends: DividendItem[];     // newest → oldest, up to 16
}

interface RawStatementVal {
  value?: number;
}
interface RawFinancialResult {
  fiscal_period?: string;
  fiscal_year?: string;
  period_of_report_date?: string;
  financials?: {
    income_statement?: Record<string, RawStatementVal>;
    balance_sheet?: Record<string, RawStatementVal>;
    cash_flow_statement?: Record<string, RawStatementVal>;
  };
}

const num = (v: RawStatementVal | undefined): number | null =>
  typeof v?.value === "number" && Number.isFinite(v.value) ? v.value : null;

function parseQuarter(r: RawFinancialResult): FundQuarter {
  const inc = r.financials?.income_statement ?? {};
  const bal = r.financials?.balance_sheet ?? {};
  const cf = r.financials?.cash_flow_statement ?? {};
  return {
    label:
      r.fiscal_period && r.fiscal_year ? `${r.fiscal_period} ${r.fiscal_year}` : "",
    endDate: r.period_of_report_date ?? null,
    revenue: num(inc.revenues),
    grossProfit: num(inc.gross_profit),
    operatingIncome: num(inc.operating_income_loss),
    netIncome: num(inc.net_income_loss),
    eps: num(inc.diluted_earnings_per_share) ?? num(inc.basic_earnings_per_share),
    assets: num(bal.assets),
    currentAssets: num(bal.current_assets),
    liabilities: num(bal.liabilities),
    currentLiabilities: num(bal.current_liabilities),
    equity: num(bal.equity),
    opCashFlow: num(cf.net_cash_flow_from_operating_activities),
  };
}

async function fetchFinancials(
  sym: string,
  timeframe: "quarterly" | "annual",
  limit: number
): Promise<RawFinancialResult[]> {
  const data = await fetchJson<{ results?: RawFinancialResult[] }>(
    `/vX/reference/financials?ticker=${sym}&timeframe=${timeframe}&order=desc&sort=period_of_report_date&limit=${limit}`,
    24 * 60 * 60_000
  );
  return data?.results ?? [];
}

async function fetchDividends(sym: string, limit: number): Promise<DividendItem[]> {
  const data = await fetchJson<{
    results?: { ex_dividend_date?: string; cash_amount?: number }[];
  }>(`/v3/reference/dividends?ticker=${sym}&order=desc&limit=${limit}`, 24 * 60 * 60_000);
  return (data?.results ?? []).map((d) => ({
    exDate: d.ex_dividend_date ?? null,
    cashAmount: typeof d.cash_amount === "number" ? d.cash_amount : null,
  }));
}

/**
 * Full research fundamentals for /research/[ticker]. Three parallel Polygon
 * calls (quarterly financials, annual financials, dividends), all 24h-cached.
 * Degrades gracefully: returns empty arrays where the key isn't entitled or the
 * ticker (many small-caps / ETFs) simply has no standardized financials — the
 * caller surfaces an honest "not enough data" state, never a fake grade.
 */
export async function getFundamentals(symbol: string): Promise<Fundamentals> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return { quarterly: [], annual: [], dividends: [] };

  const [qRaw, aRaw, dividends] = await Promise.all([
    fetchFinancials(sym, "quarterly", 8),
    fetchFinancials(sym, "annual", 5),
    fetchDividends(sym, 16),
  ]);

  const quarterly = qRaw
    .map(parseQuarter)
    .filter((q) => q.label && q.revenue != null)
    .reverse(); // oldest → newest

  const annual: FundAnnual[] = aRaw
    .map((r) => {
      const inc = r.financials?.income_statement ?? {};
      return {
        label: r.fiscal_year ? String(r.fiscal_year) : r.fiscal_period ?? "",
        revenue: num(inc.revenues),
        netIncome: num(inc.net_income_loss),
        eps:
          num(inc.diluted_earnings_per_share) ?? num(inc.basic_earnings_per_share),
      };
    })
    .filter((a) => a.label && a.revenue != null)
    .reverse();

  return { quarterly, annual, dividends };
}

export interface NewsItem {
  title: string;
  url: string;
  publisher: string | null;
  published: string | null; // ISO
  description: string | null;
}

interface NewsResult {
  results?: {
    title?: string;
    article_url?: string;
    published_utc?: string;
    description?: string;
    publisher?: { name?: string };
  }[];
}

/** Recent news headlines for a ticker (Ask Kai news tool → link cards). */
export async function getNews(symbol: string, limit = 6): Promise<NewsItem[]> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return [];
  const data = await fetchJson<NewsResult>(
    `/v2/reference/news?ticker=${sym}&order=desc&limit=${limit}&sort=published_utc`,
    15 * 60_000
  );
  return (data?.results || [])
    .filter((r) => r.title && r.article_url)
    .map((r) => ({
      title: r.title!,
      url: r.article_url!,
      publisher: r.publisher?.name ?? null,
      published: r.published_utc ?? null,
      description: r.description ?? null,
    }));
}

export interface SearchResult {
  ticker: string;
  name: string;
}

/** Ticker lookup/validation for the watchlist add-flow (better than free-text). */
export async function searchTickers(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const data = await fetchJson<{
    results?: { ticker: string; name: string }[];
  }>(
    `/v3/reference/tickers?search=${encodeURIComponent(
      q
    )}&market=stocks&active=true&limit=8`,
    24 * 60 * 60_000
  );
  return (data?.results || []).map((r) => ({ ticker: r.ticker, name: r.name }));
}
