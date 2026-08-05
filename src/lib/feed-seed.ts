import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getClubTier,
  getFamilyTierMap,
  type FamilyTier,
} from "@/lib/tier";
import { fetchXpForUsers } from "@/lib/belts";
import type { FeedPost, FeedAuthor, Role } from "@/lib/feed";

/** The signed-in viewer, as the community feed needs them. */
export interface FeedMe {
  id: string;
  display_name: string;
  role: Role;
  age_group: string | null;
  family_id: string | null;
  avatar_url: string | null;
  username: string | null;
}

/** Everything /community needs to paint the feed on first paint. */
export interface CommunityFeedSeed {
  me: FeedMe | null;
  myTier: FamilyTier;
  posts: FeedPost[];
  likeCount: Record<string, number>;
  likedByMe: string[]; // serializable; client rehydrates to a Set
  commentCount: Record<string, number>;
  tiers: Record<string, FamilyTier>;
  beltXp: Record<string, number>;
  mentions: Record<string, string>; // handleLower -> username
}

const AUTHOR_SEL =
  "author:profiles!feed_posts_author_id_fkey(id, display_name, role, age_group, family_id, avatar_url, username)";

const HANDLE_CHARS = "A-Za-z0-9_.'-";
/** Local copy of extractHandles (the shared one lives in a client module). */
function extractHandles(bodies: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  const re = new RegExp(`(?:^|\\s)@([${HANDLE_CHARS}]+)`, "g");
  for (const body of bodies) {
    if (!body) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const h = m[1].toLowerCase();
      if (h) out.add(h);
    }
  }
  return [...out];
}

function normAuthor(a: FeedAuthor | FeedAuthor[] | null): FeedAuthor | null {
  return Array.isArray(a) ? a[0] ?? null : a;
}

/**
 * Server-first seed for /community (speed pass). Composes the same paint-critical
 * reads the client's initial load did — the feed (posts + anchor + pinned),
 * batched like/comment counts, author tier badges, belt XP, resolved @mentions,
 * the viewer profile and their tier — under the member's authed session, so the
 * feed paints on first paint instead of after hydrate → session → profile →
 * feed. Live 30s polling, badge evaluation, the composer and every write stay on
 * the client. A null return lets the client run its original full load.
 */
export async function getCommunityFeedSeed(
  supabase: SupabaseClient
): Promise<CommunityFeedSeed | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? null;
  if (!uid) return null;

  // Profile + feed in parallel — the feed never waits behind the profile.
  const profileP = supabase
    .from("profiles")
    .select("display_name, role, age_group, family_id, avatar_url, username")
    .eq("id", uid)
    .single()
    .then(({ data }) => data);

  const feedP = supabase
    .from("feed_posts")
    .select(
      `id, author_id, family_id, kind, body, title, link, audience, attachment_url, attachment_type, attachment_meta, activity_payload, anchor_week_id, pinned, ticker_tags, position, created_at, ${AUTHOR_SEL}`
    )
    // KID WALL (214). RLS already scopes kid-authored rows to their household,
    // so this is defence in depth, not the wall itself — it keeps the shared
    // feed free of a viewer's OWN kid rows too (the policy admits those), so the
    // club surface reads the same for every member of a household.
    .neq("author_register", "kid")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60)
    .then(({ data }) => data ?? []);

  const [profile, rawPosts] = await Promise.all([profileP, feedP]);

  const posts: FeedPost[] = rawPosts.map((r) => {
    const raw = r as unknown as FeedPost & { author: FeedAuthor | FeedAuthor[] | null };
    return { ...raw, author: normAuthor(raw.author) };
  });

  const me: FeedMe | null = profile
    ? {
        id: uid,
        display_name: profile.display_name || "You",
        role: (profile.role as Role) || "parent",
        age_group: profile.age_group ?? null,
        family_id: profile.family_id ?? null,
        avatar_url: profile.avatar_url ?? null,
        username: profile.username ?? null,
      }
    : null;

  const ids = posts.map((p) => p.id);
  const authorFamilyIds = posts.map((p) => p.author?.family_id);
  const authorIds = [uid, ...posts.map((p) => p.author?.id)];
  const handles = extractHandles(posts.map((p) => p.body));

  const [
    myTier,
    tiers,
    beltXp,
    mentionRows,
    likeRows,
    commentRows,
  ] = await Promise.all([
    getClubTier(supabase, profile?.family_id),
    getFamilyTierMap(supabase, authorFamilyIds),
    fetchXpForUsers(supabase, authorIds),
    handles.length
      ? supabase
          .rpc("public_profile_mentions", { p_handles: handles })
          .then(({ data }) => (data as { handle: string; username: string }[]) ?? [])
      : Promise.resolve([] as { handle: string; username: string }[]),
    ids.length
      ? supabase
          .from("post_likes")
          .select("post_id, user_id")
          .in("post_id", ids)
          .then(({ data }) => data ?? [])
      : Promise.resolve([] as { post_id: string; user_id: string }[]),
    ids.length
      ? supabase
          .from("post_comments")
          .select("post_id")
          .in("post_id", ids)
          .neq("author_register", "kid")
          .then(({ data }) => data ?? [])
      : Promise.resolve([] as { post_id: string }[]),
  ]);

  const likeCount: Record<string, number> = {};
  const likedByMe: string[] = [];
  for (const l of likeRows as { post_id: string; user_id: string }[]) {
    likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1;
    if (l.user_id === uid) likedByMe.push(l.post_id);
  }
  const commentCount: Record<string, number> = {};
  for (const c of commentRows as { post_id: string }[]) {
    commentCount[c.post_id] = (commentCount[c.post_id] || 0) + 1;
  }
  const mentions: Record<string, string> = {};
  for (const r of mentionRows) {
    if (r.handle && r.username && !(r.handle in mentions)) mentions[r.handle] = r.username;
  }

  return {
    me,
    myTier,
    posts,
    likeCount,
    likedByMe,
    commentCount,
    tiers,
    beltXp,
    mentions,
  };
}
