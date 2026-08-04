import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  INDEX_FLOORS,
  TRENDING_DISCLAIMER,
  clubSentiment,
  type ClubSentiment,
} from "@/lib/club/score";
import { resolveClubCtx } from "@/lib/club/home-context";

/**
 * GET /api/club/index
 *   → { rows, verdict, positionedMembers, namesShown, floorMet, updatedAt, disclaimer }
 *
 * The CLUB INDEX — a deliberately LIGHT, editorial ranked read of where the
 * room stands (lighter than the decision-log). It reads the SAME canonical
 * community rollup the rest of the Club reads, `ticker_intel_snapshots`
 * (refreshed by refresh_club_metrics() / the /api/club/refresh cron): rank +
 * club_score for the order, sentiment_bullish/_neutral/_bearish for the
 * bull/bear split (via the shared `clubSentiment` used by /api/club/trending —
 * NOT re-derived here), sentiment_change_24h for warming/cooling, and
 * participants for the member count.
 *
 * SCALE HONESTY (INDEX_FLOORS): a row's split is a real signal only once
 * `rowPositioned` members have taken a side — below it a single vote would read
 * as a confident 100%. And the room only shows a ranked verdict once `minNames`
 * names clear that bar; otherwise `floorMet:false` and the UI renders its
 * founding empty state rather than a thin one-vote list. No volume is invented.
 */
export const runtime = "nodejs";

export type IndexTrend = "warming" | "cooling" | "steady";

export interface ClubIndexRow {
  rank: number;
  ticker: string;
  company: string | null;
  /** Positioned members on this name (bull + neutral + bear). */
  positioned: number;
  participants: number;
  sentiment: ClubSentiment;
  /** Dominant-side share, 0–100 — the "conviction" read. */
  convictionPct: number;
  /** Which side the conviction leans. */
  side: "bull" | "bear";
  /** 24h stance drift → the warming / cooling / steady indicator. */
  trend: IndexTrend;
}

interface SnapshotRow {
  ticker: string | null;
  rank: number | null;
  club_score: number | null;
  participants: number | null;
  sentiment_bullish: number | null;
  sentiment_neutral: number | null;
  sentiment_bearish: number | null;
  sentiment_change_24h: number | null;
  computed_at: string | null;
}

function trendOf(change24h: number | null | undefined): IndexTrend {
  const c = change24h ?? 0;
  if (c > 0) return "warming";
  if (c < 0) return "cooling";
  return "steady";
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Non-blocking read-through so the ledger is warm (shared with trending/pulse).
  await ctx.ensureFresh();

  // Read the canonical rollup directly — the shared getSnapshots() select does
  // not carry sentiment_change_24h, which the trend indicator needs, so this
  // route reads the ledger with the columns the Index draws. Ordered by rank
  // (rank is assigned by club_score in refresh_club_metrics — highest first).
  const { data } = await supabase
    .from("ticker_intel_snapshots")
    .select(
      "ticker, rank, club_score, participants, " +
        "sentiment_bullish, sentiment_neutral, sentiment_bearish, " +
        "sentiment_change_24h, computed_at"
    )
    .order("rank", { ascending: true });

  const snapshots = (data as SnapshotRow[] | null) ?? [];

  // Company names off screener_metrics so each row renders "Nvidia" alongside
  // its logo (same join /api/club/trending uses).
  const tickers = snapshots.map((r) => r.ticker).filter(Boolean) as string[];
  const { data: metrics } = tickers.length
    ? await supabase.from("screener_metrics").select("ticker, name").in("ticker", tickers)
    : { data: [] as { ticker: string; name: string | null }[] };
  const nameByTicker = new Map((metrics || []).map((m) => [m.ticker.toUpperCase(), m.name]));

  // Only names that clear the per-row positioning floor are real signals.
  const qualifying: ClubIndexRow[] = [];
  for (const r of snapshots) {
    const ticker = (r.ticker || "").toUpperCase();
    if (!ticker) continue;
    const sentiment = clubSentiment(r.sentiment_bullish, r.sentiment_neutral, r.sentiment_bearish);
    const positioned = sentiment.bull + sentiment.neutral + sentiment.bear;
    if (positioned < INDEX_FLOORS.rowPositioned || sentiment.bullPct == null) continue;

    const bullPct = sentiment.bullPct;
    const side: "bull" | "bear" = bullPct >= 50 ? "bull" : "bear";
    qualifying.push({
      rank: r.rank ?? qualifying.length + 1,
      ticker,
      company: nameByTicker.get(ticker) ?? null,
      positioned,
      participants: r.participants ?? 0,
      sentiment,
      convictionPct: side === "bull" ? bullPct : 100 - bullPct,
      side,
      trend: trendOf(r.sentiment_change_24h),
    });
  }

  const floorMet = qualifying.length >= INDEX_FLOORS.minNames;

  // The room verdict — a plain-English lean aggregated across qualifying names.
  let verdict = "The room hasn't formed a read yet";
  let positionedMembers = 0;
  if (floorMet) {
    let bull = 0;
    let bear = 0;
    for (const r of qualifying) {
      bull += r.sentiment.bull;
      bear += r.sentiment.bear;
      positionedMembers += r.positioned;
    }
    verdict =
      bull > bear
        ? "The room is leaning bullish"
        : bear > bull
          ? "The room is leaning bearish"
          : "The room is split down the middle";
  }

  return NextResponse.json({
    rows: floorMet ? qualifying : [],
    verdict,
    positionedMembers,
    namesShown: floorMet ? qualifying.length : 0,
    floorMet,
    updatedAt: snapshots[0]?.computed_at ?? null,
    disclaimer: TRENDING_DISCLAIMER,
  });
}
