import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import { getClubTier, type FamilyTier } from "@/lib/tier";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id, age_group, role")
    .eq("id", user.id)
    .maybeSingle();

  const tier = await getClubTier(supabase, profile?.family_id);
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

  const { data: raw } = await withTimeout(
    supabase.rpc("get_community_board"),
    LOAD_TIMEOUT_MS,
    { data: null } as { data: unknown }
  );
  const board = (raw || {}) as { entries?: CommunityEntry[] };
  const entries = board.entries || [];

  const tickers = Array.from(new Set(entries.map((e) => e.ticker).filter(Boolean)));

  const [likeRows, favorites, shiftRows] = await Promise.all([
    tickers.length
      ? supabase
          .from("ticker_like_counts")
          .select("ticker, likes, unlikes, net")
          .in("ticker", tickers)
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    fetchFavorites(supabase, "all", 5).catch(() => [] as Favorite[]),
    // Migration 195. Fails soft to [] so a board without the function deployed
    // simply omits the section rather than erroring the whole first paint.
    Promise.resolve(supabase.rpc("get_stance_shifts", { p_hours: 24 })).then(
      ({ data }) => (data ?? []) as StanceShift[],
      () => [] as StanceShift[]
    ),
  ]);

  const likeCounts: Record<string, LikeCount> = {};
  for (const r of likeRows as { ticker: string; likes: number; unlikes: number; net: number }[]) {
    likeCounts[r.ticker] = { likes: r.likes, unlikes: r.unlikes, net: r.net };
  }

  return { ...base, entries, likeCounts, favorites, stanceShifts: shiftRows };
}
