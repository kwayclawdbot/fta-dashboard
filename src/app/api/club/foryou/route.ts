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
 * card shows.
 *
 * WHY THIS WAS REWRITTEN. The old version tested four thresholds and fell
 * through to two constant strings, so a member watching four quiet tickers read
 * FOUR IDENTICAL ROWS — "Climbing the Club attention ranks" ×4 — which says
 * nothing about any of them and teaches the member that the section is noise.
 * The fix is not more copy: it is to put the REAL NUMBER in the line, and to
 * hand each row a DIFFERENT reason when the data supports one.
 *
 * Each ticker now yields a RANKED LIST of candidate reasons, every one of them
 * a real count off the snapshot (or the member's own Kai Watch state). The
 * caller walks the rows in order and gives each the strongest reason not already
 * spoken on this board — so four tickers with four different stories tell four
 * different stories, and four tickers with genuinely one story between them
 * collapse to one row rather than four copies of it (the UI drops the repeats).
 *
 * Nothing here is composed: every clause is a count, a net, or a state string
 * the watch machine actually persisted.
 */
interface Reason {
  delta: string;
  kind: BriefKind;
}

/** Kai Watch states worth saying out loud, strongest first. */
const WATCH_LINE: Record<string, string> = {
  triggered: "Your Kai Watch triggered",
  near_trigger: "Your Kai Watch is getting close",
  building: "Your Kai Watch is building",
};

function reasonsFor(d: {
  researchViews7d: number;
  watchers7d: number;
  sentimentNet: number;
  clubChange: number;
  watchState: string | null;
}): Reason[] {
  const out: Reason[] = [];

  // 1. WATCH PROXIMITY — the member's own rule, the most personal thing we know.
  if (d.watchState && WATCH_LINE[d.watchState]) {
    out.push({ delta: WATCH_LINE[d.watchState], kind: "pattern" });
  }
  // 2. RESEARCH — how many times the Club opened this ticker's research.
  if (d.researchViews7d >= 1) {
    out.push({
      delta: `${d.researchViews7d} Club research ${d.researchViews7d === 1 ? "read" : "reads"} this week`,
      kind: "research",
    });
  }
  // 3. NEW OPINIONS — net stance movement, with its size.
  if (d.sentimentNet !== 0) {
    const n = Math.abs(d.sentimentNet);
    out.push({
      delta: `${n} net new ${d.sentimentNet > 0 ? "bull" : "bear"} ${n === 1 ? "opinion" : "opinions"}`,
      kind: "sentiment",
    });
  }
  // 4. NEW WATCHERS — members who added it since last week.
  if (d.watchers7d >= 1) {
    out.push({
      delta: `${d.watchers7d} new Club ${d.watchers7d === 1 ? "watcher" : "watchers"} this week`,
      kind: "watchers",
    });
  }
  // 5. ATTENTION DELTA — the club-score move, as the number it is.
  if (Math.abs(d.clubChange) >= 1) {
    const n = Math.round(Math.abs(d.clubChange));
    out.push({
      delta: `Club attention ${d.clubChange > 0 ? "up" : "down"} ${n} pt${n === 1 ? "" : "s"} in two weeks`,
      kind: "pattern",
    });
  }
  // 6. The honest absence. Always last, always available.
  out.push({ delta: "Steady in the Club — no shift this week", kind: "pattern" });
  return out;
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

  // Single read of the canonical snapshots for the watched tickers, one read of
  // screener_metrics for live price/change (UI-contract fields), and — new —
  // the member's OWN Kai Watch state per ticker, which is the most personal
  // reason a row can carry. `watch_current_state` is the latest transition per
  // rule and its RLS joins alert_rules.user_id, so this is already scoped.
  const [{ data: snaps }, { data: metrics }, { data: rules }] = await Promise.all([
    supabase
      .from("ticker_intel_snapshots")
      .select("ticker, club_score, club_change_14d, provenance")
      .in("ticker", tickers),
    supabase
      .from("screener_metrics")
      .select("ticker, name, price, chg_1d")
      .in("ticker", tickers),
    supabase
      .from("alert_rules")
      .select("id, ticker")
      .eq("active", true)
      .in("ticker", tickers),
  ]);

  // Rule → current watch state, for the tickers this member actually watches.
  const stateByTicker = new Map<string, string>();
  const ruleRows = (rules || []) as { id: string; ticker: string | null }[];
  if (ruleRows.length > 0) {
    const { data: states } = await supabase
      .from("watch_current_state")
      .select("rule_id, state")
      .in(
        "rule_id",
        ruleRows.map((r) => r.id)
      );
    const stateByRule = new Map(
      ((states || []) as { rule_id: string; state: string }[]).map((r) => [r.rule_id, r.state])
    );
    // Strongest state wins when a ticker carries several rules.
    const RANK: Record<string, number> = { building: 1, near_trigger: 2, triggered: 3 };
    for (const r of ruleRows) {
      const t = r.ticker?.toUpperCase();
      const st = stateByRule.get(r.id);
      if (!t || !st) continue;
      const cur = stateByTicker.get(t);
      if (!cur || (RANK[st] ?? 0) > (RANK[cur] ?? 0)) stateByTicker.set(t, st);
    }
  }

  const byTicker = new Map((snaps || []).map((s) => [s.ticker.toUpperCase(), s]));
  const metricByTicker = new Map((metrics || []).map((m) => [m.ticker.toUpperCase(), m]));

  // DISTINCT REASONS ACROSS ROWS. Rows are shaped in the order they will be
  // ranked, and each takes the strongest reason no earlier row already used —
  // so the section stops printing the same sentence four times.
  const spoken = new Set<string>();

  const items = tickers.map((t) => {
    const s = byTicker.get(t);
    const prov = (s?.provenance as Provenance) || {};
    const m = metricByTicker.get(t);
    const researchViews7d = prov.researchViews7d ?? 0;
    const sentimentNet = prov.sentiment?.net ?? 0;
    const watchers7d = prov.watchlistAdds7d ?? 0;
    const clubChange = s ? Number(s.club_change_14d) : 0;
    const watchState = stateByTicker.get(t) ?? null;
    const company = m?.name || nameByTicker.get(t) || null;
    return {
      ticker: t,
      // UI contract (§9): shaped fields the ForYou card renders directly.
      company,
      price: m?.price != null ? Number(m.price) : null,
      changePct: m?.chg_1d != null ? Number(m.chg_1d) : null,
      // Filled in AFTER the sort — see the reason pass below.
      delta: "",
      kind: "pattern" as BriefKind,
      // Original raw counts (additive — kept for any other consumer).
      companyName: nameByTicker.get(t) || company,
      researchViews7d,
      sentimentNet,
      watchers7d,
      clubScore: s ? Number(s.club_score) : 0,
      clubChange,
      watchState,
    };
  });

  // Surface the tickers with the most movement first.
  items.sort(
    (a, b) =>
      b.researchViews7d + b.watchers7d + Math.abs(b.sentimentNet) -
      (a.researchViews7d + a.watchers7d + Math.abs(a.sentimentNet))
  );

  // THE REASON PASS — runs on the SORTED rows, so the strongest ticker gets
  // first claim on the strongest reason and the quieter ones fall through to
  // the next thing that is actually true about them.
  for (const it of items) {
    const candidates = reasonsFor({
      researchViews7d: it.researchViews7d,
      watchers7d: it.watchers7d,
      sentimentNet: it.sentimentNet,
      clubChange: it.clubChange,
      watchState: it.watchState,
    });
    const chosen = candidates.find((c) => !spoken.has(c.delta)) ?? candidates[0];
    spoken.add(chosen.delta);
    it.delta = chosen.delta;
    it.kind = chosen.kind;
  }

  return { body: { items } };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status, body } = await forYouCore(ctx);
  return NextResponse.json(body, status ? { status } : undefined);
}
