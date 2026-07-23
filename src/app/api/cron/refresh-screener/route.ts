import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAllReferenceTickers,
  getGroupedDaily,
  getTickerDetail,
  recentWeekdays,
  screenerConfigured,
  sleep,
  type GroupedBar,
} from "@/lib/market/screener-polygon";
import { classify, computeMetrics } from "@/lib/screener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The nightly recompute spans ~11.5k tickers + reference pagination + a batch of
// ticker-details, which can exceed 60s. Request up to 300s (Vercel Pro honours
// this; Hobby clamps to 60). Every step is idempotent — history append, metric
// upsert and the mcap round-robin all resume cleanly — so even a clamped run
// self-heals across nights rather than corrupting anything.
export const maxDuration = 300;

/**
 * Screener refresh — FULL UNIVERSE (Lane 6 rebuild; see 106_screener_full_universe).
 *
 * The universe is EVERY common stock (+ labeled ETF) on NYSE / NASDAQ / AMEX
 * (ETFs also on NYSE Arca / Cboe) — ~8-11k rows. No mcap / liquidity gate. The
 * design stays Polygon-frugal:
 *   • reference list  (getAllReferenceTickers)  — ~13 paginated calls; classifies
 *     the universe + discovers new listings. No mcap.
 *   • grouped-daily   — ONE call = every US ticker's OHLCV for a day → history.
 *   • ticker-details  — mcap/sector, one call each → expensive → filled by a
 *     nightly ROUND-ROBIN (oldest mcap_updated_at first, ~1200/night) instead of
 *     thousands at once. Unknown mcap is never an exclusion; it renders "—".
 *
 * Two modes:
 *   • default (nightly cron): refresh classification, append the latest trading
 *     day, add new listings, recompute every metric, enrich a batch of mcaps.
 *   • ?bootstrap=1&days=70 : deep backfill — pull ~70 weekdays of grouped-daily,
 *     build full history for every classified ticker, compute + write. This is
 *     the reproducible path; the one-time live fill uses scripts/bootstrap-
 *     screener.mjs (direct COPY) because it writes ~700k history rows.
 *
 * Auth mirrors /api/cron/track-performance: Bearer CRON_SECRET or ?secret=.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  if (!(auth === `Bearer ${secret}` || qsSecret === secret)) {
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
  const mcapBudget = Math.min(
    6000,
    Math.max(0, Number(req.nextUrl.searchParams.get("mcap")) || 1000)
  );

  try {
    return isBootstrap
      ? await bootstrap(db, days, mcapBudget)
      : await incremental(db, mcapBudget);
  } catch (e) {
    return NextResponse.json(
      { error: "refresh failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}

type Db = ReturnType<typeof createAdminClient>;
type Classified = { exchange: string; type: "common" | "etf"; name: string | null };
type HistRow = { ticker: string; as_of: string; close: number; volume: number };

/* ---------------------------------------------------------------------------
 * Shared: build the classified universe reference map (ticker → class + name).
 * ------------------------------------------------------------------------- */
async function buildRefMap(): Promise<Map<string, Classified>> {
  const ref = await getAllReferenceTickers();
  const map = new Map<string, Classified>();
  for (const r of ref) {
    const c = classify(r.type, r.primaryExchange);
    if (!c) continue;
    map.set(r.ticker, { exchange: c.exchange, type: c.type, name: r.name });
  }
  return map;
}

function isSaneBar(b: GroupedBar): boolean {
  return typeof b.c === "number" && b.c > 0 && typeof b.v === "number" && b.v >= 0;
}

/* ---------------------------------------------------------------------------
 * mcap ROUND-ROBIN — enrich the N stalest common-stock rows (oldest / never
 * enriched first). Bounded per run; spreads the ~5.5k detail calls over nights.
 * ------------------------------------------------------------------------- */
