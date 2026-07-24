/**
 * ONE-OFF RESTORE — recompute every screener_metrics row from the intact
 * screener_history series, using the SAME indicator math the cron uses
 * (src/lib/screener.ts computeMetrics, imported via tsx-free reimplementation).
 *
 * Why this exists: the nightly incremental recompute read history with an
 * unpaginated `.in(chunk).order(as_of)` query that hit PostgREST's 1000-row
 * cap, so every ticker was computed from only its ~5 OLDEST (April) closes →
 * stale April price + NULL long-window indicators across the whole universe.
 * History itself was never corrupted, so we can recompute correctly in place.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * gap_pct is left as-is null (needs the day's open, not stored in history);
 * the next correct nightly run repopulates it.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  computeMetrics,
} from "../src/lib/screener.ts";

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnv() {
  const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of txt.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}
const env = loadEnv();
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label) {
  let delay = 500;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 5) throw e;
      console.log(`  retry ${label} (attempt ${attempt}): ${e.message}`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

// ── paginated fetch of ALL rows for a query (defeats the 1000-row cap) ────────
async function fetchAllHistory(tickers) {
  const byTicker = new Map();
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const data = await withRetry(async () => {
      const { data, error } = await db
        .from("screener_history")
        .select("ticker, as_of, close, volume")
        .in("ticker", tickers)
        .order("ticker", { ascending: true })
        .order("as_of", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      return data;
    }, `history range ${from}`);
    if (!data || data.length === 0) break;
    for (const h of data) {
      let s = byTicker.get(h.ticker);
      if (!s) {
        s = { closes: [], volumes: [] };
        byTicker.set(h.ticker, s);
      }
      s.closes.push(Number(h.close));
      s.volumes.push(Number(h.volume ?? 0));
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return byTicker;
}

async function main() {
  // All universe tickers (paginate the metrics table too — it is >1000 rows).
  const tickers = [];
  {
    const PAGE = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await db
        .from("screener_metrics")
        .select("ticker")
        .order("ticker", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) tickers.push(r.ticker);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  console.log(`universe: ${tickers.length} tickers`);

  const CHUNK = 120;
  let recomputed = 0;
  let skipped = 0;
  for (let i = 0; i < tickers.length; i += CHUNK) {
    const chunk = tickers.slice(i, i + CHUNK);
    const byTicker = await fetchAllHistory(chunk);
    const updates = [];
    for (const ticker of chunk) {
      const s = byTicker.get(ticker);
      if (!s || s.closes.length === 0) {
        skipped++;
        continue;
      }
      const m = computeMetrics({
        closes: s.closes,
        volumes: s.volumes,
        latestOpen: null, // gap_pct unavailable in restore; nightly refills
      });
      updates.push({ ticker, ...m, updated_at: new Date().toISOString() });
    }
    // Upsert only the metric columns; name/exchange/type/sector/mcap preserved
    // because these tickers already exist (ON CONFLICT UPDATE touches provided
    // columns only).
    for (let j = 0; j < updates.length; j += 200) {
      const slice = updates.slice(j, j + 200);
      await withRetry(async () => {
        const { error } = await db
          .from("screener_metrics")
          .upsert(slice, { onConflict: "ticker" });
        if (error) throw new Error(error.message);
      }, `upsert ${j}`);
    }
    recomputed += updates.length;
    if ((i / CHUNK) % 5 === 0)
      console.log(`  ${Math.min(i + CHUNK, tickers.length)}/${tickers.length} … recomputed=${recomputed}`);
  }
  console.log(`DONE. recomputed=${recomputed} skipped(no history)=${skipped}`);

  // Stamp meta so the dashboard reflects the manual restore.
  await db.from("screener_meta").upsert(
    { id: true, note: `manual restore ${new Date().toISOString()}: recomputed ${recomputed} from full history (1000-cap bug)` },
    { onConflict: "id" }
  );

  // Spot-check.
  const { data: spot } = await db
    .from("screener_metrics")
    .select("ticker, price, chg_1m, rsi14, ema20_state, ema50_state, dist_52w_high, dist_52w_low")
    .in("ticker", ["AAPL", "TXN", "LULU", "MSFT", "NVDA"]);
  console.log("SPOT CHECK:", JSON.stringify(spot, null, 2));
}

main().catch((e) => {
  console.error("RESTORE FAILED:", e);
  process.exit(1);
});
