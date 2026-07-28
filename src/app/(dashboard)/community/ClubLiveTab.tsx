"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Play } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { LiveEvent } from "@/lib/clubhome/live-events";
import {
  BoardCard,
  Marker,
  Pill,
  PillRow,
  RingMark,
  SectionLabel,
  StripeField,
} from "./board";
import { AvatarStack, useClubPresence } from "./parts";

/**
 * THE CLUB · LIVE — Club Screens 07, built as drawn.
 *
 * The board: a NOW LIVE / UPCOMING / REPLAYS pill row, then the on-air room as a
 * striped near-black field carrying the room title, the head count, the lassoed
 * orange ring with "live!" written across it and the JOIN ROOM action — then
 * UPCOMING SESSIONS and RECENT REPLAY as cards of rows with Set Reminder and
 * WATCH on the right.
 *
 * THE FIELD ALWAYS RENDERS — a dark room is still a room. Three states, all
 * drawn the same way so the screen never collapses into a placeholder:
 *   1. ON AIR      — the live/starting room, its host, its head count, JOIN ROOM.
 *   2. NEXT ON AIR — nothing live but something scheduled: the countdown and
 *                    Remind me take the action slot.
 *   3. DARK        — nothing scheduled at all (the founding reality before the
 *                    first host opens one). The field says so plainly and hands
 *                    the member to the always-on Lounge.
 *
 * PRESENCE IS REAL. `viewer_count` comes from /api/live and the roster faces from
 * /api/club/collective; the stack is capped by the count it actually has, so
 * nothing on this screen can print "0 in the room" or stack faces that are not
 * in it. `loading` is distinct from empty — the dark-room copy is TRUE only once
 * the read has come back with nothing.
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
function RemindMe({ event, onDark = false }: { event: LiveEvent; onDark?: boolean }) {
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

  const cls = onDark
    ? "rounded-[8px] bg-[#F7F3EA]/12 px-4 py-2.5 text-[#F7F3EA] hover:bg-[#F7F3EA]/20"
    : `rounded-[8px] border border-sand bg-card px-3 py-2.5 ${
        interested ? "text-soft" : "text-ink hover:border-gold-300"
      }`;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={interested}
      className={`f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-display text-[11px] font-bold transition-colors disabled:opacity-60 ${cls}`}
    >
      {interested ? (
        <>
          <BellRing className="h-3.5 w-3.5" /> Reminded
        </>
      ) : (
        <>
          <Bell className="h-3.5 w-3.5" /> Set Reminder
        </>
      )}
    </button>
  );
}

/* ── the drawn room field ─────────────────────────────────────────────────── */

