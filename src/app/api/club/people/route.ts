import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_TTL_SECONDS } from "@/lib/club/club-cache";
import { isMemberVisibleOnDoor } from "@/lib/register";
import type { ExperienceKey } from "@/lib/experience/registry";
import { resolveClubCtx, type ClubCtx, type CoreResult } from "@/lib/club/home-context";

/**
 * GET /api/club/people → { members: [{id, name, avatar, tags, reason}] }
 *
 * "People worth following" — v1 DISCOVERY only (no follow graph, no follower
 * counts that would be fake at our N). Surfaces genuinely useful members by real
 * contribution: posts authored, ticker comments, and likes their work earned.
 * Kid-walled (same wall as the screener). Excludes the viewer, kids, and — for a
 * club-door viewer — teens (216): the club door lists adults only. Tags +
 * reason are derived from what each member actually does — nothing invented.
 *
 * The body is `peopleCore(ctx)` — shared verbatim with GET /api/club/home.
 */
export const runtime = "nodejs";

/** How many ranked members the cached roster keeps. The response shows six, but
 *  the VIEWER is excluded from their own list, so the cache has to hold a margin
 *  wide enough that removing one name still leaves six — otherwise the member
 *  ranked #1 would see a five-name list. Any margin ≥ 7 is exact; 12 is cheap. */
const ROSTER_DEPTH = 12;
/** What the response actually shows. */
const ROSTER_SHOWN = 6;

/**
 * "PEOPLE WORTH FOLLOWING", RANKED ONCE PER MINUTE PER DOOR.
 *
 * The ranking is a pure function of the room: who posted, who commented, and
 * what those posts earned. It is keyed by DOOR (which posts count toward a
 * member's score is door-walled) and by nothing else — so it was recomputing an
 * identical leaderboard, over four unbounded reads, on every pageview.
 *
 * The ONE viewer-dependent step — "not the viewer" — is applied by the caller
 * AFTER the cached roster comes back, over a list deep enough (ROSTER_DEPTH)
 * that excluding one name can never shorten the result. Same six names, same
 * order, as the uncached version returned.
 *
 * SAFE TO SHARE ONE ENTRY PER DOOR: every read here already ran on the
 * SERVICE-ROLE client, and the door wall (isMemberVisibleOnDoor + the
 * author_register band filter) is what scopes it — not RLS. Because the door is
 * the cache key, a club-door viewer can never be handed a family-door roster.
 */
const getCachedRoster = unstable_cache(
  async (door: ExperienceKey) => {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, username, avatar_url, role, age_group, track")
      .limit(200);

    // Candidate pool: visible on the viewer's door — kids are never listed (214)
    // and teens are listed to the family door only (216). A club-door viewer gets
    // an adults-only directory: the wall is about the PERSON here, not only about
    // what they wrote. (The "not the viewer" filter is the caller's — see above.)
    const candidates = (profiles || []).filter((p) => isMemberVisibleOnDoor(p, door));
    if (candidates.length === 0) return [];

    const candidateIds = candidates.map((p) => p.id);

    // Contribution is counted through the viewer's own read wall: a post this
    // viewer could not open must not lift its author up a club ranking. Kid rows
    // are family-only (214), teen rows family-door-only (216); this is the
    // service-role client, so the band is a filter, not RLS.
    const bands = door === "family" ? ["adult", "teen"] : ["adult"];

    const [{ data: posts }, { data: comments }] = await Promise.all([
      admin
        .from("feed_posts")
        .select("id, author_id, ticker_tags")
        .eq("kind", "post")
        .in("author_register", bands)
        .in("author_id", candidateIds),
      admin.from("community_ticker_comments").select("user_id").in("user_id", candidateIds),
    ]);

    const postIds = (posts || []).map((p) => p.id);
    const { data: likes } = postIds.length
      ? await admin.from("post_likes").select("post_id").in("post_id", postIds)
      : { data: [] as { post_id: string }[] };

    // Aggregate per member.
    const postsBy = new Map<string, number>();
    const tickersBy = new Map<string, Map<string, number>>();
    const postToAuthor = new Map<string, string>();
    for (const p of posts || []) {
      const a = p.author_id as string;
      postsBy.set(a, (postsBy.get(a) || 0) + 1);
      postToAuthor.set(p.id, a);
      if (p.ticker_tags) {
        const m = tickersBy.get(a) || new Map<string, number>();
        for (const t of p.ticker_tags as string[]) m.set(t.toUpperCase(), (m.get(t.toUpperCase()) || 0) + 1);
        tickersBy.set(a, m);
      }
    }
    const commentsBy = new Map<string, number>();
    for (const c of comments || []) commentsBy.set(c.user_id, (commentsBy.get(c.user_id) || 0) + 1);
    const likesBy = new Map<string, number>();
    for (const l of likes || []) {
      const a = postToAuthor.get(l.post_id);
      if (a) likesBy.set(a, (likesBy.get(a) || 0) + 1);
    }

    const scored = candidates
      .map((p) => {
        const nPosts = postsBy.get(p.id) || 0;
        const nComments = commentsBy.get(p.id) || 0;
        const nLikes = likesBy.get(p.id) || 0;
        const contribution = nPosts * 3 + nComments * 2 + nLikes;
        const topTickers = [...(tickersBy.get(p.id) || new Map())]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([t]) => t);
        const tags: string[] = [];
        if (nPosts >= 2) tags.push("Researcher");
        if (nLikes >= 2) tags.push("Helpful");
        for (const t of topTickers) tags.push(t);
        if (tags.length === 0) tags.push("Member");

        const reason =
          nPosts > 0
            ? `Shared ${nPosts} research ${nPosts === 1 ? "post" : "posts"}${topTickers.length ? ` on ${topTickers.join(", ")}` : ""}.`
            : nComments > 0
            ? `Active in ticker discussions.`
            : "New to the Club.";

        return {
          id: p.id,
          name: p.display_name || p.username || "A member",
          avatar: p.avatar_url ?? null,
          // UI contract (§10 PeopleMember.href): a real profile link when the
          // member has a public username (saves the client id→handle round-trip).
          href: p.username ? `/u/${encodeURIComponent(p.username)}` : null,
          tags: tags.slice(0, 3),
          reason,
          contribution,
        };
      })
      .filter((m) => m.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, ROSTER_DEPTH)
      // Strip the internal score — no counts leak to the client.
      .map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, href: m.href, tags: m.tags, reason: m.reason }));

    return scored;
  },
  ["club:people-roster"],
  { revalidate: CLUB_TTL_SECONDS, tags: ["club-people"] }
);

export async function peopleCore(ctx: ClubCtx): Promise<CoreResult> {
  if ((await ctx.getRegister()) === "kid") {
    return { body: { kidWalled: true, members: [] } };
  }

  // ONE door resolution (memoised on the ctx, so a batched home render pays for
  // it once across every core that asks).
  const roster = await getCachedRoster(await ctx.getDoor());

  // The only viewer-dependent step: nobody is "worth following" to themselves.
  const members = roster.filter((m) => m.id !== ctx.user.id).slice(0, ROSTER_SHOWN);

  return { body: { kidWalled: false, members } };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status, body } = await peopleCore(ctx);
  return NextResponse.json(body, status ? { status } : undefined);
}
