"use client";

import { Suspense, use, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";

import { useClubData, type ClubHomeSeed } from "@/lib/clubhome/client";
import { useLiveEvents, primaryLiveEvent, isEventUrgent } from "@/lib/clubhome/live-events";
import type { BriefResponse } from "@/lib/clubhome/contract";
import type { TodayLoop } from "@/lib/club/today";
import type { Register } from "@/lib/register";

import ChallengeSlot from "./ChallengeSlot";
import HomeMasthead from "./HomeMasthead";
import TodayOneThing from "./TodayOneThing";
import ClubSplit from "./ClubSplit";
import ClubRoom from "./ClubRoom";
import TopInTheClub from "./TopInTheClub";
import TodayIn30 from "./TodayIn30";
import YourSignals from "./YourSignals";
import YouStrip from "./YouStrip";
import { LiveNowStrip } from "@/components/live";

/**
 * CLUB HOME — board 01, rebuilt screen-for-screen.
 *
 * The reference board (.planning/design-project-v2, "01 Home", light and dark
 * twins) reads top to bottom as FIVE objects and nothing else:
 *
 *   1  masthead        — "GM, Marcus 👋" + "Here's what the Club is seeing"
 *   2  TOP IN THE CLUB — a horizontal strip of white ranked ticker CARDS
 *   3  TODAY IN 30 SECONDS — a peach card: title, one line, round orange
 *                        button, three index chips
 *   4  YOUR SIGNALS    — white card rows: tile, ticker, one human line, a
 *                        trailing mark
 *   5  YOU             — a peach card: belt, XP bar, and a conic dial
 *
 * WHAT WAS REMOVED, and why. The previous pass composed Home from the f0
 * hairline vocabulary and added four objects the board does not draw. All four
 * are gone from this surface:
 *
 *   · ACT ON THIS      — the full-bleed orange escalation band. Not on the
 *                        board. Alerts keep their own surface.
 *   · member presence  — the avatar row. Not on the board; it belongs to the
 *                        Club screen (board 04), where the room is the subject.
 *   · WHERE THE CLUB STANDS — a long stance ledger. Not on the board; the
 *                        ranked strip above is the attention object, and it now
 *                        carries the verbatim compliance line the ledger used
 *                        to.
 *   · "Add your read to the board" — a full-width orange pill CTA. Not on the
 *                        board; the tab bar is the way into the Club.
 *   · Live in the Club — a two-column grid of large bordered event cards, the
 *                        single loudest piece of the old system on this screen.
 *                        Live rooms are board 05's subject. The URGENT case
 *                        survives as the LIVE NOW strip, which is preserved law
 *                        and only fires when a room is actually on the air.
 *
 * WHAT WAS KEPT DESPITE NOT BEING DRAWN, and why:
 *
 *   · ChallengeSlot — preserved law, and only during an active pass.
 *   · LIVE NOW strip — preserved law, and only when a room is on the air.
 *   · KEEP LEARNING — preserved law (Learn is not a primary nav slot for
 *     adults, so it stays visible through this contextual object). It is no
 *     longer the old ObjectCard: it is rebuilt here as one board card row, the
 *     same object YOUR SIGNALS is made of, so it speaks the board's language
 *     instead of the previous system's.
 *
 * REAL DATA ONLY. Every numeral on this surface resolves to a real read, and
 * where a source genuinely does not exist the object says so instead of
 * borrowing the mockup's number — see the section headers for exactly which.
 *
 * THEMES. Everything is built from semantic tokens (paper / ink / soft / sand /
 * card / accent) plus the `.club-b-*` board classes, so the light board's trick
 * — white cards on warm paper — inverts correctly into the dark board's lifted
 * charcoal on near-black with no hand-rolled dark surface anywhere.
 *
 * KID REGISTER keeps the safe subset: sentiment items are stripped from the
 * brief BEFORE it reaches the card, and YOUR SIGNALS drops sentiment lines.
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

/* KEEP LEARNING — preserved law, in the board's card vocabulary. Same row
   geometry as a YOUR SIGNALS card so the surface has one card language rather
   than two. */
function KeepLearning({ pickup }: { pickup: LearningPickup | null }) {
  const href = pickup?.href ?? "/courses";
  const title = pickup?.title ?? "Pick up the Foundations";
  const context = pickup?.context ?? "One concept, one company, every week.";
  return (
    <Link
      href={href}
      className="club-b-card f0-focus f0-press flex items-center gap-2.5 px-3 py-[10px]"
    >
      <span
        className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] text-accent"
        style={{
          background: "color-mix(in srgb, var(--accent-solid) 13%, transparent)",
        }}
        aria-hidden
      >
        <PlayCircle className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-ink">
          {title}
        </span>
        <span className="block truncate text-[11px] text-soft">{context}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-soft" aria-hidden />
    </Link>
  );
}

