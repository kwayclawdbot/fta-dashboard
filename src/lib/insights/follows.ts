import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export interface FollowCounts {
  followers: number;
  following: number;
  /** Whether `viewerId` follows `userId` (false when viewer is absent or self). */
  isFollowing: boolean;
}

/**
 * Follower / following counts for a member, plus whether the viewer follows
 * them. For the profile server component to call directly (no HTTP hop). Reads
 * through whatever client is passed; `follows` is readable by any authenticated
 * member, so an RLS-scoped server client is fine.
 */
export async function getFollowCounts(
  db: DB,
  userId: string,
  viewerId?: string | null
): Promise<FollowCounts> {
  const [followersRes, followingRes] = await Promise.all([
    db.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", userId),
    db.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
  ]);

  let isFollowing = false;
  if (viewerId && viewerId !== userId) {
    const { data } = await db
      .from("follows")
      .select("follower_id")
      .eq("follower_id", viewerId)
      .eq("followee_id", userId)
      .maybeSingle();
    isFollowing = !!data;
  }

  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
    isFollowing,
  };
}
