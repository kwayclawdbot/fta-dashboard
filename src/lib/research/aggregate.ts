import "server-only";
import { unstable_cache } from "next/cache";
import { after } from "next/server";
import { serviceClient } from "@/lib/server/membership";
import {
  getCompany,
  getQuote,
  getFundamentals,
  isConfigured,
  type Fundamentals,
} from "@/lib/market/polygon";
import {
  GRADE_VERSION,
  computeValuation,
  deriveGradeInput,
  computeGrades,
  type RawQuarter,
  type RawAnnual,
} from "@/lib/research/grades";
import type { ResearchPayload, ResearchQuarter } from "@/lib/research/types";
import { humanSector } from "@/lib/research/labels";

/**
 * Research aggregate (Lane 9) — the single server source of truth for a
 * ticker's fundamentals + grades payload. Shared by BOTH the /api/research
 * route handler (client refresh path) and the /research/[ticker] server page
 * (server-first first paint), so there's exactly one implementation.
 *
 * Composition:
 *   • research_fundamentals — 24h-TTL cache of Polygon financials + a valuation
 *     snapshot. Pricey vendor data is fetched at most once/ticker/day.
 *   • screener_metrics — in-house RSI / EMA / 52w-distance (never refetched).
 *   • research_pe_medians — in-house sector + market PE medians.
 * Grades are re-computed on every request (cheap) from cached fundamentals +
 * LIVE screener momentum + LIVE medians, memoized per
 * (ticker, fundamentals-version, screener-version) for 1h across all users.
 *
 * ── THE PAGE ALWAYS PAINTS (P0) ────────────────────────────────────────────
 * The previous shape awaited a three-call Polygon refresh ON THE RENDER PATH
 * whenever the 24h row was stale or missing. Only 36 tickers were ever cached,
 * so every other name in the club paid a cold vendor round-trip to see its own
 * page — and the audit caught it returning 504 rather than a page at all.
 *
 * The rule now is: NEVER block a paint on a vendor we do not control.
 *   • A cached row exists → serve it immediately, ALWAYS, however stale. A stale
 *     refresh is queued with `after()` so it lands out of band and the next
 *     reader gets the fresh row.
 *   • No row at all → race the vendor against COLD_DEADLINE_MS. It usually wins.
 *     When it doesn't, we serve an HONEST PARTIAL — the in-house screener
 *     momentum we already have, `partial: true`, and nothing invented — and the
 *     write still completes in the background so the reload is warm.
 * `partial` is what lets the UI say "still arriving" instead of the flat lie
 * "this company doesn't publish financials".
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long a COLD ticker may hold the render path hostage. Long enough that
 * Polygon normally wins outright; short enough that the member gets a page.
 */
const COLD_DEADLINE_MS = 4500;

/** In-flight refreshes, so a burst on one cold name is still one vendor call. */
const inflight = new Map<string, Promise<FundRow | null>>();

/** Resolve `p`, or `null` if it hasn't answered in `ms`. `p` keeps running. */
function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

interface FundRow {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  exchange: string | null;
  homepage: string | null;
  address: string | null;
  employees: number | null;
  list_date: string | null;
  mcap: number | null;
  price: number | null;
  pe: number | null;
  ps: number | null;
  pb: number | null;
  peg: number | null;
  div_yield: number | null;
  eps_ttm: number | null;
  rev_ttm: number | null;
  ni_ttm: number | null;
  equity: number | null;
  insufficient: boolean;
  data: {
    quarterly?: ResearchQuarter[];
    annual?: RawAnnual[];
    dividends?: { exDate: string | null; cashAmount: number | null }[];
    description?: string | null;
    logoUrl?: string | null;
  };
  grade_version: number | null;
  fetched_at: string;
}

/** Trailing-12-month dividend-per-share from the dividend history. */
function trailingDividend(divs: Fundamentals["dividends"]): number | null {
  const cutoff = Date.now() - 365 * DAY_MS;
  const recent = divs.filter(
    (d) => d.exDate && new Date(d.exDate).getTime() >= cutoff && d.cashAmount != null
  );
  if (recent.length === 0) return null;
  return recent.reduce((s, d) => s + (d.cashAmount ?? 0), 0);
}

/** Last in-house close for a ticker — the fallback when the vendor quote is junk. */
async function screenerPrice(
  db: ReturnType<typeof serviceClient>,
  ticker: string
): Promise<number | null> {
  const { data } = await db
    .from("screener_metrics")
    .select("price")
    .eq("ticker", ticker)
    .maybeSingle();
  const p = (data as { price: number | null } | null)?.price ?? null;
  return p != null && p > 0 ? p : null;
}

