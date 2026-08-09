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

/**
 * APPEARANCE POLICY — the door decides what the theme system is allowed to do.
 *
 *   • club   → DARK by default (the Club is "epic by night"); the member may
 *              toggle light/dark/system in Settings and the choice is honored.
 *   • family → LIGHT, always. Family Mode (kids included) is a light-only
 *              surface; a stored dark preference is ignored while it applies.
 *
 * The policy is stamped into a cookie by ModeManager (the shell knows the
 * member's door) so the root layout's pre-paint script can apply the right
 * default on the NEXT load without a light→dark flash.
 */
export type AppearancePolicy = "club" | "family";

export const THEME_KEY = "fta-theme";
export const THEME_EVENT = "fta-themechange";
export const APPEARANCE_COOKIE = "cc-appearance";

/* The browser-chrome colour, which must track --paper or the status bar reads
   as a seam above the page. Light moved to the reference canvases' warm paper
   when the base neutrals did; dark is unchanged. Mirrored by the inline
   THEME_INIT script in layout.tsx (it runs before this module loads). */
const LIGHT_META = "#F7F4EF";
const DARK_META = "#17120B";
/** Club-dark paper (globals.css club-dark block — the pure-black terminal) —
 *  the status bar must match --paper or it reads as a seam above the page. */
const DARK_META_CLUB = "#050505";

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "dark" || v === "system" ? v : "light";
}

/**
 * The RAW stored preference, or null when the member has never chosen one.
 * getThemePref() collapses "unset" into "light", which was correct when light
 * was the only default — under the club policy an unset preference must be
 * distinguishable so it can default DARK instead.
 */
export function getStoredThemePref(): ThemePref | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : null;
}

/** Read the appearance-policy cookie (stamped by ModeManager). */
export function getAppearancePolicy(): AppearancePolicy | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + APPEARANCE_COOKIE + "=([^;]*)")
  );
  return m?.[1] === "club" || m?.[1] === "family"
    ? (m[1] as AppearancePolicy)
    : null;
}

/**
 * Resolve a theme UNDER A POLICY.
 *   family → light, whatever is stored.
 *   club   → the stored preference if there is one (light/dark/system all
 *            honored), else DARK — the club default.
 *   null   → the legacy resolution (stored-or-light) for policy-less surfaces
 *            (auth, admin, a first-ever visit).
 */
export function resolveForPolicy(
  policy: AppearancePolicy | null,
  stored: ThemePref | null
): ResolvedTheme {
  if (policy === "family") return "light";
  if (policy === "club") return stored ? resolvePref(stored) : "dark";
  return resolvePref(stored ?? "light");
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
  const color =
    resolved === "dark"
      ? getAppearancePolicy() === "club"
        ? DARK_META_CLUB
        : DARK_META
      : LIGHT_META;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", color));
  window.dispatchEvent(
    new CustomEvent<ResolvedTheme>(THEME_EVENT, { detail: resolved })
  );
}

/** Persist a preference and apply it immediately (under the active policy —
 *  a family-mode surface stays light even if something writes "dark"). */
export function setThemePref(pref: ThemePref) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_KEY, pref);
  }
  applyResolved(resolveForPolicy(getAppearancePolicy(), pref));
}

export function getResolvedTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}
