#!/usr/bin/env node
/**
 * One-time FULL-UNIVERSE screener backfill (Lane 6 rebuild).
 *
 * The production cron (src/app/api/cron/refresh-screener) can bootstrap too, but
 * it writes ~700k history rows through the Supabase REST layer — slow and flaky
 * for a one-shot fill. This script does the identical computation and emits two
 * CSVs for a fast `psql \copy` load (see the accompanying loader). It is an OPS
 * MIRROR of the route: the metric math + classification below are kept identical
 * to src/lib/screener.ts on purpose (this file is .mjs and cannot import the TS).
 *
 * Output (to OUT dir, default = CWD):
 *   screener_metrics.csv   — one row per classified ticker that traded
 *   screener_history.csv   — compact {ticker, as_of, close, volume} daily series
 *
 * Env:  POLYGON_API_KEY (required).  OUT=<dir>  DAYS=70  MCAP_BUDGET=6000
 */

import { writeFileSync, createWriteStream } from "node:fs";
import { join } from "node:path";

const KEY = process.env.POLYGON_API_KEY?.trim();
if (!KEY) {
  console.error("POLYGON_API_KEY missing");
  process.exit(1);
}
const OUT = process.env.OUT || process.cwd();
const DAYS = Math.max(30, Number(process.env.DAYS) || 70);
const MCAP_BUDGET = Math.max(0, Number(process.env.MCAP_BUDGET) || 6000);
const BASE = "https://api.polygon.io";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── classification (mirrors src/lib/screener.ts) ────────────────────────── */
function exchangeName(mic) {
  return (
    { XNYS: "NYSE", XNAS: "NASDAQ", XASE: "AMEX", ARCX: "NYSE Arca", BATS: "Cboe" }[
      mic
    ] || null
  );
}
function securityType(t) {
  if (t === "CS" || t === "ADRC") return "common";
  if (t === "ETF" || t === "ETV" || t === "ETN" || t === "FUND") return "etf";
  return null;
}
function classify(t, mic) {
  const type = securityType(t);
  const exchange = exchangeName(mic);
  if (!type || !exchange) return null;
  if (type === "common" && !["NYSE", "NASDAQ", "AMEX"].includes(exchange)) return null;
  return { exchange, type };
}

/* ── metric math (mirrors src/lib/screener.ts) ───────────────────────────── */
function pctChange(to, from) {
  if (to == null || from == null || from <= 0) return null;
  return ((to - from) / from) * 100;
}
function nBack(closes, n) {
  const i = closes.length - 1 - n;
  return i >= 0 ? closes[i] : null;
}
function trailingMean(values, n) {
  if (values.length === 0) return null;
  const slice = values.slice(-n);
  if (slice.length === 0) return null;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}
function rsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period,
    avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
function ema(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let e = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) e = closes[i] * k + e * (1 - k);
  return e;
}
function emaState(price, e) {
  if (price == null || e == null) return "unknown";
  return price >= e ? "above" : "below";
}
function computeMetrics(closes, volumes, latestOpen) {
  const price = closes.length ? closes[closes.length - 1] : null;
  const prev = nBack(closes, 1);
  const hi = closes.length ? Math.max(...closes) : null;
  const lo = closes.length ? Math.min(...closes) : null;
  const vol = volumes.length ? volumes[volumes.length - 1] : null;
  const avgVol20 = trailingMean(volumes, 20);
  return {
    price,
    chg_1d: pctChange(price, prev),
    chg_5d: pctChange(price, nBack(closes, 5)),
    chg_1m: pctChange(price, nBack(closes, 21)),
    chg_3m: pctChange(price, nBack(closes, 63)),
    vol: vol != null ? Math.round(vol) : null,
    avg_vol_20: avgVol20,
    vol_ratio: vol != null && avgVol20 && avgVol20 > 0 ? vol / avgVol20 : null,
    dist_52w_high: price != null && hi ? pctChange(price, hi) : null,
    dist_52w_low: price != null && lo ? pctChange(price, lo) : null,
    rsi14: rsi(closes, 14),
    ema20_state: emaState(price, ema(closes, 20)),
    ema50_state: emaState(price, ema(closes, 50)),
    gap_pct: latestOpen != null ? pctChange(latestOpen, prev) : null,
  };
}

/* ── polygon fetch ───────────────────────────────────────────────────────── */
async function getJson(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) }).catch(
      () => null
    );
    if (!res) {
      await sleep(800);
      continue;
    }
    if (res.status === 429) {
      await sleep(1500);
      continue;
    }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}
