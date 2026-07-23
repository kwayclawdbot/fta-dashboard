/**
 * Research grades engine (Lane 9) — versioned, transparent, unit-tested rules
 * that turn Polygon fundamentals + our in-house screener_metrics into A–F letter
 * grades for four dimensions (Value · Growth · Health · Momentum) and one
 * plain-English overall verdict.
 *
 * DESIGN RULES (binding):
 *  - Education register, NEVER buy/hold/sell language. The overall label is one
 *    of Strong / Solid / Mixed / Weak (compliance).
 *  - Every grade is RULE-BASED and explainable — each dimension exposes its
 *    pass/fail/neutral checks and one plain-English sentence per check with the
 *    number embedded (Ziggma register: "P/E of 18.2 sits below the 24.1 median").
 *  - HONEST insufficiency: many small-caps / ETFs have no standardized
 *    financials. A dimension with too few available signals returns
 *    letter = null / sufficient = false so the UI can say "not enough data"
 *    instead of faking a grade. We grade what is gradeable.
 *  - No external imports (self-contained types) so the rules run under Node's
 *    built-in test runner with zero build tooling.
 *
 * VERSIONING: GRADE_VERSION is stamped onto every result and cached alongside
 * research_fundamentals so grades can evolve without silently rewriting history.
 */

export const GRADE_VERSION = 1;

export type Letter = "A" | "B" | "C" | "D" | "F";
export type Dimension = "value" | "growth" | "health" | "momentum";
export type CheckStatus = "pass" | "fail" | "neutral";
export type Verdict = "Strong" | "Solid" | "Mixed" | "Weak";
export type EmaState = "above" | "below" | "unknown" | null;

export interface CheckResult {
  key: string;
  /** Short label for the check row header ("Reasonable P/E"). */
  label: string;
  status: CheckStatus;
  /** Full plain-English sentence with the number embedded (education register). */
  sentence: string;
}

export interface DimensionGrade {
  dimension: Dimension;
  /** null when there isn't enough data to grade this dimension honestly. */
  letter: Letter | null;
  /** 0–100 underlying score (null when insufficient). */
  score: number | null;
  sufficient: boolean;
  checks: CheckResult[];
  strengths: string[];
  weaknesses: string[];
}

export interface GradesResult {
  version: number;
  overall: {
    letter: Letter | null;
    label: Verdict | null;
    score: number | null;
    /** 0–1 needle position for the hero gauge (null when no overall read). */
    gauge: number | null;
    /** How many of the four dimensions were gradeable. */
    graded: number;
  };
  dimensions: DimensionGrade[];
  /** Aggregated pass sentences across dimensions (Strengths card). */
  strengths: string[];
  /** Aggregated fail sentences across dimensions (Weaknesses card). */
  weaknesses: string[];
}

/* ─────────────────────────── grade input shape ─────────────────────────── */

export interface GradeInput {
  // Value
  pe: number | null;
  ps: number | null;
  pb: number | null;
  peg: number | null;
  sectorMedianPe: number | null;
  // Growth
  revenueCagr: number | null; // annual revenue CAGR, %
  quartersRevenueUp: number | null; // # of recent quarters with YoY revenue growth
  quartersCompared: number | null; // denominator for the above
  marginTrendPp: number | null; // change in net margin, percentage points (recent − older)
  epsPositive: boolean | null; // latest reported EPS > 0
  // Health
  debtToEquity: number | null; // total liabilities / equity
  currentRatio: number | null; // current assets / current liabilities
  opCashFlowPositive: boolean | null; // latest operating cash flow > 0
  netIncomePositiveTtm: boolean | null; // TTM net income > 0
  // Momentum (from screener_metrics)
  rsi14: number | null;
  ema20State: EmaState;
  ema50State: EmaState;
  dist52wHigh: number | null; // % from trailing high (≤ 0 near high)
}

/* ─────────────────────────── scoring helpers ───────────────────────────── */

interface WeightedCheck {
  weight: number;
  earned: number; // 0..weight
  check: CheckResult;
}

/** Map a 0–100 score to a letter (fixed bands, documented in the summary). */
export function scoreToLetter(score: number): Letter {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";
  if (score >= 25) return "D";
  return "F";
}

function pct(n: number): string {
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}
function x(n: number): string {
  return `${n.toFixed(1)}×`;
}

