import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureClubMetricsFresh } from "@/lib/club/cache";
import { FLOORS, TRENDING_DISCLAIMER, floorMet } from "@/lib/club/score";

/**
 * GET /api/club/trending
 *   → { rows: [{rank, ticker, score, change, participants, floorMet}], updatedAt,
 *       disclaimer }
 *
 * Ranked community-ATTENTION ledger (NOT top gainers). Reads the cached
 * club_trending table only — no fan-out. `disclaimer` is the verbatim compliance
 * line the UI must render (attention ≠ recommendation).
 */
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureClubMetricsFresh();

  const { data } = await supabase
    .from("club_trending")
    .select("ticker, score, change, rank, participants, computed_at")
    .order("rank", { ascending: true })
    .limit(12);

  const rows = (data || []).map((r) => ({
    rank: r.rank,
    ticker: r.ticker,
    score: Number(r.score),
    change: Number(r.change),
    participants: r.participants,
    // Per-row scale awareness: only call a ticker "hot" once real breadth exists.
    floorMet: floorMet(Number(r.score), FLOORS.trendingScore),
  }));

  return NextResponse.json({
    rows,
    updatedAt: data?.[0]?.computed_at ?? null,
    disclaimer: TRENDING_DISCLAIMER,
  });
}
