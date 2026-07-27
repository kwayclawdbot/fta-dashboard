"use client";

import { Suspense, use, useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { useClubData, fixturesAllowed, type ClubHomeSeed } from "@/lib/clubhome/client";
import { useLiveEvents, primaryLiveEvent, isEventUrgent } from "@/lib/clubhome/live-events";
import { useLiveAlert } from "@/lib/clubhome/alerts";
import ContinuePath from "@/components/learn/ContinuePath";
import { EditorialSection } from "@/components/grammar";
import type { BriefResponse, ClubScale } from "@/lib/clubhome/contract";
import type { Register } from "@/lib/register";

import ChallengeSlot from "./ChallengeSlot";
import HomeMasthead from "./HomeMasthead";
import TopInTheClub from "./TopInTheClub";
import TodayIn30 from "./TodayIn30";
import YourSignals from "./YourSignals";
import PresenceRow from "./PresenceRow";
import BoardLedger from "./BoardLedger";
import YouStrip from "./YouStrip";
import ActionBand, { buildActionQueue, type ActionItem } from "@/components/club2/ActionBand";
import { LiveEventCard, LiveNowStrip } from "@/components/live";

/**
 * CLUB HOME — canvas v2, board 01.
 *
 * LIGHT PRIMARY, and now composed to the canvas's own rhythm. Board 01 reads
 * top-to-bottom as: who you are → what the club is on → the day in one
 * paragraph → what moved on YOUR tickers → where you stand. This surface is that
 * board, built from the L0 primitives and our own law objects.
 *
 * Composition, top to bottom:
 *
 *   ·  ChallengeSlot            — preserved law, only during an active pass
 *   ·  LIVE NOW strip           — preserved law, only when a room is on the air
 *   1  masthead                 — greeting eyebrow · one display headline with a
 *                                 DRAWN accent word · the canvas's orienting line
 *   2  TOP IN THE CLUB          — the dense ranked TILE STRIP (canvas §1.3)
 *   3  TODAY IN 30 SECONDS      — Kai's read on the warm brand-tinted field
 *   4  ACT ON THIS              — the full-bleed orange band, ESCALATION ONLY
 *   5  YOUR SIGNALS             — your watched tickers, as a hairline ledger
 *   6  member presence          — faces + one plain sentence about the room
 *   7  WHERE THE CLUB STANDS    — the ledger, stance lens, lime sentiment
 *   8  one primary action       — the single orange button on the surface
 *   ·  live_event rooms         — preserved law, canvas-styled
 *   9  YOU                      — belt + XP, the board's closing object
 *   ·  Keep learning            — preserved law, the shared ContinuePath object
 *
 * WHAT CHANGED IN THIS PASS, and why:
 *
 *   · The swipeable score-card carousel became the canvas's dense ranked strip.
 *     One screen now carries five to ten tickers instead of one and a half, the
 *     swipe stops being load-bearing, and the score dial — the app's only gauge —
 *     stays alive on /discover, which still renders the carousel.
 *   · The Kai brief was promoted out of the orange band into its own field.
 *     It was previously rendered as ~40 characters of pill text, which is the
 *     worst possible presentation for the single richest paragraph on Home.
 *   · The band therefore stops carrying Kai and becomes pure ESCALATION: it
 *     renders only when something has actually fired. A band that is always
 *     there is a band nobody reads, and the "never dead" fallback chip it used
 *     to carry now duplicates the field above it. Orange presence on the
 *     surface is guaranteed by the primary action button regardless.
 *   · YOUR SIGNALS and YOU are new objects, both on real reads (the watchlist
 *     delta feed and `xp_for_users`).
 *
 * NO generic card containers and no equal-column card grids: every object earns
 * identity from a field (the tile ground, the brief field, the orange band), a
 * rule (ledgers, presence, the belt strip) or the type scale (masthead).
 *
 * KID REGISTER keeps the safe subset: sentiment signals are stripped from the
 * brief BEFORE it reaches the field, YourSignals drops sentiment lines, the
 * ledger drops its stance bar, presence goes faceless, and the alert feed — an
 * adult trading object — is never fetched.
 *
 * REAL DATA ONLY. Every count-bearing surface is floor-aware and renders
 * founding-era copy or an em-dash where a metric is absent; nothing is invented.
 *
 * THEMES. The surface is built from semantic tokens (paper / ink / soft / sand /
 * card) plus the foundation classes, so it flips with :root[data-theme="dark"]
 * for free. The light system's trick — a DARK object on a CREAM page — inverts
 * at night, and the foundation handles that: .f0-tile-field, .f0-brief-field and
 * .club2-band each become LIFTED warm surfaces above the obsidian page rather
 * than wells sunk into it. Nothing here hand-rolls a dark surface. The only
 * theme-invariant colours are the law colours: orange (brand/action), lime
 * (sentiment), kai blue (Kai) and green/red (price) keep their MEANING in both
 * themes and move only along their own ramps for legibility.
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
 * before a single sentiment line can reach the field.
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
  xp = null,
  preview,
  seedPromise,
  briefPromise,
}: {
  firstName?: string;
  register: Register;
  learning: LearningPickup | null;
  challengeExpiresAt?: string | null;
  /** Lifetime XP for the closing belt strip. null = unavailable, not zero. */
  xp?: number | null;
  /** design-review only — force fixtures + a scale state (guarded to dev/preview) */
  preview?: { fixtures: boolean; scale: ClubScale };
  /**
   * SERVER SEED (the empty-first fix). The /dashboard server component builds
   * the club payload with the same assembler the API route uses and hands the
   * PROMISE across the RSC boundary; `use()` suspends this component until it
   * resolves, so what streams in is already populated — the founding branches
   * are never rendered on the way there. Omitted on the fixtures/preview path
   * and on client navigation, where the hook's own fetch is the fallback.
   *
   * It is guaranteed non-rejecting (buildClubHomeSeedSplit catches), so `use()`
   * here can never throw into an error boundary.
   */
  seedPromise?: Promise<ClubHomeSeed | null>;
  /**
   * The brief, on its OWN boundary. Split out of the seed because it alone cost
   * ~2.9s and was gating the other eight sections. When present it is the sole
   * source of the brief; when absent (client navigation, fixtures) the hook's
   * batched fetch supplies it exactly as before.
   */
  briefPromise?: Promise<unknown>;
}) {
  const isKid = register === "kid";

  // `use()` is legal in a conditional — and `seedPromise` is either always or
  // never present for a given mount, so the branch is stable.
  const seed = seedPromise ? use(seedPromise) : null;

  // `loading` matters: without a seed the club data is client-fetched, so
  // `trending` is null through SSR and the first client paint. Handed to each
  // section so it can tell "still arriving" apart from "the club has nothing" —
  // without it every load rendered the founding empty state first. With a seed,
  // `loading` is false from the very first render because the data is here.
  const { data, loading, usingFixtures } = useClubData({
    fixtures: preview?.fixtures,
    scale: preview?.scale,
    seed,
  });

  // live_events (S2.5 object). Kid register never sees adult live rooms; the
  // endpoint 404s until S2.5 lands, so live mode simply renders nothing.
  const liveEvents = useLiveEvents({ fixtures: preview?.fixtures, scale: preview?.scale });
  const showLive = !isKid && liveEvents.length > 0;
  const primaryLive = showLive ? primaryLiveEvent(liveEvents) : null;
  const liveNow = primaryLive && isEventUrgent(primaryLive) ? primaryLive : null;
  // Cards in the live tier: the upcoming/live/replay rooms (LIVE NOW already
  // carries the single most urgent one, so the tier shows the rest as objects).
  const liveTierEvents = showLive
    ? liveEvents.filter((e) => e.id !== liveNow?.id).slice(0, 3)
    : [];

  // No tier/entitlement walls here: ClubHomeV2 is only reached by NON-FREE solo
  // members (free short-circuits to FreeHome upstream in dashboard/page.tsx), so
  // every viewer passes trending_full / foryou_deep / kai_brief. The kid register
  // axis is still enforced below (sentiment strips + kid-walled objects).

  // Kid-safe subset for the FALLBACK brief path (no briefPromise). The seeded
  // path is walled inside BriefField instead.
  const fallbackBrief =
    isKid && data.brief
      ? { ...data.brief, items: data.brief.items.filter((i) => i.kind !== "sentiment") }
      : data.brief;

  // ── board-size diagnostic (dev / vercel preview ONLY, never production) ────
  const trendingRows = data.trending?.rows?.length ?? 0;
  useEffect(() => {
    if (loading || !fixturesAllowed()) return;
    console.info(
      `[ClubHome] trending rows=${trendingRows}` +
        ` totalCount=${data.trending?.totalCount ?? "n/a"}` +
        ` locked=${data.trending?.locked ?? false}` +
        ` → strip renders ${Math.min(trendingRows, 10)} tile(s)`
    );
  }, [loading, trendingRows, data.trending?.totalCount, data.trending?.locked]);

  // ── the action band's priority queue ──────────────────────────────────────
  // P1 alert   — WIRED to the setup lifecycle (confirmed setups only).
  // P2 Kai     — DELIBERATELY NOT HERE ANY MORE. The brief now has its own field
  //              above the band, where a paragraph can read as a paragraph; a
  //              chip repeating it would be the same sentence twice.
  // P3 catalyst— NO SOURCE EXISTS. There is no earnings or economic calendar in
  //              this app (Polygon financials report what has been FILED, not
  //              what is scheduled), so the slot stays honest instead of
  //              inventing dates.
  // P4 mission — NO SOURCE EXISTS. `club_missions` is not in this tree and
  //              `fic_missions` is the FAMILY/kid ladder — the wrong register.
  //
  // With nothing fired the queue is EMPTY and the band does not render at all.
  // That is the intent: the band is an escalation, and a permanent orange strip
  // carrying a standing suggestion is exactly the thing members stop seeing. The
  // surface's orange presence is carried by the primary action button below.
  const alert = useLiveAlert(!isKid && !usingFixtures);
  const items: ActionItem[] = buildActionQueue({
    alert,
    brief: null,
    catalysts: [],
    mission: null,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-7 pb-16 lg:max-w-3xl">
      {usingFixtures && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-50 rounded-full border border-volt-500/40 bg-card/95 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-gold-700 shadow-soft">
          fixtures · {preview?.scale ?? "scale"} · {register}
        </div>
      )}

      {/* §12 Challenge slot — high priority, only during an active pass (preserved law) */}
      <ChallengeSlot challengeExpiresAt={challengeExpiresAt} />

      {/* LIVE NOW (amendment #2): a live/starting room is urgent, above all
          (preserved law) */}
      {liveNow && <LiveNowStrip event={liveNow} />}

      {/* 1 — greeting, the one display voice, and the orienting line */}
      <HomeMasthead firstName={firstName} trending={data.trending} />

      {/* 2 — the dense ranked strip (canvas board 01's first content object) */}
      <TopInTheClub trending={data.trending} loading={loading} isKid={isKid} />

      {/* 3 — the day's read. Its own Suspense boundary when seeded, so the ~2.9s
          brief never gates the eight sections around it. */}
      {briefPromise ? (
        <Suspense fallback={<TodayIn30 loading />}>
          <BriefField promise={briefPromise} isKid={isKid} />
        </Suspense>
      ) : (
        <TodayIn30 brief={fallbackBrief} loading={loading} />
      )}

      {/* 4 — the full-bleed orange band. Escalation only; no price ever lands here. */}
      <ActionBand items={items} />

      {/* 5 — what moved on YOUR tickers */}
      <YourSignals foryou={data.foryou} isKid={isKid} loading={loading} />

      {/* 6 — who else is in the room */}
      <PresenceRow collective={data.collective} isKid={isKid} loading={loading} />

      {/* 7 — the hairline ledger */}
      <BoardLedger trending={data.trending} isKid={isKid} loading={loading} />

      {/* 8 — the single primary action. Orange in both themes; dark steps to
          volt-600 for the same reason .club2-band does (no glare against a
          near-black page) — the hue never softens, it only loses luminance.
          `text-white` here is deliberately theme-invariant: it is the system's
          declared on-accent colour (--accent-on: #FFFFFF) and matches the
          band's own white-on-orange. */}
      <Link
        href="/discover"
        className="f0-grain f0-focus relative flex w-full items-center justify-between gap-3 rounded-full bg-volt-500 px-6 py-4 shadow-soft transition-transform active:scale-[0.99] dark:bg-volt-600"
      >
        <span className="font-display text-[16px] font-extrabold tracking-tight text-white">
          {isKid ? "Explore the board" : "Add your read to the board"}
        </span>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-white" aria-hidden />
      </Link>

      {/* live_event rooms — canvas-styled additions when rooms are on air
          (preserved law: live_event cards) */}
      {liveTierEvents.length > 0 && (
        <EditorialSection title="Live in the Club" divide>
          <div className="grid gap-4 sm:grid-cols-2">
            {liveTierEvents.map((e) => (
              <LiveEventCard key={e.id} event={e} />
            ))}
          </div>
        </EditorialSection>
      )}

      {/* 9 — YOU: the board's closing object (canvas board 01) */}
      <YouStrip xp={xp} isKid={isKid} />

      {/* Keep learning — the shared ContinuePath object (amendment #3): Learn
          stays reachable for adults through this contextual object (preserved law). */}
      <ContinuePath pickup={learning} />
    </div>
  );
}
