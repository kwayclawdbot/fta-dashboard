import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveClubCtx, type ClubCtx, type CoreResult } from "@/lib/club/home-context";

/**
 * GET /api/club/foryou
 *   → { items: [{ticker, company, companyName, price, changePct, delta, kind,
 *       researchViews7d, sentimentNet, watchers7d, clubScore, clubChange}] }
 *
 * The bridge from network → me: per-ticker deltas on the tickers THIS member's
 * family already watches. Sourced from the canonical ticker_intel_snapshots (Kai
 * Intelligence Layer §2a) — one read instead of five fan-out queries. Because it
 * is watchlist-FILTERED (bounded by this family's own watches), it keeps its own
 * `.in(tickers)` snapshot read rather than the full shared ledger.
 *
 * UI contract (src/lib/clubhome/contract.ts §9 ForYouItem) reconcile: alongside
 * the raw snapshot counts the endpoint also returns the shaped fields the ClubHome
 * ForYou card renders directly — `company` (name), `price`/`changePct` (live off
 * screener_metrics), a derived human `delta` line, and its BriefKind `kind`.
 *
 * The body is `forYouCore(ctx)` — shared verbatim with GET /api/club/home.
 */
export const runtime = "nodejs";

type BriefKind = "research" | "sentiment" | "watchers" | "pattern" | "news";

interface Provenance {
  researchViews7d?: number;
  watchlistAdds7d?: number;
  sentiment?: { net?: number };
}

/**
 * Turn the raw per-ticker deltas into the one human line + BriefKind the ForYou
 * card shows. Picks the single strongest signal so the line reads like "what
 * changed on YOUR ticker" — never a fabricated claim, always grounded in a count.
 */
function deriveDelta(d: {
  researchViews7d: number;
  watchers7d: number;
  sentimentNet: number;
  clubChange: number;
}): { delta: string; kind: BriefKind } {
  if (d.researchViews7d >= 3)
    return { delta: `Research picking up in the Club this week`, kind: "research" };
  if (d.watchers7d >= 2)
    return { delta: `${d.watchers7d} new Club watchers this week`, kind: "watchers" };
  if (d.sentimentNet > 0)
    return { delta: `Club sentiment turning more bullish`, kind: "sentiment" };
  if (d.sentimentNet < 0)
    return { delta: `Club getting more cautious`, kind: "sentiment" };
  if (d.clubChange > 0)
    return { delta: `Climbing the Club attention ranks`, kind: "pattern" };
  if (d.clubChange < 0)
    return { delta: `Cooling off in the Club`, kind: "pattern" };
  return { delta: `Steady in the Club — no big shift yet`, kind: "pattern" };
}

export async function forYouCore(ctx: ClubCtx): Promise<CoreResult> {
  await ctx.ensureFresh();

  const profile = await ctx.getProfile();
  const familyId = profile?.family_id;
  if (!familyId) return { body: { items: [] } };

  const supabase = ctx.supabase;
  const { data: watch } = await supabase
    .from("family_watchlist")
    .select("ticker, company_name")
    .eq("family_id", familyId)
    .limit(30);

  const tickers = [...new Set((watch || []).map((w) => w.ticker?.toUpperCase()).filter(Boolean))] as string[];
  if (tickers.length === 0) return { body: { items: [] } };

  const nameByTicker = new Map<string, string>();
  for (const w of watch || []) if (w.ticker) nameByTicker.set(w.ticker.toUpperCase(), w.company_name || "");

  // Single read of the canonical snapshots for the watched tickers, plus one
  // read of screener_metrics for live price/change (UI-contract fields).
  const [{ data: snaps }, { data: metrics }] = await Promise.all([
    supabase
      .from("ticker_intel_snapshots")
      .select("ticker, club_score, club_change_14d, provenance")
      .in("ticker", tickers),
    supabase
      .from("screener_metrics")
      .select("ticker, name, price, chg_1d")
      .in("ticker", tickers),
  ]);

  const byTicker = new Map((snaps || []).map((s) => [s.ticker.toUpperCase(), s]));
  const metricByTicker = new Map((metrics || []).map((m) => [m.ticker.toUpperCase(), m]));

  const items = tickers.map((t) => {
    const s = byTicker.get(t);
    const prov = (s?.provenance as Provenance) || {};
    const m = metricByTicker.get(t);
    const researchViews7d = prov.researchViews7d ?? 0;
    const sentimentNet = prov.sentiment?.net ?? 0;
    const watchers7d = prov.watchlistAdds7d ?? 0;
    const clubChange = s ? Number(s.club_change_14d) : 0;
    const { delta, kind } = deriveDelta({ researchViews7d, watchers7d, sentimentNet, clubChange });
    const company = m?.name || nameByTicker.get(t) || null;
    return {
      ticker: t,
      // UI contract (§9): shaped fields the ForYou card renders directly.
      company,
      price: m?.price != null ? Number(m.price) : null,
      changePct: m?.chg_1d != null ? Number(m.chg_1d) : null,
      delta,
      kind,
      // Original raw counts (additive — kept for any other consumer).
      companyName: nameByTicker.get(t) || company,
      researchViews7d,
      sentimentNet,
      watchers7d,
      clubScore: s ? Number(s.club_score) : 0,
      clubChange,
    };
  });

  // Surface the tickers with the most movement first.
  items.sort(
    (a, b) =>
      b.researchViews7d + b.watchers7d + Math.abs(b.sentimentNet) -
      (a.researchViews7d + a.watchers7d + Math.abs(a.sentimentNet))
  );

  return { body: { items } };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status, body } = await forYouCore(ctx);
  return NextResponse.json(body, status ? { status } : undefined);
}
