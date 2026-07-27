"use client";

import { useEffect, useRef } from "react";
import KaiChatShared from "@/components/kai/KaiChatShared";

/**
 * KaiPanel — the Kai slide-over launched by the floating action button.
 *
 *   • Desktop (md+): a ~420px docked panel on the right edge. No scrim — the
 *     page stays fully interactive behind it (a research co-pilot you consult
 *     while you work, not a modal that seizes the screen).
 *   • Mobile: a ~85vh bottom sheet over a tap-to-dismiss scrim, with a grab
 *     handle you can flick down to close.
 *
 * It stays MOUNTED once opened (visibility is a CSS transform, not mount/unmount)
 * so the conversation — thread, history, scroll — persists across open/close.
 * The real chat is <KaiChatShared variant="panel">, the same component the /kai
 * page renders, so thread/usage/streaming behavior is identical with no server
 * changes. Mode/register skin (club volt · family gold · kid) cascades in from
 * the dashboard's data-mode wrapper automatically.
 *
 * ── CANVAS V2 (cohesion lane) ────────────────────────────────────────────────
 * This is chrome, not content — KaiChatShared owns every pixel inside it,
 * including the Kai identity (`.f0-kai-mark`). So the migration is about the
 * two things the shell itself was getting wrong in dark:
 *
 *   · THE SCRIM was `bg-black/45`. Tailwind's `black` is a constant, so the wash
 *     was identical on a cream page and on the obsidian one, where 45% is far
 *     too weak to separate a sheet from its ground. `.bg-scrim` is the system's
 *     scrim and it deepens at night (the same fix every other sheet took).
 *   · THE ELEVATION was two hardcoded `rgba(16,24,40,…)` shadows — a cool
 *     blue-grey on a warm system, and a light-page shadow that simply vanishes
 *     against a near-black page. `shadow-lift` is the themed token: warm and
 *     subtle on cream, deep and wide on obsidian.
 *
 * Both were invisible-in-light bugs, which is exactly why they survived: the
 * panel was only ever looked at in the light theme.
 */
export default function KaiPanel({
  open,
  onClose,
  contextChip = null,
  initialInput = null,
  contextNonce = 0,
}: {
  open: boolean;
  onClose: () => void;
  /** Page-context label shown as a Kai-blue chip in the sheet header. */
  contextChip?: string | null;
  /** Prefill the composer when the sheet opens with context. */
  initialInput?: string | null;
  /** Bumps each fresh contextual open so the chip/prefill re-apply. */
  contextNonce?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes the panel (when open).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Mobile swipe-down-to-dismiss on the grab handle. Direct-transform during the
  // drag (transition off so it tracks the finger), then hand back to the CSS
  // class on release — a flick or a past-threshold drag closes, otherwise it
  // snaps back.
  const drag = useRef<{ startY: number; startT: number; active: boolean }>({
    startY: 0,
    startT: 0,
    active: false,
  });

  function onHandleDown(e: React.PointerEvent) {
    const el = panelRef.current;
    if (!el) return;
    drag.current = { startY: e.clientY, startT: Date.now(), active: true };
    el.style.transition = "none";
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onHandleMove(e: React.PointerEvent) {
    const el = panelRef.current;
    if (!el || !drag.current.active) return;
    const dy = Math.max(0, e.clientY - drag.current.startY); // down only
    el.style.transform = `translateY(${dy}px)`;
  }
  function onHandleUp(e: React.PointerEvent) {
    const el = panelRef.current;
    if (!el || !drag.current.active) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    const dt = Date.now() - drag.current.startT;
    const velocity = dy / Math.max(dt, 1);
    drag.current.active = false;
    // Restore class-driven transform (with its transition) then decide.
    el.style.transition = "";
    el.style.transform = "";
    if (dy > 120 || velocity > 0.5) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-none"
      aria-hidden={!open}
    >
      {/* Scrim — mobile only; desktop leaves the page interactive. */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-scrim transition-opacity duration-300 md:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* The panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label="Ask Kai"
        className={`pointer-events-auto absolute flex flex-col bg-paper shadow-lift
          transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none
          bottom-0 inset-x-0 h-[85vh] rounded-t-2xl
          md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[420px] md:max-w-[92vw] md:rounded-none md:border-l md:border-sand
          ${
            open
              ? "translate-y-0 md:translate-x-0"
              : "translate-y-full md:translate-y-0 md:translate-x-full"
          }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Grab handle — mobile only, swipe down to dismiss */}
        <div
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          className="flex shrink-0 cursor-grab touch-none justify-center py-2 active:cursor-grabbing md:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-sand" />
        </div>

        <div className="min-h-0 flex-1">
          {/* The parent only mounts KaiPanel after the FAB's first open and keeps
              it mounted thereafter, so the conversation (thread, history, scroll)
              persists across open/close. */}
          <KaiChatShared
            variant="panel"
            onClose={onClose}
            contextChip={contextChip}
            initialInput={initialInput}
            contextNonce={contextNonce}
          />
        </div>
      </div>
    </div>
  );
}
