"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageSquare } from "lucide-react";

import { postDebateVote } from "@/lib/clubhome/client";
import type {
  DebateResponse,
  ThinkingResponse,
  TrendingResponse,
} from "@/lib/clubhome/contract";
import { BoardSection, BrandTile } from "./board";

/**
 * WHERE THE CLUB SPLITS — the block that renders two of the sections Home has
 * been computing and throwing away.
 *
 * /dashboard has always built NINE sections and drawn three. `debate` and
 * `thinking` were among the six discarded: the server paid for the debate
 * aggregate RPC and the ranked feed read on every single load, and the member
 * never saw either. `postDebateVote()` had shipped with ZERO importers, so the
 * one live debate in the product could not be voted on from anywhere.
 *
 * THREE OBJECTS, ONE SECTION, in the order a member cares about them:
 *
 *   1  THE SPLIT — the ticker the Club most disagrees on, off the stance tallies
 *      already carried on the TRENDING rows (`sentiment.bull` / `.bear`, from
 *      the snapshot ledger). "The Club disagrees on TSLA — 6 bull / 4 bear" and
 *      a link straight to that ticker's stance section (#club-read), where the
 *      member can read the split and take their own side. Contest is scored as
 *      min(bull, bear) so one loud side never wins the slot.
 *
 *   2  THE DEBATE — the live question, with the vote INLINE. Voting posts to
 *      /api/club/debate/vote and the counts update in place. Below the
 *      participation floor the counts are withheld and the framing is "be an
 *      early voice" rather than a tally of three.
 *
 *   3  THE BEST THINKING — the top member-authored post by real engagement, as
 *      one board card row. One post, not a feed: the feed is /community's job.
 *
 * FOUNDING STATES ARE DESIGNED, not accidental. The club is small: most days
 * there is no contested ticker and often no debate. Each object is absent when
 * its source is absent, and when ALL THREE are absent the section does not
 * render at all rather than drawing three empty wells.
 *
 * NO PERFORMANCE CLAIMS. A stance split is what members believe, not what is
 * right; nothing here scores or ranks a call.
 */

interface SplitPick {
  ticker: string;
  company: string | null;
  bull: number;
  bear: number;
}

/** The most CONTESTED ticker on the board — both sides real, sides closest. */
function pickSplit(trending?: TrendingResponse | null): SplitPick | null {
  let best: SplitPick | null = null;
  let bestScore = 0;
  for (const row of trending?.rows ?? []) {
    const s = row.sentiment;
    if (!s) continue;
    const bull = Number(s.bull) || 0;
    const bear = Number(s.bear) || 0;
    if (bull < 1 || bear < 1) continue;
    // Contest = the size of the SMALLER side. A 9/1 split is not a disagreement.
    const score = Math.min(bull, bear) * 100 - Math.abs(bull - bear);
    if (score > bestScore) {
      bestScore = score;
      best = { ticker: row.ticker, company: row.company ?? null, bull, bear };
    }
  }
  return best;
}