/** Build + persist a fresh fundamentals row from Polygon (service role write). */
async function refreshFundamentals(
  db: ReturnType<typeof serviceClient>,
  ticker: string
): Promise<FundRow | null> {
  const [company, quote, fundamentals] = await Promise.all([
    getCompany(ticker),
    getQuote(ticker),
    getFundamentals(ticker),
  ]);
  if (!company) return null;

  /* PRICE ZERO IS NOT A PRICE. Polygon's snapshot returns 0 for a name that
     hasn't printed a trade in the session (and for some delisted/illiquid
     tickers). Persisting that 0 poisons every ratio derived from it — most
     visibly the dividend yield, which divides by price and lands on Infinity or
     a nonsense number that then gets cached for 24h. A non-positive price is
     REJECTED here and the in-house screener close is used instead; if neither
     exists the row stores null and the ratios honestly come out "—". */
  const quoted = quote?.price ?? null;
  const price =
    quoted != null && quoted > 0 ? quoted : await screenerPrice(db, ticker);
  const mcap = company.marketCap ?? null;
  const divPerShare = trailingDividend(fundamentals.dividends);

  const quarterly: RawQuarter[] = fundamentals.quarterly.map((q) => ({
    label: q.label,
    revenue: q.revenue,
    netIncome: q.netIncome,
    eps: q.eps,
    assets: q.assets,
    currentAssets: q.currentAssets,
    liabilities: q.liabilities,
    currentLiabilities: q.currentLiabilities,
    equity: q.equity,
    opCashFlow: q.opCashFlow,
  }));
  const annual: RawAnnual[] = fundamentals.annual.map((a) => ({
    label: a.label,
    revenue: a.revenue,
    netIncome: a.netIncome,
    eps: a.eps,
  }));

  const v = computeValuation(mcap, price, quarterly, annual, divPerShare);
  const insufficient = quarterly.length < 2 && annual.length < 2;

  const dataBlock = {
    quarterly: fundamentals.quarterly,
    annual: fundamentals.annual,
    dividends: fundamentals.dividends,
    description: company.description,
    logoUrl:
      company.hasIcon || company.hasLogo
        ? `/api/market/logo?symbol=${encodeURIComponent(company.symbol)}`
        : null,
  };

  const row = {
    ticker,
    company_name: company.name,
    sector: company.sector,
    exchange: company.primaryExchange,
    homepage: company.homepage,
    address: company.address,
    employees: company.employees,
    list_date: company.listDate,
    mcap,
    price,
    pe: v.pe,
    ps: v.ps,
    pb: v.pb,
    peg: v.peg,
    div_yield: v.divYield,
    eps_ttm: v.epsTtm,
    rev_ttm: v.revTtm,
    ni_ttm: v.niTtm,
    equity: v.equity,
    insufficient,
    data: dataBlock,
    grade_version: GRADE_VERSION,
    fetched_at: new Date().toISOString(),
  };

  await db.from("research_fundamentals").upsert(row, { onConflict: "ticker" });
  return row as unknown as FundRow;
}

