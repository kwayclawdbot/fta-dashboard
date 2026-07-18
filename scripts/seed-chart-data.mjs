#!/usr/bin/env node
/**
 * seed-chart-data.mjs
 * ------------------------------------------------------------------
 * Generates a deterministic, DATA-TRUE chart path for every game_items
 * round and writes it to game_items.chart_data (jsonb).
 *
 * - candle-battle rounds get a single-candle tick "path" (the tug-of-war
 *   forming live) whose O/H/L/C + wick shape match the round's answer + why.
 * - trend-or-trap rounds get an OHLC "series" (battles in a row) that forms
 *   a real pattern and RESOLVES in the answer's direction.
 *
 * Determinism: a seeded PRNG (mulberry32) keyed off the item id, so the same
 * round always plays the exact same path in the client.
 *
 * Usage:  node scripts/seed-chart-data.mjs [--dry]
 *   Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local,
 *   updates every row, and writes supabase/migrations/023_chart_data_seed.sql
 *   as an auditable record of exactly what was stored.
 * ------------------------------------------------------------------
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/* ---------- env ---------- */
function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

/* ---------- seeded PRNG ---------- */
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round2 = (n) => Math.round(n * 100) / 100;

/* =================================================================
 * CANDLE BATTLE — one candle forming live
 * ================================================================= */
