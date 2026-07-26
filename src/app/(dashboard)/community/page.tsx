import { createClient } from "@/lib/supabase/server";
import { getCommunityFeedSeed } from "@/lib/feed-seed";
import ClubModeShell from "./ClubModeShell";

/**
 * /community — THE CLUB (CONVERGENCE S2, amendment #1).
 *
 * No landing layer: The Club opens DIRECTLY into Feed / Lounge / Live via the
 * quiet mode strip in ClubModeShell. The feed (posts + anchor + pinned
 * announcement), batched counts, author badges, resolved @mentions and the
 * viewer's profile + tier are still composed on the SERVER and handed down as
 * `initialData` so the Feed mode paints on first paint; the Lounge chat and Live
 * room list hydrate on the client. A failed seed passes null and the feed runs
 * its original full load. Auth is enforced by the (dashboard) layout.
 *
 * `?events=demo` (dev / vercel preview only, guarded downstream) surfaces fixture
 * live_events so the Live mode + LIVE NOW strip are reviewable before S2.5 lands.
 */
export const dynamic = "force-dynamic";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const [initialData, sp] = await Promise.all([
    getCommunityFeedSeed(supabase).catch(() => null),
    searchParams,
  ]);
  const demoEvents = (Array.isArray(sp.events) ? sp.events[0] : sp.events) === "demo";
  return <ClubModeShell initialData={initialData} demoEvents={demoEvents} />;
}
