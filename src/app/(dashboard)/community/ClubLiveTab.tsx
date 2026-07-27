"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Play, Radio, Link2Off } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { LiveEvent } from "@/lib/clubhome/live-events";
import { SectionRule } from "@/components/f0/parts";
import {
  AvatarStack,
  FoundingNote,
  VoltAction,
  useClubPresence,
} from "./parts";

/**
 * THE CLUB · LIVE — the room, not a room list.
 *
 * COMPOSITION LAW for this tab: exactly ONE object dominates, and it is the ONLY
 * dark object on the entire Community surface — the f0-hero-field. Everything
 * beneath it (what's coming, what was recorded) is a hairline ledger on cream.
 * There is no equal-column card grid anywhere on this tab; the previous version
 * rendered three `sm:grid-cols-2` grids of LiveEventCards, which is exactly the
 * pattern the register bans.
 *
 * THE HERO HAS THREE STATES and always renders — a dark room is still a room:
 *   1. ON AIR      — a live / starting_soon room. Host identity, title, the
 *                    member stack, and the join action.
 *   2. NEXT ON AIR — nothing live, but something scheduled. The hero carries the
 *                    countdown and Remind Me so the tab still has a subject.
 *   3. DARK        — nothing scheduled at all (the founding reality today). The
 *                    hero states that plainly, says what a room IS, and hands
 *                    the member somewhere alive (the Lounge) rather than
 *                    dead-ending. It is never a grey "no rooms" placeholder.
 *
 * PRESENCE is real: `viewer_count` from /api/live, roster faces from
 * /api/club/collective. Below the participation floor no raw count is printed —
 * founding copy replaces it. Nothing here can render "0 online".
 *
 * `focusId` is the go-live deep-link target (/club?live={id} → /community?mode=
 * live&live={id}): the matching room scrolls into view and pulses briefly.
 */

/* ── formatting ───────────────────────────────────────────────────────────── */

/** "Wed, Sep 2 · 7:00 PM ET" — always market time. */
function formatStartET(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(d);
  return `${day} · ${time} ET`;
}

