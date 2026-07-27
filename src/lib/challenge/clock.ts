"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * SERVER-SEEDED CLOCK.
 *
 * Two rules are in tension on every countdown in this lane. (1) The challenge is
 * gated on the SERVER's clock — a device whose clock is a day fast must never
 * see Day 4 unlocked. (2) A React component may not call an impure function
 * (`Date.now()`) during render, and may not `setState` synchronously inside an
 * effect. `ChallengeSlot` was just fixed for the first of those; this module
 * satisfies both.
 *
 * SHAPE: the ticking value lives entirely in a module-level EXTERNAL STORE.
 *   • `primeServerClock(iso)` is called from an effect. It measures the drift
 *     between the server's `now` and this device ONCE and notifies subscribers.
 *     It is an imperative call into an external system, not a setState — which
 *     is exactly what an effect is for.
 *   • `getSnapshot` returns a cached SECOND BUCKET already shifted onto the
 *     server's timeline, so it is stable between calls (React would spin
 *     otherwise) and no component reads a clock while rendering.
 *   • `getServerSnapshot` returns null, so SSR and the first client render agree
 *     and the countdown fills in after hydration. Callers must design that first
 *     frame — a stated "—", never a fabricated 00:00:00.
 */

const SECOND_MS = 1_000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
/** Server time minus device time, in ms. */
let driftMs = 0;
let primed = false;
/** The cached, server-aligned second bucket. */
let bucket = 0;

function recompute(): void {
  const next = Math.floor((Date.now() + driftMs) / SECOND_MS);
  if (next !== bucket) {
    bucket = next;
    listeners.forEach((l) => l());
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!timer) {
    bucket = Math.floor((Date.now() + driftMs) / SECOND_MS);
    timer = setInterval(recompute, 250);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = (): number | null => (primed ? bucket : null);
const getServerSnapshot = (): number | null => null;

/**
 * Align the store to the server's clock. Safe to call repeatedly; it only
 * notifies when the measurement actually moves, so it cannot loop.
 */
export function primeServerClock(serverNowIso: string | null | undefined): void {
  if (!serverNowIso) return;
  const server = new Date(serverNowIso).getTime();
  if (!Number.isFinite(server)) return;
  const next = server - Date.now();
  if (primed && Math.abs(next - driftMs) < 2_000) return;
  driftMs = next;
  primed = true;
  bucket = Math.floor((Date.now() + driftMs) / SECOND_MS);
  listeners.forEach((l) => l());
}

/**
 * The SERVER's current time in epoch ms, ticking once a second.
 * `null` until hydration has primed the store.
 */
export function useServerNow(serverNowIso: string | null | undefined): number | null {
  const second = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    primeServerClock(serverNowIso);
  }, [serverNowIso]);

  return second == null ? null : second * SECOND_MS;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Total ms remaining; 0 once the target has passed. */
  ms: number;
  past: boolean;
}

/** Split a remaining-ms value into the four countdown fields. */
export function splitCountdown(ms: number): Countdown {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    ms: clamped,
    past: ms <= 0,
  };
}

/**
 * A live countdown to `targetIso`, on the SERVER's timeline.
 * Returns `null` until hydration — render a stated placeholder, not zeros.
 */
export function useCountdown(
  serverNowIso: string | null | undefined,
  targetIso: string | null | undefined
): Countdown | null {
  const now = useServerNow(serverNowIso);
  if (now == null || !targetIso) return null;
  const target = new Date(targetIso).getTime();
  if (!Number.isFinite(target)) return null;
  return splitCountdown(target - now);
}

/** Two-digit pad for countdown numerals. */
export function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}
