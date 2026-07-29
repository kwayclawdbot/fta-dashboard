"use client";

/**
 * V2Surface — the token scope for a converted Phase-1 surface.
 *
 * The v2 canvas tokens live under `[data-design="v2"]` in globals.css, and the
 * light twin under `[data-design="v2"][data-theme="light"]` — so BOTH attributes
 * must sit on the SAME element (globals.css §"data-design" note). Lane A will
 * eventually stamp them on <html>; until then each converted surface opts its
 * subtree in with this wrapper, which mirrors the app's live resolved theme so
 * the light twin tracks the member's setting with zero layout change. When Lane
 * A also sets the attributes on <html> this stays correct (redundant, matching).
 *
 * `useResolvedTheme()` reads the `data-theme` the root-layout inline script
 * stamped before paint, then re-reads on every theme change — so no flash and no
 * stale control. It returns "light" for the SSR snapshot; `suppressHydrationWarning`
 * covers the one-frame reconciliation to the painted value on hydration.
 */
import type { ReactNode } from "react";
import { useResolvedTheme } from "@/lib/useTheme";

export default function V2Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const theme = useResolvedTheme();
  return (
    <div
      data-design="v2"
      data-theme={theme}
      suppressHydrationWarning
      className={className}
      style={{ background: "var(--cc-bg)", color: "var(--cc-ink)" }}
    >
      {children}
    </div>
  );
}