async function enrichMcap(db: Db, budget: number): Promise<number> {
  if (budget <= 0) return 0;
  const { data } = await db
    .from("screener_metrics")
    .select("ticker")
    .eq("type", "common")
    .order("mcap_updated_at", { ascending: true, nullsFirst: true })
    .limit(budget);
  const tickers = ((data as { ticker: string }[]) || []).map((r) => r.ticker);
  let done = 0;
  const BATCH = 25;
  const now = new Date().toISOString();
  for (let i = 0; i < tickers.length; i += BATCH) {
    const slice = tickers.slice(i, i + BATCH);
    const details = await Promise.all(slice.map((t) => getTickerDetail(t)));
    const updates = slice.map((t, j) => {
      const d = details[j];
      return {
        ticker: t,
        mcap: d?.marketCap ?? null,
        sector: d?.sector ?? null,
        mcap_updated_at: now,
      };
    });
    // Per-row update (upsert would need every NOT-NULL column; we only touch 3).
    await Promise.all(
      updates.map((u) =>
        db
          .from("screener_metrics")
          .update({ mcap: u.mcap, sector: u.sector, mcap_updated_at: u.mcap_updated_at })
          .eq("ticker", u.ticker)
      )
    );
    done += slice.length;
    await sleep(120);
  }
  return done;
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

async function upsertHistory(db: Db, rows: HistRow[]) {
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .from("screener_history")
      .upsert(rows.slice(i, i + 500), { onConflict: "ticker,as_of" });
  }
}

async function writeMetaCounts(db: Db, patch: Record<string, unknown>) {
  const counts = await Promise.all([
    db.from("screener_metrics").select("ticker", { count: "exact", head: true }),
    db
      .from("screener_metrics")
      .select("ticker", { count: "exact", head: true })
      .eq("type", "common"),
    db
      .from("screener_metrics")
      .select("ticker", { count: "exact", head: true })
      .eq("type", "etf"),
    db
      .from("screener_metrics")
      .select("ticker", { count: "exact", head: true })
      .not("mcap", "is", null),
  ]);
  await db.from("screener_meta").upsert(
    {
      id: true,
      universe_count: counts[0].count ?? null,
      common_count: counts[1].count ?? null,
      etf_count: counts[2].count ?? null,
      mcap_count: counts[3].count ?? null,
      ...patch,
    },
    { onConflict: "id" }
  );
}

/* ---------------------------------------------------------------------------
 * BOOTSTRAP — deep backfill of the FULL universe (reproducible; run locally).
 * ------------------------------------------------------------------------- */
async function bootstrap(db: Db, days: number, mcapBudget: number) {
  const ref = await buildRefMap();

  // Pull `days` weekdays of grouped-daily, OLD → NEW, skipping empty days.
  const dates = recentWeekdays(days).reverse();
  const series = new Map<
    string,
    { closes: number[]; volumes: number[]; latestOpen: number | null }
  >();
  const histRows: HistRow[] = [];
  let tradingDays = 0;

  for (const date of dates) {
    const bars = await getGroupedDaily(date);
    if (bars == null) {
      await sleep(1200);
      continue;
    }
    if (bars.length === 0) continue;
    tradingDays++;
    for (const b of bars) {
      if (!ref.has(b.T) || !isSaneBar(b)) continue;
      let s = series.get(b.T);
      if (!s) {
        s = { closes: [], volumes: [], latestOpen: null };
        series.set(b.T, s);
      }
      s.closes.push(b.c);
      s.volumes.push(b.v);
      s.latestOpen = b.o;
      histRows.push({ ticker: b.T, as_of: date, close: b.c, volume: Math.round(b.v) });
    }
    await sleep(120);
  }

  // Compute metrics for every classified ticker that traded. mcap starts null.
  const metricRows: Record<string, unknown>[] = [];
  const now = new Date().toISOString();
  for (const [ticker, s] of series) {
    if (s.closes.length === 0) continue;
    const cls = ref.get(ticker)!;
    const m = computeMetrics({
      closes: s.closes,
      volumes: s.volumes,
      latestOpen: s.latestOpen,
    });
    metricRows.push({
      ticker,
      name: cls.name,
      exchange: cls.exchange,
      type: cls.type,
      sector: null,
      mcap: null,
      mcap_updated_at: null,
      ...m,
      updated_at: now,
    });
  }

  await upsertMetrics(db, metricRows);
  await upsertHistory(db, histRows);
  const mcapDone = await enrichMcap(db, mcapBudget);
  // Reconcile the community ❤ mirror (Lane 9) — trigger keeps it live; this is
  // the nightly safety net so a universe rebuild never drifts the counts.
  await db.rpc("reconcile_screener_likes");

  await writeMetaCounts(db, {
    last_run_at: now,
    last_trading_day: dates[dates.length - 1] ?? null,
    unknown_mcap_excluded: 0,
    history_days: tradingDays,
    bootstrap_done: true,
    note: `bootstrap ${tradingDays} trading days; ${metricRows.length} tickers; ${mcapDone} mcaps enriched`,
  });

  return NextResponse.json({
    ok: true,
    mode: "bootstrap",
    trading_days: tradingDays,
    universe: metricRows.length,
    history_rows: histRows.length,
    mcap_enriched: mcapDone,
  });
}