/**
 * Assemble a dimension grade from its weighted checks. A dimension is
 * "sufficient" only when the checks that actually contributed cover at least
 * `minWeight` of the total — otherwise we don't have enough to grade honestly.
 */
function assemble(
  dimension: Dimension,
  checks: WeightedCheck[],
  minCoverage: number
): DimensionGrade {
  // Coverage = summed weight of the checks we could actually run. A check is
  // only pushed by a dimension when its input exists, so the presence of a check
  // means we had that datum (neutral still counts — we had it, it landed mid).
  const covered = checks.reduce((s, c) => s + c.weight, 0);
  const totalPossible = covered;

  if (checks.length === 0 || covered < minCoverage) {
    return {
      dimension,
      letter: null,
      score: null,
      sufficient: false,
      checks: checks.map((c) => c.check),
      strengths: [],
      weaknesses: [],
    };
  }

  const earned = checks.reduce((s, c) => s + c.earned, 0);
  const score = Math.round((earned / totalPossible) * 100);
  const strengths = checks.filter((c) => c.check.status === "pass").map((c) => c.check.sentence);
  const weaknesses = checks.filter((c) => c.check.status === "fail").map((c) => c.check.sentence);

  return {
    dimension,
    letter: scoreToLetter(score),
    score,
    sufficient: true,
    checks: checks.map((c) => c.check),
    strengths,
    weaknesses,
  };
}

/** A 3-band check: pass (full weight), neutral (half), fail (zero). */
function band(
  key: string,
  label: string,
  status: CheckStatus,
  sentence: string,
  weight: number
): WeightedCheck {
  const earned = status === "pass" ? weight : status === "neutral" ? weight * 0.5 : 0;
  return { weight, earned, check: { key, label, status, sentence } };
}

/* ─────────────────────────────── dimensions ────────────────────────────── */

function gradeValue(i: GradeInput): DimensionGrade {
  const checks: WeightedCheck[] = [];

  if (i.pe != null) {
    if (i.pe <= 0) {
      checks.push(
        band(
          "pe",
          "Price to earnings",
          "fail",
          "Not yet profitable: with no positive earnings, a P/E can't be computed, so value here rests entirely on future growth rather than today's profits.",
          40
        )
      );
    } else if (i.sectorMedianPe != null && i.sectorMedianPe > 0) {
      const cheaper = i.pe <= i.sectorMedianPe;
      const rich = i.pe > i.sectorMedianPe * 1.5;
      checks.push(
        band(
          "pe",
          "Price to earnings",
          cheaper ? "pass" : rich ? "fail" : "neutral",
          cheaper
            ? `Attractively valued: a P/E of ${x(i.pe)} sits below the ${x(i.sectorMedianPe)} median for the companies we've studied in its industry.`
            : rich
              ? `Richly valued: a P/E of ${x(i.pe)} is well above the ${x(i.sectorMedianPe)} industry median, so a lot of good news is already in the price.`
              : `Fairly valued: a P/E of ${x(i.pe)} is roughly in line with the ${x(i.sectorMedianPe)} industry median.`,
          40
        )
      );
    } else {
      const cheap = i.pe <= 22;
      const rich = i.pe > 40;
      checks.push(
        band(
          "pe",
          "Price to earnings",
          cheap ? "pass" : rich ? "fail" : "neutral",
          cheap
            ? `Reasonably priced: a P/E of ${x(i.pe)} means you're paying a modest amount for each dollar of earnings.`
            : rich
              ? `Expensive on earnings: a P/E of ${x(i.pe)} means the market is paying a steep price for each dollar of profit.`
              : `Middle-of-the-road on earnings: a P/E of ${x(i.pe)} is neither cheap nor especially expensive.`,
          40
        )
      );
    }
  }

  if (i.ps != null && i.ps > 0) {
    const cheap = i.ps <= 2;
    const rich = i.ps > 6;
    checks.push(
      band(
        "ps",
        "Price to sales",
        cheap ? "pass" : rich ? "fail" : "neutral",
        cheap
          ? `Modest on sales: a price-to-sales of ${x(i.ps)} is inexpensive relative to the revenue the company brings in.`
          : rich
            ? `Pricey on sales: a price-to-sales of ${x(i.ps)} means investors are paying a premium for every dollar of revenue.`
            : `Moderate on sales: a price-to-sales of ${x(i.ps)} is in a typical range.`,
        25
      )
    );
  }

  if (i.peg != null && i.peg > 0) {
    const cheap = i.peg <= 1;
    const rich = i.peg > 2;
    checks.push(
      band(
        "peg",
        "Growth-adjusted value",
        cheap ? "pass" : rich ? "fail" : "neutral",
        cheap
          ? `Cheap for its growth: with a PEG of ${i.peg.toFixed(2)} (below 1), the price looks reasonable once you account for how fast earnings are growing.`
          : rich
            ? `Expensive even for its growth: a PEG of ${i.peg.toFixed(2)} suggests the price outruns the earnings growth behind it.`
            : `Fairly priced for its growth: a PEG of ${i.peg.toFixed(2)} balances price against earnings growth.`,
        20
      )
    );
  }

  if (i.pb != null && i.pb > 0) {
    const cheap = i.pb <= 3;
    const rich = i.pb > 8;
    checks.push(
      band(
        "pb",
        "Price to book",
        cheap ? "pass" : rich ? "fail" : "neutral",
        cheap
          ? `Grounded in assets: a price-to-book of ${x(i.pb)} keeps the valuation reasonably tied to what the company owns.`
          : rich
            ? `Far above book value: a price-to-book of ${x(i.pb)} means the market values the company well beyond its net assets.`
            : `Above book value: a price-to-book of ${x(i.pb)} is a common range for a healthy business.`,
        15
      )
    );
  }

  // Need at least a P/E or a P/S to grade value honestly.
  return assemble("value", checks, 25);
}