/** Compose the payload from a fundamentals row + in-house momentum + medians. */
async function composeResearch(
  db: ReturnType<typeof serviceClient>,
  ticker: string,
  row: FundRow
): Promise<ResearchPayload> {
  const { data: sm } = await db
    .from("screener_metrics")
    .select(
      "price, rsi14, ema20_state, ema50_state, dist_52w_high, dist_52w_low, vol_ratio, gap_pct, chg_1d, chg_5d, chg_1m, chg_3m"
    )
    .eq("ticker", ticker)
    .maybeSingle();

  const { data: medians } = await db.rpc("research_pe_medians", { p_sector: row.sector });
  const med = (medians ?? {}) as {
    sector_median: number | null;
    sector_n: number;
    market_median: number | null;
    market_n: number;
  };

  const quarterly: RawQuarter[] = (row.data.quarterly ?? []).map((q) => ({
    label: q.label,
    revenue: q.revenue,
    netIncome: q.netIncome,
    eps: q.eps,
    assets: q.assets,
    currentAssets: q.currentAssets,
    liabilities: q.liabilities,
    currentLiabilities: q.currentLiabilities,
    equity: q.equity,
    opCashFlow: q.opCashFlow,
  }));
  const annual: RawAnnual[] = (row.data.annual ?? []).map((a) => ({
    label: a.label,
    revenue: a.revenue,
    netIncome: a.netIncome,
    eps: a.eps,
  }));

  const gradeInput = deriveGradeInput({
    valuation: {
      pe: row.pe,
      ps: row.ps,
      pb: row.pb,
      peg: row.peg,
      divYield: row.div_yield,
      epsTtm: row.eps_ttm,
      revTtm: row.rev_ttm,
      niTtm: row.ni_ttm,
      equity: row.equity,
    },
    sectorMedianPe: med.sector_median,
    quarterly,
    annual,
    momentum: {
      rsi14: sm?.rsi14 ?? null,
      ema20State: (sm?.ema20_state as "above" | "below" | "unknown" | null) ?? null,
      ema50State: (sm?.ema50_state as "above" | "below" | "unknown" | null) ?? null,
      dist52wHigh: sm?.dist_52w_high ?? null,
    },
  });
  const grades = computeGrades(gradeInput);

  /* NO SECOND 52-WEEK RANGE. This used to reconstruct the extremes from the
     screener's trailing-window DISTANCE (`price / (1 + dist/100)`), which is an
     approximation over a different window than the daily close series the same
     page draws — so a member saw two different 52-week lows on one screen and
     had no way to tell which was the real one. There is exactly one source now:
     the daily series, derived client-side where the series lives. Until it
     lands these are null and the surfaces render their loading shape. */
  const week52High = null;
  const week52Low = null;

  return {
    company: {
      ticker,
      name: row.company_name,
      description: row.data.description ?? null,
      // SIC filing categories are shouted 1970s taxonomy — humanised on read so
      // rows cached before this rule still print a sentence-shaped label.
      sector: humanSector(row.sector),
      exchange: row.exchange,
      homepage: row.homepage,
      address: row.address,
      employees: row.employees,
      listDate: row.list_date,
      logoUrl: row.data.logoUrl ?? null,
    },
    grades,
    keyStats: {
      pe: row.pe,
      pb: row.pb,
      ps: row.ps,
      peg: row.peg,
      divYield: row.div_yield,
      epsTtm: row.eps_ttm,
      week52Low,
      week52High,
      marketCap: row.mcap,
      marketCapText: marketCapText(row.mcap),
    },
    sectorMedians: {
      sector: humanSector(row.sector),
      sectorMedian: med.sector_median ?? null,
      sectorN: med.sector_n ?? 0,
      marketMedian: med.market_median ?? null,
      marketN: med.market_n ?? 0,
    },
    momentum: {
      rsi14: sm?.rsi14 ?? null,
      ema20State: (sm?.ema20_state as "above" | "below" | "unknown" | null) ?? null,
      ema50State: (sm?.ema50_state as "above" | "below" | "unknown" | null) ?? null,
      dist52wHigh: sm?.dist_52w_high ?? null,
      dist52wLow: sm?.dist_52w_low ?? null,
      volRatio: sm?.vol_ratio ?? null,
      gapPct: sm?.gap_pct ?? null,
      chg1d: sm?.chg_1d ?? null,
      chg5d: sm?.chg_5d ?? null,
      chg1m: sm?.chg_1m ?? null,
      chg3m: sm?.chg_3m ?? null,
    },
    charts: {
      quarterly: row.data.quarterly ?? [],
      annual: (row.data.annual ?? []) as ResearchPayload["charts"]["annual"],
      dividends: row.data.dividends ?? [],
    },
    insufficient: row.insufficient,
    cachedAt: row.fetched_at,
  };
}