function recentWeekdays(count) {
  const out = [];
  const d = new Date();
  while (out.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */
const q = (v) => {
  if (v == null) return "";
  const s = String(v);
  return `"${s.replace(/"/g, '""')}"`;
};
const n = (v) => (v == null || Number.isNaN(v) ? "" : String(v));

async function main() {
  const t0 = Date.now();

  // 1. Reference list → classified universe map.
  console.error("fetching reference tickers…");
  const ref = new Map();
  let url = `${BASE}/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${KEY}`;
  let pages = 0;
  while (url && pages < 25) {
    const j = await getJson(url);
    if (!j) break;
    for (const r of j.results || []) {
      const c = classify(r.type, r.primary_exchange);
      if (c) ref.set(r.ticker, { name: r.name || null, ...c });
    }
    pages++;
    url = j.next_url ? `${j.next_url}&apiKey=${KEY}` : null;
    await sleep(60);
  }
  console.error(`classified ${ref.size} tickers over ${pages} pages`);

  // 2. Grouped daily, old → new. Accumulate series + dated history.
  const dates = recentWeekdays(DAYS).reverse();
  const series = new Map(); // ticker → {closes, volumes, latestOpen}
  const histPath = join(OUT, "screener_history.csv");
  const histStream = createWriteStream(histPath);
  histStream.write("ticker,as_of,close,volume\n");
  let tradingDays = 0,
    histRows = 0;
  for (const date of dates) {
    const j = await getJson(
      `${BASE}/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true&apiKey=${KEY}`
    );
    if (!j) {
      await sleep(1000);
      continue;
    }
    const bars = j.results || [];
    if (bars.length === 0) continue;
    tradingDays++;
    for (const b of bars) {
      if (!ref.has(b.T) || typeof b.c !== "number" || b.c <= 0) continue;
      let s = series.get(b.T);
      if (!s) {
        s = { closes: [], volumes: [], latestOpen: null };
        series.set(b.T, s);
      }
      s.closes.push(b.c);
      s.volumes.push(b.v);
      s.latestOpen = b.o;
      histStream.write(`${q(b.T)},${date},${n(b.c)},${n(Math.round(b.v || 0))}\n`);
      histRows++;
    }
    console.error(`  ${date}: ${bars.length} bars (day ${tradingDays})`);
    await sleep(120);
  }
  await new Promise((r) => histStream.end(r));
  console.error(`history: ${histRows} rows across ${tradingDays} trading days`);

  // 3. mcap enrichment for common stocks (concurrency 25, bounded).
  const commons = [...series.keys()].filter((t) => ref.get(t).type === "common");
  const budget = Math.min(MCAP_BUDGET, commons.length);
  const targets = commons.slice(0, budget);
  const detail = new Map(); // ticker → {mcap, sector}
  console.error(`enriching mcap for ${targets.length} common stocks…`);
  const CC = 25;
  for (let i = 0; i < targets.length; i += CC) {
    const slice = targets.slice(i, i + CC);
    const res = await Promise.all(
      slice.map((t) => getJson(`${BASE}/v3/reference/tickers/${t}?apiKey=${KEY}`))
    );
    res.forEach((j, k) => {
      const r = j?.results;
      if (r)
        detail.set(slice[k], {
          mcap: r.market_cap ?? null,
          sector: r.sic_description ?? null,
        });
    });
    if (i % 500 === 0) console.error(`  …${i}/${targets.length}`);
  }

  // 4. Metrics CSV.
  const now = new Date().toISOString();
  const cols = [
    "ticker",
    "name",
    "sector",
    "exchange",
    "type",
    "mcap",
    "price",
    "chg_1d",
    "chg_5d",
    "chg_1m",
    "chg_3m",
    "vol",
    "avg_vol_20",
    "vol_ratio",
    "dist_52w_high",
    "dist_52w_low",
    "rsi14",
    "ema20_state",
    "ema50_state",
    "gap_pct",
    "mcap_updated_at",
    "updated_at",
  ];
  const metricsPath = join(OUT, "screener_metrics.csv");
  const mStream = createWriteStream(metricsPath);
  mStream.write(cols.join(",") + "\n");
  const exTally = {};
  let mcapCount = 0,
    common = 0,
    etf = 0;
  for (const [ticker, s] of series) {
    if (s.closes.length === 0) continue;
    const cls = ref.get(ticker);
    const d = detail.get(ticker);
    const m = computeMetrics(s.closes, s.volumes, s.latestOpen);
    const mcap = d?.mcap ?? null;
    if (mcap != null) mcapCount++;
    if (cls.type === "common") common++;
    else etf++;
    exTally[cls.exchange] = (exTally[cls.exchange] || 0) + 1;
    mStream.write(
      [
        q(ticker),
        q(cls.name),
        q(d?.sector ?? null),
        q(cls.exchange),
        q(cls.type),
        n(mcap),
        n(m.price),
        n(m.chg_1d),
        n(m.chg_5d),
        n(m.chg_1m),
        n(m.chg_3m),
        n(m.vol),
        n(m.avg_vol_20),
        n(m.vol_ratio),
        n(m.dist_52w_high),
        n(m.dist_52w_low),
        n(m.rsi14),
        q(m.ema20_state),
        q(m.ema50_state),
        n(m.gap_pct),
        cls.type === "common" && d ? now : "",
        now,
      ].join(",") + "\n"
    );
  }
  await new Promise((r) => mStream.end(r));

  const summary = {
    trading_days: tradingDays,
    universe: common + etf,
    common,
    etf,
    by_exchange: exTally,
    mcap_count: mcapCount,
    mcap_coverage_pct: +((mcapCount / (common || 1)) * 100).toFixed(1),
    history_rows: histRows,
    last_trading_day: dates[dates.length - 1],
    secs: +((Date.now() - t0) / 1000).toFixed(1),
  };
  writeFileSync(join(OUT, "screener_summary.json"), JSON.stringify(summary, null, 2));
  console.error("DONE");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
