import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export interface DiscoverExtras {
  /** Tickers the viewer has liked (👍) — their followed set. */
  watched: string[];
  /** Day movers among the viewer's watched tickers (For You). */
  forYouMovers: ForYouMover[];
  /** Typed research contributions (thesis / risk / chart) — Top Research. */
  contributions: ResearchContribution[];
  /** Newest published Kai reports, one per ticker — Top Research. */
  reports: KaiReportRef[];
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

  return { watched, forYouMovers, contributions, reports };
}