function marketCapText(v: number | null): string | null {
  if (!v || v <= 0) return null;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

/** One vendor refresh per ticker at a time, shared by every concurrent reader. */
function refreshOnce(
  db: ReturnType<typeof serviceClient>,
  ticker: string
): Promise<FundRow | null> {
  const running = inflight.get(ticker);
  if (running) return running;
  const p = refreshFundamentals(db, ticker)
    .catch(() => null)
    .finally(() => inflight.delete(ticker));
  inflight.set(ticker, p);
  return p;
}

/** The memoized compose, keyed so a new row / new screener run busts it. */
async function composeCached(
  db: ReturnType<typeof serviceClient>,
  ticker: string,
  row: FundRow
): Promise<ResearchPayload> {
  const { data: meta } = await db
    .from("screener_meta")
    .select("last_run_at")
    .maybeSingle();
  const metricsVersion = (meta?.last_run_at as string | null) ?? "0";

  return unstable_cache(
    () => composeResearch(db, ticker, row),
    [
      "research-payload",
      ticker,
      row.fetched_at,
      String(row.grade_version ?? 0),
      metricsVersion,
    ],
    { revalidate: 3600, tags: [`research:${ticker}`] }
  )();
}

/**
 * THE HONEST PARTIAL — a cold ticker whose vendor call hasn't answered yet.
 *
 * Everything in-house that we DO have (the screener's momentum row) is served;
 * everything that would need the vendor is null, and `partial: true` tells the
 * client to say "still arriving" rather than "this company publishes nothing".
 * Nothing here is invented — a partial with no screener row is still a page,
 * just an emptier one.
 */
async function partialPayload(
  db: ReturnType<typeof serviceClient>,
  ticker: string
): Promise<ResearchPayload> {
  const { data: sm } = await db
    .from("screener_metrics")
    .select(
      "price, rsi14, ema20_state, ema50_state, dist_52w_high, dist_52w_low, vol_ratio, gap_pct, chg_1d, chg_5d, chg_1m, chg_3m, mcap"
    )
    .eq("ticker", ticker)
    .maybeSingle();

  const grades = computeGrades(
    deriveGradeInput({
      valuation: {
        pe: null,
        ps: null,
        pb: null,
        peg: null,
        divYield: null,
        epsTtm: null,
        revTtm: null,
        niTtm: null,
        equity: null,
      },
      sectorMedianPe: null,
      quarterly: [],
      annual: [],
      momentum: {
        rsi14: sm?.rsi14 ?? null,
        ema20State: (sm?.ema20_state as "above" | "below" | "unknown" | null) ?? null,
        ema50State: (sm?.ema50_state as "above" | "below" | "unknown" | null) ?? null,
        dist52wHigh: sm?.dist_52w_high ?? null,
      },
    })
  );

  return {
    company: {
      ticker,
      name: null,
      description: null,
      sector: null,
      exchange: null,
      homepage: null,
      address: null,
      employees: null,
      listDate: null,
      logoUrl: null,
    },
    grades,
    keyStats: {
      pe: null,
      pb: null,
      ps: null,
      peg: null,
      divYield: null,
      epsTtm: null,
      week52Low: null,
      week52High: null,
      marketCap: sm?.mcap ?? null,
      marketCapText: marketCapText(sm?.mcap ?? null),
    },
    sectorMedians: {
      sector: null,
      sectorMedian: null,
      sectorN: 0,
      marketMedian: null,
      marketN: 0,
    },
    momentum: {
      rsi14: sm?.rsi14 ?? null,
      ema20State: (sm?.ema20_state as "above" | "below" | "unknown" | null) ?? null,
      ema50State: (sm?.ema50_state as "above" | "below" | "unknown" | null) ?? null,
      dist52wHigh: sm?.dist_52w_high ?? null,
      dist52wLow: sm?.dist_52w_low ?? null,
      volRatio: sm?.vol_ratio ?? null,
      gapPct: sm?.gap_pct ?? null,
      chg1d: sm?.chg_1d ?? null,
      chg5d: sm?.chg_5d ?? null,
      chg1m: sm?.chg_1m ?? null,
      chg3m: sm?.chg_3m ?? null,
    },
    charts: { quarterly: [], annual: [], dividends: [] },
    insufficient: false,
    partial: true,
    cachedAt: new Date().toISOString(),
  };
}

/**
 * The one entry point. `ticker` MUST be normalized by the caller. Auth is the
 * CALLER's responsibility (route checks the session; the server page is already
 * behind the authed dashboard layout).
 *
 * THIS FUNCTION ALWAYS RETURNS A PAGE unless Polygon is unconfigured and we hold
 * nothing at all. See the module header for why: the cached row is served
 * immediately however stale, the refresh is queued out of band, and a genuinely
 * cold ticker gets one bounded attempt before falling back to an honest partial.
 */
export async function getResearchPayload(
  ticker: string
): Promise<ResearchPayload | null> {
  const db = serviceClient();

  const { data: existing } = await db
    .from("research_fundamentals")
    .select("*")
    .eq("ticker", ticker)
    .maybeSingle();

  const row = existing as FundRow | null;

  if (row) {
    const stale =
      row.grade_version !== GRADE_VERSION ||
      Date.now() - new Date(row.fetched_at).getTime() > DAY_MS;
    // SERVE FIRST, REFRESH AFTER. A day-old row is a page; a vendor round-trip
    // is a 504. `after()` runs the refresh once the response is on the wire.
    if (stale && isConfigured()) {
      after(async () => {
        await refreshOnce(db, ticker);
      });
    }
    return composeCached(db, ticker, row);
  }

  // Cold ticker — there is nothing cached to paint, so the vendor gets ONE
  // bounded shot at winning the race.
  if (!isConfigured()) return null;
  const fresh = await withDeadline(refreshOnce(db, ticker), COLD_DEADLINE_MS);
  if (fresh) return composeCached(db, ticker, fresh);

  // It didn't answer in time. The write is still in flight (and `after` keeps
  // the function alive to finish it), so the reload will be warm; this paint
  // gets the in-house half of the picture and says so.
  after(async () => {
    await refreshOnce(db, ticker);
  });
  return partialPayload(db, ticker);
}
