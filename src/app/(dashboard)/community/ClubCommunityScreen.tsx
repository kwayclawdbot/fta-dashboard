"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Heart, MessageCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MentionProvider, RichBody } from "@/lib/mentions";
import { checkClean } from "@/lib/profanity";
import { deriveRegister } from "@/lib/register";
import { isSharedFeedReadOnly } from "@/lib/social/kid-posting";
import { beltForXp } from "@/lib/belts";
import { timeAgo, type FeedAuthor, type FeedPost, type PostComment, type PostPosition } from "@/lib/feed";
import type { CommunityFeedSeed } from "@/lib/feed-seed";
import { timeLeft, type CircleListRow } from "@/lib/circles";
import Avatar from "@/components/Avatar";
import ProfileLink from "@/components/ProfileLink";
import { ClubMark } from "@/components/brand/ClubMark";
import { TickerMark } from "./board";
import { Cashtag, FoundingNote } from "./parts";

/**
 * CLUB COMMUNITY — the owner's Aug-7 mockup board (club terminal phone,
 * "COMMUNITY" screen), built to the drawing:
 *
 *   · a ROW OF NEON-RING CIRCLES up top, first thing under the masthead
 *     (segmented multicolour rings, dark company face inside, "NVDA / 8d
 *     left" beneath) — these are the REAL Circles (club_circles, migration
 *     190): title, ticker mark and the live countdown, each ring linking
 *     into its /circles/[slug] room. CIRCLES ONLY — when no Circle is open
 *     the row renders nothing at all (owner ruling 2026-08-10; no member-face
 *     fallback, never an invented countdown).
 *   · the FOR YOU · FOLLOWING · TRENDING tab row with the accent underline.
 *   · POST CARDS in the mockup's anatomy: avatar with a stance dot, author +
 *     authority check, standing line ("Black belt · 2h" — the app's REAL
 *     credibility read; the mockup's "Top 1% Member" is a performance claim
 *     this product deliberately does not print), the body, a real price chart
 *     for the post's tagged ticker, and the interaction row.
 *
 * PALETTE — semantic tokens only. The club-dark terminal paints these tokens
 * dark (bg-paper is the near-black page, bg-card the #0D0F12-family card,
 * border-sand the lifted hairline, gold-700 the volt-orange accent); the
 * mockup's neon purple is rendered through the club accent + teal/kai token
 * ramps, never raw hex. Price marks use --price-up/--price-down (price only);
 * the stance dot uses the sentiment channel (lime / ink / sand), per the
 * colour law.
 *
 * DATA — everything is the real feed: feed_posts (kid-authored rows already
 * excluded by the seed AND by RLS — the kid wall stands), post_likes,
 * post_comments (kid replies never render, migration 214), belts from batched
 * XP, @mentions resolved. Likes and replies WRITE through the exact same
 * tables and guards as the shared CommunityClient (optimistic like with
 * revert, profanity check + kid/free guard on reply).
 *
 * TABS map to real signals, not invented graphs:
 *   For You   — the seeded feed order (pinned first, then newest).
 *   Following — posts by authors whose calls you have liked (there is no
 *               follow graph in the schema; a like IS the follow signal we
 *               actually have — stated adaptation).
 *   Trending  — ranked by real engagement (likes + replies), ties to recency.
 */

/* ── local shapes ─────────────────────────────────────────────────────────── */

interface Props {
  seed: CommunityFeedSeed | null;
  circles: CircleListRow[];
}

const COMMENT_AUTHOR_SEL =
  "author:profiles!post_comments_author_id_fkey(id, display_name, role, age_group, family_id, avatar_url, username)";

function normAuthor(a: FeedAuthor | FeedAuthor[] | null): FeedAuthor | null {
  return Array.isArray(a) ? (a[0] ?? null) : a;
}

/* ── circle ring ──────────────────────────────────────────────────────────── */
/**
 * The mockup's segmented neon annulus. Built entirely from token ramps
 * (volt / teal / kai / gold) with transparent gaps so it reads as the drawn
 * segments; each ring starts its sweep at a different angle so the row
 * shimmers instead of repeating.
 */
