/**
 * Club Newsroom — client-side reads (LANE 10). Thin queries over the browser
 * Supabase client; the newsroom is free-visible (authenticated read), so these
 * work for every member tier. No writes here — articles are service-role only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewsArticle, NewsCardData, NewsKind } from "@/lib/news/types";

const CARD_COLS = "slug,kind,title,dek,tickers,generated_at";

/** Feed query — newest published first, optional kind / ticker filter. */
export async function fetchNewsFeed(
  supabase: SupabaseClient,
  opts: { kind?: NewsKind | null; ticker?: string | null; limit?: number } = {}
): Promise<NewsCardData[]> {
  let q = supabase
    .from("news_articles")
    .select(CARD_COLS)
    .eq("published", true)
    .order("generated_at", { ascending: false })
    .limit(opts.limit ?? 60);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.ticker) q = q.contains("tickers", [opts.ticker.toUpperCase()]);
  const { data } = await q;
  return (data as NewsCardData[]) || [];
}

/** One article by slug (full sections). */
export async function fetchNewsArticle(
  supabase: SupabaseClient,
  slug: string
): Promise<NewsArticle | null> {
  const { data } = await supabase
    .from("news_articles")
    .select("id,slug,kind,title,dek,sections,tickers,model,published,generated_at")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return (data as NewsArticle) ?? null;
}

/** In-house articles tagged with a ticker — the research-page "Club Newsroom" group. */
export async function fetchClubNewsForTicker(
  supabase: SupabaseClient,
  ticker: string,
  limit = 4
): Promise<NewsCardData[]> {
  const { data } = await supabase
    .from("news_articles")
    .select(CARD_COLS)
    .eq("published", true)
    .contains("tickers", [ticker.toUpperCase()])
    .order("generated_at", { ascending: false })
    .limit(limit);
  return (data as NewsCardData[]) || [];
}
