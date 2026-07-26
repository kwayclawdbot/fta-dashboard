import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveClubCtx, type ClubCtx, type CoreResult } from "@/lib/club/home-context";

/**
 * GET /api/club/pulse
 *   → { signals: [{kind, ticker, headline, detail, delta, spark?}] }  (3–4)
 *
 * "What the Club is seeing today" — COMMUNITY behavior, not market movers. The
 * per-ticker signals are sourced from the canonical ticker_intel_snapshots (Kai
 * Intelligence Layer §2a) so pulse, trending, foryou and Kai all read one object:
 *   • most_watched   — top of the snapshot ledger (rank 1 = attention leader)
 *   • new_watchers   — snapshot with the most watchlist adds in the last 7 days
 *   • sentiment_shift— snapshot with the largest 7-day net sentiment swing
 *   • fresh_research — most recently researched ticker (club_events recency)
 * Headlines are scale-aware COPY ("The Club is watching NVDA"), never raw counts.
 * spark (optional) = 7-day daily attention series from club_events for accents.
 *
 * The body is `pulseCore(ctx)` — shared verbatim with the batched
 * GET /api/club/home (see src/lib/club/home-context.ts).
 */
export const runtime = "nodejs";

interface Signal {
  kind: string;
  ticker: string;
  headline: string;
  detail: string;
  delta: number;
  spark?: number[];
}

interface Provenance {
  watchlistAdds7d?: number;
  sentiment?: { net7d?: number };
}

export async function pulseCore(ctx: ClubCtx): Promise<CoreResult> {
  await ctx.ensureFresh();
  const admin = ctx.admin();
  const signals: Signal[] = [];
  const used = new Set<string>();

  // The canonical snapshots — one shared read backs the first three signals.
  const rows = (await ctx.getSnapshots()).map((s) => ({
    ticker: s.ticker.toUpperCase(),
    rank: s.rank as number | null,
    change: Number(s.club_change_14d),
    prov: (s.provenance as Provenance) || {},
  }));

  // 1. Attention leader (rank 1 of the snapshot ledger).
  const leader = rows[0];
  if (leader) {
    signals.push({
      kind: "most_watched",
      ticker: leader.ticker,
      headline: `The Club is focused on ${leader.ticker}`,
      detail: "Highest community attention this week.",
      delta: leader.change,
      spark: await spark(admin, leader.ticker),
    });
    used.add(leader.ticker);
  }

  // 2. New watchers — most watchlist adds in the last 7 days (from provenance).
  const topWatch = [...rows]
    .filter((r) => !used.has(r.ticker))
    .map((r) => ({ ticker: r.ticker, count: r.prov.watchlistAdds7d ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)[0];
  if (topWatch) {
    signals.push({
      kind: "new_watchers",
      ticker: topWatch.ticker,
      headline: `New eyes on ${topWatch.ticker}`,
      detail: "Added to Club watchlists this week.",
      delta: topWatch.count,
      spark: await spark(admin, topWatch.ticker),
    });
    used.add(topWatch.ticker);
  }

  // 3. Sentiment shift — largest 7-day net sentiment swing (from provenance).
  const topSent = [...rows]
    .filter((r) => !used.has(r.ticker))
    .map((r) => ({ ticker: r.ticker, net: r.prov.sentiment?.net7d ?? 0 }))
    .filter((r) => r.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))[0];
  if (topSent) {
    signals.push({
      kind: "sentiment_shift",
      ticker: topSent.ticker,
      headline: `Conviction building on ${topSent.ticker}`,
      detail: topSent.net >= 0 ? "The Club is leaning bullish." : "The Club is leaning cautious.",
      delta: topSent.net,
    });
    used.add(topSent.ticker);
  }

  // 4. Fresh research — most recently viewed ticker (fills to 3–4 signals).
  if (signals.length < 4) {
    const { data: rv } = await admin
      .from("club_events")
      .select("ticker, created_at")
      .eq("kind", "research_view")
      .not("ticker", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    const fresh = (rv || []).find((r) => r.ticker && !used.has(r.ticker.toUpperCase()));
    if (fresh?.ticker) {
      signals.push({
        kind: "fresh_research",
        ticker: fresh.ticker.toUpperCase(),
        headline: `Someone just dug into ${fresh.ticker.toUpperCase()}`,
        detail: "Fresh research in the Club.",
        delta: 1,
        spark: await spark(admin, fresh.ticker),
      });
    }
  }

  return { body: { signals: signals.slice(0, 4) } };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status, body } = await pulseCore(ctx);
  return NextResponse.json(body, status ? { status } : undefined);
}

/** 7-day daily club_events attention series for a ticker (accent only). */
async function spark(admin: SupabaseClient, ticker: string): Promise<number[] | undefined> {
  const since = new Date(Date.now() - 7 * 864e5);
  const { data } = await admin
    .from("club_events")
    .select("created_at")
    .eq("ticker", ticker.toUpperCase())
    .gte("created_at", since.toISOString());
  if (!data || data.length === 0) return undefined;
  const buckets = new Array(7).fill(0);
  for (const r of data) {
    const day = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 864e5);
    const idx = 6 - Math.min(6, Math.max(0, day));
    buckets[idx] += 1;
  }
  return buckets;
}
