"use client";

import { useClubData } from "@/lib/clubhome/client";
import { useLiveEvents, primaryLiveEvent, isEventUrgent } from "@/lib/clubhome/live-events";
import ContinuePath from "@/components/learn/ContinuePath";
import { EditorialSection } from "@/components/grammar";
import type { ClubScale } from "@/lib/clubhome/contract";
import type { Register } from "@/lib/register";

import ChallengeSlot from "./ChallengeSlot";
import CanvasHome from "./CanvasHome";
import { LiveEventCard, LiveNowStrip } from "@/components/live";

/**
 * ClubHome v2 — CONVERGENCE S2 hierarchy pass. Keeps v3's owner-approved content
 * and object identity, but composes it in ONE dramatic order instead of a flat
 * three-column card grid:
 *
 *   TIER 0  LIVE NOW strip        — amendment #2, only when a room is on the air
 *   TIER 1  LIVE PULSE (hero)     — near-full-width, dominant above the fold;
 *                                   live_event cards join this tier when rooms run
 *   TIER 2  THE COLLECTIVE        — the large signature visualization, with the
 *                                   KAI BRIEF adjacent
 *   TIER 3  the editorial tail    — Trending · Best Thinking · Debate · For You,
 *                                   framed as editorial sections on the sand
 *                                   canvas, then Build-the-Club · People · Keep
 *                                   Learning
 *
 * Every count-bearing section stays scale-aware (a designed founding state, never
 * a raw number). Kid register keeps the safe subset (no Debate, no People, no
 * invite competition, no sentiment, no live_event faces).
 */

export interface LearningPickup {
  title: string;
  href: string;
  context: string | null;
}

export default function ClubHomeV2({
  register,
  learning,
  challengeExpiresAt = null,
  preview,
}: {
  /** kept in the contract for callers; the canvas Home leads with the board, not a greeting */
  firstName?: string;
  register: Register;
  learning: LearningPickup | null;
  challengeExpiresAt?: string | null;
  /** design-review only — force fixtures + a scale state (guarded to dev/preview) */
  preview?: { fixtures: boolean; scale: ClubScale };
}) {
  const isKid = register === "kid";

  const { data, usingFixtures } = useClubData({
    fixtures: preview?.fixtures,
    scale: preview?.scale,
  });

  // live_events (S2.5 object). Kid register never sees adult live rooms; the
  // endpoint 404s until S2.5 lands, so live mode simply renders nothing.
  const liveEvents = useLiveEvents({ fixtures: preview?.fixtures, scale: preview?.scale });
  const showLive = !isKid && liveEvents.length > 0;
  const primaryLive = showLive ? primaryLiveEvent(liveEvents) : null;
  const liveNow = primaryLive && isEventUrgent(primaryLive) ? primaryLive : null;
  // Cards in the Pulse tier: the upcoming/live/replay rooms (LIVE NOW already
  // carries the single most urgent one, so the tier shows the rest as objects).
  const pulseTierEvents = showLive
    ? liveEvents.filter((e) => e.id !== liveNow?.id).slice(0, 3)
    : [];

  // No tier/entitlement walls here: ClubHomeV2 is only reached by NON-FREE solo
  // members (free short-circuits to FreeHome upstream in dashboard/page.tsx), so
  // every viewer passes trending_full / foryou_deep / kai_brief. Challenge-Pass
  // holders resolve to 'fic' and read as fully entitled (the countdown ribbon is
  // the global DashboardShell + ChallengeSlot, not a per-section wall). The kid
  // register axis is still enforced below (sentiment strips + kid-walled sections).

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
    <div className="mx-auto max-w-2xl space-y-7 pb-16 lg:max-w-3xl">
      {usingFixtures && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-50 rounded-full border border-volt-500/40 bg-card/95 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-volt-700 shadow-soft">
          fixtures · {preview?.scale ?? "scale"} · {register}
        </div>
      )}

      {/* §12 Challenge slot — high priority, only during an active pass (preserved law) */}
      <ChallengeSlot challengeExpiresAt={challengeExpiresAt} />

      {/* LIVE NOW (amendment #2): a live/starting room is urgent, above all — a
          canvas-styled addition sitting above the board (preserved law) */}
      {liveNow && <LiveNowStrip event={liveNow} />}

      {/* Board 01 — the canvas Home composition, wired to live club data.
          Supersedes the former Live-Pulse/Collective tier layout for club members. */}
      <CanvasHome
        trending={data.trending}
        brief={brief}
        pulse={pulse}
        foryou={foryou}
      />

      {/* live_event rooms — canvas-styled additions when rooms are on air
          (preserved law: live_event cards) */}
      {pulseTierEvents.length > 0 && (
        <EditorialSection title="Live in the Club" divide>
          <div className="grid gap-4 sm:grid-cols-2">
            {pulseTierEvents.map((e) => (
              <LiveEventCard key={e.id} event={e} />
            ))}
          </div>
        </EditorialSection>
      )}

      {/* Keep learning — the shared ContinuePath object (amendment #3): Learn
          stays reachable for adults through this contextual object (preserved law). */}
      <ContinuePath pickup={learning} />
    </div>
  );
}
