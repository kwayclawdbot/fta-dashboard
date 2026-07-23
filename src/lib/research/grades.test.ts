/**
 * Unit tests for the research grades engine (Lane 9). Run with the zero-tooling
 * Node built-in runner:  node --test src/lib/research/grades.test.ts
 * (wired as `npm run test:grades`). No build step — Node strips the types.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GRADE_VERSION,
  scoreToLetter,
  verdictLabel,
  computeGrades,
  computeValuation,
  deriveGradeInput,
  type GradeInput,
  type RawQuarter,
  type RawAnnual,
} from "./grades.ts";

/* ── fixtures ─────────────────────────────────────────────────────────────── */

// A strong, profitable, cheaply-valued, uptrending name.
const strong: GradeInput = {
  pe: 16,
  ps: 1.8,
  pb: 2.4,
  peg: 0.8,
  sectorMedianPe: 24,
  revenueCagr: 22,
  quartersRevenueUp: 4,
  quartersCompared: 4,
  marginTrendPp: 1.4,
  epsPositive: true,
  debtToEquity: 0.6,
  currentRatio: 2.1,
  opCashFlowPositive: true,
  netIncomePositiveTtm: true,
  rsi14: 62,
  ema20State: "above",
  ema50State: "above",
  dist52wHigh: -4,
};

// A weak, unprofitable, overvalued, downtrending name.
const weak: GradeInput = {
  pe: -5,
  ps: 12,
  pb: 15,
  peg: null,
  sectorMedianPe: 24,
  revenueCagr: 1.2,
  quartersRevenueUp: 1,
  quartersCompared: 4,
  marginTrendPp: -3.2,
  epsPositive: false,
  debtToEquity: 3.5,
  currentRatio: 0.7,
  opCashFlowPositive: false,
  netIncomePositiveTtm: false,
  rsi14: 28,
  ema20State: "below",
  ema50State: "below",
  dist52wHigh: -42,
};

// A sparse small-cap / ETF: no financials at all, only price momentum data.
const sparse: GradeInput = {
  pe: null,
  ps: null,
  pb: null,
  peg: null,
  sectorMedianPe: null,
  revenueCagr: null,
  quartersRevenueUp: null,
  quartersCompared: null,
  marginTrendPp: null,
  epsPositive: null,
  debtToEquity: null,
  currentRatio: null,
  opCashFlowPositive: null,
  netIncomePositiveTtm: null,
  rsi14: 55,
  ema20State: "above",
  ema50State: "below",
  dist52wHigh: -12,
};

/* ── letter / verdict bands ───────────────────────────────────────────────── */

test("scoreToLetter honours the documented bands", () => {
  assert.equal(scoreToLetter(95), "A");
  assert.equal(scoreToLetter(80), "A");
  assert.equal(scoreToLetter(70), "B");
  assert.equal(scoreToLetter(50), "C");
  assert.equal(scoreToLetter(30), "D");
  assert.equal(scoreToLetter(10), "F");
});

test("verdictLabel never uses buy/hold/sell language", () => {
  assert.equal(verdictLabel(90), "Strong");
  assert.equal(verdictLabel(60), "Solid");
  assert.equal(verdictLabel(40), "Mixed");
  assert.equal(verdictLabel(20), "Weak");
});

/* ── full grading ─────────────────────────────────────────────────────────── */

test("strong inputs grade high across all four dimensions", () => {
  const r = computeGrades(strong);
  assert.equal(r.version, GRADE_VERSION);
  assert.equal(r.overall.graded, 4);
  for (const d of r.dimensions) {
    assert.equal(d.sufficient, true, `${d.dimension} should be gradeable`);
    assert.ok(d.score! >= 65, `${d.dimension} score ${d.score} should be >= 65`);
  }
  assert.ok(["Strong", "Solid"].includes(r.overall.label!));
  assert.ok(r.overall.gauge! > 0.6);
  assert.ok(r.strengths.length >= 4);
});

test("weak inputs grade low and surface weaknesses", () => {
  const r = computeGrades(weak);
  assert.equal(r.overall.graded, 4);
  assert.ok(r.overall.score! < 45);
  assert.ok(["Mixed", "Weak"].includes(r.overall.label!));
  assert.ok(r.weaknesses.length >= 4);
  // Unprofitable → value P/E check must fail, not silently pass.
  const value = r.dimensions.find((d) => d.dimension === "value")!;
  assert.ok(value.checks.some((c) => c.key === "pe" && c.status === "fail"));
});