/* ---------------------------------------------------------------------------
 * INCREMENTAL — nightly: reclassify, append latest day, add new listings,
 * recompute every metric, enrich a batch of mcaps.
 * ------------------------------------------------------------------------- */
async function incremental(db: Db, mcapBudget: number) {
  const ref = await buildRefMap();

  // Existing universe.
  const { data: uni } = await db
    .from("screener_metrics")
    .select("ticker, name, exchange, type, sector, mcap");
  const existing = new Map(
    ((uni as { ticker: string }[]) || []).map((u) => [u.ticker, u])
  );

  // Latest trading day grouped-daily (walk back until a non-empty day).
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

  // Universe for this run = existing ∪ (classified tickers that traded today).
  const todays = new Map<string, { open: number }>();
  const histRows: HistRow[] = [];
  const newStubs: Record<string, unknown>[] = [];
  const now = new Date().toISOString();
  for (const b of bars) {
    const cls = ref.get(b.T);
    if (!cls || !isSaneBar(b)) continue;
    todays.set(b.T, { open: b.o });
    histRows.push({ ticker: b.T, as_of: usedDate, close: b.c, volume: Math.round(b.v) });
    if (!existing.has(b.T)) {
      // New listing → stub row; metrics fill in as history accrues.
      newStubs.push({
        ticker: b.T,
        name: cls.name,
        exchange: cls.exchange,
        type: cls.type,
        sector: null,
        mcap: null,
        mcap_updated_at: null,
        price: b.c,
        updated_at: now,
      });
      existing.set(b.T, {
        ticker: b.T,
        name: cls.name,
        exchange: cls.exchange,
        type: cls.type,
      } as { ticker: string });
    }
  }
  if (newStubs.length > 0) await upsertMetrics(db, newStubs);
  await upsertHistory(db, histRows);

  // Recompute metrics for every universe ticker from its trailing history.
  const universeTickers = Array.from(existing.keys());
  const metricRows: Record<string, unknown>[] = [];
  for (let i = 0; i < universeTickers.length; i += 200) {
    const chunk = universeTickers.slice(i, i + 200);
    const { data: hist } = await db
      .from("screener_history")
      .select("ticker, as_of, close, volume")
      .in("ticker", chunk)
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
    for (const ticker of chunk) {
      const s = byTicker.get(ticker);
      if (!s || s.closes.length === 0) continue;
      const cls = ref.get(ticker);
      const prev = existing.get(ticker) as {
        name?: string | null;
        exchange?: string | null;
        type?: string | null;
        sector?: string | null;
        mcap?: number | null;
      };
      const m = computeMetrics({
        closes: s.closes,
        volumes: s.volumes,
        latestOpen: todays.get(ticker)?.open ?? null,
      });
      metricRows.push({
        ticker,
        // Reference wins for identity (handles reclassification / renames).
        name: cls?.name ?? prev?.name ?? null,
        exchange: cls?.exchange ?? prev?.exchange ?? null,
        type: cls?.type ?? prev?.type ?? null,
        sector: prev?.sector ?? null, // sector is set by mcap round-robin
        mcap: prev?.mcap ?? null, // preserved; refreshed by round-robin
        ...m,
        updated_at: now,
      });
    }
  }
  await upsertMetrics(db, metricRows);

  const mcapDone = await enrichMcap(db, mcapBudget);
  // Reconcile the community ❤ mirror (Lane 9) nightly safety net.
  await db.rpc("reconcile_screener_likes");

  // Prune history older than ~400 calendar days (caps trailing window near 52w).
  await db.from("screener_history").delete().lt("as_of", ymdDaysAgo(400));

  const { count: histDepth } = await db
    .from("screener_history")
    .select("as_of", { count: "exact", head: true })
    .eq("ticker", universeTickers[0] ?? "");

  await writeMetaCounts(db, {
    last_run_at: now,
    last_trading_day: usedDate,
    history_days: histDepth ?? null,
    bootstrap_done: true,
    note: `incremental ${usedDate}; ${metricRows.length} recomputed; ${newStubs.length} new listings; ${mcapDone} mcaps enriched`,
  });

  return NextResponse.json({
    ok: true,
    mode: "incremental",
    trading_day: usedDate,
    universe: universeTickers.length,
    new_listings: newStubs.length,
    history_appended: histRows.length,
    metrics_recomputed: metricRows.length,
    mcap_enriched: mcapDone,
  });
}

function ymdDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
