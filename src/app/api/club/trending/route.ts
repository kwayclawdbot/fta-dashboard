import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureClubMetricsFresh } from "@/lib/club/cache";
import { getClubTier } from "@/lib/tier";
import { FLOORS, TRENDING_DISCLAIMER, floorMet } from "@/lib/club/score";

/** Free tier sees the top N of the attention ledger; Club/FTA see the full list. */
const FREE_TRENDING_ROWS = 5;

/**
 * GET /api/club/trending
 *   → { rows: [{rank, ticker, score, change, participants, floorMet}], updatedAt,
 *       disclaimer }
 *
 * Ranked community-ATTENTION ledger (NOT top gainers). Sourced from the canonical
 * ticker_intel_snapshots (Kai Intelligence Layer §2a) — the snapshot's club_score
 * / club_change_14d / rank / participants are the SAME numbers club_trending
 * carries (both written in one refresh pass), so the ledger and Kai read one
 * object. No fan-out. `disclaimer` is the verbatim compliance line the UI must
 * render (attention ≠ recommendation).
 */
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // ENTITLEMENT (MONETIZATION-GATES.md): "Trending in the Club — Top 5 (free) /
  // Full rankings + history (Club)". Server-authoritative — free callers never
  // receive rows beyond the cap, so the lock can't be bypassed client-side.
  const { data: prof } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .maybeSingle();
  const tier = await getClubTier(supabase, prof?.family_id);
  const isFree = tier === "free";

  await ensureClubMetricsFresh();

  const { data } = await supabase
    .from("ticker_intel_snapshots")
    .select("ticker, club_score, club_change_14d, rank, participants, computed_at")
    .order("rank", { ascending: true })
    .limit(12);

  const all = (data || []).map((r) => ({
    rank: r.rank,
    ticker: r.ticker,
    score: Number(r.club_score),
    change: Number(r.club_change_14d),
    participants: r.participants,
    // Per-row scale awareness: only call a ticker "hot" once real breadth exists.
    floorMet: floorMet(Number(r.club_score), FLOORS.trendingScore),
  }));
  const rows = isFree ? all.slice(0, FREE_TRENDING_ROWS) : all;

  return NextResponse.json({
    rows,
    // Signal the free cap so the UI can show a "see the full rankings" wall.
    locked: isFree,
    lockedFeature: isFree ? "trending_full" : undefined,
    totalCount: all.length,
    freeCap: FREE_TRENDING_ROWS,
    updatedAt: data?.[0]?.computed_at ?? null,
    disclaimer: TRENDING_DISCLAIMER,
  });
}
