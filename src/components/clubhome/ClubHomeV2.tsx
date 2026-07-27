"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { useClubData, fixturesAllowed } from "@/lib/clubhome/client";
import { useLiveEvents, primaryLiveEvent, isEventUrgent } from "@/lib/clubhome/live-events";
import { useLiveAlert } from "@/lib/clubhome/alerts";
import ContinuePath from "@/components/learn/ContinuePath";
import { EditorialSection } from "@/components/grammar";
import type { ClubScale } from "@/lib/clubhome/contract";
import type { Register } from "@/lib/register";

import ChallengeSlot from "./ChallengeSlot";
import HomeMasthead from "./HomeMasthead";
import PresenceRow from "./PresenceRow";
import BoardLedger from "./BoardLedger";
import TickerCarousel from "@/components/club2/TickerCarousel";
import ActionBand, { buildActionQueue, type ActionItem } from "@/components/club2/ActionBand";
import { LiveEventCard, LiveNowStrip } from "@/components/live";

/**
 * CLUB HOME — the canvas surface.
 *
 * LIGHT PRIMARY. The screen is warm sand, and its structure is a sandwich:
 * cream content → ONE full-bleed orange action band → cream content. Orange is
 * brand and action only; it never carries a price, because a percentage on an
 * orange field is illegible (proven three times in review).
 *
 * Composition, top to bottom:
 *
 *   ·  ChallengeSlot            — preserved law, only during an active pass
 *   ·  LIVE NOW strip           — preserved law, only when a room is on the air
 *   1  greeting                 — tracked uppercase eyebrow, no "gm"
 *   2  display headline         — text-display-1, one volt accent word, drawn underline
 *   3  WHAT THE CLUB IS SEEING  — the score-led ticker carousel
 *   4  ACT ON THIS              — full-bleed orange priority queue
 *   5  member presence          — faces + one plain sentence about the room
 *   6  the ledger               — hairline-ruled board, stance lens, lime sentiment
 *   7  one primary action       — the single orange button on the surface
 *   ·  live_event rooms         — preserved law, canvas-styled
 *   ·  Keep learning            — preserved law, the shared ContinuePath object
 *
 * NO generic card containers and no equal-column card grids: every object earns
 * identity from a field (carousel card, orange band), a rule (ledger, presence
 * row), or the type scale (masthead).
 *
 * KID REGISTER keeps the safe subset: sentiment signals are stripped from the
 * data BEFORE it reaches any child (pulse / brief / foryou below), the ledger
 * drops its stance bar, presence goes faceless, and the alert feed — an adult
 * trading object — is never fetched.
 *
 * REAL DATA ONLY. Every count-bearing surface is floor-aware and renders
 * founding-era copy or an em-dash where a metric is absent; nothing is invented.
 *
 * THEMES. The surface is built from semantic tokens (paper / ink / soft / sand /
 * card) plus the foundation classes, so it flips with :root[data-theme="dark"]
 * for free. The light system's trick — a DARK object on a CREAM page — inverts
 * at night, and the foundation handles that: .club2-card and .f0-hero-field
 * become LIFTED warm surfaces above the obsidian page rather than wells sunk
 * into it. Nothing here hand-rolls a dark surface. The only theme-invariant
 * colours are the law colours: orange (brand/action), lime (sentiment) and
 * green/red (price) keep their MEANING in both themes and move only along their
 * own ramps for legibility.
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
  firstName?: string;
  register: Register;
  learning: LearningPickup | null;
  challengeExpiresAt?: string | null;
  /** design-review only — force fixtures + a scale state (guarded to dev/preview) */
  preview?: { fixtures: boolean; scale: ClubScale };
}) {
  const isKid = register === "kid";

  // `loading` matters: the club data is client-fetched, so `trending` is null
  // through SSR and the first client paint. Handed to the carousel so it can
  // tell "still arriving" apart from "the club has ranked nothing" — without it
  // every load rendered the founding empty-state card.
  const { data, loading, usingFixtures } = useClubData({
    fixtures: preview?.fixtures,
    scale: preview?.scale,
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

  // Kid-safe subset: sentiment display is kid-walled — strip sentiment signals/
  // items from the surfaces kids DO see so no bull/bear read reaches them.
  const pulse = isKid && data.pulse
    ? { ...data.pulse, signals: data.pulse.signals.filter((s) => s.kind !== "sentiment") }
    : data.pulse;
  const brief = isKid && data.brief
    ? { ...data.brief, items: data.brief.items.filter((i) => i.kind !== "sentiment") }
    : data.brief;

  // ── board-size diagnostic (dev / vercel preview ONLY, never production) ────
  // Answers "how many rows actually reach the carousel with real data" without
  // needing a DB session: the ledger is capped server-side at 12 (free: 5) and
  // the carousel renders at most 6 of them.
  const trendingRows = data.trending?.rows?.length ?? 0;
  useEffect(() => {
    if (loading || !fixturesAllowed()) return;
    console.info(
      `[ClubHome] trending rows=${trendingRows}` +
        ` totalCount=${data.trending?.totalCount ?? "n/a"}` +
        ` locked=${data.trending?.locked ?? false}` +
        ` → carousel renders ${Math.min(trendingRows, 6)} card(s)`
    );
  }, [loading, trendingRows, data.trending?.totalCount, data.trending?.locked]);

  // ── the action band's priority queue ──────────────────────────────────────
  // P1 alert   — WIRED to the setup lifecycle (confirmed setups only).
  // P2 Kai     — WIRED to the club brief (already kid-stripped above).
  // P3 catalyst— NO SOURCE EXISTS. An earnings/econ calendar is a new dependency;
  //              passing [] keeps the slot honest instead of inventing dates.
  // P4 mission — NO SOURCE EXISTS. `club_missions` (migrations 180/181) is not in
  //              this tree (migrations stop at 177) and there is no client route
  //              for it; `fic_missions` is the FAMILY/kid ladder and is the wrong
  //              register for the Club band. Passing null.
  const alert = useLiveAlert(!isKid && !usingFixtures);
  const queue: ActionItem[] = buildActionQueue({
    alert,
    brief,
    catalysts: [],
    mission: null,
  });
  // Never a dead band: with no alert and a degraded brief there is still one
  // true thing a member can act on. This is an ACTION, not a fabricated metric.
  const items: ActionItem[] = queue.length
    ? queue
    : [{ id: "kai-fallback", kind: "kai", text: "Ask Kai what moved today", href: "/kai" }];

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

      {/* 1 + 2 — greeting and the one display voice on the surface */}
      <HomeMasthead firstName={firstName} trending={data.trending} />

      {/* 3 — what the club is seeing */}
      <TickerCarousel trending={data.trending} pulse={pulse} loading={loading} />

      {/* 4 — the full-bleed orange band. Actions only; no price ever lands here. */}
      <ActionBand items={items} />

      {/* 5 — who else is in the room */}
      <PresenceRow collective={data.collective} isKid={isKid} />

      {/* 6 — the hairline ledger */}
      <BoardLedger trending={data.trending} isKid={isKid} />

      {/* 7 — the single primary action. Orange in both themes; dark steps to
          volt-600 for the same reason .club2-band does (no glare against a
          near-black page) — the hue never softens, it only loses luminance.
          `text-white` here is deliberately theme-invariant: it is the system's
          declared on-accent colour (--accent-on: #FFFFFF) and matches the
          band's own white-on-orange. */}
      <Link
        href="/discover"
        className="f0-grain relative flex w-full items-center justify-between gap-3 rounded-full bg-volt-500 px-6 py-4 shadow-soft transition-transform active:scale-[0.99] dark:bg-volt-600"
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

      {/* Keep learning — the shared ContinuePath object (amendment #3): Learn
          stays reachable for adults through this contextual object (preserved law). */}
      <ContinuePath pickup={learning} />
    </div>
  );
}