export function ringGradient(i: number): string {
  const from = 210 + i * 47;
  return [
    `conic-gradient(from ${from}deg`,
    `var(--color-volt-500) 0deg 64deg`,
    `transparent 64deg 74deg`,
    `var(--color-teal-400) 74deg 148deg`,
    `transparent 148deg 158deg`,
    `var(--color-kai-400) 158deg 226deg`,
    `transparent 226deg 236deg`,
    `var(--color-gold-500) 236deg 306deg`,
    `transparent 306deg 316deg`,
    `var(--color-teal-500) 316deg 352deg`,
    `transparent 352deg 360deg)`,
  ].join(", ");
}

export function CircleRing({
  index,
  title,
  sub,
  href,
  face,
}: {
  index: number;
  title: string;
  sub: string | null;
  href: string;
  face: React.ReactNode;
}) {
  return (
    <Link href={href} className="f0-focus w-[72px] shrink-0 text-center">
      <span
        className="mx-auto grid h-[64px] w-[64px] place-items-center rounded-full"
        style={{ background: ringGradient(index) }}
      >
        <span className="grid h-[56px] w-[56px] place-items-center rounded-full bg-paper">
          <span className="grid h-[48px] w-[48px] place-items-center overflow-hidden rounded-full bg-card">
            {face}
          </span>
        </span>
      </span>
      <span className="mt-1.5 block truncate font-display text-[12px] font-bold text-ink">
        {title}
      </span>
      {sub && (
        <span className="block truncate font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] text-soft">
          {sub}
        </span>
      )}
    </Link>
  );
}

/* ── post price chart ─────────────────────────────────────────────────────── */

interface OhlcBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const m = d.getMinutes();
  return m === 0 ? `${h}${ampm}` : `${h}:${String(m).padStart(2, "0")}${ampm}`;
}

/**
 * The mockup's in-card candlestick panel — REAL bars only, from the app's own
 * cached market proxy (/api/market/bars?tf=15m; delayed data, key stays on the
 * server). Lazy: fetched when the card scrolls into view. No bars → no panel;
 * a chart is never faked.
 */
