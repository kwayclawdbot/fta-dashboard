import { redirect } from "next/navigation";

/**
 * /community/changed-my-mind — RETIRED (owner directive, 2026-08-01).
 *
 * CHANGED MY MIND was promoted to its own destination alongside the Club feed.
 * /community is the chat area again, and the flip feed is no longer a surface
 * the Club offers: no nav row, no profile link, no tab points here. The route
 * survives only to catch old links and bookmarks and hand them to the chat.
 *
 * ChangedMyMindClient stays on disk, unrouted — the established policy is to
 * unroute rather than delete, so v3 can build on the primitives.
 */
export const dynamic = "force-dynamic";

export default async function ChangedMyMindPage() {
  redirect("/community");
}