test("sparse ticker: fundamentals insufficient, momentum still grades, NO overall", () => {
  const r = computeGrades(sparse);
  const byDim = Object.fromEntries(r.dimensions.map((d) => [d.dimension, d]));
  assert.equal(byDim.value.sufficient, false);
  assert.equal(byDim.value.letter, null);
  assert.equal(byDim.growth.sufficient, false);
  assert.equal(byDim.health.sufficient, false);
  assert.equal(byDim.momentum.sufficient, true);
  assert.ok(byDim.momentum.letter !== null);
  // Only one gradeable dimension → no overall read (honest, not faked).
  assert.equal(r.overall.letter, null);
  assert.equal(r.overall.label, null);
  assert.equal(r.overall.graded, 1);
});

test("every check carries a plain-English sentence with no advice verbs", () => {
  const r = computeGrades(strong);
  const banned = /\b(buy|sell|hold|should invest|guaranteed|will rise|will fall)\b/i;
  for (const d of r.dimensions) {
    for (const c of d.checks) {
      assert.ok(c.sentence.length > 12, `${d.dimension}/${c.key} sentence too short`);
      assert.ok(!banned.test(c.sentence), `advice language leaked: "${c.sentence}"`);
    }
  }
});

/* ── valuation derivation ─────────────────────────────────────────────────── */

test("computeValuation derives P/E, P/S, P/B, PEG from mcap + fundamentals", () => {
  const quarterly: RawQuarter[] = [
    q(200, 20, 0.5),
    q(210, 22, 0.55),
    q(220, 24, 0.6),
    q(230, 26, 0.65),
  ];
  const annual: RawAnnual[] = [
    { label: "2022", revenue: 600, netIncome: 60, eps: 1.5 },
    { label: "2023", revenue: 700, netIncome: 72, eps: 1.8 },
    { label: "2024", revenue: 840, netIncome: 92, eps: 2.3 },
  ];
  const mcap = 1840; // niTTM = 92, revTTM = 860, equity(last)=500
  const v = computeValuation(mcap, 50, quarterly, annual, 1.0);
  assert.ok(v.niTtm === 92);
  assert.ok(v.revTtm === 860);
  assert.ok(Math.abs(v.pe! - 1840 / 92) < 1e-6);
  assert.ok(Math.abs(v.ps! - 1840 / 860) < 1e-6);
  assert.ok(Math.abs(v.pb! - 1840 / 500) < 1e-6);
  assert.ok(v.peg != null && v.peg > 0);
  assert.ok(Math.abs(v.divYield! - 2) < 1e-6); // 1.0 / 50 * 100
});

test("computeValuation returns null P/E for an unprofitable company", () => {
  const quarterly: RawQuarter[] = [q(100, -10, -0.2), q(100, -12, -0.24), q(100, -8, -0.16), q(100, -9, -0.18)];
  const v = computeValuation(1000, 10, quarterly, [], null);
  assert.equal(v.pe, null);
  assert.ok(v.ps != null); // sales still positive
});

test("deriveGradeInput → computeGrades produces a coherent full result", () => {
  const quarterly: RawQuarter[] = [];
  // 8 quarters of rising revenue, positive margins, healthy balance sheet.
  for (let k = 0; k < 8; k++) {
    quarterly.push({
      label: `Q${(k % 4) + 1} 202${3 + Math.floor(k / 4)}`,
      revenue: 200 + k * 10,
      netIncome: 20 + k * 2,
      eps: 0.5 + k * 0.03,
      assets: 1000,
      currentAssets: 400,
      liabilities: 500,
      currentLiabilities: 200,
      equity: 500,
      opCashFlow: 30 + k,
    });
  }
  const annual: RawAnnual[] = [
    { label: "2023", revenue: 820, netIncome: 84, eps: 2.0 },
    { label: "2024", revenue: 980, netIncome: 108, eps: 2.6 },
  ];
  const valuation = computeValuation(1500, 40, quarterly, annual, 0);
  const input = deriveGradeInput({
    valuation,
    sectorMedianPe: 20,
    quarterly,
    annual,
    momentum: { rsi14: 60, ema20State: "above", ema50State: "above", dist52wHigh: -6 },
  });
  assert.equal(input.quartersCompared, 4);
  assert.equal(input.quartersRevenueUp, 4);
  assert.ok(input.debtToEquity! === 1);
  assert.ok(input.currentRatio! === 2);
  assert.ok(input.revenueCagr! > 0);

  const r = computeGrades(input);
  assert.equal(r.overall.graded, 4);
  assert.ok(r.overall.letter !== null);
});

function q(revenue: number, netIncome: number, eps: number): RawQuarter {
  return {
    label: "Q",
    revenue,
    netIncome,
    eps,
    assets: 1000,
    currentAssets: 400,
    liabilities: 500,
    currentLiabilities: 200,
    equity: 500,
    opCashFlow: 30,
  };
}