function gradeGrowth(i: GradeInput): DimensionGrade {
  const checks: WeightedCheck[] = [];

  if (i.revenueCagr != null) {
    const strong = i.revenueCagr >= 15;
    const weak = i.revenueCagr < 5;
    checks.push(
      band(
        "rev_cagr",
        "Revenue growth",
        strong ? "pass" : weak ? "fail" : "neutral",
        strong
          ? `Solid top-line growth: revenue has compounded at about ${pct(i.revenueCagr)} a year, a healthy pace.`
          : weak
            ? `Sluggish growth: revenue has grown only about ${pct(i.revenueCagr)} a year, so the business is expanding slowly.`
            : `Steady growth: revenue has compounded at about ${pct(i.revenueCagr)} a year.`,
        35
      )
    );
  }

  if (i.quartersRevenueUp != null && i.quartersCompared != null && i.quartersCompared > 0) {
    const ratio = i.quartersRevenueUp / i.quartersCompared;
    const strong = ratio >= 0.75;
    const weak = ratio < 0.5;
    checks.push(
      band(
        "rev_consistency",
        "Consistent revenue",
        strong ? "pass" : weak ? "fail" : "neutral",
        strong
          ? `Dependable trend: revenue grew year-over-year in ${i.quartersRevenueUp} of the last ${i.quartersCompared} quarters.`
          : weak
            ? `Choppy trend: revenue grew year-over-year in only ${i.quartersRevenueUp} of the last ${i.quartersCompared} quarters.`
            : `Mixed trend: revenue grew year-over-year in ${i.quartersRevenueUp} of the last ${i.quartersCompared} quarters.`,
        30
      )
    );
  }

  if (i.marginTrendPp != null) {
    const improving = i.marginTrendPp >= 0.5;
    const worsening = i.marginTrendPp < -0.5;
    checks.push(
      band(
        "margin_trend",
        "Margin direction",
        improving ? "pass" : worsening ? "fail" : "neutral",
        improving
          ? `Improving profitability: net profit margin has widened by about ${i.marginTrendPp.toFixed(1)} points recently, so more of each sale is kept as profit.`
          : worsening
            ? `Shrinking profitability: net profit margin has narrowed by about ${Math.abs(i.marginTrendPp).toFixed(1)} points recently.`
            : `Stable profitability: net profit margin has held roughly flat recently.`,
        20
      )
    );
  }

  if (i.epsPositive != null) {
    checks.push(
      band(
        "eps_positive",
        "Positive earnings",
        i.epsPositive ? "pass" : "fail",
        i.epsPositive
          ? "Earning a profit: the company reported positive earnings per share in its latest results."
          : "Losing money: the company reported negative earnings per share in its latest results, so it isn't profitable yet.",
        15
      )
    );
  }

  return assemble("growth", checks, 30);
}

