import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserXp } from "@/lib/xp";
import { beltForXp } from "@/lib/belts";

/**
 * GET /api/club/thinking → { lead: Post|null, secondary: Post[] }
 *
 * "Today's Best Thinking" — the community feed's member posts ranked by real
 * engagement (likes + comments). The top post is the editorial lead; the next
 * few are the ruled secondary list. Author credibility = their earned belt
 * (from lifetime XP). All counts are real; nothing fabricated.
 */
export const runtime = "nodejs";

interface Post {
  id: string;
  ticker: string | null;
  title: string | null;
  excerpt: string | null;
  author: { id: string; name: string; avatar: string | null; belt: string };
  votes: number;
  comments: number;
  createdAt: string;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Member-authored posts (exclude auto 'activity' cards and 'anchor').
  const { data: posts } = await admin
    .from("feed_posts")
    .select("id, author_id, title, body, ticker_tags, created_at")
    .eq("kind", "post")
    .order("created_at", { ascending: false })
    .limit(40);

  if (!posts || posts.length === 0) {
    return NextResponse.json({ lead: null, secondary: [] });
  }

  const ids = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.author_id).filter(Boolean))] as string[];

  const [{ data: likes }, { data: comments }, { data: authors }] = await Promise.all([
    admin.from("post_likes").select("post_id").in("post_id", ids),
    admin.from("post_comments").select("post_id").in("post_id", ids),
    admin.from("profiles").select("id, display_name, username, avatar_url").in("id", authorIds),
  ]);

  const likeCount = countBy(likes || [], "post_id");
  const commentCount = countBy(comments || [], "post_id");
  const authorMap = new Map((authors || []).map((a) => [a.id, a]));

  // Belts need lifetime XP per author.
  const xpByAuthor = new Map<string, number>();
  await Promise.all(
    authorIds.map(async (id) => {
      xpByAuthor.set(id, await getUserXp(admin, id));
    })
  );

  const shaped: Post[] = posts.map((p) => {
    const a = authorMap.get(p.author_id as string);
    const xp = xpByAuthor.get(p.author_id as string) || 0;
    return {
      id: p.id,
      ticker: p.ticker_tags && p.ticker_tags.length ? p.ticker_tags[0] : null,
      title: p.title,
      excerpt: p.body ? p.body.slice(0, 240) : null,
      author: {
        id: (p.author_id as string) || "",
        name: a?.display_name || a?.username || "A member",
        avatar: a?.avatar_url ?? null,
        belt: beltForXp(xp).belt.key,
      },
      votes: likeCount.get(p.id) || 0,
      comments: commentCount.get(p.id) || 0,
      createdAt: p.created_at,
    };
  });

  // Rank by engagement (votes + comments), then recency.
  shaped.sort((a, b) => {
    const ea = a.votes + a.comments;
    const eb = b.votes + b.comments;
    if (eb !== ea) return eb - ea;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });

  return NextResponse.json({
    lead: shaped[0] ?? null,
    secondary: shaped.slice(1, 4),
  });
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key]);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}