function DebateBlock({ debate }: { debate: DebateResponse }) {
  const [counts, setCounts] = useState(debate.counts);
  const [vote, setVote] = useState<"yes" | "no" | null>(debate.userVote ?? null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function cast(choice: "yes" | "no") {
    if (busy || vote === choice) return;
    setBusy(true);
    setFailed(false);
    const next = await postDebateVote(debate.id, choice);
    if (next) {
      setCounts(next);
      setVote(choice);
    } else {
      setFailed(true);
    }
    setBusy(false);
  }

  const total = (counts?.yes ?? 0) + (counts?.no ?? 0);
  const showCounts = debate.floorMet && total > 0;

  return (
    <div className="club-b-card px-3.5 py-3">
      <p className="text-[13px] font-bold leading-snug text-ink">{debate.question}</p>
      <div className="mt-2.5 flex items-center gap-1.5">
        {(["yes", "no"] as const).map((choice) => {
          const on = vote === choice;
          return (
            <button
              key={choice}
              type="button"
              onClick={() => void cast(choice)}
              disabled={busy}
              aria-pressed={on}
              className={`f0-focus f0-press rounded-full px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] transition disabled:opacity-60 ${
                on
                  ? "bg-accent text-[color:var(--accent-on)]"
                  : "club-b-chip text-ink"
              }`}
            >
              {choice === "yes" ? "Yes" : "No"}
              {showCounts && (
                <span className="ml-1.5 font-mono tabular-nums opacity-70">
                  {choice === "yes" ? counts.yes : counts.no}
                </span>
              )}
            </button>
          );
        })}
        <span className="ml-1 text-[11px] text-soft">
          {failed
            ? "That vote didn't save — try again."
            : showCounts
              ? `${total} member${total === 1 ? "" : "s"} in`
              : vote
                ? "Your position is in."
                : "Be an early voice on this one."}
        </span>
      </div>
    </div>
  );
}

export default function ClubSplit({
  trending,
  debate,
  thinking,
  isKid = false,
  loading = false,
}: {
  trending?: TrendingResponse | null;
  debate?: DebateResponse | null;
  thinking?: ThinkingResponse | null;
  isKid?: boolean;
  loading?: boolean;
}) {
  const split = isKid ? null : pickSplit(trending);
  // The debate is kid-walled server-side (the core answers { kidWalled:true }),
  // so a kid never has an `id` to render — this is belt and suspenders.
  const liveDebate = !isKid && debate && debate.id && debate.question ? debate : null;
  const lead = thinking?.lead ?? null;

  if (loading && !split && !liveDebate && !lead) {
    return (
      <BoardSection id="club-split" label="Where the club" mark="splits">
        <div className="mt-2.5 flex flex-col gap-[7px]" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="club-b-card px-3.5 py-3 motion-safe:animate-pulse">
              <div className="h-2.5 w-3/5 rounded-full bg-ink/10" />
              <div className="mt-2 h-2.5 w-2/5 rounded-full bg-ink/[0.07]" />
            </div>
          ))}
        </div>
      </BoardSection>
    );
  }

  // Nothing real to show. The Club is small and quiet days are normal — an
  // empty section is worse than no section.
  if (!split && !liveDebate && !lead) return null;

  return (
    <BoardSection id="club-split" label="Where the club" mark="splits">
      <div className="mt-2.5 flex flex-col gap-[7px]">
        {/* 1 — the contested ticker */}
        {split && (
          <Link
            href={`/research/${encodeURIComponent(split.ticker)}#club-read`}
            className="club-b-card f0-focus f0-press flex items-center gap-2.5 px-3 py-[10px]"
          >
            <BrandTile ticker={split.ticker} size={26} radius={8} fontSize={11} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-ink">
                The Club disagrees on {split.ticker}
              </span>
              <span className="block truncate text-[11px] text-soft">
                {split.bull} bull / {split.bear} bear — read the split
              </span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-soft" aria-hidden />
          </Link>
        )}

        {/* 2 — the live debate, votable in place */}
        {liveDebate && <DebateBlock debate={liveDebate} />}

        {/* 3 — the best thinking, one row */}
        {lead && (
          <Link
            href={lead.href}
            className="club-b-card f0-focus f0-press flex items-center gap-2.5 px-3 py-[10px]"
          >
            <span
              className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] text-accent"
              style={{
                background: "color-mix(in srgb, var(--accent-solid) 13%, transparent)",
              }}
              aria-hidden
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-ink">
                {lead.title}
              </span>
              <span className="block truncate text-[11px] text-soft">
                {lead.author.name}
                {lead.author.badge ? ` · ${lead.author.badge}` : ""}
                {lead.comments > 0
                  ? ` · ${lead.comments} repl${lead.comments === 1 ? "y" : "ies"}`
                  : ""}
              </span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-soft" aria-hidden />
          </Link>
        )}
      </div>
    </BoardSection>
  );
}
