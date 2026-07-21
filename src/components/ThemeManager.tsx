"use client";

import { useEffect } from "react";
import { applyResolved, getThemePref, resolvePref } from "@/lib/theme";

/**
 * Mounted once in the root layout. The inline head script already applied the
 * stored preference before paint; this keeps `system` mode live by re-resolving
 * when the OS light/dark setting changes while the app is open.
 */
export default function ThemeManager() {
  useEffect(() => {
    // Re-sync on mount (defensive — e.g. bfcache restores).
    applyResolved(resolvePref(getThemePref()));

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getThemePref() === "system") {
        applyResolved(resolvePref("system"));
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return null;
}
