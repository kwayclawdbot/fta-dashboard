import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FLOORS, TRENDING_DISCLAIMER, floorMet } from "@/lib/club/score";
import { resolveClubCtx, type ClubCtx, type CoreResult } from "@/lib/club/home-context";
import { getQuotes, isConfigured } from "@/lib/market/polygon";

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
 *
 * The body is `trendingCore(ctx)` — shared verbatim with GET /api/club/home; it
 * reads the top of the SHARED snapshot ledger (pulse reads the same ledger).
 */
export const runtime = "nodejs";

export async function trendingCore(ctx: ClubCtx): Promise<CoreResult> {
  // ENTITLEMENT (MONETIZATION-GATES.md): "Trending in the Club — Top 5 (free) /
  // Full rankings + history (Club)". Server-authoritative — free callers never
  // receive rows beyond the cap, so the lock can't be bypassed client-side.
  const tier = await ctx.getTier();
  const isFree = tier === "free";

  await ctx.ensureFresh();

  // Top of the canonical snapshot ledger (shared with pulse) — take the same 12
  // the previous dedicated `.limit(12)` read returned.
  const data = (await ctx.getSnapshots()).slice(0, 12);

  // UI-contract reconcile (§6 TrendingRow.company): attach the company name from
  // screener_metrics so the row can render "Nvidia" alongside the ticker logo.
  const tickers = data.map((r) => r.ticker).filter(Boolean) as string[];
  const { data: metrics } = tickers.length
    ? await ctx.supabase.from("screener_metrics").select("ticker, name").in("ticker", tickers)
    : { data: [] as { ticker: string; name: string | null }[] };
  const nameByTicker = new Map((metrics || []).map((m) => [m.ticker.toUpperCase(), m.name]));

  // MARKET MARK — ONE batched Polygon snapshot for the whole ledger slice. The
  // canvas Home leads with price, so a trending row that carries no quote must
  // render as an honest absence (the UI hides the mark), NEVER as a "score N"
  // stand-in — that fallback is what made the board read as placeholder data.
  // Failure is non-fatal: no quotes → every price is null and the ranking still
  // ships.
  let quotes: Record<string, { price: number | null; changePercent: number | null }> = {};
  if (isConfigured() && tickers.length) {
    try {
      quotes = await getQuotes(tickers);
    } catch (err) {
      console.error("[club/trending] quote join failed:", err);
    }
  }

  // CLUB SCORE dial (mock: "94"). club_score is an unbounded weighted sum, so it
  // is normalized against the top of the ledger to become a 0–100 read. Gated by
  // the trendingScore floor: below it a founding club would show a manufactured
  // 100 for whatever happens to rank first, so `heat` stays null and the UI runs
  // its founding treatment instead.
  const topScore = Math.max(...data.map((r) => Number(r.club_score) || 0), 0);

  const all = data.map((r) => {
    const q = quotes[(r.ticker || "").toUpperCase()];
    const score = Number(r.club_score);
    const rowFloorMet = floorMet(score, FLOORS.trendingScore);
    const bull = r.sentiment_bullish ?? 0;
    const neutral = r.sentiment_neutral ?? 0;
    const bear = r.sentiment_bearish ?? 0;
    const positioned = bull + neutral + bear;

    return {
      rank: r.rank,
      ticker: r.ticker,
      company: nameByTicker.get((r.ticker || "").toUpperCase()) ?? null,
      score,
      change: Number(r.club_change_14d),
      participants: r.participants,
      price: q?.price ?? null,
      changePct: q?.changePercent ?? null,
      watchers: r.watchers ?? 0,
      sentiment: {
        bull,
        neutral,
        bear,
        bullPct: positioned > 0 ? Math.round((bull / positioned) * 100) : null,
      },
      heat:
        rowFloorMet && topScore > 0
          ? Math.max(1, Math.round((score / topScore) * 100))
          : null,
      // Per-row scale awareness: only call a ticker "hot" once real breadth exists.
      floorMet: rowFloorMet,
    };
  });
  const rows = isFree ? all.slice(0, FREE_TRENDING_ROWS) : all;

  return {
    body: {
      rows,
      // Signal the free cap so the UI can show a "see the full rankings" wall.
      locked: isFree,
      lockedFeature: isFree ? "trending_full" : undefined,
      totalCount: all.length,
      freeCap: FREE_TRENDING_ROWS,
      updatedAt: data[0]?.computed_at ?? null,
      disclaimer: TRENDING_DISCLAIMER,
    },
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status, body } = await trendingCore(ctx);
  return NextResponse.json(body, status ? { status } : undefined);
}
