import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { beltForXp } from "@/lib/belts";
import type { NewsCardData } from "@/lib/news/types";
import type {
  BeltWatch,
  KaiReportRef,
  ResearchContribution,
} from "@/lib/discover";
import type { CommunityEntry } from "@/lib/community-watchlist";
import type { StanceShift } from "@/lib/community-watchlist-board";

/**
 * CLUB-WIDE READ CACHE (speed wave).
 *
 * Everything in this file answers the SAME question for every member of the
 * club — the newsroom feed, the published Kai reports, the typed research
 * contributions, the community board, the stance-shift aggregate, and the
 * black-belt watch roster. None of it is keyed by the viewer, so the identical
 * rows were being recomputed from scratch on every single page view, and a few
 * of them are genuinely expensive: `get_community_board` runs a correlated
 * comment count and a lateral latest-close join PER ENTRY.
 *
 * WHY IT IS SAFE TO SHARE ONE CACHE ENTRY ACROSS MEMBERS — checked policy by
 * policy, not assumed:
 *   • news_articles      → `for select to authenticated using (published)`,
 *                          and the query filters published = true (mig 117).
 *   • kai_reports        → `for select to authenticated using (true)` (mig 100).
 *   • community_ticker_comments → `using (true)` (mig 097); the author join
 *                          reads profiles, `using (auth.uid() is not null)`
 *                          (mig 016) — i.e. every member sees every row.
 *   • ticker_sentiment   → `using (true)` (mig 110).
 *   • get_community_board / get_stance_shifts / xp_leaderboard_individuals →
 *                          SECURITY DEFINER functions whose bodies do not
 *                          reference the caller at all, so their output is
 *                          already identical for everyone.
 * So the service-role read below returns EXACTLY the rows the member's own
 * RLS-scoped read would have returned. Nothing that varies per member — tier,
 * register, the viewer's own votes or watchlist, XP, family — is cached here;
 * those stay on the per-request path where they belong, and every entitlement
 * gate (the free-tier trending cap, the kid wall) is still applied by the
 * caller AFTER the cached data comes back.
 *
 * TTL is deliberately short (60s). These surfaces are a feed and a set of
 * aggregates, not a live price: a member posting a contribution sees it within
 * a minute, which is the same window the club-metrics refresh already runs on.
 */

/** One minute. Long enough to absorb a burst, short enough that the newsroom
 *  and the board still read as live.
 *
 *  EXPORTED because the same invariant now governs the /api/club/* section
 *  cores (brief, trending, thinking, people, collective, pulse, debate's face
 *  roster). Those wrappers live next to the derive they cache — the derive is
 *  the thing being reasoned about — but they must all share ONE window, or the
 *  board would show sections computed a minute apart from each other. */
export const CLUB_TTL_SECONDS = 60;

/* ── the newsroom feed (/discover, board 02 foot) ─────────────────────────── */

export const getCachedNewsFeed = unstable_cache(
  async (limit: number): Promise<NewsCardData[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("news_articles")
      .select("slug,kind,title,dek,tickers,generated_at")
      .eq("published", true)
      .order("generated_at", { ascending: false })
      .limit(limit);
    return (data as NewsCardData[] | null) ?? [];
  },
  ["club:news-feed"],
  { revalidate: CLUB_TTL_SECONDS, tags: ["club-news"] }
);

/* ── Top Research: typed contributions + newest published Kai reports ─────── */

const AUTHOR_SEL =
  "author:profiles!community_ticker_comments_user_id_fkey(display_name, username, avatar_url, role, age_group)";

type RawAuthor = ResearchContribution["author"];

function normAuthor(a: RawAuthor | RawAuthor[] | null): RawAuthor {
  return Array.isArray(a) ? (a[0] ?? null) : a;
}

export const getCachedContributions = unstable_cache(
  async (): Promise<ResearchContribution[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("community_ticker_comments")
      .select(`id, ticker, body, contribution_type, created_at, ${AUTHOR_SEL}`)
      .in("contribution_type", ["thesis", "risk", "chart"])
      .order("created_at", { ascending: false })
      .limit(12);
    const rows = (data ?? []) as unknown as (ResearchContribution & {
      author: RawAuthor | RawAuthor[] | null;
      body: string;
    })[];
    return rows.map((r) => ({
      id: r.id,
      ticker: r.ticker,
      snippet: (r.body || "").slice(0, 180),
      contribution_type: r.contribution_type,
      created_at: r.created_at,
      author: normAuthor(r.author),
    }));
  },
  ["club:contributions"],
  { revalidate: CLUB_TTL_SECONDS, tags: ["club-research"] }
);

/** Newest published report per ticker, already deduped to `max` names. */
export const getCachedKaiReports = unstable_cache(
  async (max: number): Promise<KaiReportRef[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("kai_reports")
      .select("ticker, company_name, generated_at")
      .eq("status", "published")
      .order("generated_at", { ascending: false })
      .limit(30);
    const seen = new Set<string>();
    const out: KaiReportRef[] = [];
    for (const r of (data ?? []) as KaiReportRef[]) {
      const key = (r.ticker || "").toUpperCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(r);
      if (out.length >= max) break;
    }
    return out;
  },
  ["club:kai-reports"],
  { revalidate: CLUB_TTL_SECONDS, tags: ["club-research"] }
);

/* ── board 02 §"Black belts are watching" ─────────────────────────────────── */

export const getCachedBeltWatch = unstable_cache(
  async (): Promise<{ beltWatch: BeltWatch[]; blackBelts: number }> => {
    const admin = createAdminClient();
    const board = await admin
      .rpc("xp_leaderboard_individuals", { p_window: "all", p_scope: "all" })
      .then(
        ({ data }) =>
          (data as { rows?: { id: string; xp: number }[] } | null)?.rows ?? [],
        () => [] as { id: string; xp: number }[]
      );

    const blackIds = board
      .filter((r) => beltForXp(Number(r.xp) || 0).belt.key === "black")
      .map((r) => r.id)
      .filter(Boolean);

    if (blackIds.length === 0) return { beltWatch: [], blackBelts: 0 };

    const rows = await admin
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

    const names = await admin
      .from("screener_metrics")
      .select("ticker, name")
      .in(
        "ticker",
        top.map(([t]) => t)
      )
      .then(
        ({ data }) =>
          new Map(
            ((data ?? []) as { ticker: string; name: string | null }[]).map((m) => [
              m.ticker.toUpperCase(),
              m.name,
            ])
          ),
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
  },
  ["club:belt-watch"],
  { revalidate: CLUB_TTL_SECONDS, tags: ["club-belts"] }
);

/* ── the community board + the opinion-change aggregate ───────────────────── */

export const getCachedCommunityBoard = unstable_cache(
  async (): Promise<CommunityEntry[]> => {
    const admin = createAdminClient();
    const { data } = await admin.rpc("get_community_board");
    const board = (data || {}) as { entries?: CommunityEntry[] };
    return board.entries ?? [];
  },
  ["club:community-board"],
  { revalidate: CLUB_TTL_SECONDS, tags: ["club-board"] }
);

export const getCachedStanceShifts = unstable_cache(
  async (hours: number): Promise<StanceShift[]> => {
    const admin = createAdminClient();
    const { data } = await admin.rpc("get_stance_shifts", { p_hours: hours });
    return (data ?? []) as StanceShift[];
  },
  ["club:stance-shifts"],
  { revalidate: CLUB_TTL_SECONDS, tags: ["club-board"] }
);
