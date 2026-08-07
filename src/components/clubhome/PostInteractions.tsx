"use client";

import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";

import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { timeAgo, type FeedAuthor } from "@/lib/feed";
import { checkClean, PROFANITY_MESSAGE } from "@/lib/profanity";
import { KID_FEED_READONLY_NOTE } from "@/lib/social/kid-posting";

/**
 * THE INTERACTION LINE — like + reply, on the board's own feed cards.
 *
 * WHY IT EXISTS. Liking and replying lived in exactly one place: the /community
 * feed's <LikeCommentBar> / <CommentThread>, inside CommunityClient. The 07-31
 * "community = chat" directive unrouted that surface, which took the only
 * like-and-reply UI in the product with it — the routed feed objects (the board's
 * BEST THINKING row, the IN THE CLUB strip) were left as read-only links showing
 * a reply COUNT nobody could add to. This restores the interaction on the
 * surfaces that are actually routed, without resurrecting the retired boards.
 *
 * WHAT IT IS NOT. Not a second feed, not a card. It is a LINE under an existing
 * board card and a thread that opens beneath it — the board's card stays the
 * object, and this adds the two verbs the object was missing.
 *
 * DESIGN. Quiet by construction: a 12px glyph, a tabular count and two mono
 * small-caps words on the same baseline. No filled button, no pill, no second
 * container — COLOUR LAW says orange is action, so the accent appears only where
 * the member has acted (a liked heart) or is about to (the send affordance).
 * The thread is an indented ledger under a hairline rule, the same shape the
 * retired thread used, at the board's smaller type scale.
 *
 * WALLS. Every read and write here goes through the SESSION client, so RLS is
 * the wall: kid rows are family-only (214) and teen rows are family-door-only
 * (216) without a line of client-side door logic. The two client guards below
 * are the UI half of postures the database already enforces:
 *   • kid register → the warm read-only note instead of a composer (161/214);
 *   • profanity → checkClean, the same call the composer and chat rooms make.
 * `author_register` and `family_id` are stamped onto the new row by the DB
 * triggers (214), so a comment written here is walled exactly like one written
 * anywhere else.
 *
 * FREE TIER. Both host surfaces are paid-only by construction — a free member is
 * routed to <FreeHome/> before either can mount (resolveHomeRoute → kind:"free",
 * and DashboardHomeClient's `isFree` short-circuit) — so there is no upsell
 * branch here. If this line is ever mounted on a free-reachable surface, that
 * gate has to come with it.
 */

interface ThreadRow {
  id: string;
  body: string;
  created_at: string;
  author: FeedAuthor | null;
}

const COMMENT_AUTHOR_SEL =
  "author:profiles!post_comments_author_id_fkey(id, display_name, role, age_group, family_id, avatar_url, username)";

