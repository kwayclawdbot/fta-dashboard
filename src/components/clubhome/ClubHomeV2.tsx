"use client";

import { Suspense, use } from "react";

import { useClubData, type ClubHomeSeed } from "@/lib/clubhome/client";
import { useLiveEvents, primaryLiveEvent, isEventUrgent } from "@/lib/clubhome/live-events";
import type { BriefResponse } from "@/lib/clubhome/contract";
import type { TodayLoop } from "@/lib/club/today";
import type { Register } from "@/lib/register";

import ChallengeSlot from "./ChallengeSlot";
import HomeMasthead from "./HomeMasthead";
import TodayIn30 from "./TodayIn30";
import MarketPulse from "./MarketPulse";
import YourSignals from "./YourSignals";
import { LiveNowStrip } from "@/components/live";

/**
 * CLUB HOME — the mockup board's home screen (board 10_07_23, top-left phone),
 * and NOTHING but it.
 *
 * The board's home is FOUR objects, top to bottom (its logo header, avatar +
 * red-badge bell, and bottom tab bar are the app chrome — DashboardTopBar and
 * the shell nav already draw them; this surface must not duplicate them):
 *
 *   1  GREETING            — "Good morning, {name}! 👋" / "Let's crush the
 *                            market today." (HomeMasthead).
 *   2  KAI MORNING BRIEF   — one contained card: purple label + timestamp +
 *                            dismiss ×, gem-marked bullet lines, "{n} things
 *                            need your attention →" (TodayIn30). Its own
 *                            Suspense boundary when seeded so the ~2.9s brief
 *                            never gates the board.
 *   3  MARKET PULSE        — white-caps label + the green session clock, then
 *                            the horizontal quote cards: logo + ticker, price,
 *                            day move, and the "NN% Bullish" band (real
 *                            community stance from the trending ledger; absent
 *                            when nobody has positioned) (MarketPulse).
 *   4  MY WATCHLIST MOVERS — white-caps label + "···", then quiet rounded
 *                            rows: logo + ticker, a line-only month sparkline,
 *                            the day move (YourSignals).
 *
 * PRESERVED CONDITIONAL LAWS (invisible in the board's steady state, drawn
 * only while genuinely active): the challenge pass slot and the LIVE NOW
 * strip. Kids never see adult live rooms.
 *
 * WHAT IS DELIBERATELY GONE (the previous pass drew these; the board's home
 * does not): WHAT THE CLUB IS SEEING (sectors heat grid + rotation + attention
 * gravity + its disclaimer), KAI'S READ (the collective band), the
 * HIGHEST-CONVICTION lesson hero, and the index-chip row on the brief card.
 * Their data stays live under /api/club/* — natural future homes are Discover
 * (attention/sectors) and the Learn surfaces (lesson pickup).
 *
 * REAL DATA ONLY. Every numeral resolves to a real read; where a source does
 * not exist the object is absent (no quote → no pulse card; no positioned
 * members → no bullish band; no bars → no sparkline).
 *
 * THEMES: semantic tokens only (card/ink/soft/sand + --kai-blue + the price
 * ramp) — the club-dark terminal set is the board's palette.
 *
 * KID REGISTER keeps the safe subset: sentiment items are stripped from the
 * brief BEFORE it reaches the card, the pulse cards drop the bullish band, and
 * kids never see adult live rooms.
 */

export interface LearningPickup {
  title: string;
  href: string;
  context: string | null;
}

/**
 * The brief's own Suspense payload. `briefCore` is the board's long pole (~2.9s),
 * so /dashboard hands it across as a SEPARATE promise from the other eight
 * sections; this is the only thing that waits on it. Kid-walling happens here,
 * before a single sentiment line can reach the card.
 */
function BriefField({
  promise,
  isKid,
}: {
  promise: Promise<unknown>;
  isKid: boolean;
}) {
  const raw = use(promise) as BriefResponse | null;
  const brief =
    isKid && raw
      ? { ...raw, items: (raw.items ?? []).filter((i) => i.kind !== "sentiment") }
      : raw;
  return <TodayIn30 brief={brief} />;
}