function RoomField({
  event,
  faces,
  now,
}: {
  event: LiveEvent;
  faces: { avatar_url: string | null }[];
  now: number;
}) {
  const live = event.status === "live";
  const soon = event.status === "starting_soon";
  const cd = soon ? countdown(event.starts_at, now) : null;
  const roomLabel = ROOM_LABEL[event.room_type] ?? "Live room";

  // PRESENCE HONESTY: never stack more faces than the room actually holds.
  const inRoom = live ? event.viewer_count : 0;
  const stack = inRoom > 0 ? faces.slice(0, Math.min(4, inRoom)) : [];

  return (
    <StripeField className="p-4 sm:p-5">
      <div className="relative">
        <h2 className="max-w-[15ch] font-display text-[clamp(22px,6.5vw,27px)] font-black uppercase leading-[1.02] tracking-[-0.03em] text-[#F7F3EA]">
          {event.title}
        </h2>
        <p className="mt-2.5 text-[11.5px] text-[#F7F3EA]/62">
          {live ? (
            inRoom > 0 ? (
              <>
                Live now · <span className="font-bold tabular-nums text-[#F7F3EA]">{inRoom}</span>{" "}
                in room
              </>
            ) : (
              "Live now · the room is open, walk in first"
            )
          ) : soon ? (
            `Starting ${cd ?? "any moment"} · ${roomLabel}`
          ) : (
            `${formatStartET(event.starts_at)} · ${roomLabel}`
          )}
        </p>
        {event.description && (
          <p className="mt-2 max-w-[30ch] text-[13px] font-semibold leading-[1.35] text-[#F7F3EA]">
            {event.description}
          </p>
        )}

        {/* The lassoed ring + marker the board draws over the top-right corner. */}
        <RingMark size={72} className="hidden sm:block" style={{ right: 6, top: 4 }} />
        <Marker className="absolute right-[18px] top-[38px] hidden text-[21px] sm:block" rotate={-8}>
          {live ? "live!" : soon ? "soon!" : "next up"}
        </Marker>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {live || soon ? (
            event.join_url ? (
              <a
                href={event.join_url}
                className="f0-press rounded-[8px] bg-volt-500 px-[18px] py-2.5 font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-volt-600"
              >
                Join room
              </a>
            ) : (
              <span className="rounded-[8px] bg-[#F7F3EA]/12 px-[18px] py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#F7F3EA]/60">
                Link coming
              </span>
            )
          ) : (
            <RemindMe event={event} onDark />
          )}

          <span className="flex items-center gap-2.5">
            {stack.length > 0 && (
              <AvatarStack faces={stack} max={4} size="xs" ring="ring-[#14110F]" label="In the room" />
            )}
            <span className="flex items-center gap-2">
              <Avatar name={event.host.name} avatarUrl={event.host.avatarUrl} size="xs" />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#F7F3EA]/60">
                {event.host.name}
              </span>
            </span>
          </span>
        </div>
      </div>
    </StripeField>
  );
}

/** STATE 3 — the founding reality: no host has opened a room yet. */
function DarkRoomField({ faces, onGoToLounge }: { faces: { avatar_url: string | null }[]; onGoToLounge: () => void }) {
  return (
    <StripeField className="p-4 sm:p-5">
      <div className="relative">
        <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.16em] text-volt-300">
          The room is dark
        </p>
        <h2 className="mt-3 max-w-[14ch] font-display text-[clamp(22px,6.5vw,27px)] font-black uppercase leading-[1.02] tracking-[-0.03em] text-[#F7F3EA]">
          Nobody is on the air.
        </h2>
        <p className="mt-2.5 max-w-[38ch] text-[12.5px] leading-relaxed text-[#F7F3EA]/65">
          A room opens the moment a host starts one — a market walk-through, a
          class, or an open audio hang. The first ones drop with the challenge.
        </p>
        <RingMark size={72} className="hidden sm:block" style={{ right: 6, top: 4 }} />
        <Marker className="absolute right-[22px] top-[38px] hidden sm:block" rotate={-8}>
          soon
        </Marker>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onGoToLounge}
            className="f0-press rounded-[8px] bg-volt-500 px-[18px] py-2.5 font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-volt-600"
          >
            Go to the Lounge
          </button>
          {faces.length > 0 && (
            <span className="flex items-center gap-2.5">
              <AvatarStack faces={faces} max={4} size="xs" ring="ring-[#14110F]" label="Club members" />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#F7F3EA]/60">
                The founding floor is here
              </span>
            </span>
          )}
        </div>
      </div>
    </StripeField>
  );
}

/* ── the rows ─────────────────────────────────────────────────────────────── */

