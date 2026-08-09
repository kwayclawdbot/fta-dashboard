"use client";

import { Suspense, use, useEffect } from "react";

import { useClubData, type ClubHomeSeed } from "@/lib/clubhome/client";
import { useLiveEvents, primaryLiveEvent, isEventUrgent } from "@/lib/clubhome/live-events";
import type { BriefResponse } from "@/lib/clubhome/contract";
import type { TodayLoop } from "@/lib/club/today";
import type { Register } from "@/lib/register";

import ChallengeSlot from "./ChallengeSlot";
import HomeMasthead from "./HomeMasthead";
import { KaiReadBand } from "./ClubRoom";
import TopInTheClub from "./TopInTheClub";
import TodayIn30 from "./TodayIn30";
import MarketPulse from "./MarketPulse";
import HighestConviction from "./HighestConviction";
import YourSignals from "./YourSignals";
import { LiveNowStrip } from "@/components/live";

/**
 * CLUB HOME — the CheatCodeDoors composition, and NOTHING but it.
 *
 * Top to bottom, after the preserved laws (challenge pass + LIVE NOW, both of
 * which only exist while genuinely active):
 *
 *   1  GREETING            — "Good morning, {name}! 👋" / the CCDoors tagline
 *                            (HomeMasthead).
 *   2  KAI MORNING BRIEF   — the gradient-headed brief card + index chips
 *                            (TodayIn30), on its own Suspense boundary when
 *                            seeded so the ~2.9s brief never gates the board.
 *   3  WHAT THE CLUB IS SEEING — title + sub, the SECTORS HEAT GRID and
 *                            ROTATION row (real per-sector Club attention,
 *                            classified server-side onto the trending rows),
 *                            the ATTENTION GRAVITY list with its verbatim
 *                            compliance line (TopInTheClub), then KAI'S READ
 *                            as the Kai-blue band (KaiReadBand).
 *   4  MARKET PULSE        — the horizontal 112px quote-card strip: the
 *                            member's quoted watchlist tickers (topped up from
 *                            trending), real daily-close sparklines, the real
 *                            NY session clock.
 *   5  HIGHEST-CONVICTION IDEA — the hero card: the member's current lesson
 *                            pickup with its honest course progress, or the
 *                            Foundations door.
 *   6  MY WATCHLIST MOVERS — the member's own tickers as one contained card
 *                            (YourSignals).
 *
 * WHAT IS DELIBERATELY GONE (the previous pass blended these into the doors
 * composition and was rejected — the prototype draws none of them on Home):
 * TODAY'S ONE THING + the streak/due chips, WHERE THE CLUB SPLITS, the
 * people-worth-following line, the YOU belt card, and KEEP LEARNING (its job —
 * the lesson pickup — IS the Highest-conviction card now).
 *
 * REAL DATA ONLY. Every numeral resolves to a real read; where a source does
 * not exist the object is absent (no sector rows → no heat grid; no quote → no
 * pulse card; no bars → no sparkline; no progress read → no bar).
 *
 * THEMES: semantic tokens only (card/ink/soft/sand + --accent-solid /
 * --accent-gradient / --kai-blue), with the heat tiles computing their orange
 * ramp via color-mix over --accent-solid so light and dark both hold.
 *
 * KID REGISTER keeps the safe subset: sentiment items are stripped from the
 * brief BEFORE it reaches the card, YOUR SIGNALS drops sentiment lines, and
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
  learning,
  challengeExpiresAt = null,
  seedPromise,
  briefPromise,
  todayPromise,
}: {
  firstName?: string;
  register: Register;
  learning: LearningPickup | null;
  challengeExpiresAt?: string | null;
  /** Lifetime XP. Accepted for caller compatibility; the YOU belt card the
   *  prototype does not draw is gone, so nothing here reads it. */
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
  /**
   * TODAY'S LOOP (src/lib/club/today.ts): the source of the member's next
   * lesson + honest course progress for the HIGHEST-CONVICTION card. Absent →
   * the card fetches /api/club/today itself, so client navigation and the
   * family-fallback path still get real progress.
   */
  todayPromise?: Promise<TodayLoop | null>;
}) {
  const isKid = register === "kid";

  // `use()` is legal in a conditional — and `seedPromise` is either always or
  // never present for a given mount, so the branch is stable.
  const seed = seedPromise ? use(seedPromise) : null;
  // Same rule: either always present or never, for a given mount.
  const today = todayPromise ? use(todayPromise) : null;

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

  // ── board-size diagnostic (dev ONLY, never production) ────────────────────
  const trendingRows = data.trending?.rows?.length ?? 0;
  useEffect(() => {
    if (loading || process.env.NODE_ENV === "production") return;
    console.info(
      `[ClubHome] trending rows=${trendingRows}` +
        ` totalCount=${data.trending?.totalCount ?? "n/a"}` +
        ` locked=${data.trending?.locked ?? false}`
    );
  }, [loading, trendingRows, data.trending?.totalCount, data.trending?.locked]);

  return (
    /* THE PAGE RHYTHM IS THE PROTOTYPE'S, NOT A STACK UTILITY. space-y-4 gave
       every neighbour the same 16px and the board read as a generic card
       stack; CheatCodeDoors spaces sections at 18 / 26 / 22 / 24px — closer
       inside a thought, wider between thoughts. Each gap is stamped on the
       section it precedes, so an absent section (no read, no live room)
       collapses its own gap instead of leaving a double one. */
    <div className="mx-auto max-w-2xl pb-16 lg:max-w-3xl">
      {/* Preserved law — only during an active pass */}
      <ChallengeSlot challengeExpiresAt={challengeExpiresAt} />

      {/* Preserved law — only when a room is actually on the air */}
      {liveNow && <div className="mb-[18px]"><LiveNowStrip event={liveNow} /></div>}

      {/* 1 — the greeting */}
      <HomeMasthead firstName={firstName} isKid={isKid} />

      {/* 2 — the Kai morning brief, 18px under the greeting (prototype). Its
          own Suspense boundary when seeded, so the ~2.9s brief never gates the
          sections around it. */}
      <div className="mt-[18px]">
        {briefPromise ? (
          <Suspense fallback={<TodayIn30 loading />}>
            <BriefField promise={briefPromise} isKid={isKid} />
          </Suspense>
        ) : (
          <TodayIn30 brief={fallbackBrief} loading={loading} />
        )}
      </div>

      {/* 3 — WHAT THE CLUB IS SEEING: a new thought, 26px. The section is
          OPEN — it sits on the paper, not in a card. */}
      <div className="mt-[26px]">
        <TopInTheClub trending={data.trending} loading={loading} isKid={isKid} />
      </div>

      {/* 3e — KAI'S READ: a FULL-BLEED band (edge to edge, square corners) —
          the one deliberate interruption of the column, 22px after the
          section it reads. Absent when the collective read is. */}
      <div className="mt-[22px] -mx-4 lg:-mx-8">
        <KaiReadBand collective={data.collective} isKid={isKid} />
      </div>

      {/* 4 — MARKET PULSE, 24px */}
      <div className="mt-[24px]">
        <MarketPulse foryou={data.foryou} trending={data.trending} />
      </div>

      {/* 5 — HIGHEST-CONVICTION IDEA, 24px */}
      <div className="mt-[24px]">
        <HighestConviction pickup={learning} seed={today} />
      </div>

      {/* 6 — MY WATCHLIST MOVERS, 24px */}
      <div className="mt-[24px]">
        <YourSignals foryou={data.foryou} isKid={isKid} loading={loading} />
      </div>
    </div>
  );
}
