import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getGroupedDaily,
  getTickerDetail,
  recentWeekdays,
  screenerConfigured,
  sleep,
  type GroupedBar,
} from "@/lib/market/screener-polygon";
import { UNIVERSE, computeMetrics } from "@/lib/screener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Screener refresh (Vercel Cron → this route; see .planning/SCREENER-WIRING.md).
 *
 * Two modes, ONE Polygon-frugal design:
 *   • default (nightly cron): fetch the latest trading day's grouped-daily
 *     (ONE call = every US ticker) → append {close, volume} to screener_history
 *     for the EXISTING universe → recompute every metric from the trailing
 *     series → upsert screener_metrics. Idempotent per day (history PK is
 *     (ticker, as_of); metrics upsert on ticker). A capped batch of stale/missing
 *     ticker-details (mcap/name/sector) is refreshed each run.
 *   • ?bootstrap=1&days=70 : deep backfill — pull ~70 weekdays of grouped-daily,
 *     build history for every ticker, keep the liquid top-of-book (price + avg
 *     dollar-volume), resolve market cap via cached ticker-details, drop names
 *     under $300M mcap, then compute + write. Long-running: intended to be run
 *     ONCE locally against live (dev server has no 60s ceiling). Purely additive.
 *
 * Auth: copies /api/cron/track-performance exactly — if CRON_SECRET is set,
 * require Bearer CRON_SECRET (Vercel injects it) OR ?secret=. No secret → refuse.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 401 }
    );
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  const ok = auth === `Bearer ${secret}` || qsSecret === secret;
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!screenerConfigured()) {
    return NextResponse.json({ error: "POLYGON_API_KEY missing" }, { status: 500 });
  }

  const db = createAdminClient();
  const isBootstrap = req.nextUrl.searchParams.get("bootstrap") === "1";
  const days = Math.min(
    260,
    Math.max(30, Number(req.nextUrl.searchParams.get("days")) || 70)
  );

  try {
    return isBootstrap
      ? await bootstrap(db, days)
      : await incremental(db);
  } catch (e) {
    return NextResponse.json(
      { error: "refresh failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}

type Db = ReturnType<typeof createAdminClient>;

/* ---------------------------------------------------------------------------
 * BOOTSTRAP — deep backfill (run once locally).
 * ------------------------------------------------------------------------- */
async function bootstrap(db: Db, days: number) {
  // 1. Pull `days` weekdays of grouped-daily, OLD → NEW, skipping empty days.
  const dates = recentWeekdays(days).reverse(); // oldest first
  const series = new Map<
    string,
    { closes: number[]; volumes: number[]; latestOpen: number | null }
  >();
  let tradingDays = 0;

  for (const date of dates) {
    const bars = await getGroupedDaily(date);
    if (bars == null) {
      await sleep(1200); // hard failure (maybe 429) — back off, then continue
      continue;
    }
    if (bars.length === 0) continue; // holiday / non-trading day
    tradingDays++;
    for (const b of bars) {
      if (!isSaneBar(b)) continue;
      let s = series.get(b.T);
      if (!s) {
        s = { closes: [], volumes: [], latestOpen: null };
        series.set(b.T, s);
      }
      s.closes.push(b.c);
      s.volumes.push(b.v);
      s.latestOpen = b.o; // last write wins → newest day's open (for gap)
    }
    await sleep(120); // polite pacing between grouped-daily calls
  }

  // 2. Liquidity pre-filter (needs no per-ticker call): price + avg $-volume.
  type Cand = { ticker: string; dollarVol: number };
  const candidates: Cand[] = [];
  for (const [ticker, s] of series) {
    const price = s.closes[s.closes.length - 1];
    if (price == null || price < UNIVERSE.MIN_PRICE) continue;
    const n = Math.min(20, s.volumes.length);
    if (n === 0) continue;
    const avgVol =
      s.volumes.slice(-n).reduce((a, b) => a + b, 0) / n;
    const dollarVol = avgVol * price;
    if (dollarVol < UNIVERSE.MIN_AVG_DOLLAR_VOL) continue;
    candidates.push({ ticker, dollarVol });
  }
  candidates.sort((a, b) => b.dollarVol - a.dollarVol);
  const top = candidates.slice(0, UNIVERSE.MAX_CANDIDATES);

  // 3. Resolve mcap / name / sector via cached ticker-details (paced batches).
  const detail = new Map<
    string,
    { name: string | null; mcap: number | null; sector: string | null }
  >();
  const BATCH = 20;
  for (let i = 0; i < top.length; i += BATCH) {
    const slice = top.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map((c) => getTickerDetail(c.ticker))
    );
    results.forEach((d, j) => {
      const t = slice[j].ticker;
      if (d) detail.set(t, { name: d.name, mcap: d.marketCap, sector: d.sector });
    });
    await sleep(250);
  }

  // 4. Keep mcap ≥ threshold; compute metrics; stage writes.
  let unknownMcap = 0;
  const metricRows: Record<string, unknown>[] = [];
  const keptTickers: string[] = [];
  for (const c of top) {
    const d = detail.get(c.ticker);
    if (!d || d.mcap == null || d.mcap < UNIVERSE.MIN_MCAP) {
      unknownMcap++;
      continue;
    }
    const s = series.get(c.ticker)!;
    const m = computeMetrics({
      closes: s.closes,
      volumes: s.volumes,
      latestOpen: s.latestOpen,
    });
    keptTickers.push(c.ticker);
    metricRows.push({ ticker: c.ticker, name: d.name, sector: d.sector, mcap: d.mcap, ...m, updated_at: new Date().toISOString() });
  }

  // Persist metrics.
  await upsertMetrics(db, metricRows);

  // Persist compact history for kept tickers using the tail of trading dates.
  await persistHistory(db, keptTickers, series, tradingDays);

  await db.from("screener_meta").upsert(
    {
      id: true,
      last_run_at: new Date().toISOString(),
      last_trading_day: newestTradingDate(dates),
      universe_count: keptTickers.length,
      unknown_mcap_excluded: unknownMcap,
      history_days: tradingDays,
      bootstrap_done: true,
      note: `bootstrap ${tradingDays} trading days; ${candidates.length} liquid → top ${top.length} → ${keptTickers.length} kept (mcap ≥ $300M)`,
    },
    { onConflict: "id" }
  );

  return NextResponse.json({
    ok: true,
    mode: "bootstrap",
    trading_days: tradingDays,
    liquid_candidates: candidates.length,
    detail_calls: top.length,
    universe_kept: keptTickers.length,
    unknown_mcap_excluded: unknownMcap,
    history_tickers_written: keptTickers.length,
  });
}

/* ---------------------------------------------------------------------------
 * INCREMENTAL — nightly one-call refresh.
 * ------------------------------------------------------------------------- */
async function incremental(db: Db) {
  // Universe = whatever bootstrap established.
  const { data: uni } = await db
    .from("screener_metrics")
    .select("ticker, name, sector, mcap, updated_at");
  const universe = (uni || []) as {
    ticker: string;
    name: string | null;
    sector: string | null;
    mcap: number | null;
    updated_at: string | null;
  }[];
  if (universe.length === 0) {
    return NextResponse.json({
      ok: true,
      mode: "incremental",
      note: "universe empty — run ?bootstrap=1 first",
    });
  }
  const uniSet = new Set(universe.map((u) => u.ticker));

  // 1. Latest trading day grouped-daily (walk back until a non-empty day).
  let bars: GroupedBar[] | null = null;
  let usedDate = "";
  for (const date of recentWeekdays(6)) {
    const b = await getGroupedDaily(date);
    if (b && b.length > 0) {
      bars = b;
      usedDate = date;
      break;
    }
    await sleep(200);
  }
  if (!bars) {
    return NextResponse.json(
      { ok: false, mode: "incremental", note: "no grouped-daily available" },
      { status: 200 }
    );
  }

  // 2. Append today's close/volume for universe tickers (idempotent PK).
  const todays = new Map<string, { close: number; open: number; volume: number }>();
  const histRows: { ticker: string; as_of: string; close: number; volume: number }[] =
    [];
  for (const b of bars) {
    if (!uniSet.has(b.T) || !isSaneBar(b)) continue;
    todays.set(b.T, { close: b.c, open: b.o, volume: b.v });
    histRows.push({ ticker: b.T, as_of: usedDate, close: b.c, volume: b.v });
  }
  for (let i = 0; i < histRows.length; i += 500) {
    await db
      .from("screener_history")
      .upsert(histRows.slice(i, i + 500), { onConflict: "ticker,as_of" });
  }

  // 3. Recompute metrics for each universe ticker from its trailing history.
  //    Pull history in chunks so one query stays bounded.
  const detailRefreshBudget = 100; // cap stale mcap/name refetches per run
  let detailRefreshed = 0;
  const metricRows: Record<string, unknown>[] = [];
  const staleCut = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < universe.length; i += 200) {
    const chunk = universe.slice(i, i + 200);
    const tickers = chunk.map((u) => u.ticker);
    const { data: hist } = await db
      .from("screener_history")
      .select("ticker, as_of, close, volume")
      .in("ticker", tickers)
      .order("as_of", { ascending: true });
    const byTicker = new Map<string, { closes: number[]; volumes: number[] }>();
    for (const h of (hist || []) as {
      ticker: string;
      close: number;
      volume: number | null;
    }[]) {
      let s = byTicker.get(h.ticker);
      if (!s) {
        s = { closes: [], volumes: [] };
        byTicker.set(h.ticker, s);
      }
      s.closes.push(Number(h.close));
      s.volumes.push(Number(h.volume ?? 0));
    }

    for (const u of chunk) {
      const s = byTicker.get(u.ticker);
      if (!s || s.closes.length === 0) continue;
      const today = todays.get(u.ticker);
      const m = computeMetrics({
        closes: s.closes,
        volumes: s.volumes,
        latestOpen: today?.open ?? null,
      });

      // Optionally refresh stale/missing details within budget.
      let name = u.name;
      let sector = u.sector;
      let mcap = u.mcap;
      const stale =
        u.name == null ||
        u.mcap == null ||
        (u.updated_at ? Date.parse(u.updated_at) < staleCut : true);
      if (stale && detailRefreshed < detailRefreshBudget) {
        const d = await getTickerDetail(u.ticker);
        detailRefreshed++;
        if (d) {
          name = d.name ?? name;
          sector = d.sector ?? sector;
          mcap = d.marketCap ?? mcap;
        }
      }

      metricRows.push({
        ticker: u.ticker,
        name,
        sector,
        mcap,
        ...m,
        updated_at: new Date().toISOString(),
      });
    }
  }

  await upsertMetrics(db, metricRows);

  // 4. Prune very old history so the trailing window caps near a true 52 weeks.
  const cutoff = ymdDaysAgo(400);
  await db.from("screener_history").delete().lt("as_of", cutoff);

  // 5. Trailing-window depth for meta (max rows any ticker now has).
  const { count: histDepth } = await db
    .from("screener_history")
    .select("as_of", { count: "exact", head: true })
    .eq("ticker", universe[0]?.ticker ?? "");

  await db.from("screener_meta").upsert(
    {
      id: true,
      last_run_at: new Date().toISOString(),
      last_trading_day: usedDate,
      universe_count: universe.length,
      history_days: histDepth ?? null,
      note: `incremental ${usedDate}; ${metricRows.length} metrics recomputed; ${detailRefreshed} details refreshed`,
    },
    { onConflict: "id" }
  );

  return NextResponse.json({
    ok: true,
    mode: "incremental",
    trading_day: usedDate,
    universe: universe.length,
    history_appended: histRows.length,
    metrics_recomputed: metricRows.length,
    details_refreshed: detailRefreshed,
  });
}

/* ---------------------------------------------------------------------------
 * Shared write helpers.
 * ------------------------------------------------------------------------- */
async function upsertMetrics(db: Db, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .from("screener_metrics")
      .upsert(rows.slice(i, i + 500), { onConflict: "ticker" });
  }
}

