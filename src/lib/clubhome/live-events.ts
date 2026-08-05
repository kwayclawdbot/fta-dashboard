"use client";

/**
 * live_event — the S2.5 first-class object, consumed by S2 surfaces (Home Pulse
 * tier, The Club's Feed + Live tab + LIVE NOW strip).
 *
 * The backend + the canonical <LiveEventCard/> ship in the S2.5 lane under
 * /api/live/** + src/components/live/**. This module is the S2-side DATA layer
 * for those surfaces: it re-exports the shared props contract (LiveEventCardData
 * from @/lib/live/types) and a graceful data hook against GET /api/live
 * (degrades to [] on any non-200 — never an error, never a fabricated room).
 *
 * There is no fixture path. The demo harnesses that used one are gone, and a
 * live room is the one thing this app must never invent.
 */

import { useEffect, useRef, useState } from "react";
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

/** The shape returned by GET /api/live (S2.5 backend). */
interface LiveListResponse {
  live?: LiveEvent[];
  upcoming?: LiveEvent[];
  replays?: LiveEvent[];
}

/**
 * Load the Club's live_events. Hits GET /api/live (member-readable) and
 * flattens {live, upcoming, replays} into one ordered stream. Any non-200 (e.g.
 * 401 for a signed-out viewer) or network error degrades to [] so the surfaces
 * render nothing rather than a fabricated room.
 */
/**
 * Same load, but with the in-flight signal exposed. LOADING IS NOT EMPTY: the
 * hook starts at `[]`, so any consumer that renders "nobody is on the air" copy
 * off an empty array flashes that copy on every load. Callers that own such copy
 * must use THIS hook and gate on `loading`; `useLiveEvents` below is the
 * unchanged array-returning wrapper for callers that only render when non-empty.
 */
export function useLiveEventsState(): {
  events: LiveEvent[];
  loading: boolean;
} {
  const [fetched, setFetched] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
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
  }, []);

  return { events: fetched, loading };
}

/** The original array-returning hook — unchanged behaviour for every existing
 *  caller (they only render when the list is non-empty, so they never flash). */
export function useLiveEvents(): LiveEvent[] {
  return useLiveEventsState().events;
}
