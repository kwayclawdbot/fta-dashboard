import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beltForXp } from "@/lib/belts";

/**
 * Server-first extras for /discover (Cheat Code Club redesign, R3). Composes the
 * real content the enriched shell needs — the viewer's For-You mix and the Top
 * Research feed — from data we already have, honestly. Everything fails soft to
 * empty so the client degrades to a nudge rather than a broken tab.
 *
 * Uses the caller's AUTHED server supabase client (RLS runs as the member).
 */

export interface ForYouMover {
  ticker: string;
  name: string | null;
  chg_1d: number | null;
}

export interface ResearchContribution {
  id: string;
  ticker: string;
  snippet: string;
  contribution_type: string | null;
  created_at: string;
  author: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    role: string | null;
    age_group: string | null;
  } | null;
}

export interface KaiReportRef {
  ticker: string;
  company_name: string | null;
  generated_at: string;
}

/** One name on board 02's "BLACK BELTS ARE WATCHING" row. */
export interface BeltWatch {
  ticker: string;
  name: string | null;
  /** How many BLACK-BELT members are watching it. Never rounded, never padded. */
  belts: number;
}

export interface DiscoverExtras {
  /** Tickers the viewer has liked (👍) — their followed set. */
  watched: string[];
  /** Day movers among the viewer's watched tickers (For You). */
  forYouMovers: ForYouMover[];
  /** Typed research contributions (thesis / risk / chart) — Top Research. */
  contributions: ResearchContribution[];
  /** Newest published Kai reports, one per ticker — Top Research. */
  reports: KaiReportRef[];
  /**
   * Board 02 §"Black belts are watching" — the names the Club's highest-XP
   * members actually hold on their watchlists.
   *
   * REAL, not illustrative: the belt roster comes from `xp_leaderboard_
   * individuals` (the same definer the belt ladder reads, so a black belt here
   * is a black belt there), and the watch is a row of `ticker_sentiment` with
   * vote = 1 — the app's existing "watching" act. With no black belts on the
   * roster yet this is an EMPTY ARRAY and the section renders its founding
   * state; it never falls back to a general trending list wearing the label.
   */
  beltWatch: BeltWatch[];
  /** Black belts on the roster right now — the denominator behind `beltWatch`. */
  blackBelts: number;
}

const AUTHOR_SEL =
  "author:profiles!community_ticker_comments_user_id_fkey(display_name, username, avatar_url, role, age_group)";

type RawAuthor = ResearchContribution["author"];

function normAuthor(a: RawAuthor | RawAuthor[] | null): RawAuthor {
  return Array.isArray(a) ? a[0] ?? null : a;
}