function gradeHealth(i: GradeInput): DimensionGrade {
  const checks: WeightedCheck[] = [];

  if (i.debtToEquity != null && i.debtToEquity >= 0) {
    const strong = i.debtToEquity <= 1;
    const weak = i.debtToEquity > 2;
    checks.push(
      band(
        "debt_equity",
        "Debt load",
        strong ? "pass" : weak ? "fail" : "neutral",
        strong
          ? `Manageable debt: liabilities are about ${x(i.debtToEquity)} shareholder equity, a comfortable balance.`
          : weak
            ? `Heavy debt: liabilities are about ${x(i.debtToEquity)} shareholder equity, which adds financial risk if conditions turn.`
            : `Moderate debt: liabilities are about ${x(i.debtToEquity)} shareholder equity.`,
        30
      )
    );
  }

  if (i.currentRatio != null && i.currentRatio >= 0) {
    const strong = i.currentRatio >= 1.5;
    const weak = i.currentRatio < 1;
    checks.push(
      band(
        "current_ratio",
        "Short-term cushion",
        strong ? "pass" : weak ? "fail" : "neutral",
        strong
          ? `Comfortable liquidity: short-term assets cover short-term bills ${x(i.currentRatio)} over, so near-term obligations are well covered.`
          : weak
            ? `Tight liquidity: short-term assets cover only ${x(i.currentRatio)} of short-term bills, leaving little cushion.`
            : `Adequate liquidity: short-term assets cover short-term bills ${x(i.currentRatio)} over.`,
        30
      )
    );
  }

  if (i.opCashFlowPositive != null) {
    checks.push(
      band(
        "op_cash_flow",
        "Cash generation",
        i.opCashFlowPositive ? "pass" : "fail",
        i.opCashFlowPositive
          ? "Cash-generative: the core business produced positive operating cash flow in its latest period."
          : "Burning cash: the core business used more cash than it produced in its latest period.",
        20
      )
    );
  }

  if (i.netIncomePositiveTtm != null) {
    checks.push(
      band(
        "ni_ttm",
        "Bottom-line profit",
        i.netIncomePositiveTtm ? "pass" : "fail",
        i.netIncomePositiveTtm
          ? "Profitable overall: the company earned a profit across the last twelve months."
          : "Unprofitable overall: the company lost money across the last twelve months.",
        20
      )
    );
  }

  return assemble("health", checks, 30);
}

function gradeMomentum(i: GradeInput): DimensionGrade {
  const checks: WeightedCheck[] = [];

  if (i.ema20State && i.ema20State !== "unknown") {
    const above = i.ema20State === "above";
    checks.push(
      band(
        "ema20",
        "Short-term trend",
        above ? "pass" : "fail",
        above
          ? "Above its 20-day average: the recent short-term trend is pointing up."
          : "Below its 20-day average: the recent short-term trend is pointing down.",
        25
      )
    );
  }

  if (i.ema50State && i.ema50State !== "unknown") {
    const above = i.ema50State === "above";
    checks.push(
      band(
        "ema50",
        "Medium-term trend",
        above ? "pass" : "fail",
        above
          ? "Above its 50-day average: the medium-term trend is constructive."
          : "Below its 50-day average: the medium-term trend is soft.",
        25
      )
    );
  }

  if (i.rsi14 != null) {
    const strong = i.rsi14 >= 55 && i.rsi14 <= 80;
    const weak = i.rsi14 < 45;
    const stretched = i.rsi14 > 80;
    checks.push(
      band(
        "rsi",
        "Momentum strength",
        strong ? "pass" : weak || stretched ? "fail" : "neutral",
        strong
          ? `Firm momentum: a relative-strength reading of ${i.rsi14.toFixed(0)} shows steady buying interest without being overheated.`
          : stretched
            ? `Overheated: a relative-strength reading of ${i.rsi14.toFixed(0)} is very high, a level where pullbacks often follow.`
            : weak
              ? `Weak momentum: a relative-strength reading of ${i.rsi14.toFixed(0)} shows sellers in control.`
              : `Neutral momentum: a relative-strength reading of ${i.rsi14.toFixed(0)} is balanced.`,
        20
      )
    );
  }

  if (i.dist52wHigh != null) {
    const near = i.dist52wHigh >= -10;
    const far = i.dist52wHigh < -25;
    checks.push(
      band(
        "dist_high",
        "Near its highs",
        near ? "pass" : far ? "fail" : "neutral",
        near
          ? `Trading near its highs: the price sits within ${Math.abs(i.dist52wHigh).toFixed(0)}% of its recent peak, a sign of strength.`
          : far
            ? `Well off its highs: the price is about ${Math.abs(i.dist52wHigh).toFixed(0)}% below its recent peak.`
            : `Below its highs: the price is about ${Math.abs(i.dist52wHigh).toFixed(0)}% under its recent peak.`,
        30
      )
    );
  }

  return assemble("momentum", checks, 25);
}