function SessionCard({ event, now }: { event: LiveEvent; now: number }) {
  const cd = countdown(event.starts_at, now);
  return (
    <BoardCard className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] bg-sand font-mono text-[9px] uppercase tracking-wide text-soft">
        {ROOM_LABEL[event.room_type]?.split(" ")[0] ?? "Room"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[13px] font-bold text-ink">
          {event.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-soft">
          {formatStartET(event.starts_at)}
          {cd ? ` · ${cd}` : ""}
        </span>
        <span className="block truncate text-[11px] text-soft/80">w/ {event.host.name}</span>
      </span>
      <RemindMe event={event} />
    </BoardCard>
  );
}

function ReplayCard({ event }: { event: LiveEvent }) {
  const covered = event.tickers.slice(0, 4).map((t) => t.toUpperCase());
  return (
    <BoardCard className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] bg-[#14110F]">
        <Play className="h-4 w-4 fill-volt-500 text-volt-500" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[13px] font-bold text-ink">
          {event.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-soft">
          {event.duration_min ? `${event.duration_min} min` : event.host.name}
          {covered.length > 0 ? ` · ${covered.join(", ")}` : ""}
        </span>
      </span>
      {event.replay_url ? (
        <a
          href={event.replay_url}
          target="_blank"
          rel="noopener noreferrer"
          className="f0-focus shrink-0 font-display text-[11px] font-extrabold uppercase tracking-[0.04em] text-gold-700 hover:text-gold-600"
        >
          Watch
        </a>
      ) : (
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
          Soon
        </span>
      )}
    </BoardCard>
  );
}

/* ── the tab ──────────────────────────────────────────────────────────────── */

type LiveFilter = "now" | "upcoming" | "replays";

export default function ClubLiveTab({
  events,
  loading = false,
  focusId = null,
  onGoToLounge,
}: {
  events: LiveEvent[];
  /** LOADING IS NOT EMPTY — the dark-room copy is only true once the read is in. */
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
  const [filter, setFilter] = useState<LiveFilter>("now");

  const onAir = events.filter((e) => e.status === "live" || e.status === "starting_soon");
  const scheduled = events.filter((e) => e.status === "scheduled");
  const replays = events.filter((e) => e.status === "replay_ready" || e.status === "ended");

  // The field's subject: the focused deep-link room if it is still active, else
  // the loudest live room, else the soonest scheduled one, else nothing.
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

  // Deep-link focus: scroll the field into view and pulse it briefly.
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
    <div className="space-y-6">
      <PillRow>
        <Pill active={filter === "now"} onClick={() => setFilter("now")}>
          Now live
        </Pill>
        <Pill active={filter === "upcoming"} onClick={() => setFilter("upcoming")}>
          Upcoming
        </Pill>
        <Pill active={filter === "replays"} onClick={() => setFilter("replays")}>
          Replays
        </Pill>
      </PillRow>

      {/* The field is the screen's subject in every filter — a schedule with no
          room at the top of it is a list, not a place. */}
      <div ref={heroRef}>
        {hero ? (
          <RoomField event={hero} faces={faces} now={now} />
        ) : loading ? (
          <div
            className="h-[186px] rounded-[16px] bg-sand motion-safe:animate-pulse"
            aria-busy="true"
          >
            <span className="sr-only">Loading live rooms</span>
          </div>
        ) : (
          <DarkRoomField faces={faces} onGoToLounge={onGoToLounge ?? (() => {})} />
        )}
      </div>

      {filter !== "replays" && upcoming.length > 0 && (
        <section>
          <SectionLabel>Upcoming sessions</SectionLabel>
          <div className="space-y-2.5">
            {upcoming.map((e) => (
              <SessionCard key={e.id} event={e} now={now} />
            ))}
          </div>
        </section>
      )}

      {filter !== "upcoming" && replays.length > 0 && (
        <section>
          <SectionLabel>{replays.length === 1 ? "Recent replay" : "Recent replays"}</SectionLabel>
          <div className="space-y-2.5">
            {replays.map((e) => (
              <ReplayCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {/* FOUNDING TAIL: a dark room with nothing scheduled and nothing recorded is
          the club's real state today. Say what happens next rather than ending
          the screen on silence. */}
      {!hero && !loading && replays.length === 0 && (
        <BoardCard>
          <p className="font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold-700">
            What lands here
          </p>
          <p className="mt-2 max-w-[24ch] font-display text-[19px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
            Every room becomes a recording.
          </p>
          <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-soft">
            Rooms run live, then stay — covered tickers, the host&apos;s read, and
            Kai&apos;s recap attached underneath. The shelf fills from the first
            session.
          </p>
          <Link
            href="/fta/recordings"
            className="mt-3.5 inline-flex font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-gold-700 hover:text-gold-600"
          >
            Browse the archive
          </Link>
        </BoardCard>
      )}
    </div>
  );
}
