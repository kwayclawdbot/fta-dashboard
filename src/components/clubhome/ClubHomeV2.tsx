"use client";

import Link from "next/link";
import { PlayCircle, ArrowRight } from "lucide-react";
import { useClubData } from "@/lib/clubhome/client";
import type { ClubScale } from "@/lib/clubhome/contract";
import type { Register } from "@/lib/register";

import ChallengeSlot from "./ChallengeSlot";
import ClubHeader from "./ClubHeader";
import LivePulse from "./LivePulse";
import Collective from "./Collective";
import BuildTheClub from "./BuildTheClub";
import KaiBrief from "./KaiBrief";
import Trending from "./Trending";
import BestThinking from "./BestThinking";
import Debate from "./Debate";
import ForYou from "./ForYou";
import People from "./People";

/**
 * ClubHome v2 — mock-faithful rebuild (owner 07-26: reproduce the mock). The
 * page is a three-column dashboard of contained data-object cards over the warm
 * sand base: a Live Pulse hero of ticker signal cards, then a masonry grid —
 *   left:   The Collective · Today's Best Thinking
 *   middle: Kai Brief · The Debate
 *   right:  Trending in the Club · For You
 * — closed by the Build-the-Club invite (carve-out, styled native) and the
 * People strip. Every count-bearing section is scale-aware (a designed founding
 * state, never a raw embarrassing number). Kid register gets the safe subset
 * (no Debate, no People, no invite competition, no sentiment).
 */

export interface LearningPickup {
  title: string;
  href: string;
  context: string | null;
}

export default function ClubHomeV2({
  firstName,
  register,
  learning,
  challengeExpiresAt = null,
  preview,
}: {
  firstName: string;
  register: Register;
  learning: LearningPickup | null;
  challengeExpiresAt?: string | null;
  /** design-review only — force fixtures + a scale state (guarded to dev/preview) */
  preview?: { fixtures: boolean; scale: ClubScale };
}) {
  const isKid = register === "kid";
  const canInvite = register !== "kid";
  const canDebate = register !== "kid";
  const canDiscoverPeople = register !== "kid";

  const { data, usingFixtures } = useClubData({
    fixtures: preview?.fixtures,
    scale: preview?.scale,
  });

  const collectiveFloorMet = data.collective?.floorMet ?? false;

  // Kid-safe subset: sentiment display is kid-walled — strip sentiment signals/
  // items from the surfaces kids DO see so no bull/bear read reaches them.
  const pulse = isKid && data.pulse
    ? { ...data.pulse, signals: data.pulse.signals.filter((s) => s.kind !== "sentiment") }
    : data.pulse;
  const brief = isKid && data.brief
    ? { ...data.brief, items: data.brief.items.filter((i) => i.kind !== "sentiment") }
    : data.brief;
  const foryou = isKid && data.foryou
    ? { ...data.foryou, items: data.foryou.items.filter((i) => i.kind !== "sentiment") }
    : data.foryou;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {usingFixtures && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-50 rounded-full border border-volt-500/40 bg-card/95 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-volt-700 shadow-soft">
          fixtures · {preview?.scale ?? "scale"} · {register}
        </div>
      )}

      {/* §12 Challenge slot — high priority, only during an active pass */}
      <ChallengeSlot challengeExpiresAt={challengeExpiresAt} />

      {/* §1 Header */}
      <ClubHeader
        firstName={firstName}
        connectedMinds={data.collective?.connectedMinds ?? null}
        floorMet={collectiveFloorMet}
      />

      {/* §2 Live Pulse hero — ticker signal cards */}
      <LivePulse pulse={pulse} isKid={isKid} />

      {/* three-column dashboard grid (masonry columns, mock-faithful) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr_1fr]">
        {/* left column */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* §3 The Collective — founding embeds the §4 invite engine as centerpiece */}
          <Collective
            collective={data.collective}
            isKid={isKid}
            invite={
              canInvite && !collectiveFloorMet ? (
                <BuildTheClub invite={data.invite} embedded />
              ) : undefined
            }
          />
          {/* §7 Today's Best Thinking */}
          <BestThinking thinking={data.thinking} />
        </div>

        {/* middle column */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* §5 Kai Brief */}
          <KaiBrief brief={brief} />
          {/* §8 The Debate (kid-walled) */}
          {canDebate && <Debate debate={data.debate} />}
        </div>

        {/* right column */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* §6 Trending in the Club */}
          <Trending trending={data.trending} />
          {/* §9 For You */}
          <ForYou foryou={foryou} />
        </div>
      </div>

      {/* §4 Build the Club — standalone invite ledger once past the floor (carve-out) */}
      {canInvite && collectiveFloorMet && <BuildTheClub invite={data.invite} />}

      {/* §10 People worth following (kid-walled) */}
      {canDiscoverPeople && <People people={data.people} />}

      {/* Keep learning — one compact pickup line (personal continuity) */}
      <KeepLearning learning={learning} />
    </div>
  );
}

function KeepLearning({ learning }: { learning: LearningPickup | null }) {
  const href = learning?.href ?? "/courses";
  const title = learning?.title ?? "Pick up the Foundations";
  const context = learning?.context ?? "One concept, one company, every week.";
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-sand bg-card p-4 shadow-soft transition-colors hover:border-volt-400/50"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-volt-500/12 text-volt-700">
        <PlayCircle className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[11px] font-bold uppercase tracking-wider text-volt-700">Keep learning</p>
        <p className="truncate font-semibold text-ink">{title}</p>
        <p className="truncate text-[12px] text-soft">{context}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-volt-700 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