/* ─────────────────────────────── overall ───────────────────────────────── */

export function verdictLabel(score: number): Verdict {
  if (score >= 75) return "Strong";
  if (score >= 55) return "Solid";
  if (score >= 35) return "Mixed";
  return "Weak";
}

/**
 * Compute the full grade set. Overall is the equal-weight average of whichever
 * dimensions were gradeable; it needs at least TWO gradeable dimensions to
 * render an overall letter/verdict (one lone dimension isn't an overall read).
 */
export function computeGrades(input: GradeInput): GradesResult {
  const dimensions = [
    gradeValue(input),
    gradeGrowth(input),
    gradeHealth(input),
    gradeMomentum(input),
  ];

  const graded = dimensions.filter((d) => d.sufficient && d.score != null);
  const strengths = dimensions.flatMap((d) => d.strengths);
  const weaknesses = dimensions.flatMap((d) => d.weaknesses);

  if (graded.length < 2) {
    return {
      version: GRADE_VERSION,
      overall: { letter: null, label: null, score: null, gauge: null, graded: graded.length },
      dimensions,
      strengths,
      weaknesses,
    };
  }

  const avg = Math.round(graded.reduce((s, d) => s + (d.score ?? 0), 0) / graded.length);
  return {
    version: GRADE_VERSION,
    overall: {
      letter: scoreToLetter(avg),
      label: verdictLabel(avg),
      score: avg,
      gauge: Math.min(1, Math.max(0, avg / 100)),
      graded: graded.length,
    },
    dimensions,
    strengths,
    weaknesses,
  };
}

/* ─────────────────────── derivation from raw data ──────────────────────── */
// Kept in this module (not the route) so the whole pipeline — deriving inputs
// AND grading — is unit-tested and versioned together.

export interface RawQuarter {
  label: string;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  assets: number | null;
  currentAssets: number | null;
  liabilities: number | null;
  currentLiabilities: number | null;
  equity: number | null;
  opCashFlow: number | null;
}
export interface RawAnnual {
  label: string;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
}

export interface ValuationSnapshot {
  pe: number | null;
  ps: number | null;
  pb: number | null;
  peg: number | null;
  divYield: number | null;
  epsTtm: number | null;
  revTtm: number | null;
  niTtm: number | null;
  equity: number | null;
}

const last = <T>(a: T[]): T | undefined => a[a.length - 1];
const sumLast = (a: (number | null)[], n: number): number | null => {
  const vals = a.slice(-n).filter((v): v is number => v != null);
  return vals.length === n ? vals.reduce((s, v) => s + v, 0) : null;
};

/**
 * Valuation snapshot from market cap + fundamentals. mcap-based (avoids needing
 * shares outstanding) so P/E, P/S, P/B are consistent with the median RPC.
 * TTM = trailing four reported quarters. PEG uses annual EPS growth. Returns
 * nulls wherever the inputs aren't there (unprofitable → no P/E, etc.).
 */
