"use client";

import { use, useEffect } from "react";

import { LiveNowStrip } from "@/components/live";
import type { TodayLoop } from "@/lib/club/today";
import type { ClubScale } from "@/lib/clubhome/contract";
import { fixturesAllowed, type ClubHomeSeed, useClubData } from "@/lib/clubhome/client";
import { isEventUrgent, primaryLiveEvent, useLiveEvents } from "@/lib/clubhome/live-events";
import type { Register } from "@/lib/register";

import ChallengeSlot from "./ChallengeSlot";
import StandaloneHome from "./StandaloneHome";

export interface LearningPickup {
  title: string;
  href: string;
  context: string | null;
}

/**
 * Screen 01 from the supplied Cheat Code standalone mockup.
 *
 * Presentation is intentionally isolated from data assembly: the server still
 * builds the same Supabase/market/Kai seed and this client still consumes the
 * same Club contract. Only the composition changed—from the earlier light board
 * interpretation to the supplied warm-black, live-ticker-first screen.
 */
export default function ClubHomeV2({
  firstName,
  register,
  challengeExpiresAt = null,
  xp = null,
  preview,
  seedPromise,
  briefPromise,
  todayPromise,
}: {
  firstName?: string;
  register: Register;
  learning: LearningPickup | null;
  challengeExpiresAt?: string | null;
  xp?: number | null;
  preview?: { fixtures: boolean; scale: ClubScale };
  seedPromise?: Promise<ClubHomeSeed | null>;
  briefPromise?: Promise<unknown>;
  todayPromise?: Promise<TodayLoop | null>;
}) {
  const isKid = register === "kid";
  const seed = seedPromise ? use(seedPromise) : null;

  // These promises remain server-owned for compatibility with the family home
  // and route cache. Screen 01 does not draw their former cards, so it does not
  // suspend the mockup-native view on them.
  void briefPromise;
  void todayPromise;

  const { data, loading, usingFixtures } = useClubData({
    fixtures: preview?.fixtures,
    scale: preview?.scale,
    seed,
  });

  const liveEvents = useLiveEvents({ fixtures: preview?.fixtures, scale: preview?.scale });
  const primaryLive = !isKid && liveEvents.length > 0 ? primaryLiveEvent(liveEvents) : null;
  const liveNow = primaryLive && isEventUrgent(primaryLive) ? primaryLive : null;

  const trendingRows = data.trending?.rows?.length ?? 0;
  useEffect(() => {
    if (loading || !fixturesAllowed()) return;
    console.info(
      `[ClubHome] standalone rows=${trendingRows}` +
        ` totalCount=${data.trending?.totalCount ?? "n/a"}` +
        ` locked=${data.trending?.locked ?? false}`
    );
  }, [loading, trendingRows, data.trending?.totalCount, data.trending?.locked]);

  return (
    <div className="mx-auto max-w-[760px] pb-16">
      {usingFixtures && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-50 rounded-full border border-[#FF7A1A]/40 bg-[#17141A]/95 px-3 py-1 cc-app-signal text-[10px] font-bold uppercase tracking-wide text-[#FF9A4D]">
          fixtures · {preview?.scale ?? "scale"} · {register}
        </div>
      )}
      <div className="space-y-3 px-4 pt-4 sm:px-0">
        <ChallengeSlot challengeExpiresAt={challengeExpiresAt} />
        {liveNow && <LiveNowStrip event={liveNow} />}
      </div>
      <StandaloneHome
        firstName={firstName}
        trending={data.trending}
        signals={data.foryou?.items}
        loading={loading}
        xp={xp}
        isKid={isKid}
      />
    </div>
  );
}
