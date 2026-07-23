import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/server/membership";
import {
  getCompany,
  getQuote,
  getFundamentals,
  normalizeSymbol,
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

/**
 * GET /api/research/[ticker]
 *
 * The Lane 9 aggregate. Composes the research page's fundamentals + grades from:
 *   • research_fundamentals — a 24h-TTL cache of Polygon financials (income /
 *     balance / cash-flow highlights + a valuation snapshot). EXPENSIVE data is
 *     fetched from Polygon at most once per ticker per day; every other visit
 *     reads the cached row → cache-first, minimal API spend.
 *   • screener_metrics — in-house RSI / EMA / 52w-distance (never refetched).
 *   • research_pe_medians — in-house sector + market PE medians.
 *
 * Grades are RE-COMPUTED on every request (cheap) from cached fundamentals +
 * LIVE screener momentum + LIVE medians, so a nightly screener refresh flows
 * through immediately while the pricey fundamentals stay cached. Members only
 * (any tier); the page gates premium presentation for free tier.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

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

  const price = quote?.price ?? null;
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

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await ctx.params;
  const ticker = normalizeSymbol(rawTicker);
  if (!ticker) {
    return NextResponse.json({ error: "bad-ticker" }, { status: 400 });
  }

  // Members-only (any tier). Presentation gating happens on the page.
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = serviceClient();

  // Cache-first: reuse a fresh row (< 24h, current grade version).
  const { data: existing } = await db
    .from("research_fundamentals")
    .select("*")
    .eq("ticker", ticker)
    .maybeSingle();

  let row = existing as FundRow | null;
  const stale =
    !row ||
    row.grade_version !== GRADE_VERSION ||
    Date.now() - new Date(row.fetched_at).getTime() > DAY_MS;

  if (stale) {
    if (!isConfigured()) {
      // No Polygon key: serve whatever stale row exists, else 503.
      if (!row) {
        return NextResponse.json({ error: "market-data-unavailable" }, { status: 503 });
      }
    } else {
      const fresh = await refreshFundamentals(db, ticker);
      if (fresh) row = fresh;
      else if (!row) {
        return NextResponse.json({ error: "not-found" }, { status: 404 });
      }
    }
  }
  if (!row) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  // In-house momentum (never refetched from a vendor).
  const { data: sm } = await db
    .from("screener_metrics")
    .select(
      "price, rsi14, ema20_state, ema50_state, dist_52w_high, dist_52w_low, vol_ratio, gap_pct, chg_1d, chg_5d, chg_1m, chg_3m"
    )
    .eq("ticker", ticker)
    .maybeSingle();

  // In-house PE medians (sector + market) from every analysed ticker.
  const { data: medians } = await db.rpc("research_pe_medians", {
    p_sector: row.sector,
  });
  const med = (medians ?? {}) as {
    sector_median: number | null;
    sector_n: number;
    market_median: number | null;
    market_n: number;
  };

  // Re-grade with cached fundamentals + live momentum + live medians.
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

  // 52-week band from screener distance (honestly a trailing window) + price.
  const px = sm?.price ?? row.price ?? null;
  const week52High =
    px != null && sm?.dist_52w_high != null ? px / (1 + sm.dist_52w_high / 100) : null;
  const week52Low =
    px != null && sm?.dist_52w_low != null ? px / (1 + sm.dist_52w_low / 100) : null;

  const payload: ResearchPayload = {
    company: {
      ticker,
      name: row.company_name,
      description: row.data.description ?? null,
      sector: row.sector,
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
      sector: row.sector,
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

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}

function marketCapText(v: number | null): string | null {
  if (!v || v <= 0) return null;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}