export function computeValuation(
  mcap: number | null,
  price: number | null,
  quarterly: RawQuarter[],
  annual: RawAnnual[],
  trailingDividendPerShare: number | null
): ValuationSnapshot {
  const revTtm = sumLast(quarterly.map((q) => q.revenue), 4);
  const niTtm = sumLast(quarterly.map((q) => q.netIncome), 4);
  const epsTtm = sumLast(quarterly.map((q) => q.eps), 4);
  const equity = last(quarterly)?.equity ?? null;

  const pe = mcap != null && niTtm != null && niTtm > 0 ? mcap / niTtm : null;
  const ps = mcap != null && revTtm != null && revTtm > 0 ? mcap / revTtm : null;
  const pb = mcap != null && equity != null && equity > 0 ? mcap / equity : null;

  // Earnings growth for PEG — from annual net income, oldest→newest CAGR.
  let peg: number | null = null;
  if (pe != null) {
    const nis = annual.map((a) => a.netIncome).filter((v): v is number => v != null && v > 0);
    if (nis.length >= 2) {
      const years = nis.length - 1;
      const growth = (Math.pow(nis[nis.length - 1] / nis[0], 1 / years) - 1) * 100;
      if (growth > 0) peg = pe / growth;
    }
  }

  const divYield =
    price != null && price > 0 && trailingDividendPerShare != null && trailingDividendPerShare > 0
      ? (trailingDividendPerShare / price) * 100
      : price != null && price > 0
        ? 0
        : null;

  return { pe, ps, pb, peg, divYield, epsTtm, revTtm, niTtm, equity };
}

export interface MomentumInput {
  rsi14: number | null;
  ema20State: EmaState;
  ema50State: EmaState;
  dist52wHigh: number | null;
}

/** Assemble the full GradeInput from raw fundamentals + valuation + momentum. */
export function deriveGradeInput(args: {
  valuation: ValuationSnapshot;
  sectorMedianPe: number | null;
  quarterly: RawQuarter[];
  annual: RawAnnual[];
  momentum: MomentumInput;
}): GradeInput {
  const { valuation: v, quarterly, annual, momentum, sectorMedianPe } = args;

  // Revenue CAGR from annual revenue (oldest→newest).
  let revenueCagr: number | null = null;
  const revs = annual.map((a) => a.revenue).filter((r): r is number => r != null && r > 0);
  if (revs.length >= 2) {
    const years = revs.length - 1;
    revenueCagr = (Math.pow(revs[revs.length - 1] / revs[0], 1 / years) - 1) * 100;
  }

  // YoY quarterly consistency: compare each quarter to the one 4 quarters prior.
  let quartersRevenueUp: number | null = null;
  let quartersCompared: number | null = null;
  if (quarterly.length >= 5) {
    let up = 0;
    let cmp = 0;
    for (let k = 4; k < quarterly.length; k++) {
      const cur = quarterly[k].revenue;
      const prior = quarterly[k - 4].revenue;
      if (cur != null && prior != null && prior !== 0) {
        cmp++;
        if (cur > prior) up++;
      }
    }
    if (cmp > 0) {
      quartersRevenueUp = up;
      quartersCompared = cmp;
    }
  }

  // Net-margin trend: latest quarter margin vs the quarter 4 periods earlier.
  let marginTrendPp: number | null = null;
  if (quarterly.length >= 5) {
    const cur = last(quarterly)!;
    const prior = quarterly[quarterly.length - 5];
    if (cur.revenue && cur.netIncome != null && prior.revenue && prior.netIncome != null) {
      const curM = (cur.netIncome / cur.revenue) * 100;
      const priorM = (prior.netIncome / prior.revenue) * 100;
      marginTrendPp = curM - priorM;
    }
  }

  const latestEps = last(quarterly)?.eps ?? null;
  const latestOcf = last(quarterly)?.opCashFlow ?? null;
  const latestLiab = last(quarterly)?.liabilities ?? null;
  const latestEquity = last(quarterly)?.equity ?? null;
  const latestCA = last(quarterly)?.currentAssets ?? null;
  const latestCL = last(quarterly)?.currentLiabilities ?? null;

  return {
    pe: v.pe,
    ps: v.ps,
    pb: v.pb,
    peg: v.peg,
    sectorMedianPe,
    revenueCagr,
    quartersRevenueUp,
    quartersCompared,
    marginTrendPp,
    epsPositive: latestEps != null ? latestEps > 0 : null,
    debtToEquity:
      latestLiab != null && latestEquity != null && latestEquity > 0
        ? latestLiab / latestEquity
        : null,
    currentRatio:
      latestCA != null && latestCL != null && latestCL > 0 ? latestCA / latestCL : null,
    opCashFlowPositive: latestOcf != null ? latestOcf > 0 : null,
    netIncomePositiveTtm: v.niTtm != null ? v.niTtm > 0 : null,
    rsi14: momentum.rsi14,
    ema20State: momentum.ema20State,
    ema50State: momentum.ema50State,
    dist52wHigh: momentum.dist52wHigh,
  };
}
