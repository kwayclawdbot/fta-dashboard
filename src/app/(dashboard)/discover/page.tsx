import { createClient } from "@/lib/supabase/server";
import { fetchNewsFeed } from "@/lib/news/client";
import { getCommunityBoardSeed } from "@/lib/community-watchlist-board";
import DiscoverClient from "./DiscoverClient";

/**
 * /discover — the Club's discovery hub (Cheat Code Club redesign, R2 nav shell).
 *
 * A NEW top-level surface introduced by the five-item nav. R2 ships the
 * functional shell: the five tabs (For You · Trending · Top Research · Most
 * Discussed · News) exist and each renders real content where it maps trivially
 * onto surfaces we already have — News = the newsroom feed, Trending / Most
 * Discussed = slices of the community board, and the Stock Finder (screener)
 * lives here now behind a "Launch Stock Finder" CTA. For You / Top Research are
 * honest placeholders that point at what exists today. R3 makes the shell rich
 * (ranked trending lists w/ sparklines, research author cards).
 *
 * Server-first: news + the community board seed are fetched here and handed to
 * the client so the default tab paints without a hydrate round trip. A failed
 * seed just passes null and the client degrades gracefully.
 */
export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const supabase = await createClient();
  const [initialNews, board] = await Promise.all([
    fetchNewsFeed(supabase, { kind: null, limit: 30 }).catch(() => null),
    getCommunityBoardSeed(supabase).catch(() => null),
  ]);
  return <DiscoverClient initialNews={initialNews} board={board} />;
}
