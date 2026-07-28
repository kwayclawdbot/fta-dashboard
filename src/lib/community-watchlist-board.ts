import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import { effectiveClubTier, type FamilyTier } from "@/lib/tier";
import {
  getRequestProfile,
  getRequestTierState,
  getRequestUser,
} from "@/lib/supabase/rsc";
import {
  getCachedCommunityBoard,
  getCachedStanceShifts,
} from "@/lib/club/club-cache";
import { fetchFavorites, type Favorite } from "@/lib/research/social";
import type { CommunityEntry } from "@/lib/community-watchlist";

/** Net like tally for one ticker (from the ticker_like_counts view). */
export interface LikeCount {
  likes: number;
  unlikes: number;
  net: number;
}

/**
 * Server-first seed for /watchlist/community (speed pass). Mirrors the client's
 * paint-critical reads so the board paints on first paint: tier (for the
 * members-only gate), the community board entries, batched like counts, and the
 * Community Favorites strip. Live quotes and the viewer's own votes stay on the
 * client (not paint-critical, and user/live-specific).
 *
 * Uses the caller's AUTHED server supabase client (RLS runs as the member).
 * For free members it resolves tier only and returns NO board entries — the
 * page renders the upsell, so board data is never seeded to a free client.
 */
/**
 * One company the club RE-THOUGHT inside the window — a member who had already
 * voted changed that vote. Canvas board 06 draws this as "Opinion Changes · 4
 * tickers shifted today"; migration 195 added the aggregate behind it. Counts
 * only: `get_stance_shifts` never returns who changed their mind.
 */
export interface StanceShift {
  ticker: string;
  shifts: number;
  net_now: number;
}

export interface CommunityBoardSeed {
  userId: string;
  tier: FamilyTier;
  ageGroup: string | null;
  role: string | null;
  entries: CommunityEntry[];
  likeCounts: Record<string, LikeCount>;
  favorites: Favorite[];
  stanceShifts: StanceShift[];
}

export async function getCommunityBoardSeed(
  supabase: SupabaseClient
): Promise<CommunityBoardSeed | null> {
  // SPEED: was getUser() (a GoTrue round trip) → profiles → getClubTier, three
  // sequential round trips that the shell and the page had ALREADY paid for on
  // the same request. All three are now the request-scoped shared reads.
  const [user, profile] = await Promise.all([
    getRequestUser(),
    getRequestProfile(),
  ]);
  if (!user) return null;
  const tierState = await getRequestTierState(profile?.family_id);

  // Identical to the previous getClubTier(): real tier folded through the Club
  // clock, so a lapsed FTA family still reads 'free' here.
  const tier = effectiveClubTier(tierState.tier, tierState.clubLapsed);
  const base: CommunityBoardSeed = {
    userId: user.id,
    tier,
    ageGroup: profile?.age_group ?? null,
    role: profile?.role ?? null,
    entries: [],
    likeCounts: {},
    favorites: [],
    stanceShifts: [],
  };

  // Never seed board data to a free member — the page renders the upsell.
  if (tier === "free") return base;

  // SPEED — the board, the favourites strip and the stance-shift aggregate do
  // NOT depend on each other; only the like counts need the board's tickers.
  // They used to run board → [likes, favourites, shifts], i.e. everything
  // waited on the single most expensive query in this file. Now the two
  // independent reads start immediately alongside it.
  //
  // `get_community_board` and `get_stance_shifts` are SECURITY DEFINER
  // functions that never reference the caller, so their result is identical for
  // every member and comes from the 60s club-wide cache (club-cache.ts). The
  // board is the expensive one: a correlated comment count plus a lateral
  // latest-close join per entry, re-run for every viewer until now.
  const boardPromise = withTimeout(
    getCachedCommunityBoard(),
    LOAD_TIMEOUT_MS,
    [] as CommunityEntry[]
  );
  const favoritesPromise = fetchFavorites(supabase, "all", 5).catch(
    () => [] as Favorite[]
  );
  // Migration 195. Fails soft to [] so a board without the function deployed
  // simply omits the section rather than erroring the whole first paint.
  const shiftsPromise = getCachedStanceShifts(24).catch(() => [] as StanceShift[]);

  const entries = await boardPromise;
  const tickers = Array.from(new Set(entries.map((e) => e.ticker).filter(Boolean)));

  const [likeRows, favorites, shiftRows] = await Promise.all([
    tickers.length
      ? supabase
          .from("ticker_like_counts")
          .select("ticker, likes, unlikes, net")
          .in("ticker", tickers)
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    favoritesPromise,
    shiftsPromise,
  ]);

  const likeCounts: Record<string, LikeCount> = {};
  for (const r of likeRows as { ticker: string; likes: number; unlikes: number; net: number }[]) {
    likeCounts[r.ticker] = { likes: r.likes, unlikes: r.unlikes, net: r.net };
  }

  return { ...base, entries, likeCounts, favorites, stanceShifts: shiftRows };
}
