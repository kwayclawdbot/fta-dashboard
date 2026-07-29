"use client";

import { useEffect } from "react";

/**
 * DESIGN v2 — the whole-app opt-in (globals.css §"HOW A ROUTE OPTS IN", form b).
 *
 * Mirrors the pattern of ModeManager/ThemeManager: mounted inside a converted
 * subtree, it stamps `data-design="v2"` onto <html> and removes it on unmount.
 * Because `data-theme` is ALSO on <html> (applied before first paint by the
 * root layout's inline script and kept live by ThemeManager), the two
 * attributes are co-located on the same element — which is exactly what the
 * light twin needs: `[data-design="v2"][data-theme="light"]` only matches when
 * both sit together. So the theme resolves flash-free and the light/dark twins
 * follow the user's existing preference with zero extra plumbing.
 *
 * The SSR markup of a converted surface is already v2-shaped (the flag is read
 * server-side too); only the --cc-* custom properties wait one tick for this
 * effect to land data-design. Converted roots carry token fallbacks so that
 * single frame is not visibly unstyled.
 *
 * This never renders when the flag is off (callers gate on designV2Enabled()),
 * so a production build never stamps data-design and every v2 selector stays
 * inert — v1 is untouched.
 */
export default function DesignManager() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-design");
    root.setAttribute("data-design", "v2");
    return () => {
      if (prev) root.setAttribute("data-design", prev);
      else root.removeAttribute("data-design");
    };
  }, []);

  return null;
}
