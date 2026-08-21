import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_TTL_SECONDS } from "@/lib/club/club-cache";
import { FLOORS, TRENDING_DISCLAIMER, clubSentiment, floorMet } from "@/lib/club/score";
import {
  resolveClubCtx,
  type ClubCtx,
  type ClubSnapshotRow,
  type CoreResult,
} from "@/lib/club/home-context";
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

/**
 * THE LEDGER SLICE, COMPUTED ONCE PER MINUTE FOR THE WHOLE CLUB.
 *
 * Everything below the entitlement cap is a pure function of the database plus
 * the Polygon snapshot: the same twelve rows, the same scores, the same marks,
 * for every member. It was three round trips per pageview (snapshot ledger,
 * screener_metrics names, the Polygon batch) to produce a byte-identical array.
 *
 * SAFE TO SHARE ONE ENTRY ACROSS MEMBERS — checked policy by policy:
 *   • ticker_intel_snapshots → `for select to authenticated using (true)`
 *                              (mig 141). Service-role read is identical.
 *   • screener_metrics       → KID-WALLED: `using (not viewer_is_kid())`
 *                              (mig 137). The service-role read bypasses that,
 *                              so the wall is re-applied EXPLICITLY by the
 *                              caller below — a kid still gets `company: null`,
 *                              exactly what RLS was silently doing before.
 * Nothing member-varying (tier cap, register) is cached; both stay on the
 * per-request path where they belong.
 */
const getCachedTrendingLedger = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const { data: snaps } = await admin
      .from("ticker_intel_snapshots")
      .select(
        "ticker, rank, club_score, club_change_14d, participants, watchers, " +
          "sentiment_bullish, sentiment_neutral, sentiment_bearish, provenance, computed_at"
      )
      .order("rank", { ascending: true })
      .limit(12);
    const data = (snaps as ClubSnapshotRow[] | null) ?? [];

    // UI-contract reconcile (§6 TrendingRow.company): attach the company name
    // from screener_metrics so the row can render "Nvidia" alongside the logo.
    const tickers = data.map((r) => r.ticker).filter(Boolean) as string[];
    const { data: metrics } = tickers.length
      ? await admin.from("screener_metrics").select("ticker, name").in("ticker", tickers)
      : { data: [] as { ticker: string; name: string | null }[] };
    const nameByTicker = new Map(
      ((metrics || []) as { ticker: string; name: string | null }[]).map((m) => [
        m.ticker.toUpperCase(),
        m.name,
      ])
    );

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
      // Shared split logic (reused by /api/club/index) so the two ledgers can't drift.
      const sentiment = clubSentiment(
        r.sentiment_bullish,
        r.sentiment_neutral,
        r.sentiment_bearish
      );

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
        sentiment,
        heat:
          rowFloorMet && topScore > 0
            ? Math.max(1, Math.round((score / topScore) * 100))
            : null,
        // Per-row scale awareness: only call a ticker "hot" once real breadth exists.
        floorMet: rowFloorMet,
      };
    });

    return { all, updatedAt: data[0]?.computed_at ?? null };
  },
  ["club:trending-ledger"],
  { revalidate: CLUB_TTL_SECONDS, tags: ["club-trending"] }
);

export async function trendingCore(ctx: ClubCtx): Promise<CoreResult> {
  // ENTITLEMENT (MONETIZATION-GATES.md): "Trending in the Club — Top 5 (free) /
  // Full rankings + history (Club)". Server-authoritative — free callers never
  // receive rows beyond the cap, so the lock can't be bypassed client-side.
  const tier = await ctx.getTier();
  const isFree = tier === "free";

  // The read-through freshness trigger is deliberately OUTSIDE the cache: it
  // schedules an after()-deferred recompute, which is a request-scoped effect,
  // not a value.
  await ctx.ensureFresh();

  // Both of these are memoised off the ONE profile read the request already
  // made — neither costs a round trip.
  const isKid = (await ctx.getRegister()) === "kid";

  const { all: ledger, updatedAt } = await getCachedTrendingLedger();

  // THE KID WALL, RESTATED. screener_metrics is kid-walled by RLS (mig 137) and
  // the cached ledger is a service-role read, so the wall has to be applied
  // here or a kid would start seeing company names the session-scoped read had
  // been withholding. Same output as before, now stated rather than incidental.
  const all = isKid ? ledger.map((r) => ({ ...r, company: null })) : ledger;

  const rows = isFree ? all.slice(0, FREE_TRENDING_ROWS) : all;

  return {
    body: {
      rows,
      // Signal the free cap so the UI can show a "see the full rankings" wall.
      locked: isFree,
      lockedFeature: isFree ? "trending_full" : undefined,
      totalCount: all.length,
      freeCap: FREE_TRENDING_ROWS,
      updatedAt,
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
