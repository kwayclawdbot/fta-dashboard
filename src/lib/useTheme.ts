"use client";

import { useEffect, useState } from "react";
import {
  getResolvedTheme,
  getThemePref,
  ResolvedTheme,
  setThemePref,
  ThemePref,
  THEME_EVENT,
} from "@/lib/theme";

/**
 * Subscribe to the resolved theme (`light` | `dark`). Returns `light` during
 * SSR / first render to match the server, then syncs after mount and on every
 * theme change broadcast — used by client widgets (e.g. TradingView embeds)
 * that need to re-render with the active theme.
 */
export function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    setTheme(getResolvedTheme());
    const handler = () => setTheme(getResolvedTheme());
    window.addEventListener(THEME_EVENT, handler);
    return () => window.removeEventListener(THEME_EVENT, handler);
  }, []);

  return theme;
}

/**
 * Read + set the persisted theme preference (`light` | `dark` | `system`).
 * Reflects updates made from anywhere in the app.
 */
export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>("light");

  useEffect(() => {
    setPref(getThemePref());
    const handler = () => setPref(getThemePref());
    window.addEventListener(THEME_EVENT, handler);
    return () => window.removeEventListener(THEME_EVENT, handler);
  }, []);

  const update = (p: ThemePref) => {
    setPref(p);
    setThemePref(p);
  };

  return [pref, update];
}
