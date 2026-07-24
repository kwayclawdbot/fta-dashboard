import { createClient } from "@/lib/supabase/server";
import { fetchNewsFeed } from "@/lib/news/client";
import NewsClient from "./NewsClient";

/**
 * /news — Club Newsroom, server-first first paint (speed pass).
 *
 * The default "All" feed is fetched on the SERVER and handed to the client as
 * `initialArticles`, so the article list paints on first paint instead of after
 * hydrate → client query. The newsroom is free-visible (authenticated read),
 * so every member tier gets the same seed — no tier gating here. Auth is already
 * enforced by the (dashboard) layout. All interactivity (kind tabs, ticker
 * filter, how-to hint) stays in the client; a failed seed just passes null and
 * the client fetches/degrades to its own skeleton.
 */
export const dynamic = "force-dynamic";

export default async function NewsroomPage() {
  const supabase = await createClient();
  const initialArticles = await fetchNewsFeed(supabase, { kind: null, limit: 60 }).catch(
    () => null
  );
  return <NewsClient initialArticles={initialArticles} />;
}