function genCandle(item) {
  const rnd = mulberry32(hashStr(item.id));
  const text = `${item.prompt} ${item.why || ""}`.toLowerCase();
  const green = item.answer === "GREEN TEAM";

  // explicit prices in the prompt (e.g. "$50 ... $58", "dipped to $28")
  const nums = (item.prompt.match(/\$(\d+(?:\.\d+)?)/g) || []).map((s) =>
    parseFloat(s.slice(1))
  );

  let o, c, low, high;
  if (nums.length >= 2) {
    o = nums[0];
    c = nums[nums.length - 1];
    if (nums.length >= 3) {
      const mid = nums[1];
      if (/dip|dropped|pushed it back|rescued/.test(text)) low = mid;
      else if (/spike|dragged it back|rejected/.test(text)) high = mid;
    }
  } else {
    o = 100;
    // body magnitude from language
    let mv = 0.045;
    if (/tall|big|long (green|red )?body|way (up|high|down|low)|swallow|engulf|controlled the whole|pulled the rope hard|right at the (high|low)|no (upper|lower) wick/.test(text))
      mv = 0.075 + rnd() * 0.015;
    else if (/medium/.test(text)) mv = 0.032 + rnd() * 0.008;
    else if (/small|short|a bit|a little|barely|tiny .*body|hammer|shooting|dipped|spiked/.test(text))
      mv = 0.012 + rnd() * 0.008;
    c = green ? o * (1 + mv) : o * (1 - mv);
  }

  const bodyTop = Math.max(o, c);
  const bodyBot = Math.min(o, c);
  const body = Math.max(bodyTop - bodyBot, o * 0.004);

  // wick sizing from language (as multiples of body / floors)
  const longUpper = /long upper wick|shooting|rejected the highs|spiked|dragged it back/.test(text);
  const longLower = /long lower wick|hammer|pushed (it |them )?back up|pushed back|rescued|buyers pushed|dipped/.test(text);
  const bothLong = /wicks on both|both ends|long wicks on both/.test(text);
  const noUpper = /no upper wick|closes right at the high|right at the high|closed at .* high/.test(text);
  const noLower = /no lower wick|closes right at the low|right at the low|closed at .* low/.test(text);
  const tinyWicks = /tiny wick|small wick|only tiny wick/.test(text);

  let up = body * (0.25 + rnd() * 0.25); // default modest
  let dn = body * (0.25 + rnd() * 0.25);
  if (tinyWicks) { up = body * 0.12; dn = body * 0.12; }
  if (bothLong) { up = body * (2.2 + rnd()); dn = body * (2.2 + rnd()); }
  if (longUpper) up = body * (2.4 + rnd() * 1.2);
  if (longLower) dn = body * (2.4 + rnd() * 1.2);
  if (noUpper) up = body * 0.02;
  if (noLower) dn = body * 0.02;

  if (high == null) high = bodyTop + up;
  else high = Math.max(high, bodyTop + body * 0.05);
  if (low == null) low = bodyBot - dn;
  else low = Math.min(low, bodyBot - body * 0.05);

  // guarantee ordering
  high = Math.max(high, bodyTop + o * 0.002);
  low = Math.min(low, bodyBot - o * 0.002);

  // where in time each extreme is touched (shapes the tug-of-war walk)
  let tLow, tHigh;
  if (longLower || /hammer|dipped|pushed back|rescued/.test(text)) {
    tLow = 0.38 + rnd() * 0.08; tHigh = green ? 0.94 : 0.9;
  } else if (longUpper || /shooting|spiked|rejected/.test(text)) {
    tHigh = 0.38 + rnd() * 0.08; tLow = green ? 0.9 : 0.94;
  } else if (bothLong) {
    if (rnd() < 0.5) { tLow = 0.28; tHigh = 0.6; } else { tHigh = 0.3; tLow = 0.62; }
  } else if (green) {
    tLow = 0.06 + rnd() * 0.05; tHigh = 0.93 + rnd() * 0.05;
  } else {
    tHigh = 0.06 + rnd() * 0.05; tLow = 0.93 + rnd() * 0.05;
  }

  // build path from sorted keypoints, piecewise-linear + seeded noise
  const keys = [
    [0, o],
    [tLow, low],
    [tHigh, high],
    [1, c],
  ].sort((a, b) => a[0] - b[0]);
  const N = 46;
  const noiseAmp = body * 0.14;
  const path = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    // find segment
    let k = 0;
    while (k < keys.length - 1 && t > keys[k + 1][0]) k++;
    const [t0, v0] = keys[k];
    const [t1, v1] = keys[Math.min(k + 1, keys.length - 1)];
    const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
    let v = v0 + (v1 - v0) * f;
    const edge = i === 0 || i === N - 1;
    const nearKey = keys.some(([kt]) => Math.abs(t - kt) < 0.03);
    if (!edge && !nearKey) v += (rnd() - 0.5) * 2 * noiseAmp;
    v = Math.min(high, Math.max(low, v));
    path.push(round2(v));
  }
  path[0] = round2(o);
  path[N - 1] = round2(c);
  // force the exact extremes onto their nearest sample
  const idxLow = Math.round(tLow * (N - 1));
  const idxHigh = Math.round(tHigh * (N - 1));
  if (idxLow > 0 && idxLow < N - 1) path[idxLow] = round2(low);
  if (idxHigh > 0 && idxHigh < N - 1) path[idxHigh] = round2(high);

  return {
    kind: "candle",
    o: round2(o),
    h: round2(high),
    l: round2(low),
    c: round2(c),
    path,
    decisionAt: 0.8,
  };
}

/* =================================================================
 * TREND OR TRAP — battles in a row (mini candlestick chart)
 * ================================================================= */
// Build OHLC candles from a close-series. o = prev close, wick from vol.
function closesToCandles(closes, rnd, vol = 1) {
  const candles = [];
  let prev = closes[0] - (closes[1] - closes[0]) * 0.4;
  for (let i = 0; i < closes.length; i++) {
    const o = round2(prev);
    const c = round2(closes[i]);
    const top = Math.max(o, c);
    const bot = Math.min(o, c);
    const range = Math.max(Math.abs(c - o), 0.4) ;
    const uw = range * (0.15 + rnd() * 0.5) * vol;
    const lw = range * (0.15 + rnd() * 0.5) * vol;
    candles.push({
      o,
      h: round2(top + uw),
      l: round2(bot - lw),
      c,
    });
    prev = c;
  }
  return candles;
}

/* ---------- trendline helpers (computed FROM the generated candles so the
 * diagonal always sits along the real swings, never floats off the shape) --- */
