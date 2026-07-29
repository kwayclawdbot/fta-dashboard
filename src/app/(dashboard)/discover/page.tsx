import { getRequestClient, getRequestProfile } from "@/lib/supabase/rsc";
import { getCachedNewsFeed } from "@/lib/club/club-cache";
import { getCommunityBoardSeed } from "@/lib/community-watchlist-board";
import { getDiscoverExtras } from "@/lib/discover";
import { deriveRegister } from "@/lib/register";
import DiscoverClient from "./DiscoverClient";

/**
 * /discover — the Club's discovery hub, composed in DiscoverClient to the
 * owner's mockup BOARD 02 (and board 15 for its Screener tab).
 *
 * The surface is a "discover" masthead with two round controls, the board's
 * orange PILL TABS (For you · Screener · Trending), and then the board's four
 * sections as drawn: Rising fast, Most divisive (the donut), Black belts are
 * watching, From quiet to loud — with the newsroom at the foot.
 *
 * Server-first: news + the community board seed + the discover extras are
 * fetched here and handed to the client so the surface paints without a hydrate
 * round trip. The live community-attention ledger (/api/club/trending, which
 * owns the entitlement cap and the compliance disclaimer) is read client-side.
 * A failed seed just passes null and the client degrades to founding-era copy —
 * never a fabricated number.
 *
 * `extras` now also carries the REAL black-belt watch roster (see
 * src/lib/discover.ts) that board 02's third section needs.
 */
export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  // SPEED: the auth call and the profile read that used to open this page were
  // the THIRD copy of each on the same request (the shell and both seed
  // builders below made their own). They are now the request-scoped shared
  // reads, and the newsroom feed — the same published rows for every member —
  // comes from the 60s club-wide cache instead of a query per view.
  const supabase = await getRequestClient();

  const [initialNews, board, extras, profile] = await Promise.all([
    getCachedNewsFeed(30).catch(() => null),
    getCommunityBoardSeed(supabase).catch(() => null),
    getDiscoverExtras(supabase).catch(() => null),
    getRequestProfile().catch(() => null),
  ]);

  // /screener redirects kids server-side (and migration 137 closed the data
  // door), so the SCREENER tab would be a door that bounces a young member to
  // /dashboard. It is resolved here, on the server, where the register is
  // actually known — the client never guesses.
  const isKid = deriveRegister(profile) === "kid";

  const requested = await searchParams;
  const requestedTab = requested.tab;
  const initialTab =
    requestedTab === "screener" || requestedTab === "trending"
      ? requestedTab
      : "foryou";

  return (
    <DiscoverClient
      initialNews={initialNews}
      board={board}
      extras={extras}
      showScreener={!isKid}
      initialTab={isKid && initialTab === "screener" ? "foryou" : initialTab}
      initialQuery={requested.q ?? ""}
    />
  );
}
