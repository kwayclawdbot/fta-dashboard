"use client";

import { useRef, useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { m, useReducedMotion } from "@/lib/motion";
import {
  Video,
  Play,
  Lock,
  BookOpen,
  Check,
  CalendarCheck,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, hasXpForRef } from "@/lib/xp";
import {
  canAccessSessionEffective,
  getFamilyTierState,
  type FamilyTier,
  type SessionTier,
} from "@/lib/tier";
import TierBadge from "@/components/TierBadge";
import { BoardSection } from "@/components/clubhome/board";
import RecordingPlayerModal from "@/components/live/RecordingPlayerModal";
import {
  resolveRecordingKind,
  type RecordingKind,
} from "@/lib/recordings";

/**
 * LIVE — board 07 "LIVE ROOMS", transcribed.
 *
 * The board reads top to bottom as FOUR objects and nothing else:
 *
 *   1  (•) LIVE           — the live-dot glyph beside one Sora black display word
 *   2  NOW LIVE / UPCOMING / REPLAYS — a filter PILL row. Orange fill on the
 *                           active pill, white card + hairline on the rest.
 *   3  the live hero      — a dark diagonal-striped field: room title in white
 *                           display caps, "Live now · N", one line of copy, an
 *                           orange JOIN ROOM button, a circled script "live!"
 *                           mark on the right.
 *   4  UPCOMING SESSIONS  — white cards: photo tile, title, when-line, host-line,
 *      / RECENT REPLAY      a hairline action on the right; and the replay card
 *                           with its black play tile and a plain orange WATCH.
 *
 * WHAT WAS REMOVED. The previous pass built this surface out of the hairline
 * ledger vocabulary — `f0-ledger` rows, `f0-section-rule` markers, a `f0-rule-top`
 * entitlement notice and a `SegmentedRail` underscore rail. That was the previous
 * VERSION of the design system, not this one. Every one of those is gone: the
 * schedule is cards, the section markers are `BoardSection` tracked mono caps, and
 * the two one-of-N controls are pill rows.
 *
 * WHAT THE BOARD DRAWS AND WE STILL DO NOT: a photographed room, a stage, a raise
 * hand, a room chat and "2,341 in room". None of those has a write path.
 * `live_sessions` + `session_rsvps` carry a schedule, a Zoom link and an RSVP — so
 * the only two controls drawn are the two that persist: RSVP (which also awards
 * XP) and Join (which opens Zoom). The board's "N in room" becomes the RSVP count,
 * which is a number we actually hold, and the ON STAGE ring row becomes the real
 * RSVP'd roster. Drawing a mic that does nothing is worse than not drawing it.
 *
 * BOARD 08 ("IN THE ROOM") has no in-room state to take here — this surface never
 * hosts the room, Zoom does. Its vocabulary lands on the one dark object that IS
 * here: the live hero wears board 08's `• LIVE` pill, its ON STAGE avatar ring row
 * with the host ringed in orange, and its near-black ground.
 *
 * HOST HONESTY (migration 198): `live_sessions` carries host_name / host_title /
 * host_avatar_url, and a class with no host on the record renders NO host line.
 *
 * COLOUR LAW: green/red are PRICE and appear nowhere here. Live and every action
 * ride --accent-solid (gold in Family Mode, volt orange in Club, metallic on the
 * FTA desk), so the live signal is mode-correct for free. Orange FILLS carry
 * --accent-on, never text-ink or a hardcoded white.
 *
 * WIRING UNTOUCHED: the Zoom join link, the RSVP insert/delete + XP award + the
 * push-enrolment nudge, the Supabase session/RSVP reads, tier + track gating via
 * the central access matrix, and the recording player (which owns its own XP).
 */

// ── Types ──

type Track = "kids" | "teens" | "adults" | "all";

interface LiveSession {
  id: string;
  title: string;
  description: string;
  /** From the record (migration 198). null = unknown → no host line is drawn. */
  host: string | null;
  hostTitle: string | null;
  hostAvatarUrl: string | null;
  scheduledAt: string;
  scheduledIso: string | null;
  durationMin: number;
  track: Track;
  status: "live" | "upcoming" | "completed";
  minTier: SessionTier;
  zoomUrl?: string;
  recordingUrl?: string;
  recordingPath?: string;
  recordingKind: RecordingKind | null;
  classType: ClassType | null;
  worksheetUrl?: string;
  assignment?: string;
}

type ClassType =
  | "weekly_class"
  | "guest_speaker"
  | "orientation"
  | "parent_qa"
  | "kids_money_lab"
  | "market_recap";

// FIC class-type grouping/labels. Order here drives the grouped UI order.
const CLASS_TYPE_CONFIG: Record<ClassType, { label: string }> = {
  weekly_class: { label: "Weekly Family Stock Class" },
  kids_money_lab: { label: "Kids Money Lab" },
  parent_qa: { label: "Parent Q&A" },
  guest_speaker: { label: "Guest Speaker" },
  market_recap: { label: "Market Recap" },
  orientation: { label: "Orientation" },
};

const CLASS_TYPE_ORDER: ClassType[] = [
  "weekly_class",
  "kids_money_lab",
  "parent_qa",
  "guest_speaker",
  "market_recap",
  "orientation",
];

interface Access {
  isChild: boolean;
  userTrack: Track;
  tier: FamilyTier;
  clubLapsed: boolean;
}

/** A real RSVP'd member, for the room roster. */
interface RosterMember {
  id: string;
  name: string;
  initials: string;
}

/** Track labels only — the old per-track colour chips added four accent ramps to
 *  a surface that needs one. Track reads as a mono label in the card meta. */
const TRACK_LABEL: Record<Track, string> = {
  kids: "Kids Corner",
  teens: "Teens",
  adults: "Parents & Adults",
  all: "Whole Family",
};

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "M"
  );
}

