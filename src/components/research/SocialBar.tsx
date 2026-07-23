"use client";

/**
 * SocialBar — the one social affordance reused across every ticker surface
 * (Lane 9). Three variants:
 *
 *   hero  — full interactive bar in the research-page hero: 👍 Like / 👎 Not
 *           for me with live counts + your vote state, comment count (jumps to
 *           the thread), contributor count, and the "N of M members like this"
 *           consensus line. Fetches its own snapshot (one RPC per page).
 *   card  — compact interactive bar for community-watchlist / family cards.
 *           Counts are passed in (batched by the parent — never an N+1 RPC).
 *   row   — count-only pill for screener rows / pick rows. Display only.
 *
 * Voting is forge-proof (RLS) and awards NO XP. Free tier sees counts but is
 * nudged to join before voting; kids vote like everyone (owner rule) and never
 * see a lock or bull/bear jargon.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ThumbsUp, ThumbsDown, MessageCircle, Users2, Heart } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchSocial,
  setVote,
  clearVote,
  voteLabels,
  consensusLine,
  type TickerSocial,
  type Vote,
} from "@/lib/research/social";

type Variant = "hero" | "card" | "row";

export default function SocialBar({
  supabase,
  ticker,
  variant = "row",
  initial,
  userId,
  ageGroup,
  canVote = false,
  threadHref,
  showConsensus = false,
}: {
  supabase?: SupabaseClient;
  ticker: string;
  variant?: Variant;
  /** Counts supplied by a batched parent (card/row). Hero fetches its own. */
  initial?: Partial<TickerSocial>;
  userId?: string | null;
  ageGroup?: string | null;
  canVote?: boolean;
  /** Where the comment affordance links / jumps to. */
  threadHref?: string;
  showConsensus?: boolean;
}) {
  const [s, setS] = useState<TickerSocial>({
    ticker,
    likes: initial?.likes ?? 0,
    unlikes: initial?.unlikes ?? 0,
    net: initial?.net ?? 0,
    myVote: initial?.myVote ?? null,
    commentCount: initial?.commentCount ?? 0,
    contributors: initial?.contributors ?? 0,
    memberTotal: initial?.memberTotal ?? 0,
  });
  const [busy, setBusy] = useState(false);

  // Hero fetches its own authoritative snapshot on mount.
  useEffect(() => {
    if (variant !== "hero" || !supabase) return;
    let live = true;
    fetchSocial(supabase, ticker).then((snap) => {
      if (live) setS(snap);
    });
    return () => {
      live = false;
    };
  }, [variant, supabase, ticker]);

  const labels = voteLabels(ageGroup);

  const vote = useCallback(
    async (v: Vote) => {
      if (!supabase || !userId || !canVote || busy) return;
      setBusy(true);
      const prev = s.myVote;
      // Optimistic: toggle off if re-tapping the same vote, else set.
      const next: Vote | null = prev === v ? null : v;
      const likes =
        s.likes + (next === 1 ? 1 : 0) - (prev === 1 ? 1 : 0);
      const unlikes =
        s.unlikes + (next === -1 ? 1 : 0) - (prev === -1 ? 1 : 0);
      setS({ ...s, myVote: next, likes, unlikes, net: likes - unlikes });

      const ok =
        next === null
          ? await clearVote(supabase, ticker, userId)
          : await setVote(supabase, ticker, userId, next);
      if (!ok) {
        setS(s); // rollback
      } else if (variant === "hero") {
        // Reconcile with server truth (trigger updates counts).
        const snap = await fetchSocial(supabase, ticker);
        setS(snap);
      }
      setBusy(false);
    },
    [supabase, userId, canVote, busy, s, ticker, variant]
  );

  const consensus = showConsensus ? consensusLine(s) : null;

  /* ── row: count-only pill (screener / pick rows) ───────────────────────── */
  if (variant === "row") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-semibold text-soft"
        title={`${s.likes} like${s.likes === 1 ? "" : "s"}`}
      >
        <Heart
          className={`h-3.5 w-3.5 ${s.net > 0 ? "fill-red-500 text-red-500" : "text-soft"}`}
        />
        {s.net > 0 ? s.net : "—"}
      </span>
    );
  }

  /* ── card: compact interactive (watchlist / family cards) ──────────────── */
  if (variant === "card") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => vote(1)}
          disabled={!canVote || busy}
          aria-pressed={s.myVote === 1}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold transition-colors ${
            s.myVote === 1
              ? "bg-red-500/12 text-red-600"
              : "text-soft hover:bg-paper disabled:hover:bg-transparent"
          } disabled:opacity-60`}
          title={labels.like}
        >
          <Heart className={`h-3.5 w-3.5 ${s.myVote === 1 ? "fill-red-500" : ""}`} />
          {s.likes}
        </button>
        {threadHref && (
          <Link
            href={threadHref}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-soft hover:bg-paper"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {s.commentCount}
          </Link>
        )}
      </div>
    );
  }

  /* ── hero: full interactive bar ────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => vote(1)}
          disabled={!canVote || busy}
          aria-pressed={s.myVote === 1}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
            s.myVote === 1
              ? "border-red-500/40 bg-red-500/12 text-red-600"
              : "border-sand text-soft hover:bg-paper"
          } disabled:opacity-60`}
        >
          <ThumbsUp className={`h-4 w-4 ${s.myVote === 1 ? "fill-red-500/20" : ""}`} />
          {labels.like}
          <span className="tabular-nums">{s.likes}</span>
          {labels.likeSub && s.myVote === 1 && (
            <span className="text-[10px] font-normal opacity-70">· {labels.likeSub}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => vote(-1)}
          disabled={!canVote || busy}
          aria-pressed={s.myVote === -1}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
            s.myVote === -1
              ? "border-soft/40 bg-sand text-ink"
              : "border-sand text-soft hover:bg-paper"
          } disabled:opacity-60`}
        >
          <ThumbsDown className={`h-4 w-4 ${s.myVote === -1 ? "" : ""}`} />
          {labels.unlike}
          <span className="tabular-nums">{s.unlikes}</span>
          {labels.unlikeSub && s.myVote === -1 && (
            <span className="text-[10px] font-normal opacity-70">· {labels.unlikeSub}</span>
          )}
        </button>

        {threadHref && (
          <a
            href={threadHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-sand px-3 py-1.5 text-sm font-semibold text-soft hover:bg-paper"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="tabular-nums">{s.commentCount}</span>
          </a>
        )}

        {s.contributors > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-soft">
            <Users2 className="h-3.5 w-3.5" />
            {s.contributors} contributor{s.contributors === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {consensus && (
        <p className="inline-flex items-center gap-1.5 text-xs text-soft">
          <Heart className="h-3.5 w-3.5 fill-red-500/70 text-red-500" />
          {consensus}
        </p>
      )}

      {!canVote && userId && (
        <p className="text-[11px] text-soft/80">Join the club to add your vote.</p>
      )}
    </div>
  );
}
