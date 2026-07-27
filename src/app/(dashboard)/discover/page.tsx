import { createClient } from "@/lib/supabase/server";
import { fetchNewsFeed } from "@/lib/news/client";
import { getCommunityBoardSeed } from "@/lib/community-watchlist-board";
import { getDiscoverExtras } from "@/lib/discover";
import { deriveRegister } from "@/lib/register";
import DiscoverClient from "./DiscoverClient";

/**
 * /discover — the Club's discovery hub (canvas rebuild B).
 *
 * The surface is composed in DiscoverClient to the club canvas system: a
 * display-1 masthead, a ruled search field with the "or ask Kai" handoff, the
 * shared <TickerCarousel />, a segmented control (For You · Trending · Top
 * Research · Most Discussed) driving ONE ranked hairline ledger, the author-led
 * research list, the orange Stock Finder band (the screener lives behind it),
 * and the preserved newsroom.
 *
 * Server-first: news + the community board seed + the discover extras are
 * fetched here and handed to the client so the surface paints without a hydrate
 * round trip. The live community-attention ledger (/api/club/trending, which
 * owns the entitlement cap and the compliance disclaimer) and the pulse series
 * are read client-side. A failed seed just passes null and the client degrades
 * to founding-era copy — never a fabricated number.
 */
export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [initialNews, board, extras, profile] = await Promise.all([
    fetchNewsFeed(supabase, { kind: null, limit: 30 }).catch(() => null),
    getCommunityBoardSeed(supabase).catch(() => null),
    getDiscoverExtras(supabase).catch(() => null),
    user
      ? supabase
          .from("profiles")
          .select("role, age_group, track")
          .eq("id", user.id)
          .maybeSingle()
          .then(({ data }) => data, () => null)
      : Promise.resolve(null),
  ]);

  // /screener redirects kids server-side (and migration 137 closed the data
  // door), so the Stock Finder band was offering a young member a door that
  // bounces them to /dashboard. The band is resolved here, on the server, where
  // the register is actually known — the client never guesses.
  const isKid = deriveRegister(profile) === "kid";

  return (
    <DiscoverClient
      initialNews={initialNews}
      board={board}
      extras={extras}
      showStockFinder={!isKid}
    />
  );
}
