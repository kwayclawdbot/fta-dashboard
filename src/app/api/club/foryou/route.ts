import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureClubMetricsFresh } from "@/lib/club/cache";

/**
 * GET /api/club/foryou
 *   → { items: [{ticker, companyName, researchViews7d, sentimentNet, watchers7d,
 *       clubScore, clubChange}] }
 *
 * The bridge from network → me: per-ticker deltas on the tickers THIS member's
 * family already watches. Sourced from the canonical ticker_intel_snapshots (Kai
 * Intelligence Layer §2a) — one read instead of five fan-out queries. Every field
 * comes off the snapshot (or its provenance raw counts):
 *   researchViews7d ← provenance.researchViews7d   sentimentNet ← provenance.sentiment.net
 *   watchers7d      ← provenance.watchlistAdds7d    clubScore/clubChange ← snapshot
 * Tickers with no active snapshot report zeros (unchanged behaviour). Bounded by
 * the member's own watchlist size.
 */
export const runtime = "nodejs";

interface Provenance {
  researchViews7d?: number;
  watchlistAdds7d?: number;
  sentiment?: { net?: number };
}

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

  // Single read of the canonical snapshots for the watched tickers.
  const { data: snaps } = await supabase
    .from("ticker_intel_snapshots")
    .select("ticker, club_score, club_change_14d, provenance")
    .in("ticker", tickers);

  const byTicker = new Map(
    (snaps || []).map((s) => [s.ticker.toUpperCase(), s])
  );

  const items = tickers.map((t) => {
    const s = byTicker.get(t);
    const prov = (s?.provenance as Provenance) || {};
    return {
      ticker: t,
      companyName: nameByTicker.get(t) || null,
      researchViews7d: prov.researchViews7d ?? 0,
      sentimentNet: prov.sentiment?.net ?? 0,
      watchers7d: prov.watchlistAdds7d ?? 0,
      clubScore: s ? Number(s.club_score) : 0,
      clubChange: s ? Number(s.club_change_14d) : 0,
    };
  });

  // Surface the tickers with the most movement first.
  items.sort(
    (a, b) =>
      b.researchViews7d + b.watchers7d + Math.abs(b.sentimentNet) -
      (a.researchViews7d + a.watchers7d + Math.abs(a.sentimentNet))
  );

  return NextResponse.json({ items });
}