// ── Bits ──

/**
 * The board's `(•)` heading glyph — a ringed dot beside the display word. The
 * inner dot goes to the accent (and pulses) ONLY when a class is genuinely on
 * air, so the mark is a live indicator rather than decoration.
 */
function LiveGlyph({ on }: { on: boolean }) {
  return (
    <span
      className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-[2.5px] border-ink sm:h-8 sm:w-8"
      aria-hidden
    >
      <span className="relative flex h-[7px] w-[7px] items-center justify-center">
        {on && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
        )}
        <span
          className={`relative inline-flex h-[7px] w-[7px] rounded-full ${
            on ? "bg-accent" : "bg-ink"
          }`}
        />
      </span>
    </span>
  );
}

/**
 * The board's filter pill row. NOT a segmented widget and NOT a tab rail with an
 * underscore — those were the previous version. Active = solid accent fill with
 * the declared on-accent foreground; resting = the plain white board card with
 * its hairline. Real tabs over real panels, so tablist/tab semantics with a
 * roving tab stop and arrow keys.
 */
function ViewPills({
  value,
  onChange,
}: {
  value: TabType;
  onChange: (t: TabType) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const TABS: { id: TabType; label: string }[] = [
    { id: "live", label: "Now live" },
    { id: "upcoming", label: "Upcoming" },
    { id: "recordings", label: "Replays" },
  ];
  const index = Math.max(0, TABS.findIndex((t) => t.id === value));

  function move(delta: number) {
    const next = (index + delta + TABS.length) % TABS.length;
    onChange(TABS[next].id);
    railRef.current
      ?.querySelectorAll<HTMLButtonElement>("[data-pill]")
      ?.[next]?.focus();
  }

  return (
    <div
      ref={railRef}
      role="tablist"
      aria-label="Live class views"
      /* py-1/-my-1: the 2px-offset focus ring would otherwise be clipped by the
         scroll box, and the negative margin keeps the row where it was. */
      className="club2-track -my-1 flex gap-2 overflow-x-auto py-1"
    >
      {TABS.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            data-pill
            role="tab"
            type="button"
            id={`live-tab-${t.id}`}
            aria-selected={on}
            aria-controls={`live-panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(-1);
              }
            }}
            className={`f0-focus f0-press shrink-0 px-4 py-2.5 font-display text-[12.5px] font-extrabold uppercase tracking-[0.08em] transition-colors ${
              on
                ? "rounded-[14px] bg-accent text-[color:var(--accent-on)]"
                : "club-b-card text-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The secondary track filter. Deliberately a step quieter than the view pills —
 * same pill geometry at a smaller measure, and the chosen one takes the shared
 * selection chip's ink flip rather than a second orange fill, so the surface only
 * ever has ONE orange control row. radiogroup/radio + roving tab stop, because
 * this filters a panel rather than switching between them.
 */
function TrackPills({
  value,
  onChange,
}: {
  value: Track;
  onChange: (t: Track) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const OPTIONS: { id: Track; label: string }[] = [
    { id: "all", label: "All" },
    { id: "kids", label: "Kids" },
    { id: "teens", label: "Teens" },
    { id: "adults", label: "Adults" },
  ];
  const index = Math.max(0, OPTIONS.findIndex((o) => o.id === value));

  function move(delta: number) {
    const next = (index + delta + OPTIONS.length) % OPTIONS.length;
    onChange(OPTIONS[next].id);
    railRef.current
      ?.querySelectorAll<HTMLButtonElement>("[data-track]")
      ?.[next]?.focus();
  }

  return (
    <div
      ref={railRef}
      role="radiogroup"
      aria-label="Filter classes by track"
      className="club2-track -my-1 flex gap-1.5 overflow-x-auto py-1"
    >
      {OPTIONS.map((o, i) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            data-track
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === index ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(-1);
              }
            }}
            className={`f0-chip f0-focus f0-press shrink-0 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${
              on ? "f0-chip-on" : "text-soft hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Board 08's ON STAGE row, honest. These are the members who actually pressed
 * RSVP; there is no attendance table, so nothing here claims anyone is
 * "listening". With no resolved names the stack degrades to nothing rather than
 * posing as a crowd.
 */
function RosterStack({ members, total }: { members: RosterMember[]; total: number }) {
  if (members.length === 0) return null;
  const shown = members.slice(0, 5);
  const rest = total - shown.length;
  return (
    <span className="flex items-center gap-3">
      {/* The ring must match the surface BEHIND the stack so it reads as a
          cut-out. This stack sits on the dark island in both themes, so the ring
          is pinned to that ground rather than the page's --paper. */}
      <span className="f0-stack" style={{ ["--f0-stack-ring" as string]: "#04060C" }}>
        {shown.map((mem) => (
          <span
            key={mem.id}
            title={mem.name}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 font-display text-[10px] font-extrabold"
          >
            {mem.initials}
          </span>
        ))}
        {rest > 0 && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 font-mono text-[9px] font-semibold">
            +{rest}
          </span>
        )}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-60">
        {total} RSVP&apos;d
      </span>
    </span>
  );
}

/**
 * THE LIVE HERO — board 07's dark diagonal-striped field, and the only dark
 * object on this surface. The board fills the right of it with a photographed
 * room; production has no room capture, so the field carries the class identity,
 * the real host (board 08's orange HOST ring), the real roster and the one
 * control that works.
 *
 * NOT A PAPER CARD: it is the sanctioned dark island, with the stripes laid over
 * it as an inline repeating gradient plus a warm accent wash, so no new CSS class
 * is needed and both themes get the same field (a dark island is dark in both by
 * design — it is the strongest value contrast the warm paper ground can carry).
 * Nothing here moves except the live dot, which is `motion-safe:` gated.
 */
function LiveHero({
  session,
  roster,
  rosterTotal,
}: {
  session: LiveSession;
  roster: RosterMember[];
  rosterTotal: number;
}) {
  // The island is the loudest object on the surface, so its entry is the one
  // that most needs to not happen when the viewer has asked for stillness. The
  // stripes are static and the only other motion (the live dot) is CSS-gated.
  const reduce = useReducedMotion();
  return (
    <m.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="night-island f0-grain relative isolate"
    >
      {/* The board's diagonal stripe field + a warm wash so the island reads as
          the brand's dark, not a cold terminal. Presentational only. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 11px, transparent 11px, transparent 28px), radial-gradient(120% 120% at 18% 0%, color-mix(in srgb, var(--accent-solid) 16%, transparent) 0%, transparent 62%)",
        }}
      />

      <div className="relative flex flex-col gap-6 px-5 py-6 sm:flex-row sm:items-end sm:px-7 sm:py-7">
        <div className="min-w-0 flex-1">
          {/* Board 08's pill: a dot, the word, nothing else. No elapsed timer —
              a ticking clock would mean reading the wall clock every second. */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-on)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-70 motion-safe:animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            Live
          </span>

          <h2 className="mt-3.5 max-w-xl font-display text-display-2 font-extrabold uppercase leading-[0.98]">
            {session.title}
          </h2>

          <p className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.12em] opacity-70">
            Live now
            {rosterTotal > 0 && <> · {rosterTotal} RSVP&apos;d</>} ·{" "}
            {session.durationMin} min · {TRACK_LABEL[session.track]}
          </p>

          {session.description && (
            <p className="mt-3 max-w-md text-[13.5px] leading-relaxed opacity-80">
              {session.description}
            </p>
          )}

          {/* ON STAGE — the host ringed in accent exactly as board 08 draws it,
              then the real RSVP'd roster. A class with no host on the record
              draws no host block; never a placeholder name. */}
          {(session.host || roster.length > 0) && (
            <div className="mt-5">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent">
                On stage
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-3">
                {session.host && (
                  <span className="flex items-center gap-2.5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 font-display text-[13px] font-extrabold ring-2 ring-[color:var(--accent-solid)]">
                      {initialsOf(session.host)}
                    </span>
                    <span>
                      <span className="block text-[13.5px] font-semibold">
                        {session.host}
                      </span>
                      <span className="block font-mono text-[9.5px] uppercase tracking-[0.16em] text-accent">
                        {session.hostTitle || "Host"}
                      </span>
                    </span>
                  </span>
                )}
                <RosterStack members={roster} total={rosterTotal} />
              </div>
            </div>
          )}

          <div className="mt-6">
            {session.zoomUrl ? (
              <a
                href={session.zoomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="f0-focus f0-press inline-flex items-center gap-2 rounded-[12px] bg-accent px-5 py-3 font-display text-[14px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
              >
                <Video className="h-4 w-4" />
                Join room
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <p className="max-w-md text-[13.5px] leading-relaxed opacity-85">
                The join link hasn&apos;t been posted yet — refresh in a moment or
                check your email.
              </p>
            )}
            <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] opacity-55">
              Opens in Zoom · the recording is posted here afterwards
            </p>
          </div>
        </div>

        {/* The board's circled script mark. Sora italic is the closest thing the
            app's three families carry — see CSS NEEDS in the lane report. */}
        <span
          aria-hidden
          className="hidden shrink-0 self-center sm:grid sm:h-[124px] sm:w-[124px] sm:place-items-center sm:rounded-full sm:border-[2.5px] sm:border-[color:var(--accent-solid)]"
        >
          <span className="font-display text-[26px] font-extrabold italic tracking-tight text-accent">
            live!
          </span>
        </span>
      </div>
    </m.section>
  );
}

/** The board's photo slot. We hold no session imagery, so the tile is a plain
 *  sand square with the medium's own glyph — obviously a placeholder, never a
 *  stand-in for a picture that exists. */
function SessionTile() {
  return (
    <span
      className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[10px] bg-sand"
      aria-hidden
    >
      <Video className="h-4 w-4 text-soft" />
    </span>
  );
}

/**
 * UPCOMING SESSION — board 07's white card: tile, title, when-line, host-line,
 * and the hairline action on the right.
 *
 * The board's word for that action is "Set Reminder". Ours stays RSVP / Going,
 * because the write behind it does more than remind: it counts the member's
 * family as going (the card says so underneath) and it awards XP. Relabelling it
 * would make the card contradict itself.
 */
function UpcomingCard({
  session,
  when,
  locked,
  lockReason,
  rsvp,
  onRsvp,
}: {
  session: LiveSession;
  when: string;
  locked: boolean;
  lockReason?: string;
  rsvp?: { count: number; going: boolean };
  onRsvp?: () => void;
}) {
  const families = rsvp?.count ?? 0;
  const going = rsvp?.going ?? false;

  return (
    <div
      className={`club-b-card flex items-start gap-3 px-3 py-3 ${
        locked ? "opacity-60" : ""
      }`}
    >
      <SessionTile />

      <div className="min-w-0 flex-1">
        <h4 className="font-display text-[14.5px] font-bold leading-snug tracking-tight text-ink">
          {session.title}
        </h4>
        <p className="mt-1 font-mono text-[11px] tabular-nums text-soft">{when}</p>
        {session.host && (
          <p className="mt-0.5 truncate text-[12px] text-soft">w/ {session.host}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-soft">
          <span>{session.durationMin} min</span>
          <span>{TRACK_LABEL[session.track]}</span>
          {onRsvp && families > 0 && (
            <span className="text-accent">
              {families} famil{families === 1 ? "y" : "ies"} going
            </span>
          )}
          {session.minTier === "academy" && <TierBadge tier="fta" size="xs" />}
        </div>

        {(session.worksheetUrl || session.assignment) && (
          <div className="mt-2 space-y-1">
            {session.worksheetUrl && (
              <a
                href={session.worksheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="f0-focus inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent"
              >
                <BookOpen className="h-3 w-3" />
                Worksheet
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {session.assignment && (
              <p className="max-w-prose text-[11.5px] leading-relaxed text-soft">
                <span className="font-semibold text-ink">Assignment: </span>
                {session.assignment}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 self-center">
        {locked ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-soft"
            title={lockReason}
          >
            <Lock className="h-3 w-3" />
            {lockReason || "Locked"}
          </span>
        ) : onRsvp ? (
          <button
            onClick={onRsvp}
            aria-pressed={going}
            className={`f0-focus f0-press inline-flex items-center gap-1.5 rounded-[14px] px-3 py-2 text-[12.5px] font-semibold transition-colors ${
              going
                ? "bg-accent text-[color:var(--accent-on)]"
                : "club-b-card text-ink hover:text-accent"
            }`}
          >
            {going ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Going
              </>
            ) : (
              <>
                <CalendarCheck className="h-3.5 w-3.5" />
                RSVP
              </>
            )}
          </button>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">
            TBA
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * RECENT REPLAY — board 07's white card with a black square play tile and a
 * plain orange WATCH. The tile's near-black is pinned rather than taken from
 * --ink, because --ink inverts between themes and a play tile that turns cream
 * in dark stops being a play tile.
 */
function ReplayCard({
  session,
  when,
  locked,
  lockReason,
  onWatch,
}: {
  session: LiveSession;
  when: string;
  locked: boolean;
  lockReason?: string;
  onWatch?: () => void;
}) {
  const hasRecording = session.recordingKind !== null;
  const meta = [
    `${session.durationMin} min`,
    TRACK_LABEL[session.track],
    when,
  ].join(" · ");

  const watchClass =
    "f0-focus f0-press inline-flex items-center gap-1.5 font-display text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-accent";

  return (
    <div
      className={`club-b-card flex items-center gap-3 px-3 py-3 ${
        locked ? "opacity-60" : ""
      }`}
    >
      <span
        className="club-b-tile h-[54px] w-[54px] shrink-0"
        style={
          {
            borderRadius: 10,
            "--tile-bg": "#141216",
            "--tile-fg": "#F4F0EC",
          } as React.CSSProperties
        }
        aria-hidden
      >
        <Play className="h-4 w-4" fill="currentColor" />
      </span>

      <div className="min-w-0 flex-1">
        <h4 className="font-display text-[14.5px] font-bold leading-snug tracking-tight text-ink">
          {session.title}
        </h4>
        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] tabular-nums text-soft">
          {meta}
        </p>
        {session.minTier === "academy" && (
          <span className="mt-1.5 inline-flex">
            <TierBadge tier="fta" size="xs" />
          </span>
        )}
      </div>

      <div className="shrink-0 self-center text-right">
        {locked ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-soft"
            title={lockReason}
          >
            <Lock className="h-3 w-3" />
            {lockReason || "Locked"}
          </span>
        ) : !hasRecording ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">
            Soon
          </span>
        ) : session.recordingKind === "external" && session.recordingUrl ? (
          <a
            href={session.recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={watchClass}
          >
            Watch
          </a>
        ) : (
          <button onClick={onWatch} className={watchClass}>
            Watch
          </button>
        )}
      </div>
    </div>
  );
}

/** A stated absence with a way out — never a skeleton, never a decoration. */
function EmptyCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="club-b-card px-4 py-4">
      <p className="font-display text-[15px] font-extrabold text-ink">{title}</p>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-soft">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ── Main Page ──

type TabType = "live" | "upcoming" | "recordings";

/* The viewer's clock as an EXTERNAL STORE, bucketed to the hour.
   The staleness filter below ("is this class already over?") needs the viewer's
   wall clock, which the server cannot know — but a component may not read an
   impure function during render, and `const now = Date.now()` in the body was
   exactly that. It was also non-idempotent: two renders either side of a class's
   end time silently disagreed about whether it was still upcoming.

   useSyncExternalStore is the sanctioned bridge, and the snapshot must be STABLE
   between calls or React spins — hence the hour bucket rather than the raw
   millisecond. An hour is far finer than this filter needs: it only decides
   whether a scheduled class has already finished, and it already adds the
   session's full duration before comparing. The server snapshot is null, and the
   filter simply does not run until the client supplies an hour — the list is
   complete either way, never wrong, at worst briefly unpruned.

   The board's "Today · 1:00 PM" day-labels read the SAME bucket, so the relative
   wording never diverges from the pruning it sits beside, and there is still no
   Date.now() anywhere in render. */
const HOUR_MS = 3_600_000;
const CLOCK_SUBSCRIBE = () => () => {};
const CLOCK_CLIENT = () => Math.floor(Date.now() / HOUR_MS);
const CLOCK_SERVER = () => null;

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Board 07's when-line: "Today · 1:00 PM EDT". Relative only when the hour
 *  bucket is available; otherwise the absolute date, never a guess. The zone is
 *  printed because the viewer's clock is not necessarily Eastern. */
function formatWhen(iso: string | null, nowHour: number | null): string {
  if (!iso) return "Time to be announced";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  if (nowHour != null) {
    const days = Math.round(
      (startOfLocalDay(d) - startOfLocalDay(new Date(nowHour * HOUR_MS))) / 86_400_000
    );
    if (days === 0) return `Today · ${time}`;
    if (days === 1) return `Tomorrow · ${time}`;
    if (days === -1) return `Yesterday · ${time}`;
  }
  const day = d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .replace(",", "");
  return `${day} · ${time}`;
}

function formatScheduledAt(dateStr: string | null, status: string): string {
  if (!dateStr) return "";
  if (status === "live") return "LIVE NOW";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LiveSessionsPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<TabType>("live");
  const [tabTouched, setTabTouched] = useState(false);
  const [trackFilter, setTrackFilter] = useState<Track>("all");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>({
    isChild: false,
    userTrack: "adults",
    tier: "fic",
    clubLapsed: false,
  });
  const [watching, setWatching] = useState<LiveSession | null>(null);
  const [rsvpInfo, setRsvpInfo] = useState<
    Record<string, { count: number; going: boolean }>
  >({});
  /** Real RSVP'd members per session, for the room roster. */
  const [roster, setRoster] = useState<Record<string, RosterMember[]>>({});
  /** Viewer clock, hour-bucketed. See CLOCK_* above — never Date.now() in render. */
  const nowHour = useSyncExternalStore(CLOCK_SUBSCRIBE, CLOCK_CLIENT, CLOCK_SERVER);
  const reduceMotion = useReducedMotion();

  const loadRsvps = useCallback(
    async (uid: string) => {
      const { data } = await supabase
        .from("session_rsvps")
        .select("session_id, user_id, family_id");
      const rows =
        (data as { session_id: string; user_id: string; family_id: string | null }[]) || [];

      const map: Record<string, { fams: Set<string>; going: boolean }> = {};
      const bySession: Record<string, string[]> = {};
      rows.forEach((r) => {
        const e = map[r.session_id] || { fams: new Set<string>(), going: false };
        if (r.family_id) e.fams.add(r.family_id);
        else e.fams.add(r.user_id); // no family → count the individual
        if (r.user_id === uid) e.going = true;
        map[r.session_id] = e;
        (bySession[r.session_id] ||= []).push(r.user_id);
      });
      const out: Record<string, { count: number; going: boolean }> = {};
      Object.entries(map).forEach(([k, v]) => {
        out[k] = { count: v.fams.size, going: v.going };
      });
      setRsvpInfo(out);

      // The roster is REAL people who pressed RSVP — resolved from profiles, so
      // the stack shows names we actually have. No names → no stack.
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) {
        setRoster({});
        return;
      }
      const { data: people } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids.slice(0, 200));
      const nameOf = new Map<string, string>();
      ((people as { id: string; display_name: string | null }[]) || []).forEach((p) => {
        if (p.display_name) nameOf.set(p.id, p.display_name);
      });
      const rosterOut: Record<string, RosterMember[]> = {};
      Object.entries(bySession).forEach(([sid, uids]) => {
        rosterOut[sid] = uids
          .filter((id) => nameOf.has(id))
          .map((id) => {
            const name = nameOf.get(id)!;
            return { id, name, initials: initialsOf(name) };
          });
      });
      setRoster(rosterOut);
    },
    [supabase]
  );

  const toggleRsvp = useCallback(
    async (sessionId: string) => {
      if (!userId) return;
      const going = rsvpInfo[sessionId]?.going;
      if (going) {
        await supabase
          .from("session_rsvps")
          .delete()
          .eq("session_id", sessionId)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("session_rsvps")
          .insert({ session_id: sessionId, user_id: userId, family_id: familyId });
        const already = await hasXpForRef(supabase, userId, "rsvp", sessionId);
        if (!already) await awardXp(supabase, userId, "rsvp", XP.RSVP, sessionId);
        // High-intent moment — nudge push enrollment (NotificationOnboard caps it).
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("fic:notify-intent"));
        }
      }
      await loadRsvps(userId);
    },
    [supabase, userId, familyId, rsvpInfo, loadRsvps]
  );

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("live_sessions")
      .select("*")
      .order("scheduled_at", { ascending: true });

    if (data && data.length > 0) {
      const mapped: LiveSession[] = data.map(
        (s: {
          id: string;
          title: string;
          description: string | null;
          scheduled_at: string | null;
          duration_min: number | null;
          zoom_join_url: string | null;
          recording_url: string | null;
          recording_path: string | null;
          recording_kind: string | null;
          status: string;
          track: string | null;
          min_tier: string | null;
          class_type: string | null;
          worksheet_url: string | null;
          assignment: string | null;
          host_name?: string | null;
          host_title?: string | null;
          host_avatar_url?: string | null;
        }) => ({
          id: s.id,
          title: s.title,
          description: s.description || "",
          // Migration 198. Null stays null — the UI omits the host line rather
          // than substituting a plausible-looking name.
          host: s.host_name || null,
          hostTitle: s.host_title || null,
          hostAvatarUrl: s.host_avatar_url || null,
          scheduledAt: formatScheduledAt(s.scheduled_at, s.status),
          scheduledIso: s.scheduled_at,
          durationMin: s.duration_min || 45,
          track: (s.track as Track) || "all",
          status:
            s.status === "scheduled"
              ? "upcoming"
              : (s.status as "live" | "upcoming" | "completed"),
          minTier: (s.min_tier as "challenge" | "academy") || "challenge",
          zoomUrl: s.zoom_join_url || undefined,
          recordingUrl: s.recording_url || undefined,
          recordingPath: s.recording_path || undefined,
          recordingKind: resolveRecordingKind(s),
          classType: (s.class_type as ClassType) || null,
          worksheetUrl: s.worksheet_url || undefined,
          assignment: s.assignment || undefined,
        })
      );
      setSessions(mapped);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Open on the first tab that actually has something (audit #11): landing on an
  // empty "Now live" when Upcoming/Replays have items is a dead first view.
  // Only auto-selects until the member picks a tab themselves.
  useEffect(() => {
    if (loading || tabTouched) return;
    const hasLive = sessions.some((s) => s.status === "live");
    const hasUpcoming = sessions.some((s) => s.status === "upcoming");
    const hasRecording = sessions.some((s) => s.status === "completed");
    const first: TabType = hasLive
      ? "live"
      : hasUpcoming
        ? "upcoming"
        : hasRecording
          ? "recordings"
          : "live";
    setTab(first);
  }, [loading, sessions, tabTouched]);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      setUserId(user.id);

      // RSVP counts only need the user id — run them in parallel with the
      // profile + tier lookup instead of after it.
      const rsvpsP = loadRsvps(user.id);

      // Same access derivation as the courses page: profile track/age_group
      // + the family membership tier (kids inherit the family's tier).
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, age_group, track, family_id")
        .eq("id", user.id)
        .single();

      const userTrack = (profile?.age_group ||
        profile?.track ||
        "adults") as Track;
      const isChild = profile?.role === "child";
      setFamilyId(profile?.family_id ?? null);

      const { tier, clubLapsed } = await getFamilyTierState(
        supabase,
        profile?.family_id
      );
      setAccess({ isChild, userTrack, tier, clubLapsed });

      await rsvpsP;
    }
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kids see their own track + whole-family sessions; parents/teens see all
  // family tracks (mirrors the courses page's family-library behavior).
  const isTrackLocked = (track: Track) =>
    access.isChild && track !== "all" && track !== access.userTrack;

  // Tier gating comes from the central access matrix (src/lib/tier.ts):
  // 'academy' sessions are part of the FTA live program.
  const isTierLocked = (session: LiveSession) =>
    !canAccessSessionEffective(access.tier, access.clubLapsed, session.minTier);

  const sessionLock = (session: LiveSession) => {
    if (isTrackLocked(session.track))
      return { locked: true, reason: TRACK_LABEL[session.track] };
    if (isTierLocked(session)) return { locked: true, reason: "FTA members" };
    return { locked: false, reason: undefined };
  };

  const liveSession = sessions.find((s) => s.status === "live");
  // Only genuinely future (or in-progress) classes count as upcoming —
  // stale past-dated rows shouldn't masquerade as a schedule.
  const upcoming = sessions.filter(
    (s) =>
      s.status === "upcoming" &&
      (nowHour == null ||
        !s.scheduledIso ||
        new Date(s.scheduledIso).getTime() + s.durationMin * 60_000 >=
          nowHour * HOUR_MS)
  );
  const recordings = sessions
    .filter((s) => s.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.scheduledIso || 0).getTime() -
        new Date(a.scheduledIso || 0).getTime()
    );

  const filterByTrack = (list: LiveSession[]) =>
    trackFilter === "all" ? list : list.filter((s) => s.track === trackFilter);

  // Group a list by FIC class type (with a labeled section mark per group).
  // Legacy rows without a class type render flat, so nothing breaks pre-tagging.
  const groupSessions = (list: LiveSession[]) => {
    const hasTypes = list.some((s) => s.classType);
    if (!hasTypes)
      return [{ key: "all", label: null as string | null, items: list }];
    const groups: { key: string; label: string | null; items: LiveSession[] }[] =
      [];
    for (const t of CLASS_TYPE_ORDER) {
      const items = list.filter((s) => s.classType === t);
      if (items.length)
        groups.push({ key: t, label: CLASS_TYPE_CONFIG[t].label, items });
    }
    const other = list.filter((s) => !s.classType);
    if (other.length)
      groups.push({ key: "other", label: "Other classes", items: other });
    return groups;
  };

  const goTo = (t: TabType) => {
    setTabTouched(true);
    setTab(t);
  };

  const liveLock = liveSession ? sessionLock(liveSession) : null;
  const liveShown = liveSession && !liveLock?.locked ? liveSession : null;

  const countMark = (n: number) => (
    <span className="shrink-0 font-mono text-[10.5px] font-semibold tabular-nums text-soft">
      {n}
    </span>
  );
  const seeAll = (t: TabType, label: string) => (
    <button
      type="button"
      onClick={() => goTo(t)}
      className="f0-focus f0-press shrink-0 rounded-md text-[11px] font-semibold text-accent"
    >
      {label}
    </button>
  );

  /* LOADING ≠ EMPTY (§0.4). The skeleton is shaped like the board it is about to
     become — glyph + display word, a pill row, then cards — so the swap is a
     fill, not a reflow. It is never the founding state's copy. */
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6 lg:max-w-3xl" aria-busy="true">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-sand" />
          <div className="h-9 w-40 animate-pulse rounded-lg bg-sand" />
        </div>
        <div className="mt-5 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 w-28 animate-pulse rounded-[14px] bg-sand/70" />
          ))}
        </div>
        <div className="mt-5 h-52 animate-pulse rounded-2xl bg-sand/70" />
        <div className="mt-6 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="club-b-card flex items-center gap-3 px-3 py-3 motion-safe:animate-pulse"
            >
              <div className="h-[54px] w-[54px] shrink-0 rounded-[10px] bg-ink/10" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded-full bg-ink/10" />
                <div className="h-2.5 w-1/3 rounded-full bg-ink/[0.07]" />
              </div>
              <div className="h-8 w-20 shrink-0 rounded-[10px] bg-ink/10" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading the live schedule</span>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6 lg:max-w-3xl">
      {/* ── (•) LIVE ─────────────────────────────────────────────────────── */}
      <m.header
        initial={reduceMotion ? false : { opacity: 0, y: -8 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3">
          <LiveGlyph on={Boolean(liveSession)} />
          <h1 className="font-display text-display-1 font-extrabold uppercase leading-none text-ink">
            Live
          </h1>
        </div>
        <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-soft">
          Coaching calls, Q&amp;A and workshops run live — then every one of them
          is posted back here as a recording you can study at your own pace.
        </p>

        {/* Entitlement — a stated line, no notice box and no rule. */}
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-soft">
          {access.isChild ? (
            <>
              <span className="font-semibold text-ink">Your track:</span>{" "}
              {TRACK_LABEL[access.userTrack] || access.userTrack}, plus every
              whole-family session.
            </>
          ) : access.tier === "fta" ? (
            <>
              <span className="font-semibold text-ink">FTA member</span> — every
              class and every recording is open to you.
            </>
          ) : (
            <>
              <span className="font-semibold text-ink">Foundations member</span>{" "}
              — family classes are open to you. Sessions marked{" "}
              <span className="font-semibold text-accent">FTA</span> are part
              of the 6-week live program.{" "}
              <Link
                href="/upgrade"
                className="f0-focus font-semibold text-accent"
              >
                Join the next cohort →
              </Link>
            </>
          )}
        </p>
      </m.header>

      {/* ── Filter pills ─────────────────────────────────────────────────── */}
      <div className="mt-5">
        <ViewPills value={tab} onChange={goTo} />
      </div>

      {/* Track filter — only worth showing once a tab is crowded (>6 sessions). */}
      {tab !== "live" &&
        (tab === "upcoming" ? upcoming.length : recordings.length) > 6 && (
          <div className="mt-3">
            <TrackPills value={trackFilter} onChange={setTrackFilter} />
          </div>
        )}

      {/* ── NOW LIVE ─────────────────────────────────────────────────────── */}
      {tab === "live" && (
        <div
          className="mt-5 space-y-7"
          role="tabpanel"
          id="live-panel-live"
          aria-labelledby="live-tab-live"
        >
          {liveShown ? (
            <LiveHero
              session={liveShown}
              roster={roster[liveShown.id] ?? []}
              rosterTotal={rsvpInfo[liveShown.id]?.count ?? 0}
            />
          ) : liveSession && liveLock?.locked ? (
            /* The wall, restyled — never widened or narrowed. */
            <EmptyCard
              title={
                isTierLocked(liveSession)
                  ? "Part of the FTA 6-week program"
                  : `Reserved for the ${TRACK_LABEL[liveSession.track]} track`
              }
              body="A class is on air right now, but this one isn't part of your membership."
              action={
                isTierLocked(liveSession) ? (
                  <Link
                    href="/upgrade"
                    className="f0-focus f0-press inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent"
                  >
                    Join the next cohort →
                  </Link>
                ) : undefined
              }
            />
          ) : (
            /* FOUNDING STATE (§0.5) — the real state on most days. Stated
               absence with two ways out, never a skeleton. */
            <EmptyCard
              title="The room is quiet right now"
              body="When a class goes live it takes over this page. Until then, the schedule and the full recording library are a tap away."
              action={
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold">
                  <button
                    onClick={() => goTo("upcoming")}
                    className="f0-focus f0-press text-accent"
                  >
                    See what&apos;s scheduled →
                  </button>
                  {recordings.length > 0 && (
                    <button
                      onClick={() => goTo("recordings")}
                      className="f0-focus f0-press text-soft transition hover:text-ink"
                    >
                      Watch a recording
                    </button>
                  )}
                </div>
              }
            />
          )}

          {/* The board keeps the next sessions and the last replay under the
              hero on the same screen. Previews only — the full lists live on
              their own pills. */}
          {upcoming.length > 0 && (
            <BoardSection
              id="live-upcoming-peek"
              label="Upcoming"
              mark="sessions"
              action={seeAll("upcoming", "See all")}
            >
              <div className="mt-2.5 flex flex-col gap-2">
                {upcoming.slice(0, 2).map((session) => {
                  const lock = sessionLock(session);
                  return (
                    <UpcomingCard
                      key={session.id}
                      session={session}
                      when={formatWhen(session.scheduledIso, nowHour)}
                      locked={lock.locked}
                      lockReason={lock.reason}
                      rsvp={rsvpInfo[session.id]}
                      onRsvp={lock.locked ? undefined : () => toggleRsvp(session.id)}
                    />
                  );
                })}
              </div>
            </BoardSection>
          )}

          {recordings.length > 0 && (
            <BoardSection
              id="live-replay-peek"
              label="Recent"
              mark="replay"
              action={seeAll("recordings", "See all")}
            >
              <div className="mt-2.5">
                {recordings.slice(0, 1).map((session) => {
                  const lock = sessionLock(session);
                  return (
                    <ReplayCard
                      key={session.id}
                      session={session}
                      when={formatWhen(session.scheduledIso, nowHour)}
                      locked={lock.locked}
                      lockReason={lock.reason}
                      onWatch={lock.locked ? undefined : () => setWatching(session)}
                    />
                  );
                })}
              </div>
            </BoardSection>
          )}
        </div>
      )}

      {/* ── UPCOMING ─────────────────────────────────────────────────────── */}
      {tab === "upcoming" && (
        <div
          className="mt-5 space-y-7"
          role="tabpanel"
          id="live-panel-upcoming"
          aria-labelledby="live-tab-upcoming"
        >
          {filterByTrack(upcoming).length === 0 ? (
            <EmptyCard
              title="Nothing on the calendar yet"
              body={`No upcoming sessions${
                trackFilter !== "all" ? " for this track" : ""
              } are scheduled — new classes are posted here as they are set, with the host and the time on the record.`}
            />
          ) : (
            groupSessions(filterByTrack(upcoming)).map((group) => (
              <BoardSection
                key={group.key}
                id={`live-upcoming-${group.key}`}
                label={group.label ?? "Upcoming"}
                mark={group.label ? undefined : "sessions"}
                action={countMark(group.items.length)}
              >
                <div className="f0-stagger mt-2.5 flex flex-col gap-2">
                  {group.items.map((session, i) => {
                    const lock = sessionLock(session);
                    return (
                      <div key={session.id} style={{ ["--i" as string]: i }}>
                        <UpcomingCard
                          session={session}
                          when={formatWhen(session.scheduledIso, nowHour)}
                          locked={lock.locked}
                          lockReason={lock.reason}
                          rsvp={rsvpInfo[session.id]}
                          onRsvp={
                            lock.locked ? undefined : () => toggleRsvp(session.id)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </BoardSection>
            ))
          )}
        </div>
      )}

      {/* ── REPLAYS ──────────────────────────────────────────────────────── */}
      {tab === "recordings" && (
        <div
          className="mt-5 space-y-7"
          role="tabpanel"
          id="live-panel-recordings"
          aria-labelledby="live-tab-recordings"
        >
          {filterByTrack(recordings).length === 0 ? (
            <EmptyCard
              title="The shelf is empty"
              body={`No recordings${
                trackFilter !== "all" ? " for this track" : ""
              } yet — every live class lands here once it has been processed. Nothing is hidden behind this screen.`}
            />
          ) : (
            groupSessions(filterByTrack(recordings)).map((group) => (
              <BoardSection
                key={group.key}
                id={`live-replays-${group.key}`}
                label={group.label ?? "Recent"}
                mark={group.label ? undefined : "replays"}
                action={countMark(group.items.length)}
              >
                <div className="f0-stagger mt-2.5 flex flex-col gap-2">
                  {group.items.map((session, i) => {
                    const lock = sessionLock(session);
                    return (
                      <div key={session.id} style={{ ["--i" as string]: i }}>
                        <ReplayCard
                          session={session}
                          when={formatWhen(session.scheduledIso, nowHour)}
                          locked={lock.locked}
                          lockReason={lock.reason}
                          onWatch={
                            lock.locked ? undefined : () => setWatching(session)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </BoardSection>
            ))
          )}
        </div>
      )}

      {watching && (
        <RecordingPlayerModal
          session={{
            id: watching.id,
            title: watching.title,
            durationMin: watching.durationMin,
            recordingKind: watching.recordingKind,
            recordingUrl: watching.recordingUrl,
            recordingPath: watching.recordingPath,
            scheduledAt: watching.scheduledAt,
            trackLabel: TRACK_LABEL[watching.track],
          }}
          userId={userId}
          onClose={() => setWatching(null)}
        />
      )}
    </div>
  );
}
