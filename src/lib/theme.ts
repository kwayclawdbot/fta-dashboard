"use client";

/**
 * Theme system — warm-paper light (brand default) + warm-charcoal dark.
 *
 * Preference (`light` | `dark` | `system`) is stored in localStorage under
 * `fta-theme`. The *resolved* theme (`light` | `dark`) is written to
 * <html data-theme="…">, which drives the CSS variable overrides in
 * globals.css. A tiny inline script in the root layout applies the stored
 * preference before first paint (no flash) — this module keeps it in sync
 * afterwards and handles live OS changes when the preference is `system`.
 */

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "fta-theme";
export const THEME_EVENT = "fta-themechange";

const LIGHT_META = "#FBF7EF";
const DARK_META = "#17120B";

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "dark" || v === "system" ? v : "light";
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolvePref(pref: ThemePref): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

/** Apply a resolved theme to the DOM + PWA chrome, and broadcast the change. */
export function applyResolved(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
  const color = resolved === "dark" ? DARK_META : LIGHT_META;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", color));
  window.dispatchEvent(
    new CustomEvent<ResolvedTheme>(THEME_EVENT, { detail: resolved })
  );
}

/** Persist a preference and apply it immediately. */
export function setThemePref(pref: ThemePref) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_KEY, pref);
  }
  applyResolved(resolvePref(pref));
}

export function getResolvedTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}