function linreg(pts) {
  const nn = pts.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const { x, y } of pts) {
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const den = nn * sxx - sx * sx || 1;
  const m = (nn * sxy - sx * sy) / den;
  const c = (sy - m * sx) / nn;
  return { m, c };
}
// A rising/falling SUPPORT line — tangent UNDER the lows of [a,b], extended to `ext`.
function supportLine(candles, a, b, ext, label) {
  const pts = [];
  for (let i = a; i <= b; i++) pts.push({ x: i, y: candles[i].l });
  let { m, c } = linreg(pts);
  let off = Infinity;
  for (const p of pts) off = Math.min(off, p.y - (m * p.x + c));
  c += off; // drop the line until it just touches the lowest low
  return {
    kind: "trendline",
    from: { index: a, price: round2(m * a + c) },
    to: { index: ext, price: round2(m * ext + c) },
    label,
    tone: "gold",
  };
}
// A RESISTANCE line — tangent OVER the highs of [a,b], extended to `ext`.
function resistanceLine(candles, a, b, ext, label) {
  const pts = [];
  for (let i = a; i <= b; i++) pts.push({ x: i, y: candles[i].h });
  let { m, c } = linreg(pts);
  let off = -Infinity;
  for (const p of pts) off = Math.max(off, p.y - (m * p.x + c));
  c += off; // raise the line until it just touches the highest high
  return {
    kind: "trendline",
    from: { index: a, price: round2(m * a + c) },
    to: { index: ext, price: round2(m * ext + c) },
    label,
    tone: "gold",
  };
}
// A moving-average polyline (for the golden/death cross round).
function maLine(candles, w, label, tone, endIdx) {
  const closes = candles.map((k) => k.c);
  const last = endIdx == null ? closes.length - 1 : endIdx;
  const points = [];
  for (let i = 0; i <= last; i++) {
    let s = 0, cnt = 0;
    for (let j = Math.max(0, i - w + 1); j <= i; j++) { s += closes[j]; cnt++; }
    points.push({ index: i, price: round2(s / cnt) });
  }
  return { kind: "trendline", from: points[0], to: points[points.length - 1], points, label, tone };
}
/**
 * Attach the ONE annotation that matches each round's own description.
 * Level-based rounds already carry `levels` (support/resistance/neckline/swept
 * level); this covers the trend / momentum / MA-cross rounds with a diagonal.
 */
function trendlinesFor(id, candles, di) {
  const nC = candles.length;
  const b = Math.max(1, di - 1); // last setup bar
  const up = (label) => [supportLine(candles, 0, b, nC - 1, label)];
  const down = (label) => [resistanceLine(candles, 0, b, nC - 1, label)];
  switch (id) {
    case "tot-001": // higher highs + higher lows
    case "tot-019": // steady weekly uptrend
    case "tot-022": // buyers keep making higher lows
    case "tot-003": // buyers flood in
    case "tot-011": // three white soldiers thrust
    case "tot-023": // earnings beat, buyers rush
      return up("Uptrend");
    case "tot-002": // lower highs + lower lows
    case "tot-020": // steady weekly downtrend
    case "tot-004": // sellers flood in
    case "tot-012": // three black crows thrust
      return down("Downtrend");
    case "tot-017": // pulls back to a rising trendline, bounces
    case "tot-018": // falls straight through a rising trendline
      return up("Trendline");
    case "tot-013": // extended DOWN leg, then reclaims up (RSI < 30 bounce)
      return down("Downtrend");
    case "tot-014": // extended UP leg, then rolls over (RSI > 70)
      return up("Uptrend");
    case "tot-007": // 50MA crosses ABOVE 200MA — golden cross
    case "tot-008": // 50MA crosses BELOW 200MA — death cross
      return [
        maLine(candles, 3, "50 MA", "gold"),
        maLine(candles, 6, "200 MA", "soft", nC - 3), // trim 2 bars so labels don't collide
      ];
    default:
      return [];
  }
}

