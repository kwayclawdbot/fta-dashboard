/**
 * Client-safe types + fetcher for the /api/research/[ticker] aggregate route
 * (Lane 9). No server imports — the research page and its chart components share
 * these shapes. Grade shapes come from the self-contained grades engine.
 */

import type { GradesResult } from "@/lib/research/grades";

export interface ResearchQuarter {
  label: string;
  endDate: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  assets: number | null;
  currentAssets: number | null;
  liabilities: number | null;
  currentLiabilities: number | null;
  equity: number | null;
  opCashFlow: number | null;
}

export interface ResearchAnnual {
  label: string;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
}

export interface ResearchDividend {
  exDate: string | null;
  cashAmount: number | null;
}

export interface SectorMedians {
  sector: string | null;
  sectorMedian: number | null;
  sectorN: number;
  marketMedian: number | null;
  marketN: number;
}

export interface KeyStats {
  pe: number | null;
  pb: number | null;
  ps: number | null;
  peg: number | null;
  divYield: number | null;
  epsTtm: number | null;
  week52Low: number | null;
  week52High: number | null;
  marketCap: number | null;
  marketCapText: string | null;
}

export interface MomentumStats {
  rsi14: number | null;
  ema20State: "above" | "below" | "unknown" | null;
  ema50State: "above" | "below" | "unknown" | null;
  dist52wHigh: number | null;
  dist52wLow: number | null;
  volRatio: number | null;
  gapPct: number | null;
  chg1d: number | null;
  chg5d: number | null;
  chg1m: number | null;
  chg3m: number | null;
}

export interface ResearchCompany {
  ticker: string;
  name: string | null;
  description: string | null;
  sector: string | null;
  exchange: string | null;
  homepage: string | null;
  address: string | null;
  employees: number | null;
  listDate: string | null;
  logoUrl: string | null;
}

export interface ResearchPayload {
  company: ResearchCompany;
  grades: GradesResult;
  keyStats: KeyStats;
  sectorMedians: SectorMedians;
  momentum: MomentumStats;
  charts: {
    quarterly: ResearchQuarter[];
    annual: ResearchAnnual[];
    dividends: ResearchDividend[];
  };
  /** True when Polygon serves no usable financials (sparse small-cap / ETF). */
  insufficient: boolean;
  /**
   * True when this payload is the HONEST PARTIAL: a cold ticker whose vendor
   * fetch hasn't landed yet, served so the page paints. In-house momentum is
   * real; the company block and financials are simply not here yet. Surfaces
   * must say "still arriving", never "this company publishes nothing".
   */
  partial?: boolean;
  cachedAt: string;
}

/** Fetch the composed research payload (fails soft to null). */
export async function fetchResearch(
  ticker: string,
  signal?: AbortSignal
): Promise<ResearchPayload | null> {
  try {
    const res = await fetch(`/api/research/${encodeURIComponent(ticker)}`, { signal });
    if (!res.ok) return null;
    return (await res.json()) as ResearchPayload;
  } catch {
    return null;
  }
}