function PostChart({ symbol }: { symbol: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [bars, setBars] = useState<OhlcBar[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "160px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/api/market/bars?symbol=${encodeURIComponent(symbol)}&tf=15m`,
          { signal: ctrl.signal }
        );
        if (!res.ok) throw new Error("bars");
        const j = (await res.json()) as { bars?: OhlcBar[] };
        const rows = (j.bars ?? []).filter(
          (b) => Number.isFinite(b.o) && Number.isFinite(b.c)
        );
        if (rows.length >= 8) setBars(rows.slice(-48));
        else setFailed(true);
      } catch {
        setFailed(true);
      }
    })();
    return () => ctrl.abort();
  }, [visible, symbol]);

  if (failed) return <div ref={hostRef} />;

  const W = 480;
  const H = 132;
  const PAD_R = 40; // price rail
  const PAD_B = 16; // clock rail

  let body: React.ReactNode = null;
  if (bars) {
    const lo = Math.min(...bars.map((b) => b.l));
    const hi = Math.max(...bars.map((b) => b.h));
    const span = hi - lo || 1;
    const iw = W - PAD_R;
    const ih = H - PAD_B;
    const step = iw / bars.length;
    const cw = Math.max(2, step * 0.55);
    const y = (v: number) => ih - ((v - lo) / span) * (ih - 8) - 4;
    const tickIdx = [
      0,
      Math.floor(bars.length / 3),
      Math.floor((bars.length * 2) / 3),
      bars.length - 1,
    ];
    body = (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${symbol} recent price bars`}
      >
        {bars.map((b, i) => {
          const up = b.c >= b.o;
          const color = up ? "var(--price-up)" : "var(--price-down)";
          const x = i * step + step / 2;
          const top = y(Math.max(b.o, b.c));
          const bot = y(Math.min(b.o, b.c));
          return (
            <g key={b.t}>
              <line x1={x} x2={x} y1={y(b.h)} y2={y(b.l)} stroke={color} strokeWidth="1" />
              <rect
                x={x - cw / 2}
                y={top}
                width={cw}
                height={Math.max(1, bot - top)}
                fill={color}
              />
            </g>
          );
        })}
        {[hi, (hi + lo) / 2, lo].map((v) => (
          <text
            key={v}
            x={W - PAD_R + 6}
            y={y(v) + 3}
            fontSize="9"
            className="fill-soft font-mono"
          >
            {v >= 100 ? Math.round(v) : v.toFixed(1)}
          </text>
        ))}
        {tickIdx.map((idx, i) => (
          <text
            key={`t${bars[idx].t}-${i}`}
            x={Math.min(idx * step + step / 2, iw - 2)}
            y={H - 4}
            fontSize="9"
            textAnchor={i === 0 ? "start" : i === tickIdx.length - 1 ? "end" : "middle"}
            className="fill-soft font-mono"
          >
            {fmtClock(bars[idx].t)}
          </text>
        ))}
      </svg>
    );
  } else {
    body = <div className="h-[100px] animate-pulse rounded-[8px] bg-sand/40" />;
  }

  return (
    <div ref={hostRef} className="mt-3 overflow-hidden rounded-[12px] border border-sand bg-card p-2.5">
      {body}
    </div>
  );
}

/* ── stance dot on the avatar ─────────────────────────────────────────────── */
/**
 * The mockup pins a small badge to the avatar's corner. Ours carries the
 * author's declared stance in the SENTIMENT channel (lime = bull, ink = bear,
 * sand = neutral) — never the price greens/reds, per the colour law.
 */
const STANCE_DOT: Record<PostPosition, { cls: string; label: string }> = {
  bull: { cls: "bg-lime-500 dark:bg-lime-400", label: "Bullish" },
  bear: { cls: "bg-ink/60", label: "Bearish" },
  neutral: { cls: "bg-sand", label: "Neutral" },
};

/* ── the screen ───────────────────────────────────────────────────────────── */

type FeedTab = "foryou" | "following" | "trending";

const TABS: { id: FeedTab; label: string }[] = [
  { id: "foryou", label: "For You" },
  { id: "following", label: "Following" },
  { id: "trending", label: "Trending" },
];

export default function ClubCommunityScreen({ seed, circles }: Props) {
  const supabase = createClient();

  const me = seed?.me ?? null;
  const readOnly = (seed?.myTier ?? "fic") === "free";
  const kidWalled = isSharedFeedReadOnly(me ? deriveRegister(me) : "adult");

  const posts = useMemo(
    () =>
      (seed?.posts ?? []).filter(
        (p) => p.kind === "post" || p.kind === "announcement"
      ),
    [seed]
  );

  const [tab, setTab] = useState<FeedTab>("foryou");
  const [likeCount, setLikeCount] = useState<Record<string, number>>(
    seed?.likeCount ?? {}
  );
  const [likedByMe, setLikedByMe] = useState<Set<string>>(
    () => new Set(seed?.likedByMe ?? [])
  );
  const [commentCount, setCommentCount] = useState<Record<string, number>>(
    seed?.commentCount ?? {}
  );
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});

  /* ── likes (same tables + optimistic revert as the shared feed) ── */
  async function toggleLike(postId: string) {
    if (!me || readOnly) return;
    const liked = likedByMe.has(postId);
    setLikedByMe((prev) => {
      const n = new Set(prev);
      if (liked) n.delete(postId);
      else n.add(postId);
      return n;
    });
    setLikeCount((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] || 0) + (liked ? -1 : 1)),
    }));
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me.id);
    } else {
      const { error } = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: me.id });
      if (error) {
        setLikedByMe((prev) => {
          const n = new Set(prev);
          n.delete(postId);
          return n;
        });
        setLikeCount((prev) => ({
          ...prev,
          [postId]: Math.max(0, (prev[postId] || 1) - 1),
        }));
      }
    }
  }

  /* ── replies (kid wall kept: kid-authored replies never load) ── */
  async function toggleComments(postId: string) {
    const willOpen = !openComments[postId];
    setOpenComments((prev) => ({ ...prev, [postId]: willOpen }));
    if (willOpen && !commentsByPost[postId]) {
      const { data } = await supabase
        .from("post_comments")
        .select(`id, post_id, author_id, body, created_at, ${COMMENT_AUTHOR_SEL}`)
        .eq("post_id", postId)
        .neq("author_register", "kid")
        .order("created_at", { ascending: true });
      const norm: PostComment[] = (data ?? []).map((r) => {
        const raw = r as unknown as PostComment & {
          author: FeedAuthor | FeedAuthor[] | null;
        };
        return { ...raw, author: normAuthor(raw.author) };
      });
      setCommentsByPost((prev) => ({ ...prev, [postId]: norm }));
    }
  }

  async function addComment(postId: string, body: string): Promise<boolean> {
    if (!me || readOnly || kidWalled) return false;
    if (!checkClean(body).ok) return false;
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, author_id: me.id, body })
      .select("id, post_id, author_id, body, created_at")
      .single();
    if (error || !data) return false;
    const comment: PostComment = {
      ...(data as unknown as PostComment),
      author: {
        id: me.id,
        display_name: me.display_name,
        role: me.role,
        age_group: me.age_group,
        family_id: me.family_id,
        avatar_url: me.avatar_url,
        username: me.username,
      },
    };
    setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), comment] }));
    setCommentCount((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    return true;
  }

  /* ── the three tabs, from real signals ── */
  const followedAuthors = useMemo(() => {
    const ids = new Set<string>();
    for (const p of posts) {
      if (likedByMe.has(p.id) && p.author?.id && p.author.id !== me?.id) {
        ids.add(p.author.id);
      }
    }
    return ids;
  }, [posts, likedByMe, me?.id]);

  const shown = useMemo(() => {
    if (tab === "following") {
      return posts.filter((p) => p.author?.id && followedAuthors.has(p.author.id));
    }
    if (tab === "trending") {
      return [...posts].sort((a, b) => {
        const ea = (likeCount[a.id] || 0) + (commentCount[a.id] || 0);
        const eb = (likeCount[b.id] || 0) + (commentCount[b.id] || 0);
        if (eb !== ea) return eb - ea;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return posts; // For You — the seeded order (pinned, then newest).
  }, [tab, posts, followedAuthors, likeCount, commentCount]);

  return (
    <MentionProvider map={seed?.mentions ?? {}}>
      <div className="mx-auto max-w-2xl">
        {/* ── masthead: brand mark left, COMMUNITY centred (the drawn header) ── */}
        <header className="relative flex h-9 items-center">
          <ClubMark solid size={18} className="text-gold-700" title="Cheat Code Club" />
          <h1 className="absolute left-1/2 -translate-x-1/2 font-display text-[15px] font-black uppercase tracking-[0.24em] text-ink">
            Community
          </h1>
        </header>

        {/* ── the neon ring row — the screen's drawn structure holds even at
               zero: expired clocks collapse the rings to ONE honest dashed
               "Start a Circle" affordance, never an absent row (owner
               correction 2026-08-10: the page read as gutted when every
               Circle ran out its 30 days) ── */}
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="-mx-1 flex flex-1 gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {circles.length === 0 && (
              <Link href="/circles" className="f0-focus w-[72px] shrink-0 text-center">
                <span
                  aria-hidden
                  className="mx-auto grid h-[64px] w-[64px] place-items-center rounded-full border-2 border-dashed border-sand"
                >
                  <span className="grid h-[48px] w-[48px] place-items-center rounded-full bg-card font-display text-[22px] font-black leading-none text-gold-700">
                    +
                  </span>
                </span>
                <span className="mt-1.5 block truncate font-display text-[12px] font-bold text-ink">
                  Start one
                </span>
                <span className="block truncate font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] text-soft">
                  No Circle open
                </span>
              </Link>
            )}
            {circles.map((c, i) => {
                const left = timeLeft(c.expires_at);
                return (
                  <CircleRing
                    key={c.id}
                    index={i}
                    title={c.ticker ?? c.title}
                    sub={left ? `${left} left` : "closing"}
                    href={`/circles/${c.slug}`}
                    face={
                      c.ticker ? (
                        <TickerMark ticker={c.ticker} size={40} radius={20} />
                      ) : (
                        <span className="font-display text-[15px] font-black uppercase text-ink">
                          {c.title.slice(0, 1)}
                        </span>
                      )
                    }
                  />
                );
              })}
            </div>
            <Link
              href="/circles"
              className="f0-focus mt-5 shrink-0 font-display text-[11px] font-bold uppercase tracking-[0.08em] text-gold-700 hover:text-gold-600"
            >
              Circles
            </Link>
          </div>

        {/* ── For You · Following · Trending ── */}
        <div role="tablist" aria-label="Community feed" className="mt-4 flex gap-7 border-b border-sand">
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.id)}
                className={`f0-focus relative pb-2.5 font-display text-[14.5px] transition-colors ${
                  on ? "font-bold text-ink" : "font-semibold text-soft hover:text-ink"
                }`}
              >
                {t.label}
                {on && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-volt-500"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── the feed ── */}
        {shown.length === 0 ? (
          <FoundingNote
            eyebrow={tab === "following" ? "Following" : tab === "trending" ? "Trending" : "The feed"}
            headline={
              tab === "following"
                ? "Like a call to follow its author."
                : tab === "trending"
                  ? "Nothing is trending yet."
                  : "The first call opens the board."
            }
            body={
              tab === "following"
                ? "Your Following feed is built from the authors whose calls you've liked."
                : "Posts land here the moment a member makes a call."
            }
          />
        ) : (
          <div className="divide-y divide-sand/70">
            {shown.map((p) => (
              <ClubPost
                key={p.id}
                post={p}
                beltXp={seed?.beltXp ?? {}}
                likes={likeCount[p.id] || 0}
                liked={likedByMe.has(p.id)}
                replies={commentCount[p.id] || 0}
                canWrite={!readOnly && !kidWalled && !!me}
                onLike={() => toggleLike(p.id)}
                onToggleReplies={() => toggleComments(p.id)}
                repliesOpen={!!openComments[p.id]}
                comments={commentsByPost[p.id]}
                onReply={(body) => addComment(p.id, body)}
                me={me}
              />
            ))}
          </div>
        )}

        {readOnly && (
          <p className="mt-6 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-soft">
            Reading the room ·{" "}
            <Link href="/upgrade" className="f0-focus font-bold text-gold-700">
              join the Club to post
            </Link>
          </p>
        )}
      </div>
    </MentionProvider>
  );
}

/* ── one post, in the mockup's anatomy ────────────────────────────────────── */

function ClubPost({
  post,
  beltXp,
  likes,
  liked,
  replies,
  canWrite,
  onLike,
  onToggleReplies,
  repliesOpen,
  comments,
  onReply,
  me,
}: {
  post: FeedPost;
  beltXp: Record<string, number>;
  likes: number;
  liked: boolean;
  replies: number;
  canWrite: boolean;
  onLike: () => void;
  onToggleReplies: () => void;
  repliesOpen: boolean;
  comments: PostComment[] | undefined;
  onReply: (body: string) => Promise<boolean>;
  me: CommunityFeedSeed["me"];
}) {
  const author = post.author;
  const username = author?.username ?? null;
  const authority = author?.role === "coach" || author?.role === "admin";
  const xp = author?.id ? beltXp[author.id] : undefined;
  const standing = authority
    ? (author?.role ?? "").toUpperCase()
    : xp && xp > 0
      ? `${beltForXp(xp).short} belt`
      : "Member";
  const stance = post.position ? STANCE_DOT[post.position] : null;
  const ticker = post.ticker_tags?.[0] ?? null;

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await onReply(body);
    if (ok) setDraft("");
    setSending(false);
  }

  return (
    <article className="py-4">
      <div className="flex items-start gap-3">
        {/* avatar + stance dot (the mockup's corner badge) */}
        <div className="relative shrink-0">
          <ProfileLink username={username} variant="avatar">
            <Avatar name={author?.display_name} avatarUrl={author?.avatar_url} size="lg" />
          </ProfileLink>
          {stance && (
            <span
              title={stance.label}
              aria-label={stance.label}
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-paper ${stance.cls}`}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* author · authority check · standing · clock */}
          <div className="flex items-center gap-1.5">
            <ProfileLink username={username}>
              <span className="truncate font-display text-[14.5px] font-bold text-ink">
                {author?.display_name || "Member"}
              </span>
            </ProfileLink>
            {authority && (
              <BadgeCheck
                className="h-4 w-4 shrink-0 text-gold-700"
                aria-label="Club staff"
              />
            )}
            {post.kind === "announcement" && (
              <span className="rounded-[4px] bg-volt-500/12 px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold uppercase tracking-[0.12em] text-gold-700">
                Announcement
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-soft">
            {standing} · {timeAgo(post.created_at)}
          </p>

          {/* the call */}
          {post.title && (
            <p className="mt-2 font-display text-[15px] font-bold text-ink">{post.title}</p>
          )}
          {post.body && (
            <RichBody
              body={post.body}
              className="mt-2 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-ink"
            />
          )}

          {/* the real chart for the tagged name */}
          {ticker && <PostChart symbol={ticker} />}

          {/* member media */}
          {post.attachment_url && post.attachment_type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.attachment_url}
              alt="Shared image"
              loading="lazy"
              className="mt-3 max-h-[340px] w-auto max-w-full rounded-[12px] border border-sand"
            />
          )}
          {post.attachment_url && post.attachment_type === "video" && (
            <video
              src={post.attachment_url}
              controls
              preload="metadata"
              playsInline
              className="mt-3 max-h-[340px] w-auto max-w-full rounded-[12px] border border-sand bg-night-950"
            />
          )}

          {/* the interaction row — real counts only */}
          <div className="mt-3 flex items-center gap-7">
            <button
              type="button"
              onClick={onLike}
              disabled={!canWrite}
              aria-pressed={liked}
              aria-label={liked ? "Unlike" : "Like"}
              className={`f0-focus flex items-center gap-1.5 transition-colors ${
                liked ? "text-gold-700" : "text-soft hover:text-ink"
              } ${canWrite ? "" : "cursor-default opacity-60"}`}
            >
              <Heart className={`h-[17px] w-[17px] ${liked ? "fill-current" : ""}`} />
              {likes > 0 && (
                <span className="font-mono text-[12px] tabular-nums">{likes}</span>
              )}
            </button>
            <button
              type="button"
              onClick={onToggleReplies}
              aria-expanded={repliesOpen}
              aria-label="Replies"
              className={`f0-focus flex items-center gap-1.5 transition-colors ${
                repliesOpen ? "text-ink" : "text-soft hover:text-ink"
              }`}
            >
              <MessageCircle className="h-[17px] w-[17px]" />
              {replies > 0 && (
                <span className="font-mono text-[12px] tabular-nums">{replies}</span>
              )}
            </button>
            {ticker && (
              <Link
                href={`/research/${ticker}`}
                className="f0-focus group/tag ml-auto"
                aria-label={`Research ${ticker}`}
              >
                <Cashtag ticker={ticker} size="sm" />
              </Link>
            )}
          </div>

          {/* inline replies */}
          {repliesOpen && (
            <div className="mt-3 space-y-3 border-l-2 border-sand/70 pl-3">
              {comments === undefined ? (
                <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-soft">
                  Loading replies…
                </p>
              ) : comments.length === 0 ? (
                <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-soft">
                  No replies yet
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <Avatar
                      name={c.author?.display_name}
                      avatarUrl={c.author?.avatar_url}
                      size="xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px]">
                        <span className="font-display font-bold text-ink">
                          {c.author?.display_name || "Member"}
                        </span>{" "}
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-soft">
                          {timeAgo(c.created_at)}
                        </span>
                      </p>
                      <RichBody
                        body={c.body}
                        className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink"
                      />
                    </div>
                  </div>
                ))
              )}
              {canWrite && me && (
                <div className="flex items-center gap-2">
                  <Avatar name={me.display_name} avatarUrl={me.avatar_url} size="xs" />
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void submit();
                    }}
                    placeholder="Add your read…"
                    className="min-w-0 flex-1 rounded-[9px] border border-sand bg-card px-3 py-1.5 text-[13px] text-ink placeholder:text-soft focus:border-gold-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={!draft.trim() || sending}
                    aria-label="Send reply"
                    className="f0-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-volt-500 text-white transition-opacity disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
