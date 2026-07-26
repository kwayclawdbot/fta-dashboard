import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureClubMetricsFresh } from "@/lib/club/cache";
import { deriveRegister } from "@/lib/register";
import { getClubTier } from "@/lib/tier";
import { FLOORS, SNAPSHOT_FLOORS, INTEL_DISCLAIMER, floorMet } from "@/lib/club/score";

/**
 * GET /api/club/intel/[ticker] — the provenance "why?" surface (KAI §6).
 *
 * Returns the canonical ticker_intel_snapshot for one ticker: the derived numbers
 * (Club Score + change, watcher/research/comment velocity, sentiment split,
 * unusual-activity flag) PAIRED WITH the raw counts in `provenance` that back every
 * one of them — so no claim is magic-AI, it is grounded in the Club. Ships the
 * attention-not-recommendation disclaimer inline (compliance armor).
 *
 * Kid-wall: consistent with the rest of the Club (debate/screener, viewer_is_kid).
 * Kids get the attention/activity view but NO sentiment split and no sentiment
 * provenance (mirrors the debate wall) — sentiment is an adults+teens surface.
 */
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  const ticker = (rawTicker || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);
  if (!ticker) return NextResponse.json({ error: "bad_ticker" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track, family_id")
    .eq("id", user.id)
    .single();
  const isKid = deriveRegister(profile) === "kid";

  // ENTITLEMENT (MONETIZATION-GATES.md): the intel provenance — Club Score
  // drivers/history + "why is this moving" — is the paid "Club Intelligence"
  // surface. Free members see CURRENT score only; the drivers are walled.
  // Server-authoritative (never UI-only). Composes with the kid wall below.
  const tier = await getClubTier(supabase, profile?.family_id);
  const isFree = tier === "free";

  await ensureClubMetricsFresh();

  const { data: snap } = await supabase
    .from("ticker_intel_snapshots")
    .select(
      "ticker, as_of, rank, club_score, club_change_14d, score_change_24h, participants, watchers, watch_velocity_24h, research_velocity_24h, comment_velocity_24h, sentiment_bullish, sentiment_neutral, sentiment_bearish, sentiment_change_24h, unusual_activity, top_topics, top_risks, provenance, computed_at"
    )
    .eq("ticker", ticker)
    .maybeSingle();

  if (!snap) {
    // Not an active ticker (no attention in the trailing window). Honest empty.
    return NextResponse.json({
      ticker,
      active: false,
      disclaimer: INTEL_DISCLAIMER,
    });
  }

  const provenance = (snap.provenance as Record<string, unknown>) || {};

  // Base intelligence view — attention + activity, safe for every register.
  const intel: Record<string, unknown> = {
    ticker: snap.ticker,
    active: true,
    asOf: snap.as_of,
    rank: snap.rank,
    clubScore: Number(snap.club_score),
    clubChange14d: Number(snap.club_change_14d),
    scoreChange24h: Number(snap.score_change_24h),
    participants: snap.participants,
    watchers: snap.watchers,
    watchVelocity24h: snap.watch_velocity_24h,
    researchVelocity24h: snap.research_velocity_24h,
    commentVelocity24h: snap.comment_velocity_24h,
    unusualActivity: snap.unusual_activity,
    // Scale awareness: only call a ticker "hot" once real breadth exists.
    scoreFloorMet: floorMet(Number(snap.club_score), FLOORS.trendingScore),
    // Phase 2 (null until the classification queue drains).
    topTopics: snap.top_topics ?? null,
    topRisks: snap.top_risks ?? null,
  };

  if (isFree) {
    // Free tier — "Club Score: current score only". Return the current score +
    // rank so the ticker still shows a number, but WALL the drivers/history,
    // velocities, sentiment and provenance behind Club Intelligence. The client
    // shows the ContextualWall(club_intel) for the paid detail.
    return NextResponse.json({
      ticker: snap.ticker,
      active: true,
      asOf: snap.as_of,
      rank: snap.rank,
      clubScore: Number(snap.club_score),
      scoreFloorMet: floorMet(Number(snap.club_score), FLOORS.trendingScore),
      walled: true,
      feature: "club_intel",
      disclaimer: INTEL_DISCLAIMER,
    });
  }

  if (isKid) {
    // Strip sentiment + sentiment provenance for kids (same wall as the debate).
    const prov = { ...provenance };
    delete (prov as Record<string, unknown>).sentiment;
    return NextResponse.json({
      ...intel,
      kidWalled: true,
      sentiment: null,
      provenance: prov,
      floors: SNAPSHOT_FLOORS,
      disclaimer: INTEL_DISCLAIMER,
    });
  }

  return NextResponse.json({
    ...intel,
    kidWalled: false,
    sentiment: {
      bullish: snap.sentiment_bullish,
      neutral: snap.sentiment_neutral,
      bearish: snap.sentiment_bearish,
      change24h: Number(snap.sentiment_change_24h),
    },
    provenance,
    floors: SNAPSHOT_FLOORS,
    disclaimer: INTEL_DISCLAIMER,
  });
}
