"use client";

import { useSyncExternalStore } from "react";
import {
  getResolvedTheme,
  getThemePref,
  ResolvedTheme,
  resolvePref,
  setThemePref,
  ThemePref,
  THEME_EVENT,
} from "@/lib/theme";

/**
 * THE THEME STORE IS OUTSIDE REACT — localStorage plus a `data-theme` attribute
 * that an inline script in the root layout stamps before first paint. Both
 * hooks below therefore READ it with `useSyncExternalStore` rather than seeding
 * a `useState("light")` and correcting it in an effect.
 *
 * That correction-in-an-effect is what shipped the Settings bug: the APPEARANCE
 * control reported LIGHT while the app was plainly dark. A constant initial
 * state that is only fixed by an effect is wrong for at least one frame, stays
 * wrong for any render path where the effect does not land, and cannot see a
 * change made anywhere other than through this hook. `useSyncExternalStore`
 * has none of those failure modes: it hydrates with the server snapshot, then
 * re-reads the real value, and re-reads it again on every broadcast.
 *
 * IT SUBSCRIBES TO THREE THINGS: the app's own THEME_EVENT, the `storage`
 * event (another tab switching theme), and — for the preference — the resolved
 * `data-theme` currently on <html>. That last one is the reconciliation: if the
 * page is painted dark while the stored preference says light (a stale write,
 * a preference cleared behind the app's back, an attribute stamped by anything
 * other than setThemePref), the CONTROL FOLLOWS THE PAINT. A theme selector
 * that disagrees with the screen is lying about which one is selected, and the
 * screen is the thing the member can see.
 */

function subscribe(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Snapshots are plain strings, so referential stability is free. */
const serverResolved = (): ResolvedTheme => "light";
const serverPref = (): ThemePref => "light";

function clientPref(): ThemePref {
  const pref = getThemePref();
  const painted = getResolvedTheme();
  // `system` is honest whenever it resolves to what is painted; if it does not,
  // it is stale and the painted theme is the truth.
  return resolvePref(pref) === painted ? pref : painted;
}

/**
 * Subscribe to the resolved theme (`light` | `dark`). Returns `light` during
 * SSR / first render to match the server, then syncs to the applied theme and
 * to every subsequent change — used by client widgets (e.g. TradingView
 * embeds) that need to re-render with the active theme.
 */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, getResolvedTheme, serverResolved);
}

/**
 * Read + set the persisted theme preference (`light` | `dark` | `system`).
 * Reflects updates made from anywhere in the app — and never reports a
 * preference that contradicts the theme actually on screen.
 */
export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const pref = useSyncExternalStore(subscribe, clientPref, serverPref);
  // setThemePref writes localStorage, stamps <html data-theme> and broadcasts
  // THEME_EVENT — which is exactly the subscription above, so the control
  // re-reads the new truth instead of holding a second copy of it.
  return [pref, setThemePref];
}
