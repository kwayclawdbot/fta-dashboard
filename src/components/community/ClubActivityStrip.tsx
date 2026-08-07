"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Award, Eye, CheckCircle2, Target, Calendar, Trophy, Sparkles, ArrowRight, Heart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  activityLine, timeAgo, type ActivityPayload, type FeedAuthor,
} from "@/lib/feed";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { BoardSection } from "@/components/clubhome/board";
import PostInteractions from "@/components/clubhome/PostInteractions";
import { fetchXpForUsers } from "@/lib/belts";

/**
 * <ClubActivityStrip> — a compact "what's happening in the club" strip for the
 * dashboard Home (COMMUNITY-EXPERIENCE-STUDY §3, §4.3). Surfaces the latest few
 * feed items (human posts + activity cards) with a link into /community, so the
 * screen everyone lands on shows a live sliver of the community and pulls them in.
 *
 * SELF-CONTAINED: fetches its own data, renders nothing while empty/loading, and
 * is NOT wired into any page by this migration. Drop `<ClubActivityStrip />`
 * into the dashboard home to activate. Optional `limit` (default 4).
 *
 * BOARD LANGUAGE PASS. It was one `paper-card` — the previous version's default
 * container — wrapping a bold-14px heading and a stack of bare rows. Now it is
 * the board's shape: a `BoardSection` mark ("IN THE CLUB", tracked mono caps with
 * the trailing phrase in the accent) plus a plain "See all", and each item as its
 * own white board card, exactly like the board's YOUR SIGNALS rows. No outer box
 * — the cards ARE the object, and the section mark is the only chrome.
 *
 * TOKENS: the body line was `text-midnight-200`, a raw ramp that INVERTS between
 * themes, so on the dark board it painted near-white type where the card already
 * supplies contrast. It reads `text-soft` now, and the "See all" rides
 * --accent-solid rather than a hardcoded gold step, so it is mode-correct.
 *
 * INTERACTIVE (lane B). Member-written rows carry a like + reply line
 * (<PostInteractions>); activity cards do not — a badge award is the system
 * narrating, and there is nothing in it to reply to. Both verbs go through the
 * session client, so RLS is the wall (kid rows 214, teen door 216).
 *
 * STILL RENDERS NOTHING WHEN EMPTY. This is a *contextual sliver* of another
 * surface, not a section of its host: a stated "the club has been quiet" box
 * would be a claim the host page never asked to make. Absence here is silence,
 * and /community is one tap away in the nav either way.
 */

const ICONS: Record<string, React.ElementType> = {
  award: Award, eye: Eye, check: CheckCircle2, target: Target,
  calendar: Calendar, trophy: Trophy, sparkles: Sparkles, heart: Heart,
};

interface Row {
  id: string;
  kind: string;
  body: string;
  created_at: string;
  activity_payload: ActivityPayload | null;
  author: FeedAuthor | null;
}