export default function PostInteractions({
  postId,
  likes,
  liked = false,
  comments,
  isKid = false,
}: {
  postId: string;
  /** Like count as the server counted it. */
  likes: number;
  /** Has this viewer already liked it. */
  liked?: boolean;
  /** Reply count as the server counted it (through the viewer's own wall). */
  comments: number;
  /** Kid register → read + react, never a composer (161 / 214). */
  isKid?: boolean;
}) {
  const supabase = createClient();

  const [likeCount, setLikeCount] = useState(likes);
  const [isLiked, setIsLiked] = useState(liked);
  const [busy, setBusy] = useState(false);

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ThreadRow[] | null>(null);
  const [count, setCount] = useState(comments);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function myId(): Promise<string | null> {
    // Local read of the stored session — no GoTrue round trip on the hot path.
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  async function toggleLike() {
    if (busy) return;
    const me = await myId();
    if (!me) return;
    const wasLiked = isLiked;
    setBusy(true);
    // Optimistic: the tap is the feedback.
    setIsLiked(!wasLiked);
    setLikeCount((n) => Math.max(0, n + (wasLiked ? -1 : 1)));
    const { error } = wasLiked
      ? await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me)
      : await supabase.from("post_likes").insert({ post_id: postId, user_id: me });
    if (error) {
      // Revert — a failed write must not leave a lie on screen.
      setIsLiked(wasLiked);
      setLikeCount((n) => Math.max(0, n + (wasLiked ? 1 : -1)));
    }
    setBusy(false);
  }

  async function loadThread() {
    const { data } = await supabase
      .from("post_comments")
      .select(`id, body, created_at, ${COMMENT_AUTHOR_SEL}`)
      .eq("post_id", postId)
      // Defence in depth, matching every other club-surface read: RLS already
      // walls other households' kid rows, and this drops the viewer's OWN
      // household's too, so a club object reads the same for everyone.
      .neq("author_register", "kid")
      .order("created_at", { ascending: true })
      .limit(50);
    const norm: ThreadRow[] = (data ?? []).map((r) => {
      const raw = r as unknown as ThreadRow & { author: FeedAuthor | FeedAuthor[] | null };
      return { ...raw, author: Array.isArray(raw.author) ? (raw.author[0] ?? null) : raw.author };
    });
    setRows(norm);
    setCount(norm.length);
  }

  async function toggleThread() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && rows === null) await loadThread();
  }

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    const me = await myId();
    if (!me) return;
    if (!checkClean(body).ok) {
      setErr(PROFANITY_MESSAGE);
      return;
    }
    setSending(true);
    setErr(null);
    const { error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, author_id: me, body });
    if (error) {
      setErr("That reply didn't save — try again.");
      setSending(false);
      return;
    }
    setDraft("");
    // Re-read rather than splice: the row comes back with its author embed and
    // its trigger-stamped columns, so the thread shows exactly what was stored.
    await loadThread();
    setSending(false);
  }

  return (
    <>
      <div className="mt-1.5 flex items-center gap-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
        <button
          type="button"
          onClick={() => void toggleLike()}
          disabled={busy}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Remove your like" : "Like this"}
          className={`f0-focus inline-flex items-center gap-1.5 rounded transition-colors disabled:opacity-60 ${
            isLiked ? "text-accent" : "text-soft hover:text-ink"
          }`}
        >
          <Heart className={`h-3 w-3 ${isLiked ? "fill-current" : ""}`} aria-hidden />
          {likeCount > 0 && <span className="tabular-nums">{likeCount}</span>}
          <span>{isLiked ? "Liked" : "Like"}</span>
        </button>
        <button
          type="button"
          onClick={() => void toggleThread()}
          aria-expanded={open}
          className="f0-focus inline-flex items-center gap-1.5 rounded text-soft transition-colors hover:text-ink"
        >
          <span>Reply</span>
          {count > 0 && <span className="tabular-nums text-ink">{count}</span>}
        </button>
      </div>

      {open && (
        <div className="mt-2.5 space-y-2.5 border-l border-sand pl-3">
          {rows === null ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-soft" aria-label="Loading replies" />
          ) : rows.length === 0 ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
              No replies yet
            </p>
          ) : (
            rows.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar
                  name={c.author?.display_name}
                  avatarUrl={c.author?.avatar_url}
                  role={c.author?.role}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[12px] font-semibold text-ink">
                      {c.author?.display_name || "Member"}
                    </span>
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-soft">
                      {timeAgo(c.created_at)}
                    </span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-soft">
                    {c.body}
                  </p>
                </div>
              </div>
            ))
          )}

          {isKid ? (
            // Read + react stays; writing into the shared feed does not (161).
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
              {KID_FEED_READONLY_NOTE}
            </p>
          ) : (
            <div>
              {err && (
                <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
                  {err}
                </p>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  rows={1}
                  placeholder="Reply…"
                  aria-label="Write a reply"
                  className="max-h-20 flex-1 resize-none border-b border-sand bg-transparent pb-1 text-[12.5px] text-ink placeholder:text-soft focus:border-[color:var(--accent-solid)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!draft.trim() || sending}
                  className="f0-focus f0-press rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent transition-opacity disabled:opacity-40"
                >
                  {sending ? "Sending" : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
