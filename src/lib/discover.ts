import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequestUser } from "@/lib/supabase/rsc";
import {
  getCachedBeltWatch,
  getCachedContributions,
  getCachedKaiReports,
} from "@/lib/club/club-cache";

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

  // Local token verification, not a GoTrue round trip, and shared with the page
  // and the shell (src/lib/supabase/rsc.ts).
  const user = await getRequestUser();
  if (!user) return empty;

  // SPEED — this used to be THREE sequential waves: [votes, contributions,
  // reports] → screener_metrics → getBeltWatch (itself another three serial
  // reads). Only ONE of those dependencies is real (the For-You movers need the
  // viewer's watched tickers first), so everything else now runs alongside it.
  //
  // Three of the four are club-wide — the same rows for every member — so they
  // come from the 60s shared cache in src/lib/club/club-cache.ts rather than
  // being recomputed per view. The viewer's OWN votes are per-user and are
  // deliberately NOT cached: a member must see their own watchlist immediately.
  const [votesRes, contributions, reports, belts] = await Promise.all([
    supabase
      .from("ticker_sentiment")
      .select("ticker")
      .eq("user_id", user.id)
      .eq("vote", 1)
      .order("updated_at", { ascending: false })
      .limit(20)
      .then(({ data }) => data ?? [], () => [] as { ticker: string }[]),
    getCachedContributions().catch(() => [] as ResearchContribution[]),
    getCachedKaiReports(8).catch(() => [] as KaiReportRef[]),
    getCachedBeltWatch().catch(() => ({ beltWatch: [], blackBelts: 0 })),
  ]);

  const watched = Array.from(
    new Set((votesRes as { ticker: string }[]).map((r) => r.ticker).filter(Boolean))
  );

  // For-You movers: the viewer's watched tickers, ranked by |day move|. The one
  // genuinely dependent read — it cannot start until `watched` is known.
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

  return {
    watched,
    forYouMovers,
    contributions,
    reports,
    beltWatch: belts.beltWatch,
    blackBelts: belts.blackBelts,
  };
}

/* ── board 02 §"Black belts are watching" ──────────────────────────────────
 * Now built by getCachedBeltWatch() in src/lib/club/club-cache.ts, where it is
 * shared across members on a 60s TTL. It is the same three reads it always was:
 *
 *   1. `xp_leaderboard_individuals` (security definer, migration 099) returns
 *      every member with their summed XP. `beltForXp` maps XP → belt, so the
 *      black-belt roster is derived from the SAME function the belt ladder and
 *      the leaderboard use — this surface cannot disagree with them.
 *   2. `ticker_sentiment` is readable by any authenticated member (`select
 *      using (true)`, migration 110). A vote of 1 is the app's "watching" act.
 *   3. `screener_metrics` for the company names.
 *
 * The answer does not depend on WHO is asking — every member sees the same
 * black-belt roster — which is exactly why one cache entry serves all of them.
 *
 * Fails soft to nothing. An empty result is a real answer — a club with no
 * black belts yet has no black-belt watchlist, and the surface says exactly
 * that rather than borrowing the trending list and relabelling it.
 */
