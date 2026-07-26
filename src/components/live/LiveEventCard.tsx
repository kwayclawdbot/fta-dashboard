"use client";

/**
 * LiveEventCard — the CONVERGENCE PART II live_event object, rendered as ONE card
 * that transforms through its whole life: scheduled → starting_soon → live →
 * ended → replay_ready. The Feed renders the CURRENT STATE of the same object
 * (one object, one URL, one engagement history).
 *
 * Grammar (GRAMMAR.md, pass/fail): this is a genuine persistent object, so it
 * earns the ObjectCard container (primitive #5) — the ONLY sanctioned card.
 * Accent discipline: Club register = VOLT dominant (`accent="accent"`), TEAL
 * supporting (tickers). The LIVE state gets a red "on-air" pulse — the universal
 * recording signal, a semantic indicator, not a third brand accent. Kai-blue
 * appears ONLY on the Kai recap line. Type scale: object title is reading-body
 * (16px), everything smaller is metadata. Motion communicates meaning
 * (near-start urgency pulses; reduced-motion drops transforms).
 *
 * NEVER Zoom (plan Live UI rule): no participant-tile grid, no corporate chrome —
 * a class event reads as an invitation, a live event as energy.
 *
 * Props contract SHARED with the S2 rendering lane — see src/lib/live/types.ts.
 * Do not change `event`'s core shape without noting it to S2.
 */

import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  Radio,
  LineChart,
  Play,
  Bell,
  BellRing,
  Users,
  Sparkles,
  CalendarClock,
  Link2Off,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { ObjectCard, StatusChip } from "@/components/grammar";
import type {
  LiveEventCardData,
  LiveRoomType,
  LiveEventStatus,
} from "@/lib/live/types";

// ── formatting helpers ───────────────────────────────────────────────────────

const ROOM_META: Record<
  LiveRoomType,
  { icon: typeof GraduationCap; label: string }
> = {
  class: { icon: GraduationCap, label: "Live Class" },
  audio: { icon: Radio, label: "Audio Room" },
  market: { icon: LineChart, label: "Market Room" },
};

/** "Wed, Sep 2 · 7:00 PM ET" — always in market time (America/New_York). */
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
  if (mins < 60) return `Starts in ${Math.max(1, mins)} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Starts in ${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `Starts in ${days} day${days === 1 ? "" : "s"}`;
}

/** Scale-floored interest copy — never a fabricated crowd (GUARDRAILS). */
function interestCopy(n: number): string {
  if (n <= 0) return "Be the first to save your spot";
  if (n === 1) return "1 member interested";
  return `${n} members interested`;
}

function durationCopy(min: number | null): string | null {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ── the red on-air pulse (LIVE only) ─────────────────────────────────────────

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70 motion-reduce:hidden" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

// ── ticker chips (teal supporting accent) ────────────────────────────────────

function TickerChips({ tickers }: { tickers: string[] }) {
  if (!tickers.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tickers.slice(0, 6).map((t) => (
        <span
          key={t}
          className="rounded-full bg-teal-400/15 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide text-teal-700"
        >
          {t.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

// ── the shared header row (room type + host) ─────────────────────────────────

function HostLine({ event }: { event: LiveEventCardData }) {
  return (
    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-soft">
      <Avatar name={event.host.name} avatarUrl={event.host.avatarUrl} size="xs" />
      <span className="font-semibold text-ink">{event.host.name}</span>
    </div>
  );
}

// ── the Join / "Link coming" affordance ──────────────────────────────────────

function JoinAction({
  joinUrl,
  live,
}: {
  joinUrl: string | null;
  live: boolean;
}) {
  if (!joinUrl) {
    // Owner hasn't supplied the webinar link yet — graceful, honest.
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sand bg-sand/40 px-3 py-1.5 text-[12px] font-semibold text-soft">
        <Link2Off className="h-3.5 w-3.5" />
        Link coming
      </span>
    );
  }
  return (
    <a
      href={joinUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white transition-transform hover:-translate-y-px active:translate-y-0 motion-reduce:hover:translate-y-0 ${
        live ? "bg-red-500 hover:bg-red-600" : "bg-volt-500 hover:bg-volt-600"
      }`}
    >
      {live ? <Radio className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      {live ? "Join now" : "Enter room"}
    </a>
  );
}

