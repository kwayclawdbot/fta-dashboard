import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureClubMetricsFresh } from "@/lib/club/cache";

/**
 * GET /api/club/foryou
 *   → { items: [{ticker, companyName, researchViews7d, sentimentNet, watchers7d,
 *       clubScore, clubChange}] }
 *
 * The bridge from network → me: per-ticker deltas on the tickers THIS member's
 * family already watches. Everything real: research views (club_events),
 * sentiment (ticker_sentiment), watcher adds (watchlists), plus the cached Club
 * Score for context. Bounded by the member's own watchlist size.
 */
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureClubMetricsFresh();

  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .single();
  const familyId = profile?.family_id;
  if (!familyId) return NextResponse.json({ items: [] });

  const { data: watch } = await supabase
    .from("family_watchlist")
    .select("ticker, company_name")
    .eq("family_id", familyId)
    .limit(30);

  const tickers = [...new Set((watch || []).map((w) => w.ticker?.toUpperCase()).filter(Boolean))] as string[];
  if (tickers.length === 0) return NextResponse.json({ items: [] });

  const nameByTicker = new Map<string, string>();
  for (const w of watch || []) if (w.ticker) nameByTicker.set(w.ticker.toUpperCase(), w.company_name || "");

  const admin = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [{ data: rv }, { data: sent }, { data: cw }, { data: fw }, { data: trend }] = await Promise.all([
    admin.from("club_events").select("ticker").eq("kind", "research_view").in("ticker", tickers).gte("created_at", weekAgo),
    admin.from("ticker_sentiment").select("ticker, vote").in("ticker", tickers),
    admin.from("community_watchlist").select("ticker").in("ticker", tickers).gte("created_at", weekAgo),
    admin.from("family_watchlist").select("ticker").in("ticker", tickers).gte("created_at", weekAgo),
    admin.from("club_trending").select("ticker, score, change").in("ticker", tickers),
  ]);

  const rvCount = tallyUpper(rv);
  const watchCount = tallyUpper([...(cw || []), ...(fw || [])]);
  const sentNet = new Map<string, number>();
  for (const r of sent || []) {
    if (!r.ticker) continue;
    const k = r.ticker.toUpperCase();
    sentNet.set(k, (sentNet.get(k) || 0) + (Number(r.vote) || 0));
  }
  const trendMap = new Map((trend || []).map((t) => [t.ticker.toUpperCase(), t]));

  const items = tickers.map((t) => ({
    ticker: t,
    companyName: nameByTicker.get(t) || null,
    researchViews7d: rvCount.get(t) || 0,
    sentimentNet: sentNet.get(t) || 0,
    watchers7d: watchCount.get(t) || 0,
    clubScore: trendMap.get(t) ? Number(trendMap.get(t)!.score) : 0,
    clubChange: trendMap.get(t) ? Number(trendMap.get(t)!.change) : 0,
  }));

  // Surface the tickers with the most movement first.
  items.sort(
    (a, b) =>
      b.researchViews7d + b.watchers7d + Math.abs(b.sentimentNet) -
      (a.researchViews7d + a.watchers7d + Math.abs(a.sentimentNet))
  );

  return NextResponse.json({ items });
}

function tallyUpper(rows: { ticker: string | null }[] | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows || []) {
    if (!r.ticker) continue;
    const k = r.ticker.toUpperCase();
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}
