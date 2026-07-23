import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuotes } from "@/lib/market/polygon";
import {
  PERF_MILESTONES,
  PERF_FAMILY_DAILY_CAP,
} from "@/lib/community-watchlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily performance tracker (Vercel Cron → this route; see vercel.json).
 *
 * pg_cron is unavailable on this project, so the daily job runs here. It is
 * IDEMPOTENT per day (snapshot upserts + XP ref_id dedup), so re-running is safe.
 *
 * Steps:
 *   1. Collect every tracked ticker (community_watchlist ∪ family_watchlist).
 *   2. Batch quotes via the server Polygon layer (chunked, cached). Today's
 *      close ≈ quote.price ?? prevClose.
 *   3. Upsert ticker_snapshots(ticker, as_of=today, close).
 *   4. Backfill snapshot_price on any entry still NULL → today's close.
 *   5. Evaluate performance-XP milestones for community-PROMOTED member picks
 *      only (public accountability gate). Anti-gaming rules:
 *        - only kind='member' entries (admin picks + private adds earn nothing);
 *        - milestones +5/+10/+25% → +15/+25/+50 XP, measured on the daily close;
 *        - one award per (entry, milestone) ever (xp_events.ref_id dedup);
 *        - min hold ≥1 daily close (snapshot older than today);
 *        - per-family cap of PERF_FAMILY_DAILY_CAP awards per run.
 *
 * Auth: if CRON_SECRET is set, require Bearer CRON_SECRET (Vercel injects this
 * header) OR ?secret=. Without CRON_SECRET set the route refuses — fail-safe.
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

  const db = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Collect tracked tickers.
  const [{ data: comm }, { data: fam }] = await Promise.all([
    db.from("community_watchlist").select("ticker").neq("status", "archived"),
    db.from("family_watchlist").select("ticker"),
  ]);
  const tickers = Array.from(
    new Set(
      [...(comm || []), ...(fam || [])]
        .map((r) => (r as { ticker: string }).ticker)
        .filter(Boolean)
    )
  );

  if (tickers.length === 0) {
    return NextResponse.json({ ok: true, tickers: 0, note: "nothing tracked" });
  }

  // 2. Batch quotes (chunk by 100 to stay under URL/limit ceilings).
  const closes: Record<string, number> = {};
  for (let i = 0; i < tickers.length; i += 100) {
    const chunk = tickers.slice(i, i + 100);
    const quotes = await getQuotes(chunk);
    for (const [sym, q] of Object.entries(quotes)) {
      const px = q.price ?? q.prevClose ?? null;
      if (px != null && px > 0) closes[sym] = px;
    }
  }

  // 3. Upsert today's closes (idempotent).
  const snapshotRows = Object.entries(closes).map(([ticker, close]) => ({
    ticker,
    as_of: today,
    close,
  }));
  if (snapshotRows.length) {
    await db
      .from("ticker_snapshots")
      .upsert(snapshotRows, { onConflict: "ticker,as_of" });
  }

  // 4. Backfill snapshot_price on entries still NULL (community + family).
  let backfilled = 0;
  for (const table of ["community_watchlist", "family_watchlist"] as const) {
    const { data: missing } = await db
      .from(table)
      .select("id, ticker")
      .is("snapshot_price", null);
    for (const row of (missing || []) as { id: string; ticker: string }[]) {
      const px = closes[row.ticker];
      if (px == null) continue;
      const { error } = await db
        .from(table)
        .update({ snapshot_price: px, snapshot_at: new Date().toISOString() })
        .eq("id", row.id);
      if (!error) backfilled++;
    }
  }

  // 5. Performance-XP milestones for community-promoted member picks.
  const { data: entries } = await db
    .from("community_watchlist")
    .select("id, ticker, family_id, promoted_by, snapshot_price, snapshot_at")
    .eq("kind", "member")
    .neq("status", "archived");

  type Entry = {
    id: string;
    ticker: string;
    family_id: string | null;
    promoted_by: string | null;
    snapshot_price: number | null;
    snapshot_at: string | null;
  };
  const memberEntries = (entries || []) as Entry[];

  // Build candidate awards, respecting min-hold + milestone thresholds.
  type Candidate = {
    entry: Entry;
    milestone: number;
    xp: number;
    refId: string;
  };
  const candidates: Candidate[] = [];
  for (const e of memberEntries) {
    if (!e.promoted_by || e.snapshot_price == null || e.snapshot_price <= 0) {
      continue;
    }
    // Min hold: must have survived at least one prior daily close.
    const snapDay = (e.snapshot_at || "").slice(0, 10);
    if (!snapDay || snapDay >= today) continue;

    const close = closes[e.ticker];
    if (close == null) continue;
    const pct = ((close - e.snapshot_price) / e.snapshot_price) * 100;
    for (const m of PERF_MILESTONES) {
      if (pct >= m.pct) {
        candidates.push({
          entry: e,
          milestone: m.pct,
          xp: m.xp,
          refId: `perf:${e.id}:${m.pct}`,
        });
      }
    }
  }

  // Dedup against already-awarded ref_ids.
  const awarded: string[] = [];
  const perFamily: Record<string, number> = {};
  if (candidates.length) {
    const refIds = candidates.map((c) => c.refId);
    const { data: existing } = await db
      .from("xp_events")
      .select("ref_id")
      .eq("kind", "bonus")
      .in("ref_id", refIds);
    const done = new Set(
      (existing || []).map((r) => (r as { ref_id: string }).ref_id)
    );

    for (const c of candidates) {
      if (done.has(c.refId)) continue;
      const famKey = c.entry.family_id || "none";
      if ((perFamily[famKey] || 0) >= PERF_FAMILY_DAILY_CAP) continue;
      const { error } = await db.from("xp_events").insert({
        user_id: c.entry.promoted_by,
        kind: "bonus",
        amount: c.xp,
        ref_id: c.refId,
      });
      if (!error) {
        done.add(c.refId);
        perFamily[famKey] = (perFamily[famKey] || 0) + 1;
        awarded.push(c.refId);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    date: today,
    tickers: tickers.length,
    closes: Object.keys(closes).length,
    snapshots_upserted: snapshotRows.length,
    snapshot_backfilled: backfilled,
    member_entries: memberEntries.length,
    xp_awards: awarded.length,
  });
}
