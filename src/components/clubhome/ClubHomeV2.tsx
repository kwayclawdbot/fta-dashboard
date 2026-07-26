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
 * ClubHome v2 — "The Collective." The live collective-intelligence Home for CLUB
 * (solo) members. Composes sections 1–13 of the ratified plan in the D1
 * editorial language (typography, ruled ledgers, hairlines, objects-with-
 * identity — never a grid of identical cards). Every count-bearing section is
 * scale-aware: a designed founding-era state (motivation, not emptiness) and an
 * at-scale state. Kid register gets the safe subset (no Debate, no People, no
 * invite competition).
 *
 * Data: consumes the /api/club/* contract via useClubData, with a fixtures
 * fallback for design review (dev/preview only — never in production).
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
  const canInvite = register !== "kid"; // adults + teens
  const canDebate = register !== "kid";
  const canDiscoverPeople = register !== "kid";

  const { data, usingFixtures } = useClubData({
    fixtures: preview?.fixtures,
    scale: preview?.scale,
  });

  const collectiveFloorMet = data.collective?.floorMet ?? false;

  // Kid-safe subset: sentiment display is kid-walled (plan §16). Strip sentiment
  // signals/items from the surfaces kids DO see so no bull/bear read reaches them.
  const pulse = isKid && data.pulse
    ? { ...data.pulse, signals: data.pulse.signals.filter((s) => s.kind !== "sentiment") }
    : data.pulse;
  const brief = isKid && data.brief
    ? { ...data.brief, items: data.brief.items.filter((i) => i.kind !== "sentiment") }
    : data.brief;
  const foryou = isKid && data.foryou
    ? { ...data.foryou, items: data.foryou.items.filter((i) => i.kind !== "sentiment") }
    : data.foryou;

  // Two-lane pairing helper: render a paired row on lg, but if one side is walled
  // off (kid register) the present side takes the full width — never an empty cell.
  function Pair({ a, b }: { a: React.ReactNode; b: React.ReactNode | null }) {
    if (!b) return <>{a}</>;
    return (
      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <div className="min-w-0">{a}</div>
        <div className="min-w-0">{b}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-16">
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

      {/* §2 Live Pulse hero (absorbs the old masthead) */}
      <LivePulse pulse={pulse} isKid={isKid} />

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

      {/* §5 Kai Brief · §6 Trending */}
      <Pair a={<KaiBrief brief={brief} />} b={<Trending trending={data.trending} />} />

      {/* §7 Best Thinking · §8 Debate (kid-walled) */}
      <Pair
        a={<BestThinking thinking={data.thinking} />}
        b={canDebate ? <Debate debate={data.debate} /> : null}
      />

      {/* §4 Build the Club — standalone recognition ledger once past the floor */}
      {canInvite && collectiveFloorMet && <BuildTheClub invite={data.invite} />}

      {/* §9 For You · §10 People (kid-walled) */}
      <Pair
        a={<ForYou foryou={foryou} />}
        b={canDiscoverPeople ? <People people={data.people} /> : null}
      />

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
        <p className="font-display text-[11px] font-bold uppercase tracking-wider text-volt-700">
          Keep learning
        </p>
        <p className="truncate font-semibold text-ink">{title}</p>
        <p className="truncate text-[12px] text-soft">{context}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-volt-700 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
