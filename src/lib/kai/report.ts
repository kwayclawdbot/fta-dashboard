/**
 * Shared types + helpers for Kai Research Reports. The report is generated
 * server-side (admin route), stored in kai_reports, and rendered on
 * /research/[ticker]. Charts are drawn from the STORED `data` block — the model
 * never draws; it only writes the prose in `sections`.
 */

import type { KaiReportSections } from "@/lib/kai/persona";
import type { MarketBar, FinancialPeriod } from "@/lib/market/client";

export interface KaiReportData {
  bars: MarketBar[]; // daily closes, ~1y, oldest→newest
  financials: FinancialPeriod[] | null;
  snapshot: {
    price: number | null;
    marketCapText: string | null;
    sector: string | null;
  };
}

export interface KaiReport {
  id: string;
  ticker: string;
  company_name: string | null;
  version: number;
  status: string;
  model: string | null;
  sections: KaiReportSections;
  data: KaiReportData;
  generated_at: string;
}

/** Split a model paragraph string into paragraph nodes. */
export function toParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Compact large money values for chart axis / labels. */
export function abbreviateMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  const neg = v < 0;
  const a = Math.abs(v);
  let s: string;
  if (a >= 1e12) s = `$${(a / 1e12).toFixed(1)}T`;
  else if (a >= 1e9) s = `$${(a / 1e9).toFixed(1)}B`;
  else if (a >= 1e6) s = `$${(a / 1e6).toFixed(0)}M`;
  else if (a >= 1e3) s = `$${(a / 1e3).toFixed(0)}K`;
  else s = `$${a.toFixed(0)}`;
  return neg ? `-${s}` : s;
}

export const KAI_REPORT_DISCLAIMER =
  "This Kai Research Report is AI-generated educational analysis for the Cheat Code Club — it teaches how to think about a company, and is NOT investment advice, a recommendation, or a prediction. Market data is delayed ~15 minutes. Always do your own research and talk to a licensed professional before making any financial decision.";
