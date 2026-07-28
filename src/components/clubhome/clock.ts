"use client";

import { useSyncExternalStore } from "react";

/**
 * HOUR-BUCKETED CLOCK — the only clock Home reads.
 *
 * The greeting on board 01 ("GM, Marcus") depends on the viewer's local hour,
 * which the server cannot know. Two rules are in tension:
 *
 *   1. A component may not call an impure function (`new Date()` / `Date.now()`)
 *      during render — React may render speculatively, and two renders that
 *      straddle a second would disagree.
 *   2. SSR and the first client render must produce identical markup.
 *
 * Same shape as the challenge lane's server-seeded clock (src/lib/challenge/
 * clock.ts), reduced to what Home needs: the value lives in a module-level
 * EXTERNAL STORE, `getSnapshot` returns a cached HOUR (stable between calls, so
 * React cannot spin), and `getServerSnapshot` returns null so the server and the
 * first client render agree. The caller must design that first frame — a neutral
 * greeting, never a guessed one.
 *
 * The store is primed on `subscribe`, which React calls in the commit phase and
 * immediately follows with a fresh `getSnapshot`; so the real hour lands on the
 * render straight after mount with no effect and no setState.
 */

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let primed = false;
/** The viewer's local hour, 0–23. Cached; only reassigned when it changes. */
let hour = 0;

function recompute(): void {
  const next = new Date().getHours();
  if (next !== hour) {
    hour = next;
    listeners.forEach((l) => l());
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!timer) {
    hour = new Date().getHours();
    primed = true;
    // A minute is far finer than an hour bucket needs, and it costs nothing —
    // it just means a tab left open across the boundary updates promptly.
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

const getSnapshot = (): number | null => (primed ? hour : null);
const getServerSnapshot = (): number | null => null;

/** The viewer's local hour, or `null` before the store primes. */
export function useLocalHour(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