export default function ClubActivityStrip({
  limit = 4,
  isKid = false,
}: {
  limit?: number;
  /** Kid register → read + react, never a composer (161 / 214). The strip's one
   *  routed call site already renders it for non-kids only; this is the guard
   *  for any future one. */
  isKid?: boolean;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [xpMap, setXpMap] = useState<Record<string, number>>({});
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("feed_posts")
        .select(
          "id, kind, body, created_at, activity_payload, author:profiles!feed_posts_author_id_fkey(id, display_name, role, age_group, family_id, avatar_url)"
        )
        .neq("kind", "anchor")
        // KID WALL (214): this strip is a sliver of the CLUB, so it never
        // carries a kid's card — not even their own household's. Kid progress
        // shows on the family surfaces. TEEN rows need no filter here: the
        // session client is RLS-scoped, so migration 216 hides them from a
        // club-door viewer and shows them to a family-door one, server-side.
        .neq("author_register", "kid")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!mounted) return;
      const norm: Row[] = (data ?? []).map((r) => {
        const raw = r as unknown as Row & { author: FeedAuthor | FeedAuthor[] | null };
        return { ...raw, author: Array.isArray(raw.author) ? raw.author[0] ?? null : raw.author };
      });
      setRows(norm);
      setReady(true);
      // Batched belt XP for the strip's avatars (one RPC).
      fetchXpForUsers(supabase, norm.map((r) => r.author?.id)).then((m) => mounted && setXpMap(m));

      // ENGAGEMENT for the member-written rows only — an activity card is the
      // system narrating what someone did, not something they said, so it gets
      // no verbs. Two small keyed reads, both RLS-scoped.
      const postIds = norm.filter((r) => r.kind !== "activity").map((r) => r.id);
      if (postIds.length === 0) return;
      const [likeRes, commentRes, sessionRes] = await Promise.all([
        supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
        supabase
          .from("post_comments")
          .select("post_id")
          .in("post_id", postIds)
          .neq("author_register", "kid"),
        supabase.auth.getSession(),
      ]);
      if (!mounted) return;
      const me = sessionRes.data.session?.user?.id ?? null;
      const likeCounts: Record<string, number> = {};
      const mine = new Set<string>();
      for (const l of (likeRes.data ?? []) as { post_id: string; user_id: string }[]) {
        likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
        if (me && l.user_id === me) mine.add(l.post_id);
      }
      const replyCounts: Record<string, number> = {};
      for (const c of (commentRes.data ?? []) as { post_id: string }[]) {
        replyCounts[c.post_id] = (replyCounts[c.post_id] || 0) + 1;
      }
      setLikes(likeCounts);
      setLikedByMe(mine);
      setReplies(replyCounts);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, limit]);

  if (!ready || rows.length === 0) return null;

  return (
    <BoardSection
      id="club-activity-strip"
      label="In the"
      mark="club"
      action={
        <Link
          href="/community"
          className="f0-focus f0-press inline-flex shrink-0 items-center gap-1 rounded-md text-[11px] font-semibold text-accent"
        >
          See all
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      }
    >
      <div className="mt-2.5 flex flex-col gap-[7px]">
        {rows.map((r) => {
          if (r.kind === "activity" && r.activity_payload) {
            const line = activityLine(r.activity_payload);
            const Icon = ICONS[line.iconKey] || Sparkles;
            return (
              <Link
                key={r.id}
                href="/community"
                className="club-b-card f0-focus f0-press flex items-center gap-2.5 px-3 py-[10px]"
              >
                <span
                  className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] ${line.accent}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <p className="min-w-0 flex-1 truncate text-[12px] text-soft">
                  <span className="font-semibold text-ink">{line.subject}</span>{" "}
                  {line.verb} <span className="font-medium text-ink">{line.target}</span>
                </p>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-soft">
                  {timeAgo(r.created_at)}
                </span>
              </Link>
            );
          }
          // A member-written row: the card links on, and carries the two verbs
          // beneath it (like + reply, <PostInteractions>). Activity cards above
          // stay plain links — they are the system narrating, not a member
          // speaking, and there is nothing there to reply to.
          return (
            <div key={r.id} className="club-b-card px-3 py-[10px]">
              <Link
                href="/community"
                className="f0-focus f0-press -mx-1 flex items-center gap-2.5 rounded-lg px-1"
              >
                <Avatar
                  name={r.author?.display_name}
                  avatarUrl={r.author?.avatar_url}
                  role={r.author?.role}
                  xp={r.author?.id ? xpMap[r.author.id] : undefined}
                  size="sm"
                />
                <p className="min-w-0 flex-1 truncate text-[12px] text-soft">
                  <span className="font-semibold text-ink">
                    {r.author?.display_name || "Member"}
                  </span>{" "}
                  <AgeBadge
                    role={r.author?.role}
                    ageGroup={r.author?.age_group}
                    className="align-middle"
                  />{" "}
                  {r.body || "shared a photo"}
                </p>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-soft">
                  {timeAgo(r.created_at)}
                </span>
              </Link>
              <PostInteractions
                postId={r.id}
                likes={likes[r.id] ?? 0}
                liked={likedByMe.has(r.id)}
                comments={replies[r.id] ?? 0}
                isKid={isKid}
              />
            </div>
          );
        })}
      </div>
    </BoardSection>
  );
}
