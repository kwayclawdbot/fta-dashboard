import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureClubMetricsFresh } from "@/lib/club/cache";

/**
 * GET /api/club/pulse
 *   → { signals: [{kind, ticker, headline, detail, delta, spark?}] }  (3–4)
 *
 * "What the Club is seeing today" — COMMUNITY behavior, not market movers. Every
 * signal is derived from real rows:
 *   • most_watched   — top of the cached Club Score ledger (attention leader)
 *   • new_watchers   — ticker with the most watchlist adds in the last 7 days
 *   • sentiment_shift— ticker with the most bull/bear votes in the last 7 days
 *   • fresh_research — most recently researched ticker (club_events)
 * Headlines are scale-aware COPY ("The Club is watching NVDA"), never raw counts.
 * spark (optional) = 7-day daily attention series from club_events for accents.
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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureClubMetricsFresh();
  const admin = createAdminClient();
  const signals: Signal[] = [];
  const used = new Set<string>();
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString();

  // 1. Attention leader (cached score).
  const { data: top } = await supabase
    .from("club_trending")
    .select("ticker, score, change, participants")
    .order("rank", { ascending: true })
    .limit(3);
  if (top && top[0]) {
    const t = top[0];
    signals.push({
      kind: "most_watched",
      ticker: t.ticker,
      headline: `The Club is focused on ${t.ticker}`,
      detail: "Highest community attention this week.",
      delta: Number(t.change),
      spark: await spark(admin, t.ticker),
    });
    used.add(t.ticker);
  }

  // 2. New watchers — most watchlist adds in the last 7 days (community + family).
  const [{ data: cw }, { data: fw }] = await Promise.all([
    admin.from("community_watchlist").select("ticker").gte("created_at", since7),
    admin.from("family_watchlist").select("ticker").gte("created_at", since7),
  ]);
  const watchCounts = tally([...(cw || []), ...(fw || [])].map((r) => r.ticker));
  const topWatch = pick(watchCounts, used);
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

  // 3. Sentiment shift — most bull/bear votes in the last 7 days.
  const { data: sent } = await admin
    .from("ticker_sentiment")
    .select("ticker, vote, updated_at")
    .gte("updated_at", since7);
  const sentNet = new Map<string, number>();
  for (const r of sent || []) {
    if (!r.ticker || used.has(r.ticker)) continue;
    sentNet.set(r.ticker, (sentNet.get(r.ticker) || 0) + (Number(r.vote) || 0));
  }
  const topSent = [...sentNet.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  if (topSent) {
    const [tk, net] = topSent;
    signals.push({
      kind: "sentiment_shift",
      ticker: tk,
      headline: `Conviction building on ${tk}`,
      detail: net >= 0 ? "The Club is leaning bullish." : "The Club is leaning cautious.",
      delta: net,
    });
    used.add(tk);
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
    const fresh = (rv || []).find((r) => r.ticker && !used.has(r.ticker));
    if (fresh?.ticker) {
      signals.push({
        kind: "fresh_research",
        ticker: fresh.ticker,
        headline: `Someone just dug into ${fresh.ticker}`,
        detail: "Fresh research in the Club.",
        delta: 1,
        spark: await spark(admin, fresh.ticker),
      });
    }
  }

  return NextResponse.json({ signals: signals.slice(0, 4) });
}

function tally(items: (string | null)[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    if (!it) continue;
    const k = it.toUpperCase();
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function pick(m: Map<string, number>, used: Set<string>) {
  let best: { ticker: string; count: number } | null = null;
  for (const [ticker, count] of m) {
    if (used.has(ticker)) continue;
    if (!best || count > best.count) best = { ticker, count };
  }
  return best;
}

/** 7-day daily club_events attention series for a ticker (accent only). */
async function spark(
  admin: ReturnType<typeof createAdminClient>,
  ticker: string
): Promise<number[] | undefined> {
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
