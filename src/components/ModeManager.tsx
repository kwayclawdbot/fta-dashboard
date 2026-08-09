"use client";

import { useEffect } from "react";
import {
  APPEARANCE_COOKIE,
  applyResolved,
  getStoredThemePref,
  resolveForPolicy,
  type AppearancePolicy,
} from "@/lib/theme";

export type AppMode = "club" | "family" | "fta";

/**
 * Mirrors the member's MODE onto <html data-mode> so the whole document —
 * including <body>'s background (which lives outside the DashboardShell
 * wrapper) — picks up the mode-scoped palette defined in globals.css.
 *
 * The shell already stamps `data-mode` on its own wrapper div for the app
 * subtree (SSR-stable); this covers the body/overscroll chrome and swaps the
 * browser-tab favicon so a Club member sees the infinity mark in their tab.
 *
 * Family mode keeps the current (FTA-candle) favicon; the installed PWA icon
 * is fixed at install time from the manifest and can't be per-member — noted
 * for R2 (a mode-aware manifest route would be the fuller fix).
 */
const FAVICON: Record<AppMode, string | null> = {
  club: "/icons/club-favicon-32.png",
  family: null, // keep the document's default <link rel=icon>
  fta: null,
};

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon'][data-mode-managed]");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.setAttribute("data-mode-managed", "");
    document.head.appendChild(link);
  }
  link.href = href;
}

function clearFavicon() {
  document
    .querySelectorAll("link[rel~='icon'][data-mode-managed]")
    .forEach((el) => el.remove());
}

export default function ModeManager({
  mode,
  appearance,
}: {
  mode: AppMode;
  /**
   * The member's APPEARANCE POLICY (club: dark default + honored toggle ·
   * family: light only). Stamped into a cookie so the root layout's pre-paint
   * script applies the right default on the next load, and enforced
   * immediately here so a family surface can never sit dark (and a club
   * member's first session lands dark without waiting for a reload).
   */
  appearance?: AppearancePolicy;
}) {
  useEffect(() => {
    if (!appearance) return;
    document.cookie = `${APPEARANCE_COOKIE}=${appearance}; path=/; max-age=31536000; SameSite=Lax`;
    applyResolved(resolveForPolicy(appearance, getStoredThemePref()));
  }, [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-mode");
    root.setAttribute("data-mode", mode);

    const fav = FAVICON[mode];
    if (fav) setFavicon(fav);
    else clearFavicon();

    return () => {
      // Restore prior mode (or drop the attribute) when the shell unmounts so
      // non-shell routes (auth, admin) fall back to the family default.
      if (prev) root.setAttribute("data-mode", prev);
      else root.removeAttribute("data-mode");
      clearFavicon();
    };
  }, [mode]);

  return null;
}
