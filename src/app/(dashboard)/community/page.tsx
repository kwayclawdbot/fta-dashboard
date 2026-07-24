import { createClient } from "@/lib/supabase/server";
import { getCommunityFeedSeed } from "@/lib/feed-seed";
import CommunityClient from "./CommunityClient";

/**
 * /community — server-first first paint (speed pass).
 *
 * The feed (posts + anchor + pinned announcement), its batched like/comment
 * counts, author tier badges + belt XP, resolved @mentions, and the viewer's
 * profile + tier are composed on the SERVER and handed to the client as
 * `initialData`, so the feed paints on first paint instead of after
 * hydrate → session → profile → feed. The client seeds its state from the prop
 * and skips its initial load; 30s polling, badge evaluation, the composer and
 * every write stay on the client. A failed seed passes null and the client runs
 * its original full load. Auth is already enforced by the (dashboard) layout.
 */
export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const supabase = await createClient();
  const initialData = await getCommunityFeedSeed(supabase).catch(() => null);
  return <CommunityClient initialData={initialData} />;
}
