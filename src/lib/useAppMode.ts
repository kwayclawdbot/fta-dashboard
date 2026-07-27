"use client";

import { useEffect, useState } from "react";
import type { AppMode } from "@/components/ModeManager";

/**
 * useAppMode — read the member's active shell MODE (club · family · fta) from
 * the `data-mode` attribute the DashboardShell stamps on <html> (via
 * ModeManager) and on its wrapper div. This is the single primitive a screen
 * uses to switch to the CLUB-register composition (canvas: sand + volt orange,
 * trader voice) without forking family behaviour — every family/kid surface is
 * left byte-for-byte identical because the branch only fires when mode==="club".
 *
 * SSR-safe: renders `family` on the server / first paint (the historical
 * default, so the family tree never flickers), then resolves the real mode on
 * mount. Club screens gate their new composition behind `mode === "club"`, so
 * the worst case on hydration is a one-frame family render for a club member —
 * acceptable, and avoids a hydration mismatch on the family tree.
 */
export function useAppMode(): AppMode {
  const [mode, setMode] = useState<AppMode>("family");
  useEffect(() => {
    const read = () => {
      const v =
        document.documentElement.getAttribute("data-mode") ||
        document.querySelector("[data-mode]")?.getAttribute("data-mode");
      if (v === "club" || v === "family" || v === "fta") setMode(v);
    };
    read();
    // ModeManager sets the attribute in its own effect; re-read on the next
    // frame in case this hook's effect ran first.
    const raf = requestAnimationFrame(read);
    return () => cancelAnimationFrame(raf);
  }, []);
  return mode;
}