/** Live countdown string, recomputed each tick. null once the start has passed. */
function countdown(iso: string, now: number): string | null {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${Math.max(1, mins)} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

const ROOM_LABEL: Record<string, string> = {
  class: "Live class",
  audio: "Audio room",
  market: "Market room",
};

/* ── remind me ────────────────────────────────────────────────────────────── */
/** Preserves the S2.5 behaviour: POST /api/live/{id}/remind, optimistic + revert. */
function RemindMe({ event }: { event: LiveEvent }) {
  const [interested, setInterested] = useState(Boolean(event.interested));
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !interested;
    setInterested(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/live/${event.id}/remind`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interested: next }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setInterested(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={interested}
      className={`inline-flex shrink-0 items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] transition-colors disabled:opacity-60 ${
        interested ? "text-soft" : "text-gold-700 hover:text-gold-600"
      }`}
    >
      {interested ? (
        <>
          <BellRing className="h-3.5 w-3.5" /> Reminded
        </>
      ) : (
        <>
          <Bell className="h-3.5 w-3.5" /> Remind me
        </>
      )}
    </button>
  );
}

/* ── the hero field — the one dark object ─────────────────────────────────── */

function OnAirDot({ live }: { live: boolean }) {
  return (
    <span className="relative flex h-2 w-2" aria-hidden>
      {live && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70 motion-reduce:hidden" />
      )}
      <span
        className={`relative inline-flex h-2 w-2 rounded-full ${
          live ? "bg-red-500" : "bg-[#F7F3EA]/35"
        }`}
      />
    </span>
  );
}

/**
 * The hero shell.
 *
 * THEME NOTE — the cream literals below (#F7F3EA) are deliberate and
 * theme-INVARIANT, exactly as in the read-only foundation (club2/ClubCard.tsx).
 * `.f0-hero-field` sets `color: #F7F3EA` and stays obsidian in BOTH themes by
 * design, so its contents are painted against a known ground, not against the
 * page. Semantic tokens would be WRONG here: `text-ink` flips to near-black in
 * light and would be unreadable on the field.
 *
 * DARK SEPARATION is now handled by the FOUNDATION: `.f0-hero-field` gained a
 * `:root[data-theme="dark"]` variant that warms the field and gives it a defined
 * inset edge, so it still reads as a deliberate island on the warm near-black
 * page. The component-level `dark:ring-1 dark:ring-sand` stopgap that used to sit
 * here has been removed — the primitive owns it.
 */
function HeroShell({
  eyebrow,
  live = false,
  children,
}: {
  eyebrow: string;
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="f0-hero-field f0-grain px-5 py-6 sm:px-7 sm:py-8">
      <div className="flex items-center gap-2">
        <OnAirDot live={live} />
        <span className="font-display text-eyebrow font-bold uppercase text-[#F7F3EA]/70">
          {eyebrow}
        </span>
      </div>
      {children}
    </div>
  );
}

/** STATE 1 + 2 — a real room fills the field. */
function RoomHero({
  event,
  faces,
  now,
}: {
  event: LiveEvent;
  faces: { avatar_url: string | null }[];
  now: number;
}) {
  const live = event.status === "live";
  const cd = event.status === "starting_soon" ? countdown(event.starts_at, now) : null;
  const roomLabel = ROOM_LABEL[event.room_type] ?? "Live room";
  const eyebrow = live
    ? `On air · ${roomLabel}`
    : event.status === "starting_soon"
      ? `Starting ${cd ?? "any moment"} · ${roomLabel}`
      : `Next on air · ${roomLabel}`;

  // PRESENCE HONESTY: never stack more faces than the room actually holds.
  // /api/live gives us a viewer COUNT but not viewer identities, so the stack is
  // capped by the real count and captioned by it.
  const inRoom = live ? event.viewer_count : 0;
  const stack = inRoom > 0 ? faces.slice(0, Math.min(5, inRoom)) : [];

  return (
    <HeroShell eyebrow={eyebrow} live={live}>
      <h2 className="mt-4 max-w-[18ch] font-display text-display-2 font-extrabold text-[#F7F3EA]">
        {event.title}
      </h2>

      {event.description && (
        <p className="mt-2.5 max-w-[44ch] text-[14.5px] leading-relaxed text-[#F7F3EA]/70">
          {event.description}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2.5">
        <Avatar name={event.host.name} avatarUrl={event.host.avatarUrl} size="md" />
        <span className="min-w-0">
          <span className="block font-display text-[14px] font-bold leading-tight text-[#F7F3EA]">
            {event.host.name}
          </span>
          <span className="block font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#F7F3EA]/50">
            Host
          </span>
        </span>
      </div>

      {event.tickers.length > 0 && (
        <p className="mt-3.5 font-mono text-[11px] font-bold tracking-wide text-[#F7F3EA]/70">
          {event.tickers
            .slice(0, 6)
            .map((t) => `$${t.toUpperCase()}`)
            .join("   ")}
        </p>
      )}

      {/* hairline floor — presence on the left, the action on the right */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#F7F3EA]/12 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          {stack.length > 0 && (
            <AvatarStack
              faces={stack}
              max={5}
              ring="ring-[#171A21]"
              label="Club members"
            />
          )}
          <p className="font-mono text-[11px] tracking-wide text-[#F7F3EA]/60">
            {live && inRoom > 0 ? (
              <>
                <span className="font-bold tabular-nums text-[#F7F3EA]">{inRoom}</span> in
                the room
              </>
            ) : live ? (
              "The room is open — walk in first"
            ) : (
              formatStartET(event.starts_at)
            )}
          </p>
        </div>

        {live || event.status === "starting_soon" ? (
          event.join_url ? (
            <VoltAction href={event.join_url}>
              <Radio className="h-3.5 w-3.5" />
              {live ? "Join now" : "Enter room"}
            </VoltAction>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#F7F3EA]/50">
              <Link2Off className="h-3.5 w-3.5" /> Link coming
            </span>
          )
        ) : (
          <RemindMe event={event} />
        )}
      </div>
    </HeroShell>
  );
}

/**
 * STATE 3 — DARK. The founding reality: no host has opened a room yet.
 *
 * This is the state the surface will be in most of the time before Sept 1, so it
 * gets the most design attention, not the least. The field stays: a dark room is
 * still the room. It says what a room IS (so the empty state teaches), it shows
 * the real founding floor (faces we actually have), and it hands the member to
 * the Lounge — which is always on — instead of leaving them at a dead end.
 */
function DarkRoomHero({
  faces,
  onGoToLounge,
}: {
  faces: { avatar_url: string | null }[];
  onGoToLounge: () => void;
}) {
  return (
    <HeroShell eyebrow="The room is dark">
      <h2 className="mt-4 max-w-[16ch] font-display text-display-2 font-extrabold text-[#F7F3EA]">
        Nobody is on the air.
      </h2>
      <p className="mt-3 max-w-[42ch] text-[14.5px] leading-relaxed text-[#F7F3EA]/70">
        A room opens the moment a host starts one — a market walk-through, a
        class, or an open audio hang. The first ones drop with the challenge.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#F7F3EA]/12 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          {faces.length > 0 && (
            <AvatarStack faces={faces} max={5} ring="ring-[#171A21]" label="Club members" />
          )}
          <p className="font-mono text-[11px] tracking-wide text-[#F7F3EA]/60">
            The founding floor is already here
          </p>
        </div>
        <VoltAction onClick={onGoToLounge} onDark>
          Go to the Lounge
        </VoltAction>
      </div>
    </HeroShell>
  );
}

/* ── the ledger rows ──────────────────────────────────────────────────────── */

function ScheduledRow({ event, now }: { event: LiveEvent; now: number }) {
  const cd = countdown(event.starts_at, now);
  return (
    <div className="f0-ledger-row">
      <div className="w-[70px] shrink-0">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-gold-700">
          {cd ?? "Now"}
        </p>
        <p className="mt-0.5 font-mono text-[10px] tracking-wide text-soft">
          {ROOM_LABEL[event.room_type] ?? "Room"}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-bold leading-snug text-ink">
          {event.title}
        </p>
        <p className="mt-0.5 font-mono text-[10.5px] tracking-wide text-soft">
          {formatStartET(event.starts_at)} · {event.host.name}
        </p>
      </div>
      <RemindMe event={event} />
    </div>
  );
}

function ReplayRow({ event }: { event: LiveEvent }) {
  const covered = event.tickers.slice(0, 4).map((t) => `$${t.toUpperCase()}`);
  return (
    <div className="f0-ledger-row">
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-bold leading-snug text-ink">
          {event.title}
        </p>
        <p className="mt-0.5 font-mono text-[10.5px] tracking-wide text-soft">
          {event.host.name}
          {event.duration_min ? ` · ${event.duration_min} min` : ""}
          {covered.length > 0 ? ` · ${covered.join(" ")}` : ""}
        </p>
        {event.kai_summary && (
          <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-soft">
            {event.kai_summary}
          </p>
        )}
      </div>
      {event.replay_url ? (
        <a
          href={event.replay_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] text-gold-700 hover:text-gold-600"
        >
          <Play className="h-3.5 w-3.5" /> Watch
        </a>
      ) : (
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
          Soon
        </span>
      )}
    </div>
  );
}

/* ── the tab ──────────────────────────────────────────────────────────────── */

export default function ClubLiveTab({
  events,
  loading = false,
  focusId = null,
  onGoToLounge,
}: {
  events: LiveEvent[];
  /** LOADING IS NOT EMPTY. The /api/live read starts at `[]`, so without this
   *  the tab rendered "Nobody is on the air." — its largest type — on every
   *  open, then swapped in the real rooms. The dark-room copy is TRUE only once
   *  the read has come back with nothing. */
  loading?: boolean;
  focusId?: string | null;
  /** Never dead-end a dark room — hand the member to the always-on Lounge. */
  onGoToLounge?: () => void;
}) {
  const presence = useClubPresence();
  const faces = useMemo(
    () => (presence?.avatars ?? []).map((a) => ({ avatar_url: a.url })),
    [presence]
  );

  const onAir = events.filter((e) => e.status === "live" || e.status === "starting_soon");
  const scheduled = events.filter((e) => e.status === "scheduled");
  const replays = events.filter((e) => e.status === "replay_ready" || e.status === "ended");

  // The hero subject: the focused deep-link room if it is still active, else the
  // loudest live room, else the soonest scheduled one, else nothing.
  const hero = useMemo(() => {
    const focused = focusId ? events.find((e) => e.id === focusId) : null;
    if (focused && focused.status !== "ended" && focused.status !== "replay_ready")
      return focused;
    const live = [...onAir].sort((a, b) => b.viewer_count - a.viewer_count)[0];
    if (live) return live;
    return [...scheduled].sort((a, b) =>
      (a.starts_at ?? "").localeCompare(b.starts_at ?? "")
    )[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, focusId]);

  // Ticking clock only while something is counting down.
  const needsClock = !!hero && hero.status !== "live";
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!needsClock && scheduled.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [needsClock, scheduled.length]);

  // Deep-link focus: scroll the hero into view and pulse it briefly.
  const heroRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusId) return;
    const el = heroRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-volt-500", "ring-offset-2", "ring-offset-paper", "rounded-2xl");
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-volt-500", "ring-offset-2", "ring-offset-paper");
    }, 2600);
    return () => clearTimeout(t);
  }, [focusId, events.length]);

  const upcoming = scheduled.filter((e) => e.id !== hero?.id);

  return (
    <div className="f0-stagger space-y-9">
      <div ref={heroRef} style={{ ["--i" as string]: 0 }}>
        {hero ? (
          <RoomHero event={hero} faces={faces} now={now} />
        ) : loading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-3 w-28 rounded-full bg-ink/10 motion-safe:animate-pulse" />
            <div className="h-[0.9em] w-[80%] rounded-full bg-ink/10 text-display-2 motion-safe:animate-pulse" />
            <div className="h-[0.9em] w-[48%] rounded-full bg-ink/10 text-display-2 motion-safe:animate-pulse" />
            <span className="sr-only">Loading live rooms</span>
          </div>
        ) : (
          <DarkRoomHero faces={faces} onGoToLounge={onGoToLounge ?? (() => {})} />
        )}
      </div>

      {upcoming.length > 0 && (
        <section style={{ ["--i" as string]: 1 }}>
          <SectionRule>On the schedule</SectionRule>
          <div className="f0-ledger mt-3">
            {upcoming.map((e) => (
              <ScheduledRow key={e.id} event={e} now={now} />
            ))}
          </div>
        </section>
      )}

      {replays.length > 0 && (
        <section style={{ ["--i" as string]: 2 }}>
          <SectionRule>Recorded</SectionRule>
          <div className="f0-ledger mt-3">
            {replays.map((e) => (
              <ReplayRow key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {/* Founding tail: a dark room with nothing scheduled and nothing recorded
          is the club's real state today. Say what happens next instead of
          leaving the tab to end on silence. */}
      {!hero && !loading && replays.length === 0 && (
        <section style={{ ["--i" as string]: 1 }} className="f0-rule-top pt-1">
          <FoundingNote
            eyebrow="What lands here"
            headline="Every room becomes a recording."
            body="Rooms run live, then stay — covered tickers, the host's read, and Kai's recap attached underneath. The shelf fills from the first session."
            action={
              <Link
                href="/fta/recordings"
                className="inline-flex items-center gap-1.5 font-display text-[12px] font-bold uppercase tracking-[0.08em] text-gold-700 hover:text-gold-600"
              >
                Browse the archive
              </Link>
            }
          />
        </section>
      )}
    </div>
  );
}
