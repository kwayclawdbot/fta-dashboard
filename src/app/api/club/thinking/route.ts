import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  company: string | null;
  title: string | null;
  excerpt: string | null;
  author: {
    id: string;
    name: string;
    avatar: string | null;
    belt: string;
    badge: string | null;
    verified: boolean;
  };
  votes: number;
  comments: number;
  saves: number;
  href: string;
  editorPick: boolean;
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
  const tickerSet = [
    ...new Set(
      posts.map((p) => (p.ticker_tags && p.ticker_tags.length ? String(p.ticker_tags[0]).toUpperCase() : null)).filter(Boolean)
    ),
  ] as string[];

  const [{ data: likes }, { data: comments }, { data: saves }, { data: authors }, { data: metrics }] =
    await Promise.all([
      admin.from("post_likes").select("post_id").in("post_id", ids),
      admin.from("post_comments").select("post_id").in("post_id", ids),
      // Saves = the 'saved' object reaction on a feed post (migration 150).
      admin
        .from("object_reactions")
        .select("target_id")
        .eq("target_type", "feed_post")
        .eq("reaction", "saved")
        .in("target_id", ids),
      admin.from("profiles").select("id, display_name, username, avatar_url, role").in("id", authorIds),
      tickerSet.length
        ? admin.from("screener_metrics").select("ticker, name").in("ticker", tickerSet)
        : Promise.resolve({ data: [] as { ticker: string; name: string | null }[] }),
    ]);

  const likeCount = countBy(likes || [], "post_id");
  const commentCount = countBy(comments || [], "post_id");
  const saveCount = countBy(saves || [], "target_id");
  const authorMap = new Map((authors || []).map((a) => [a.id, a]));
  const companyByTicker = new Map((metrics || []).map((m) => [m.ticker.toUpperCase(), m.name]));

  // Belts need lifetime XP per author — one grouped read instead of a per-author
  // scan of xp_events (was N round trips). Identical totals; sums client-side.
  const xpByAuthor = new Map<string, number>();
  if (authorIds.length) {
    const { data: xpRows } = await admin
      .from("xp_events")
      .select("user_id, amount")
      .in("user_id", authorIds);
    for (const r of (xpRows || []) as { user_id: string; amount: number }[]) {
      xpByAuthor.set(r.user_id, (xpByAuthor.get(r.user_id) || 0) + (r.amount || 0));
    }
  }

  const shaped: Post[] = posts.map((p) => {
    const a = authorMap.get(p.author_id as string);
    const xp = xpByAuthor.get(p.author_id as string) || 0;
    const belt = beltForXp(xp).belt;
    const ticker = p.ticker_tags && p.ticker_tags.length ? String(p.ticker_tags[0]) : null;
    const role = (a?.role as string | null) || null;
    return {
      id: p.id,
      ticker,
      // UI contract (§7 ThinkingPost): company name for the ticker logo/byline.
      company: ticker ? companyByTicker.get(ticker.toUpperCase()) ?? null : null,
      title: p.title,
      excerpt: p.body ? p.body.slice(0, 240) : null,
      author: {
        id: (p.author_id as string) || "",
        name: a?.display_name || a?.username || "A member",
        avatar: a?.avatar_url ?? null,
        belt: belt.key,
        // Credibility tag from the earned belt (White = no badge). verified =
        // staff (coach/admin) — a real authority marker, never fabricated.
        badge: belt.order > 0 ? `${belt.name} Belt` : null,
        verified: role === "admin" || role === "coach",
      },
      votes: likeCount.get(p.id) || 0,
      comments: commentCount.get(p.id) || 0,
      saves: saveCount.get(p.id) || 0,
      // Real, working link — the ticker's research page (with the community tab),
      // or the feed when the post carries no ticker.
      href: ticker ? `/research/${encodeURIComponent(ticker)}` : "/community",
      editorPick: false,
      createdAt: p.created_at,
    };
  });

  // Rank by engagement (votes + comments + saves), then recency.
  shaped.sort((a, b) => {
    const ea = a.votes + a.comments + a.saves;
    const eb = b.votes + b.comments + b.saves;
    if (eb !== ea) return eb - ea;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });

  // The editorial lead earns the "Editor's Pick" flag once it clears a real
  // engagement bar (never on an empty room).
  const lead = shaped[0] ?? null;
  if (lead && lead.votes + lead.comments + lead.saves >= 3) lead.editorPick = true;

  return NextResponse.json({
    lead,
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