function genSeries(item) {
  const rnd = mulberry32(hashStr(item.id));
  const climbing = item.answer === "CLIMBING";
  const id = item.id;
  const base = 55;
  const step = 2.4;

  // --- shape builders return { closes, decisionIndex, vol } ---
  const jig = (a) => a + (rnd() - 0.5) * step * 0.5;

  function staircase(dir) {
    const closes = [];
    let p = base;
    const n = 12;
    const di = 8;
    for (let i = 0; i < n; i++) {
      // pullback every ~3rd bar to make higher-lows / lower-highs visible
      const pull = i % 3 === 2 ? -dir * step * (0.5 + rnd() * 0.3) : 0;
      p += dir * step * (0.7 + rnd() * 0.6) + pull;
      closes.push(jig(p));
    }
    return { closes, decisionIndex: di, vol: 1 };
  }
  function flood(dir) {
    const closes = [];
    let p = base;
    const di = 7;
    for (let i = 0; i < 12; i++) {
      if (i < 4) p += (rnd() - 0.5) * step * 0.6; // flat standoff
      else p += dir * step * (1.0 + rnd() * 0.7);
      closes.push(jig(p));
    }
    return { closes, decisionIndex: di, vol: 1.1 };
  }
  function threeSoldiers(dir) {
    const closes = [];
    let p = base;
    const di = 8;
    for (let i = 0; i < 12; i++) {
      if (i < 5) p += (rnd() - 0.5) * step * 0.7;
      else if (i < 8) p += dir * step * (1.3 + rnd() * 0.4); // the 3 strong bars
      else p += dir * step * (0.8 + rnd() * 0.5);
      closes.push(jig(p));
    }
    return { closes, decisionIndex: di, vol: 0.9 };
  }
  function crossing(dir) {
    const closes = [];
    let p = base;
    const di = 7;
    for (let i = 0; i < 12; i++) {
      const accel = Math.max(0, i - 4) * 0.22;
      p += dir * step * (0.35 + accel + rnd() * 0.4);
      closes.push(jig(p));
    }
    return { closes, decisionIndex: di, vol: 1 };
  }
  function breakoutLvl(dir) {
    const closes = [];
    let p = base;
    const di = 8;
    const level = base + dir * step * 1.4;
    for (let i = 0; i < 12; i++) {
      if (i < 8) p = level - dir * (0.4 + rnd() * 1.2) * step * 0.6; // ride under/over the level
      else p += dir * step * (1.4 + rnd() * 0.6); // break with volume
      closes.push(jig(p));
    }
    // the level the break happens on: resistance breaking up, support breaking down
    const levels = [
      {
        price: round2(level),
        kind: dir > 0 ? "resistance" : "support",
        label: dir > 0 ? "Resistance" : "Support",
      },
    ];
    return { closes, decisionIndex: di, vol: 1.2, levels };
  }
  function doubleBottom() {
    // down, low1, up to neckline, down to low2, break up
    const lo = base - step * 2.2;
    const neck = base - step * 0.4;
    const pts = [base, base - step, lo, base - step * 1.3, neck, base - step * 1.1, lo + 0.2];
    const di = pts.length; // decision right as second bottom turns up
    const res = [neck + 0.3, neck + step, neck + step * 2, neck + step * 2.8];
    const levels = [
      { price: round2(lo), kind: "support", label: "Support" },
      { price: round2(neck), kind: "resistance", label: "Neckline" },
    ];
    return { closes: [...pts, ...res], decisionIndex: di, vol: 1, levels };
  }
  function headShoulders() {
    const sh = base + step * 1.4;
    const head = base + step * 2.6;
    const neck = base + step * 0.2;
    const pts = [base, sh, neck, head, neck + 0.2, sh - 0.3, neck];
    const di = pts.length;
    const res = [neck - step, neck - step * 2, neck - step * 2.9, neck - step * 3.6];
    // the neckline is the floor price stands on, then breaks below (bearish)
    const levels = [{ price: round2(neck), kind: "support", label: "Neckline" }];
    return { closes: [...pts, ...res], decisionIndex: di, vol: 1, levels };
  }
  function levelBounce(dir) {
    // dir = +1 support bounce (climbing), -1 resistance reject (falling)
    const level = dir > 0 ? base - step * 1.6 : base + step * 1.6;
    const pts = [];
    let p = base;
    for (let i = 0; i < 7; i++) {
      // oscillate toward the level, touching it a few times
      p = i % 2 === 0 ? level + dir * (0.1 + rnd() * 0.2) : base + dir * (rnd() * 0.6);
      pts.push(jig(p));
    }
    const di = pts.length;
    const res = [];
    let r = level;
    for (let i = 0; i < 4; i++) {
      r += dir * step * (1.0 + rnd() * 0.5);
      res.push(jig(r));
    }
    // dir>0 = support bounce (floor), dir<0 = resistance rejection (ceiling)
    const levels = [
      {
        price: round2(level),
        kind: dir > 0 ? "support" : "resistance",
        label: dir > 0 ? "Support" : "Resistance",
      },
    ];
    return { closes: [...pts, ...res], decisionIndex: di, vol: 1.1, levels };
  }
  function trendBreak(dir) {
    // rising trend that then breaks the OTHER way (the trap) -> answer=dir
    const up = -dir; // setup trends opposite to the answer
    const closes = [];
    let p = base;
    const di = 8;
    for (let i = 0; i < 8; i++) {
      const pull = i % 3 === 2 ? -up * step * 0.5 : 0;
      p += up * step * (0.7 + rnd() * 0.4) + pull;
      closes.push(jig(p));
    }
    for (let i = 0; i < 4; i++) {
      p += dir * step * (1.4 + rnd() * 0.6); // sharp break the resolving way
      closes.push(jig(p));
    }
    return { closes, decisionIndex: di, vol: 1.2 };
  }
  function rsiReversal(dir) {
    // extended move opposite, then reverse dir
    const away = -dir;
    const closes = [];
    let p = base;
    const di = 8;
    for (let i = 0; i < 8; i++) {
      p += away * step * (1.0 + rnd() * 0.5);
      closes.push(jig(p));
    }
    for (let i = 0; i < 4; i++) {
      p += dir * step * (1.2 + rnd() * 0.6);
      closes.push(jig(p));
    }
    return { closes, decisionIndex: di, vol: 1.1 };
  }
  function squeeze(dir) {
    const closes = [];
    let p = base;
    const di = 8;
    for (let i = 0; i < 8; i++) {
      const amp = step * (1 - i / 9); // contracting range
      p = base + (rnd() - 0.5) * 2 * amp;
      closes.push(round2(p));
    }
    let q = closes[closes.length - 1];
    for (let i = 0; i < 4; i++) {
      q += dir * step * (1.5 + rnd() * 0.6);
      closes.push(jig(q));
    }
    // the ceiling of the quiet range that price bursts through
    const levels = [
      {
        price: round2(base + step),
        kind: dir > 0 ? "resistance" : "support",
        label: dir > 0 ? "Resistance" : "Support",
      },
    ];
    return { closes, decisionIndex: di, vol: 1.2, levels };
  }
  function baitGrab() {
    // uptrend, quick dip below prior low (trap), then reclaim + run
    const closes = [];
    let p = base;
    for (let i = 0; i < 6; i++) {
      p += step * (0.6 + rnd() * 0.4);
      closes.push(jig(p));
    }
    const priorLow = Math.min(...closes.slice(-3));
    closes.push(round2(priorLow - step * 1.1)); // the bait (sweep low)
    const di = closes.length; // decide right at the trap
    let q = closes[closes.length - 1];
    for (let i = 0; i < 4; i++) {
      q += step * (1.5 + rnd() * 0.6); // the grab + run
      closes.push(jig(q));
    }
    // the support the bait briefly sweeps below before the grab
    const levels = [{ price: round2(priorLow), kind: "support", label: "Support" }];
    return { closes, decisionIndex: di, vol: 1.2, levels };
  }

  const routes = {
    "tot-001": () => staircase(1),
    "tot-002": () => staircase(-1),
    "tot-003": () => flood(1),
    "tot-004": () => flood(-1),
    "tot-005": () => levelBounce(1),
    "tot-006": () => levelBounce(-1),
    "tot-007": () => crossing(1),
    "tot-008": () => crossing(-1),
    "tot-009": () => breakoutLvl(1),
    "tot-010": () => breakoutLvl(-1),
    "tot-011": () => threeSoldiers(1),
    "tot-012": () => threeSoldiers(-1),
    "tot-013": () => rsiReversal(1),
    "tot-014": () => rsiReversal(-1),
    "tot-015": () => headShoulders(),
    "tot-016": () => doubleBottom(),
    "tot-017": () => staircase(1),
    "tot-018": () => trendBreak(-1),
    "tot-019": () => staircase(1),
    "tot-020": () => staircase(-1),
    "tot-021": () => squeeze(1),
    "tot-022": () => staircase(1),
    "tot-023": () => flood(1),
    "tot-024": () => baitGrab(),
  };

  const build = routes[id] || (() => staircase(climbing ? 1 : -1));
  const { closes, decisionIndex, vol, levels } = build();
  const candles = closesToCandles(closes, rnd, vol);
  const out = { kind: "series", candles, decisionIndex };
  if (levels && levels.length) out.levels = levels;
  const trendlines = trendlinesFor(id, candles, decisionIndex);
  if (trendlines.length) out.trendlines = trendlines;
  return out;
}

