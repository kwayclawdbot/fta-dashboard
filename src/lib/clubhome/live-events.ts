"use client";

/**
 * live_event — the S2.5 first-class object, consumed by S2 surfaces (Home Pulse
 * tier, The Club's Feed + Live tab + LIVE NOW strip).
 *
 * The backend + the canonical <LiveEventCard/> ship in the S2.5 lane under
 * /api/live/** + src/components/live/**. This module is the S2-side DATA layer
 * for those surfaces: it re-exports the shared props contract (LiveEventCardData
 * from @/lib/live/types), a graceful data hook against GET /api/live (degrades to
 * [] on any non-200 — never an error, never a fabricated room), and preview
 * fixtures so the /club/preview + ?events=demo harnesses can SEE the LIVE NOW
 * strip and live cards before real rooms run.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { fixturesAllowed } from "./client";
import type { ClubScale } from "./contract";
import type {
  LiveEventCardData,
  LiveEventStatus,
  LiveRoomType,
} from "@/lib/live/types";

// Re-exported so existing S2 imports (`import type { LiveEvent } from
// "@/lib/clubhome/live-events"`) keep resolving to the canonical shape.
export type { LiveEventStatus, LiveRoomType };
/** The live_event props contract — an alias to the canonical LiveEventCardData. */
export type LiveEvent = LiveEventCardData;

/** A room is "on the air" (urgent) when live or just about to start. */
export function isEventUrgent(e: LiveEvent): boolean {
  return e.status === "live" || e.status === "starting_soon";
}

/** The single most prominent active room for the LIVE NOW strip (live first). */
export function primaryLiveEvent(events: LiveEvent[]): LiveEvent | null {
  const live = events.filter((e) => e.status === "live");
  if (live.length)
    return [...live].sort((a, b) => b.viewer_count - a.viewer_count)[0];
  const soon = events
    .filter((e) => e.status === "starting_soon")
    .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""));
  return soon[0] ?? null;
}

// ── preview fixtures (design review only — never reaches production) ──────────
function fixtureEvents(scale: ClubScale): LiveEvent[] {
  const inMin = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
  const live: LiveEvent = {
    id: "le-live-1",
    status: "live",
    room_type: "market",
    title: "Nvidia into earnings — reading the tape live",
    description: "Walking the chart, levels, and what the Club is watching.",
    tickers: ["NVDA", "AMD"],
    host: { name: "Coach Ray", avatarUrl: null },
    viewer_count: scale === "founding" ? 9 : 214,
    interested_count: scale === "founding" ? 14 : 512,
    starts_at: inMin(-12),
    ended_at: null,
    duration_min: null,
    join_url: "/live-sessions",
    replay_url: null,
    interested: false,
    kai_summary: null,
    top_questions: [],
  };
  const soon: LiveEvent = {
    id: "le-soon-1",
    status: "starting_soon",
    room_type: "class",
    title: "Foundations: reading a candle like a pro",
    description: "The Tuesday class — bring a chart.",
    tickers: [],
    host: { name: "Coach Mia", avatarUrl: null },
    viewer_count: 0,
    interested_count: scale === "founding" ? 8 : 112,
    starts_at: inMin(24),
    ended_at: null,
    duration_min: 45,
    join_url: "/live-sessions",
    replay_url: null,
    interested: false,
    kai_summary: null,
    top_questions: [],
  };
  const replay: LiveEvent = {
    id: "le-replay-1",
    status: "replay_ready",
    room_type: "market",
    title: "Fed day recap — what actually mattered",
    description: null,
    tickers: ["SPY", "TLT"],
    host: { name: "Coach Ray", avatarUrl: null },
    viewer_count: 0,
    interested_count: scale === "founding" ? 11 : 340,
    starts_at: inMin(-1440),
    ended_at: inMin(-1380),
    duration_min: 52,
    join_url: null,
    replay_url: "/fta/recordings",
    interested: false,
    kai_summary:
      "Powell held rates; the tape faded the knee-jerk pop and reclaimed the range. Focus stayed on rate-sensitive names.",
    top_questions: [{ q: "Is the range still valid into Friday?", count: 7 }],
  };
  return scale === "founding" ? [soon, replay] : [live, soon, replay];
}

export interface UseLiveEventsOptions {
  fixtures?: boolean;
  scale?: ClubScale;
}

/** The shape returned by GET /api/live (S2.5 backend). */
interface LiveListResponse {
  live?: LiveEvent[];
  upcoming?: LiveEvent[];
  replays?: LiveEvent[];
}

/**
 * Load the Club's live_events. Fixtures short-circuit for design review; live
 * mode hits GET /api/live (member-readable) and flattens {live, upcoming,
 * replays} into one ordered stream. Any non-200 (e.g. 401 for a signed-out
 * viewer) or network error degrades to [] so the surfaces render nothing rather
 * than a fabricated room.
 */
/**
 * Same load, but with the in-flight signal exposed. LOADING IS NOT EMPTY: the
 * hook starts at `[]`, so any consumer that renders "nobody is on the air" copy
 * off an empty array flashes that copy on every load. Callers that own such copy
 * must use THIS hook and gate on `loading`; `useLiveEvents` below is the
 * unchanged array-returning wrapper for callers that only render when non-empty.
 */
export function useLiveEventsState(
  opts: UseLiveEventsOptions = {}
): { events: LiveEvent[]; loading: boolean } {
  const usingFixtures = !!opts.fixtures && fixturesAllowed();
  const scale: ClubScale = opts.scale ?? "scale";

  const fixtureData = useMemo(
    () => (usingFixtures ? fixtureEvents(scale) : null),
    [usingFixtures, scale]
  );

  // Live fetch state only — the fixtures path is derived synchronously below, so
  // no setState runs inside the effect body (react-hooks/set-state-in-effect).
  const [fetched, setFetched] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(!usingFixtures);
  const started = useRef(false);

  useEffect(() => {
    if (usingFixtures || started.current) return;
    started.current = true;
    const ctrl = new AbortController();
    let mounted = true;
    void (async () => {
      try {
        const res = await fetch(`/api/live`, {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) return; // 401 (signed out) / error → stay []
        const json = (await res.json()) as LiveListResponse;
        const merged = [
          ...(Array.isArray(json.live) ? json.live : []),
          ...(Array.isArray(json.upcoming) ? json.upcoming : []),
          ...(Array.isArray(json.replays) ? json.replays : []),
        ];
        if (mounted) setFetched(merged);
      } catch {
        /* network/abort → stay [] */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [usingFixtures]);

  return usingFixtures
    ? { events: fixtureData ?? [], loading: false }
    : { events: fetched, loading };
}

/** The original array-returning hook — unchanged behaviour for every existing
 *  caller (they only render when the list is non-empty, so they never flash). */
export function useLiveEvents(opts: UseLiveEventsOptions = {}): LiveEvent[] {
  return useLiveEventsState(opts).events;
}
