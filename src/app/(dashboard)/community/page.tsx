import CommunityChat from "./CommunityChat";

/**
 * /community — the chat area.
 *
 * RESTORED. This route served the club CHAT — rooms, a compose card, dated
 * message cards — from migration 016 until 64de416 turned it feed-first, and
 * 4918d0b then rebuilt it as the Club boards (Feed / Discussions / Changed My
 * Mind / Lounge / Live). Owner directive, 2026-07-31: the chat area comes back.
 * The chat is what a member came here for; the feed put stance cards, flips and
 * seeded personas in front of it.
 *
 * The feed is not deleted, only unrouted. ClubModeShell, CommunityClient,
 * ClubDiscussions, ClubLiveTab, board.tsx and parts.tsx all stay on disk — v3
 * builds on their primitives. Nothing routes to them: Discussions and CHANGED
 * MY MIND are gone as surfaces (owner directive, 2026-08-01), and both
 * /community/changed-my-mind and /community/compose now redirect here.
 *
 * There is no server seed to compose: the chat's first paint is its room
 * history, which is a client realtime subscription either way, so the whole
 * surface is one client component and the (dashboard) layout owns auth.
 */
export const dynamic = "force-dynamic";

export default function CommunityPage() {
  return <CommunityChat />;
}