export default function ClubHomeV2({
  firstName,
  register,
  learning,
  challengeExpiresAt = null,
  xp = null,
  seedPromise,
  briefPromise,
  todayPromise,
}: {
  firstName?: string;
  register: Register;
  learning: LearningPickup | null;
  challengeExpiresAt?: string | null;
  /** Lifetime XP for the closing belt card. null = unavailable, not zero. */
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
   * TODAY'S LOOP (src/lib/club/today.ts): the member's own next lesson, streak,
   * due cards and triggered watches. Server-built and handed across like the
   * section seed. Absent → TodayOneThing fetches /api/club/today itself, so the
   * client-navigation and family-fallback paths still get the loop.
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
  // register never sees adult live rooms. The rest of the live tier is board
  // 05's subject and no longer renders here.
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
    <div className="mx-auto max-w-2xl space-y-4 pb-16 lg:max-w-3xl">
      {/* Preserved law — only during an active pass */}
      <ChallengeSlot challengeExpiresAt={challengeExpiresAt} />

      {/* Preserved law — only when a room is actually on the air */}
      {liveNow && <LiveNowStrip event={liveNow} />}

      {/* 1 — the greeting */}
      <HomeMasthead firstName={firstName} isKid={isKid} />

      {/* 2 — TODAY'S ONE THING + the due strip. THE LOOP, and the reason this
          surface is a home rather than a dashboard: the member's own next
          action comes before what the room is looking at. It sits ABOVE TOP IN
          THE CLUB deliberately — the board opened on other people's attention,
          which is why a member's own due cards were four taps deep. */}
      <TodayOneThing seed={today} isKid={isKid} />

      {/* 3 — the ranked card strip */}
      <TopInTheClub trending={data.trending} loading={loading} isKid={isKid} />

      {/* 4 — the day's read. Its own Suspense boundary when seeded, so the
          ~2.9s brief never gates the sections around it. */}
      {briefPromise ? (
        <Suspense fallback={<TodayIn30 loading />}>
          <BriefField promise={briefPromise} isKid={isKid} />
        </Suspense>
      ) : (
        <TodayIn30 brief={fallbackBrief} loading={loading} />
      )}

      {/* 5 — what moved on YOUR tickers */}
      <YourSignals foryou={data.foryou} isKid={isKid} loading={loading} />

      {/* 6 — WHERE THE CLUB SPLITS: the debate + best-thinking sections the
          server was already computing and this surface was discarding. Voting
          happens inline. Absent when the Club has neither, by design. */}
      <ClubSplit
        trending={data.trending}
        debate={data.debate}
        thinking={data.thinking}
        isKid={isKid}
        loading={loading}
      />

      {/* 7 — the room, as one line (collective + people, also previously
          computed and discarded). */}
      <ClubRoom collective={data.collective} people={data.people} isKid={isKid} />

      {/* 8 — the board's closing object */}
      <YouStrip xp={xp} isKid={isKid} />

      {/* Preserved law, in the board's card vocabulary */}
      <KeepLearning pickup={learning} />
    </div>
  );
}
