"use client";

/**
 * live_event — the S2.5 first-class object, consumed by S2 surfaces (Home Pulse
 * tier, The Club's Feed + Live tab + LIVE NOW strip).
 *
 * The BACKEND + the canonical <LiveEventCard/> are built by the parallel S2.5
 * lane under /api/live/** + src/components/live/**. Until that lands this module
 * is the S2 stub: the exact props contract from the convergence brief, a
 * graceful data hook (the live endpoint 404s today → [] , never an error), and
 * preview fixtures so design review can SEE the LIVE NOW strip and live cards.
 *
 * ON FINAL REBASE: if src/components/live/LiveEventCard exists, swap the S2
 * imports to it and delete the local card; the shapes are identical so the
 * surfaces don't change.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { fixturesAllowed } from "./client";
import type { ClubScale } from "./contract";

export type LiveEventStatus =
  | "scheduled"
  | "starting_soon"
  | "live"
  | "ended"
  | "replay_ready";
export type LiveRoomType = "audio" | "market" | "class";

export interface LiveEventHost {
  name: string;
  avatarUrl?: string | null;
}

/** The exact props contract handed down for the S2.5 live_event object. */
export interface LiveEvent {
  id: string;
  status: LiveEventStatus;
  room_type: LiveRoomType;
  title: string;
  description?: string | null;
  tickers: string[];
  host: LiveEventHost;
  viewer_count: number;
  interested_count: number;
  starts_at: string | null;
  ended_at?: string | null;
  duration_min?: number | null;
  join_url?: string | null;
  replay_url?: string | null;
}

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
    duration_min: null,
    join_url: "/live-sessions",
    replay_url: null,
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
    duration_min: 45,
    join_url: "/live-sessions",
    replay_url: null,
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
  };
  return scale === "founding" ? [soon, replay] : [live, soon, replay];
}

export interface UseLiveEventsOptions {
  fixtures?: boolean;
  scale?: ClubScale;
}

/**
 * Load the Club's live_events. Fixtures short-circuit for design review; live
 * mode hits the (S2.5-owned) endpoint and degrades to [] on any non-200 so the
 * surfaces render nothing until the backend lands — never an error, never a
 * fabricated room.
 */
export function useLiveEvents(opts: UseLiveEventsOptions = {}): LiveEvent[] {
  const usingFixtures = !!opts.fixtures && fixturesAllowed();
  const scale: ClubScale = opts.scale ?? "scale";

  const fixtureData = useMemo(
    () => (usingFixtures ? fixtureEvents(scale) : null),
    [usingFixtures, scale]
  );

  // Live fetch state only — the fixtures path is derived synchronously below, so
  // no setState runs inside the effect body (react-hooks/set-state-in-effect).
  const [fetched, setFetched] = useState<LiveEvent[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (usingFixtures || started.current) return;
    started.current = true;
    const ctrl = new AbortController();
    let mounted = true;
    void (async () => {
      try {
        const res = await fetch(`/api/club/live`, {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) return; // 404 today (S2.5 not landed) → stay []
        const json = (await res.json()) as { events?: LiveEvent[] };
        if (mounted && Array.isArray(json.events)) setFetched(json.events);
      } catch {
        /* network/abort → stay [] */
      }
    })();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [usingFixtures]);

  return usingFixtures ? fixtureData ?? [] : fetched;
}
