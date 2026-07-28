import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCommunityBoardSeed } from "@/lib/community-watchlist-board";
import CommunityWatchlistClient from "./CommunityWatchlistClient";

// Overrides the /watchlist layout title: this is a different board with a
// different name, and it is the name the rail uses to send a member here.
export const metadata: Metadata = {
  title: "Club Picks",
  description:
    "Every company on the club board was brought by a member and is researched in the open.",
};

/**
 * /watchlist/community — server-first first paint (speed pass).
 *
 * The paint-critical reads (tier + community board entries + batched like counts
 * + Community Favorites) are done on the SERVER and handed to the client as
 * `initialData`, so the board paints on first paint instead of after
 * hydrate → auth → tier → RPC. Free members are resolved server-side and seeded
 * with NO board entries (the client renders the upsell), so premium board data
 * is never sent to a free client. Live quotes, the viewer's own votes, inline
 * threads, voting, tabs and the hint framework all stay on the client; a failed
 * seed just passes null and the client runs its original full load.
 */
export const dynamic = "force-dynamic";

export default async function CommunityWatchlistPage() {
  const supabase = await createClient();
  const initialData = await getCommunityBoardSeed(supabase).catch(() => null);
  return <CommunityWatchlistClient initialData={initialData} />;
}