/**
 * Persist compact history for kept tickers. We stamp the trailing tradingDays
 * dates (weekday sequence approximation is fine — as_of is only used to ORDER
 * and to age-out old rows, never to reconcile to an exact calendar day).
 */
async function persistHistory(
  db: Db,
  tickers: string[],
  series: Map<
    string,
    { closes: number[]; volumes: number[]; latestOpen: number | null }
  >,
  tradingDays: number
) {
  const dateStamps = recentWeekdays(tradingDays).reverse(); // old→new, len≈tradingDays
  const rows: { ticker: string; as_of: string; close: number; volume: number }[] = [];
  for (const ticker of tickers) {
    const s = series.get(ticker);
    if (!s) continue;
    const closes = s.closes;
    const vols = s.volumes;
    // Align the tail of `dateStamps` to the tail of the arrays.
    const n = Math.min(closes.length, dateStamps.length);
    for (let k = 0; k < n; k++) {
      const idxData = closes.length - n + k;
      const idxDate = dateStamps.length - n + k;
      rows.push({
        ticker,
        as_of: dateStamps[idxDate],
        close: closes[idxData],
        volume: Math.round(vols[idxData] ?? 0),
      });
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .from("screener_history")
      .upsert(rows.slice(i, i + 500), { onConflict: "ticker,as_of" });
  }
}

function isSaneBar(b: GroupedBar): boolean {
  return (
    typeof b.c === "number" &&
    b.c > 0 &&
    typeof b.v === "number" &&
    b.v >= 0 &&
    /^[A-Z]{1,6}$/.test(b.T) // plain common-stock tickers only (no warrants/units)
  );
}

function newestTradingDate(datesOldToNew: string[]): string {
  return datesOldToNew[datesOldToNew.length - 1] ?? new Date().toISOString().slice(0, 10);
}

function ymdDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
