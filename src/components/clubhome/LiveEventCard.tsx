"use client";

import Link from "next/link";
import { Mic, LineChart, GraduationCap, Play, Users, Clock } from "lucide-react";
import Avatar from "@/components/Avatar";
import { StatusChip, ObjectCard } from "@/components/grammar";
import type { LiveEvent, LiveEventStatus, LiveRoomType } from "@/lib/clubhome/live-events";

/**
 * LiveEventCard — S2 stub for the S2.5 live_event object (props contract from the
 * convergence brief). The SAME object renders its CURRENT STATE everywhere it
 * appears (Home Pulse tier, The Club's Feed + Live tab), so its look is driven by
 * `status` + `room_type`, not by where it sits. Built only from grammar
 * primitives — an ObjectCard (a persistent object with its own URL) carrying a
 * `live` spine, a StatusChip for state, a TickerRow-style ticker chip row.
 *
 * ON FINAL REBASE swap the import to src/components/live/LiveEventCard (identical
 * shape) if the S2.5 lane shipped it.
 */

const ROOM_ICON: Record<LiveRoomType, React.ElementType> = {
  audio: Mic,
  market: LineChart,
  class: GraduationCap,
};
const ROOM_LABEL: Record<LiveRoomType, string> = {
  audio: "Audio room",
  market: "Market room",
  class: "Class",
};

function statusChip(status: LiveEventStatus) {
  switch (status) {
    case "live":
      return (
        <StatusChip tone="live" pulse>
          Live now
        </StatusChip>
      );
    case "starting_soon":
      return <StatusChip tone="live">Starting soon</StatusChip>;
    case "scheduled":
      return <StatusChip tone="accent">Scheduled</StatusChip>;
    case "ended":
      return <StatusChip tone="neutral">Ended</StatusChip>;
    case "replay_ready":
      return <StatusChip tone="support">Replay ready</StatusChip>;
  }
}

function whenLabel(e: LiveEvent): string {
  if (e.status === "live") return `${e.viewer_count.toLocaleString()} watching`;
  if (e.status === "replay_ready" || e.status === "ended")
    return e.duration_min ? `${e.duration_min} min replay` : "Recap ready";
  if (!e.starts_at) return "Soon";
  const mins = Math.round((new Date(e.starts_at).getTime() - Date.now()) / 60000);
  if (mins <= 0) return "Any moment";
  if (mins < 60) return `Starts in ${mins} min`;
  const d = new Date(e.starts_at);
  return `Starts ${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.toLocaleTimeString(
    "en-US",
    { hour: "numeric", minute: "2-digit" }
  )}`;
}

function ctaLabel(status: LiveEventStatus): string {
  if (status === "live") return "Join live";
  if (status === "starting_soon") return "Join";
  if (status === "replay_ready" || status === "ended") return "Watch replay";
  return "Remind me";
}

function href(e: LiveEvent): string {
  if (e.status === "replay_ready" || e.status === "ended")
    return e.replay_url || "/fta/recordings";
  return e.join_url || "/live-sessions";
}

/** Full live_event card — Feed + the Live tab room list. */
export default function LiveEventCard({ event: e }: { event: LiveEvent }) {
  const RoomIcon = ROOM_ICON[e.room_type];
  const active = e.status === "live" || e.status === "starting_soon";

  return (
    <ObjectCard accent="live" href={href(e)} className="!p-0 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-soft">
            <RoomIcon className="h-3.5 w-3.5 text-volt-600" />
            {ROOM_LABEL[e.room_type]}
          </span>
          {statusChip(e.status)}
        </div>

        <h3 className="mt-2.5 font-display text-[17px] font-bold leading-snug tracking-tight text-ink">
          {e.title}
        </h3>
        {e.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-soft">{e.description}</p>
        )}

        {e.tickers.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {e.tickers.map((t) => (
              <span
                key={t}
                className="rounded-md bg-sand/70 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={e.host.name} avatarUrl={e.host.avatarUrl ?? undefined} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{e.host.name}</p>
              <p className="inline-flex items-center gap-1 text-[11px] text-soft">
                {e.status === "live" ? (
                  <Users className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {whenLabel(e)}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold ${
              active
                ? "bg-volt-500 text-white shadow-soft"
                : "border border-sand bg-card text-ink"
            }`}
          >
            {e.status === "live" && <Play className="h-3.5 w-3.5" />}
            {ctaLabel(e.status)}
          </span>
        </div>
      </div>
    </ObjectCard>
  );
}

/**
 * LIVE NOW strip — amendment #2: when a room is live, a prominent full-bleed
 * volt band renders ABOVE the mode strip / above the Pulse tier. One primary
 * room, maximal urgency, one action.
 */
export function LiveNowStrip({ event: e }: { event: LiveEvent }) {
  const RoomIcon = ROOM_ICON[e.room_type];
  return (
    <Link
      href={href(e)}
      className="group relative block overflow-hidden rounded-2xl bg-gradient-to-r from-volt-600 via-volt-500 to-volt-600 p-4 text-white shadow-soft sm:p-5"
    >
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(120%_140%_at_100%_0%,rgba(255,255,255,0.5),transparent_60%)]" />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          {e.status === "live" ? "Live now" : "Starting soon"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[17px] font-extrabold leading-tight sm:text-[19px]">
            {e.title}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-white/85">
            <RoomIcon className="h-3.5 w-3.5" />
            {e.host.name}
            <span aria-hidden>·</span>
            {whenLabel(e)}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-volt-700 transition-transform group-hover:scale-[1.03]">
          {e.status === "live" && <Play className="h-4 w-4" />}
          {ctaLabel(e.status)}
        </span>
      </div>
    </Link>
  );
}
