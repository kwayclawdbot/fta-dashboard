import type { CandleChart, SeriesChart } from "./types";

/**
 * Client-side fallback generators. Every game_items row is seeded with
 * chart_data by scripts/seed-chart-data.mjs, so these only run in the unlikely
 * event a row is missing data — they keep a round animated rather than dropping
 * to text-only. Deterministic from the round id so a given round always looks
 * the same.
 */

function hashStr(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (n: number) => Math.round(n * 100) / 100;

export function fallbackCandle(id: string, answer: string): CandleChart {
  const rnd = mulberry32(hashStr(id));
  const green = answer === "GREEN TEAM";
  const o = 100;
  const mv = 0.05 + rnd() * 0.03;
  const c = green ? o * (1 + mv) : o * (1 - mv);
  const top = Math.max(o, c);
  const bot = Math.min(o, c);
  const body = top - bot;
  const high = top + body * (0.3 + rnd() * 0.3);
  const low = bot - body * (0.3 + rnd() * 0.3);
  const N = 46;
  const path: number[] = [];
  const tLow = green ? 0.1 : 0.9;
  const tHigh = green ? 0.9 : 0.1;
  const keys = [
    [0, o],
    [tLow, low],
    [tHigh, high],
    [1, c],
  ].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    let k = 0;
    while (k < keys.length - 1 && t > keys[k + 1][0]) k++;
    const [t0, v0] = keys[k];
    const [t1, v1] = keys[Math.min(k + 1, keys.length - 1)];
    const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
    let v = v0 + (v1 - v0) * f;
    if (i > 0 && i < N - 1) v += (rnd() - 0.5) * body * 0.2;
    path.push(r2(Math.min(high, Math.max(low, v))));
  }
  path[0] = r2(o);
  path[N - 1] = r2(c);
  return { kind: "candle", o: r2(o), h: r2(high), l: r2(low), c: r2(c), path, decisionAt: 0.8 };
}

export function fallbackSeries(id: string, answer: string): SeriesChart {
  const rnd = mulberry32(hashStr(id));
  const dir = answer === "CLIMBING" ? 1 : -1;
  const closes: number[] = [];
  let p = 55;
  for (let i = 0; i < 12; i++) {
    const pull = i % 3 === 2 ? -dir * 1.2 : 0;
    p += dir * 2.4 * (0.7 + rnd() * 0.6) + pull;
    closes.push(p);
  }
  const candles = closes.map((c, i) => {
    const o = i === 0 ? c - dir * 1.5 : closes[i - 1];
    const top = Math.max(o, c);
    const bot = Math.min(o, c);
    const range = Math.max(Math.abs(c - o), 0.5);
    return {
      o: r2(o),
      h: r2(top + range * (0.2 + rnd() * 0.4)),
      l: r2(bot - range * (0.2 + rnd() * 0.4)),
      c: r2(c),
    };
  });
  return { kind: "series", candles, decisionIndex: 8 };
}
