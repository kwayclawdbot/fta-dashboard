import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { beltForXp } from "@/lib/belts";
import { resolveClubCtx, type ClubCtx, type CoreResult } from "@/lib/club/home-context";

/**
 * GET /api/club/thinking → { lead: Post|null, secondary: Post[] }
 *
 * "Today's Best Thinking" — the community feed's member posts ranked by real
 * engagement (likes + comments). The top post is the editorial lead; the next
 * few are the ruled secondary list. Author credibility = their earned belt
 * (from lifetime XP). All counts are real; nothing fabricated.
 *
 * The body is `thinkingCore(ctx)` — shared verbatim with GET /api/club/home.
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
  /** Has THIS viewer liked it — so the card can render its own state (lane B). */
  likedByMe: boolean;
  comments: number;
  saves: number;
  href: string;
  editorPick: boolean;
  createdAt: string;
}

export async function thinkingCore(ctx: ClubCtx): Promise<CoreResult> {
  const admin = ctx.admin();

  // Member-authored posts (exclude auto 'activity' cards and 'anchor').
  //
  // THE READ WALL, RESTATED AS A FILTER. This runs on the SERVICE-ROLE client,
  // which bypasses RLS, so neither the kid wall (214) nor the teen door wall
  // (216) can reach it — the band has to be an explicit query filter:
  //   • kid rows  → never here (family-only, and this is a club surface);
  //   • teen rows → only for a viewer on the FAMILY door;
  //   • adult rows → always.
  // `author_register` is NOT NULL as of 214 (every historical row backfilled),
  // so the .in() is null-safe and needs no companion .neq.
  const door = await ctx.getDoor();
  const bands = door === "family" ? ["adult", "teen"] : ["adult"];

  const { data: posts } = await admin
    .from("feed_posts")
    .select("id, author_id, title, body, ticker_tags, created_at")
    .eq("kind", "post")
    .in("author_register", bands)
    .order("created_at", { ascending: false })
    .limit(40);

  if (!posts || posts.length === 0) {
    return { body: { lead: null, secondary: [] } };
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
      // `user_id` comes back too, so "did I like this" is answered by the read
      // that was already being paid for — no second query, and no client-side
      // fetch of the viewer's likes (lane B: the card ships its own state).
      admin.from("post_likes").select("post_id, user_id").in("post_id", ids),
      // Replies are counted through the SAME band as the posts above: a kid's
      // reply is family-only (214) and a teen's is family-door-only (216), so
      // neither moves a count on a surface that cannot show the reply.
      admin.from("post_comments").select("post_id").in("post_id", ids).in("author_register", bands),
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

  const likeRows = (likes || []) as { post_id: string; user_id: string }[];
  const likeCount = countBy(likeRows, "post_id");
  const likedByMe = new Set(
    likeRows.filter((l) => l.user_id === ctx.user.id).map((l) => l.post_id)
  );
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
      likedByMe: likedByMe.has(p.id),
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

  return { body: { lead, secondary: shaped.slice(1, 4) } };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status, body } = await thinkingCore(ctx);
  return NextResponse.json(body, status ? { status } : undefined);
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key]);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}
