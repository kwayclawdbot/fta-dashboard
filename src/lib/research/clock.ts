"use client";

import { useSyncExternalStore } from "react";

/**
 * THE WALL CLOCK, READ ONCE, ON THE CLIENT ONLY.
 *
 * Reading `Date.now()` during render is two bugs at once on this surface:
 *   • the server renders one "now" and the client renders another, so any
 *     relative time ("today", "3m ago") is a hydration mismatch waiting to
 *     happen; and
 *   • the server's clock is not the reader's clock, which is how a Sunday page
 *     ended up labelling Friday's print "today".
 *
 * `useSyncExternalStore` is the sanctioned way to have a value that is simply
 * ABSENT on the server and present after hydration: the server snapshot is
 * null, the client snapshot is a single timestamp captured at first read and
 * held stable thereafter (a getSnapshot that changed on every call would spin).
 * Callers render nothing rather than a guess while it is null.
 */
let captured: number | null = null;

/** Never emits — this value is fixed for the life of the document. */
const subscribe = () => () => {};

const clientSnapshot = () => (captured ??= Date.now());
const serverSnapshot = () => null;

export function useClientNow(): number | null {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