export default function ClubHomeV2({
  firstName,
  register,
  challengeExpiresAt = null,
  seedPromise,
  briefPromise,
}: {
  firstName?: string;
  register: Register;
  /** The member's lesson pickup. Accepted for caller compatibility; the board's
   *  home draws no lesson hero, so nothing here reads it (it belongs on the
   *  Learn surfaces). */
  learning?: LearningPickup | null;
  challengeExpiresAt?: string | null;
  /** Lifetime XP. Accepted for caller compatibility; the board's home draws no
   *  belt/XP object. */
  xp?: number | null;
  /**
   * SERVER SEED (the empty-first fix). The /dashboard server component builds
   * the club payload with the same assembler the API route uses and hands the
   * PROMISE across the RSC boundary; `use()` suspends this component until it
   * resolves, so what streams in is already populated — the founding branches
   * are never rendered on the way there.
   */
  seedPromise?: Promise<ClubHomeSeed | null>;
  /** The brief, on its OWN boundary — it alone costs ~2.9s. */
  briefPromise?: Promise<unknown>;
  /** The TODAY loop. Accepted for caller compatibility; the lesson hero it fed
   *  is not on the board's home, so it is never awaited here. */
  todayPromise?: Promise<TodayLoop | null>;
}) {
  const isKid = register === "kid";

  // `use()` is legal in a conditional — and `seedPromise` is either always or
  // never present for a given mount, so the branch is stable.
  const seed = seedPromise ? use(seedPromise) : null;

  // `loading` lets each section tell "still arriving" apart from "the club has
  // nothing". With a seed it is false from the very first render.
  const { data, loading } = useClubData({ seed });

  // LIVE NOW (preserved law): a live/starting room is urgent, above all. Kid
  // register never sees adult live rooms.
  const liveEvents = useLiveEvents();
  const primaryLive = !isKid && liveEvents.length > 0 ? primaryLiveEvent(liveEvents) : null;
  const liveNow = primaryLive && isEventUrgent(primaryLive) ? primaryLive : null;

  // Kid-safe subset for the FALLBACK brief path (no briefPromise). The seeded
  // path is walled inside BriefField instead.
  const fallbackBrief =
    isKid && data.brief
      ? { ...data.brief, items: data.brief.items.filter((i) => i.kind !== "sentiment") }
      : data.brief;

  return (
    /* THE PAGE RHYTHM IS THE BOARD'S: greeting → brief at 18px, then 26px
       before each of the two market sections — closer inside the opening
       thought, wider between sections. Each gap is stamped on the section it
       precedes, so an absent section collapses its own gap. */
    <div className="mx-auto max-w-2xl pb-16 lg:max-w-3xl">
      {/* Preserved law — only during an active pass */}
      <ChallengeSlot challengeExpiresAt={challengeExpiresAt} />

      {/* Preserved law — only when a room is actually on the air */}
      {liveNow && <div className="mb-[18px]"><LiveNowStrip event={liveNow} /></div>}

      {/* 1 — the greeting */}
      <HomeMasthead firstName={firstName} isKid={isKid} />

      {/* 2 — the Kai morning brief, 18px under the greeting. Its own Suspense
          boundary when seeded, so the ~2.9s brief never gates the sections
          around it. */}
      <div className="mt-[18px]">
        {briefPromise ? (
          <Suspense fallback={<TodayIn30 loading />}>
            <BriefField promise={briefPromise} isKid={isKid} />
          </Suspense>
        ) : (
          <TodayIn30 brief={fallbackBrief} loading={loading} />
        )}
      </div>

      {/* 3 — MARKET PULSE, 26px */}
      <div className="mt-[26px]">
        <MarketPulse foryou={data.foryou} trending={data.trending} isKid={isKid} />
      </div>

      {/* 4 — MY WATCHLIST MOVERS, 26px */}
      <div className="mt-[26px]">
        <YourSignals foryou={data.foryou} isKid={isKid} loading={loading} />
      </div>
    </div>
  );
}
