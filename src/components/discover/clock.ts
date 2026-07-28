"use client";

import { useSyncExternalStore } from "react";

/**
 * HOUR-BUCKETED "NOW" — the only clock the Discover / News lane reads.
 *
 * Timestamps ("2h ago") need a reading of the wall clock, but a component may
 * not call `Date.now()` during render: React can render speculatively, and two
 * renders that straddle a tick would disagree — which on a server-rendered feed
 * shows up as a hydration mismatch on every dateline.
 *
 * Same shape as `src/components/clubhome/clock.ts`, carrying a millisecond
 * stamp instead of an hour: the value lives in a module-level EXTERNAL STORE,
 * `getSnapshot` returns a CACHED stamp (stable between calls, so React cannot
 * spin) that is only reassigned when the hour bucket rolls over, and
 * `getServerSnapshot` returns null so the server and the first client render
 * agree. Callers must design that first frame — `timeAgoAt` returns null before
 * the store primes, and the dateline simply omits the stamp rather than
 * guessing one.
 */

const HOUR = 3_600_000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let primed = false;
/** Milliseconds since epoch, floored to the hour. Cached. */
let stamp = 0;

function bucket(): number {
  return Math.floor(Date.now() / HOUR) * HOUR;
}

function recompute(): void {
  const next = bucket();
  if (next !== stamp) {
    stamp = next;
    listeners.forEach((l) => l());
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!timer) {
    stamp = bucket();
    primed = true;
    timer = setInterval(recompute, 60_000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = (): number | null => (primed ? stamp : null);
const getServerSnapshot = (): number | null => null;

/** The current hour bucket in ms, or `null` before the store primes. */
export function useNowHour(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * PURE relative-time formatter. Takes the reading rather than taking one, so it
 * is safe to call during render. Returns null when either side is unknown —
 * the caller renders nothing, never "just now" as a stand-in.
 */
export function timeAgoAt(
  iso: string | null | undefined,
  now: number | null
): string | null {
  if (!iso || now == null) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 3600) {
    const m = Math.floor(secs / 60);
    return m <= 1 ? "just now" : `${m}m ago`;
  }
  if (secs < 86_400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604_800) return `${Math.floor(secs / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
