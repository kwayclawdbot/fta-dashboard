"use client";

import { useEffect } from "react";
import {
  applyResolved,
  getAppearancePolicy,
  getStoredThemePref,
  resolveForPolicy,
} from "@/lib/theme";

/**
 * Mounted once in the root layout. The inline head script already applied the
 * stored preference before paint; this keeps `system` mode live by re-resolving
 * when the OS light/dark setting changes while the app is open.
 *
 * Both paths resolve UNDER THE APPEARANCE POLICY (club: dark default + honored
 * toggle · family: light only) — see src/lib/theme.ts.
 */
export default function ThemeManager() {
  useEffect(() => {
    // Re-sync on mount (defensive — e.g. bfcache restores).
    applyResolved(resolveForPolicy(getAppearancePolicy(), getStoredThemePref()));

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredThemePref() === "system") {
        applyResolved(resolveForPolicy(getAppearancePolicy(), "system"));
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return null;
}