export async function getDiscoverExtras(
  supabase: SupabaseClient
): Promise<DiscoverExtras> {
  const empty: DiscoverExtras = {
    watched: [],
    forYouMovers: [],
    contributions: [],
    reports: [],
    beltWatch: [],
    blackBelts: 0,
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  // Parallel, independent reads. Each caught to [] so one failure never blanks
  // the tab.
  const [votesRes, contribRes, reportsRes] = await Promise.all([
    supabase
      .from("ticker_sentiment")
      .select("ticker")
      .eq("user_id", user.id)
      .eq("vote", 1)
      .order("updated_at", { ascending: false })
      .limit(20)
      .then(({ data }) => data ?? [], () => [] as { ticker: string }[]),
    supabase
      .from("community_ticker_comments")
      .select(`id, ticker, body, contribution_type, created_at, ${AUTHOR_SEL}`)
      .in("contribution_type", ["thesis", "risk", "chart"])
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => data ?? [], () => []),
    supabase
      .from("kai_reports")
      .select("ticker, company_name, generated_at")
      .eq("status", "published")
      .order("generated_at", { ascending: false })
      .limit(30)
      .then(({ data }) => data ?? [], () => []),
  ]);

  const watched = Array.from(
    new Set((votesRes as { ticker: string }[]).map((r) => r.ticker).filter(Boolean))
  );

  // For-You movers: the viewer's watched tickers, ranked by |day move|.
  let forYouMovers: ForYouMover[] = [];
  if (watched.length) {
    const metrics = await supabase
      .from("screener_metrics")
      .select("ticker, name, chg_1d")
      .in("ticker", watched)
      .then(({ data }) => (data as ForYouMover[] | null) ?? [], () => [] as ForYouMover[]);
    forYouMovers = metrics
      .slice()
      .sort((a, b) => Math.abs(b.chg_1d ?? 0) - Math.abs(a.chg_1d ?? 0))
      .slice(0, 6);
  }

  const contributions: ResearchContribution[] = (
    contribRes as (ResearchContribution & { author: RawAuthor | RawAuthor[] | null; body: string })[]
  ).map((r) => ({
    id: r.id,
    ticker: r.ticker,
    snippet: (r.body || "").slice(0, 180),
    contribution_type: r.contribution_type,
    created_at: r.created_at,
    author: normAuthor(r.author),
  }));

  // Newest published report per ticker (dedupe versions).
  const seen = new Set<string>();
  const reports: KaiReportRef[] = [];
  for (const r of reportsRes as KaiReportRef[]) {
    const key = (r.ticker || "").toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    reports.push(r);
    if (reports.length >= 8) break;
  }

  const { beltWatch, blackBelts } = await getBeltWatch(supabase);

  return { watched, forYouMovers, contributions, reports, beltWatch, blackBelts };
}

/* ── board 02 §"Black belts are watching" ──────────────────────────────────
 * Two reads, both already granted to an authenticated member:
 *
 *   1. `xp_leaderboard_individuals` (security definer, migration 099) returns
 *      every member with their summed XP. `beltForXp` maps XP → belt, so the
 *      black-belt roster is derived from the SAME function the belt ladder and
 *      the leaderboard use — this surface cannot disagree with them.
 *   2. `ticker_sentiment` is readable by any authenticated member (`select
 *      using (true)`, migration 110). A vote of 1 is the app's "watching" act.
 *
 * Fails soft to nothing. An empty result is a real answer — a club with no
 * black belts yet has no black-belt watchlist, and the surface says exactly
 * that rather than borrowing the trending list and relabelling it.
 */
async function getBeltWatch(
  supabase: SupabaseClient
): Promise<{ beltWatch: BeltWatch[]; blackBelts: number }> {
  const board = await supabase
    .rpc("xp_leaderboard_individuals", { p_window: "all", p_scope: "all" })
    .then(
      ({ data }) => (data as { rows?: { id: string; xp: number }[] } | null)?.rows ?? [],
      () => [] as { id: string; xp: number }[]
    );

  const blackIds = board
    .filter((r) => beltForXp(Number(r.xp) || 0).belt.key === "black")
    .map((r) => r.id)
    .filter(Boolean);

  if (blackIds.length === 0) return { beltWatch: [], blackBelts: 0 };

  const rows = await supabase
    .from("ticker_sentiment")
    .select("ticker")
    .in("user_id", blackIds)
    .eq("vote", 1)
    .limit(500)
    .then(({ data }) => (data as { ticker: string }[] | null) ?? [], () => []);

  const counts = new Map<string, number>();
  for (const r of rows) {
    const t = (r.ticker || "").toUpperCase();
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6);

  if (top.length === 0) return { beltWatch: [], blackBelts: blackIds.length };

  const names = await supabase
    .from("screener_metrics")
    .select("ticker, name")
    .in(
      "ticker",
      top.map(([t]) => t)
    )
    .then(
      ({ data }) => new Map((data ?? []).map((m) => [m.ticker.toUpperCase(), m.name])),
      () => new Map<string, string | null>()
    );

  return {
    beltWatch: top.map(([ticker, belts]) => ({
      ticker,
      name: names.get(ticker) ?? null,
      belts,
    })),
    blackBelts: blackIds.length,
  };
}