// ── Remind Me (scheduled / starting_soon) ────────────────────────────────────

function RemindButton({
  event,
  onToggle,
}: {
  event: LiveEventCardData;
  onToggle?: (interested: boolean) => void;
}) {
  const [interested, setInterested] = useState(Boolean(event.interested));
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !interested;
    setInterested(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch(`/api/live/${event.id}/remind`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interested: next }),
      });
      if (!res.ok) throw new Error("failed");
      onToggle?.(next);
    } catch {
      setInterested(!next); // revert
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
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-transform hover:-translate-y-px active:translate-y-0 disabled:opacity-60 motion-reduce:hover:translate-y-0 ${
        interested
          ? "bg-volt-500/15 text-volt-700"
          : "bg-volt-500 text-white hover:bg-volt-600"
      }`}
    >
      {interested ? (
        <>
          <BellRing className="h-3.5 w-3.5" />
          Reminder set
        </>
      ) : (
        <>
          <Bell className="h-3.5 w-3.5" />
          Remind me
        </>
      )}
    </button>
  );
}

// ── the eyebrow (room type + state chip) ─────────────────────────────────────

function Eyebrow({ event }: { event: LiveEventCardData }) {
  const { icon: RoomIcon, label } = ROOM_META[event.room_type] ?? ROOM_META.class;
  const status = event.status;

  let chip: React.ReactNode = null;
  if (status === "live") {
    chip = (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
        <LiveDot />
        Live now
      </span>
    );
  } else if (status === "starting_soon") {
    chip = (
      <StatusChip tone="live" pulse>
        Starting soon
      </StatusChip>
    );
  } else if (status === "scheduled") {
    chip = <StatusChip tone="accent">Upcoming</StatusChip>;
  } else if (status === "ended") {
    chip = <StatusChip tone="neutral">Recap</StatusChip>;
  } else if (status === "replay_ready") {
    chip = <StatusChip tone="accent">Replay</StatusChip>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-soft">
        <RoomIcon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-soft/40">·</span>
      {chip}
    </div>
  );
}

// ── the recap body (ended / replay_ready) ────────────────────────────────────

function RecapBody({ event }: { event: LiveEventCardData }) {
  const dur = durationCopy(event.duration_min);
  const questions = event.top_questions ?? [];
  return (
    <div className="mt-3 space-y-3">
      {(dur || event.tickers.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-soft">
          {dur && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              {dur} session
            </span>
          )}
          {event.tickers.length > 0 && (
            <span>
              Covered{" "}
              <span className="font-mono font-bold text-ink">
                {event.tickers.slice(0, 5).map((t) => t.toUpperCase()).join(" · ")}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Kai recap — the ONLY Kai-blue moment on this card. Null until credits. */}
      {event.kai_summary ? (
        <div className="rounded-xl bg-kai-blue-soft p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-kai-blue">
            <Sparkles className="h-3.5 w-3.5" />
            Kai&apos;s recap
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">{event.kai_summary}</p>
        </div>
      ) : (
        <p className="text-[12px] italic text-soft">
          Kai&apos;s recap will be attached shortly.
        </p>
      )}

      {questions.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-soft">
            Top questions
          </div>
          <ul className="mt-1 space-y-1">
            {questions.slice(0, 3).map((q, i) => (
              <li key={i} className="text-[13px] leading-snug text-ink">
                “{q.q}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── the card ─────────────────────────────────────────────────────────────────

const LIVE_STATES: LiveEventStatus[] = ["live", "starting_soon"];

export default function LiveEventCard({
  event,
  onRemindToggled,
  className = "",
}: {
  event: LiveEventCardData;
  /** Fired after a successful Remind-Me toggle (S2 may refetch counts). */
  onRemindToggled?: (interested: boolean) => void;
  className?: string;
}) {
  // A ticking clock only where a countdown / near-start urgency is shown.
  const needsClock = event.status === "scheduled" || event.status === "starting_soon";
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!needsClock) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [needsClock]);

  const isLive = LIVE_STATES.includes(event.status);
  const accent = isLive ? "live" : event.status === "ended" ? "neutral" : "accent";
  const cd = useMemo(
    () => (needsClock ? countdown(event.starts_at, now) : null),
    [needsClock, event.starts_at, now]
  );

  return (
    <ObjectCard accent={accent} className={className}>
      <Eyebrow event={event} />

      <h3 className="mt-2 text-[16px] font-bold leading-snug text-ink">{event.title}</h3>

      {event.description && event.status !== "ended" && event.status !== "replay_ready" && (
        <p className="mt-1 text-[13px] leading-relaxed text-soft line-clamp-2">
          {event.description}
        </p>
      )}

      <HostLine event={event} />

      {/* State-specific body */}
      {event.status === "scheduled" && (
        <>
          <div className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-ink">
            <CalendarClock className="h-4 w-4 text-volt-600" />
            {formatStartET(event.starts_at)}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-soft">{interestCopy(event.interested_count)}</span>
            <RemindButton event={event} onToggle={onRemindToggled} />
          </div>
        </>
      )}

      {event.status === "starting_soon" && (
        <>
          <TickerChips tickers={event.tickers} />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-volt-700">
              <CalendarClock className="h-4 w-4" />
              {cd ?? "Starting any moment"}
            </span>
            {event.join_url ? (
              <JoinAction joinUrl={event.join_url} live={false} />
            ) : (
              <RemindButton event={event} onToggle={onRemindToggled} />
            )}
          </div>
        </>
      )}

      {event.status === "live" && (
        <>
          <TickerChips tickers={event.tickers} />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-soft">
              <Users className="h-4 w-4" />
              {event.viewer_count > 0
                ? `${event.viewer_count} watching`
                : "The room is open"}
            </span>
            <JoinAction joinUrl={event.join_url} live />
          </div>
        </>
      )}

      {(event.status === "ended" || event.status === "replay_ready") && (
        <>
          <RecapBody event={event} />
          <div className="mt-3 flex items-center justify-end">
            {event.replay_url ? (
              <a
                href={event.replay_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-volt-500 px-3.5 py-1.5 text-[12px] font-bold text-white transition-transform hover:-translate-y-px active:translate-y-0 motion-reduce:hover:translate-y-0 hover:bg-volt-600"
              >
                <Play className="h-3.5 w-3.5" />
                Watch replay
              </a>
            ) : (
              <span className="text-[11px] italic text-soft">
                Replay for VIP members — coming soon
              </span>
            )}
          </div>
        </>
      )}
    </ObjectCard>
  );
}

// ── LiveNowStrip — the compact above-mode-strip variant ──────────────────────

/**
 * LiveNowStrip — owner amendment #2: when a room is ACTIVE, a prominent strip
 * appears ABOVE the Feed|Lounge|Live mode strip (host · title · viewer count ·
 * Join). Only meaningful for live / starting_soon; renders nothing otherwise.
 * Full-bleed volt→red energy, not a boxed card — this is a banner, not an object.
 */
export function LiveNowStrip({
  event,
  className = "",
}: {
  event: LiveEventCardData;
  className?: string;
}) {
  if (event.status !== "live" && event.status !== "starting_soon") return null;
  const live = event.status === "live";
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/10 via-volt-500/10 to-transparent px-3.5 py-2.5 ${className}`}
    >
      {live ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
          <LiveDot />
          Live
        </span>
      ) : (
        <StatusChip tone="live" pulse>
          Soon
        </StatusChip>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-ink">{event.title}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-soft">
          <span className="font-semibold text-ink">{event.host.name}</span>
          {live && event.viewer_count > 0 && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {event.viewer_count}
              </span>
            </>
          )}
        </div>
      </div>

      <JoinAction joinUrl={event.join_url} live={live} />
    </div>
  );
}