/* =================================================================
 * main
 * ================================================================= */
async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");
  const dry = process.argv.includes("--dry");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: items, error } = await supabase
    .from("game_items")
    .select("id, game, prompt, answer, why, ord")
    .order("game")
    .order("ord");
  if (error) throw error;

  const sqlLines = [
    "-- 023_chart_data_seed.sql — generated by scripts/seed-chart-data.mjs",
    "-- Deterministic, data-true chart paths for every game round.",
    "",
  ];
  const summary = [];
  let issues = 0;
  let unannotated = 0;

  for (const item of items) {
    const data =
      item.game === "candle-battle" ? genCandle(item) : genSeries(item);

    // sanity — verify the path agrees with the answer
    let ok = true;
    if (data.kind === "candle") {
      const green = item.answer === "GREEN TEAM";
      ok = green ? data.c > data.o : data.c < data.o;
      summary.push(
        `${item.id} ${item.answer.padEnd(10)} o=${data.o} h=${data.h} l=${data.l} c=${data.c} ${ok ? "" : "  <-- MISMATCH"}`
      );
    } else {
      const climbing = item.answer === "CLIMBING";
      const cs = data.candles;
      const first = cs[data.decisionIndex - 1]?.c ?? cs[0].c;
      const last = cs[cs.length - 1].c;
      ok = climbing ? last > first : last < first;
      const ann = data.levels
        ? `L:${data.levels.map((l) => l.label).join("/")}`
        : data.trendlines
          ? `T:${data.trendlines.map((t) => t.label).join("/")}`
          : "— NONE";
      summary.push(
        `${item.id} ${item.answer.padEnd(9)} di=${data.decisionIndex} ${first}->${last} [${ann}] ${ok ? "" : "  <-- MISMATCH"}`
      );
      if (!data.levels && !data.trendlines) unannotated++;
    }
    if (!ok) issues++;

    const json = JSON.stringify(data);
    sqlLines.push(
      `update public.game_items set chart_data = '${json.replace(/'/g, "''")}'::jsonb where id = '${item.id}';`
    );

    if (!dry) {
      const { error: upErr } = await supabase
        .from("game_items")
        .update({ chart_data: data })
        .eq("id", item.id);
      if (upErr) throw upErr;
    }
  }

  writeFileSync(
    new URL("../supabase/migrations/023_chart_data_seed.sql", import.meta.url),
    sqlLines.join("\n") + "\n"
  );

  console.log(summary.join("\n"));
  const totSeries = items.filter((i) => i.game === "trend-or-trap").length;
  console.log(
    `\n${items.length} rounds processed, ${issues} answer mismatches. ${
      dry ? "(dry run — no writes)" : "chart_data written."
    }`
  );
  console.log(
    `trend-or-trap annotation coverage: ${totSeries - unannotated}/${totSeries} (${unannotated} unannotated)`
  );
  console.log("SQL record: supabase/migrations/023_chart_data_seed.sql");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
