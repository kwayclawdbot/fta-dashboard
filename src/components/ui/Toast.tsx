"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "@/lib/motion";
import { Check, AlertTriangle } from "lucide-react";

/**
 * THE CONFIRMATION PRIMITIVE — the one place the app says "that worked" or
 * "that did not". Fire from anywhere on the client with `toast()`; a single
 * <Toaster/> mounted in DashboardShell renders them. No provider and no
 * context: it rides a window CustomEvent, so a deep child or a callback three
 * files away can confirm an action without threading state through the tree.
 *
 * WHY IT EXISTS AT ALL. Several real writes in this app landed silently — an
 * alert saved and the sheet just closed, a guardrail was refused by the server
 * and the knob stayed flipped. A write with no acknowledgement is
 * indistinguishable from a write that did not happen, and the second one is
 * what a member assumes.
 *
 * BOARD LANGUAGE. White card, hairline, one orange mark — the same object the
 * boards draw everywhere else, not a floating black pill from another design
 * system. `bg-card` / `border-sand` / `--accent-solid` are semantic tokens that
 * flip with the theme, so this is correct in light and dark with no `dark:`
 * variant and no edit to globals.css.
 *
 * COLOUR LAW. Green and red belong to PRICE. A saved alert is not a stock
 * rising and a refused write is not a stock falling, so confirm carries the
 * mode accent and error carries ink weight plus a warning glyph. The WORD is
 * the signal; colour only ranks it.
 */

export interface ToastPayload {
  id: number;
  message: string;
  tone: "success" | "info" | "error";
}

const EVENT = "fic:toast";

/** Errors hold longer than confirmations — they usually need reading. */
const DWELL: Record<ToastPayload["tone"], number> = {
  success: 4000,
  info: 4000,
  error: 7000,
};

export function toast(message: string, tone: ToastPayload["tone"] = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<Omit<ToastPayload, "id">>(EVENT, { detail: { message, tone } })
  );
}

export function Toaster() {
  const [items, setItems] = useState<ToastPayload[]>([]);

  useEffect(() => {
    let seq = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    function onToast(e: Event) {
      const detail = (e as CustomEvent<Omit<ToastPayload, "id">>).detail;
      const item: ToastPayload = { id: ++seq, ...detail };
      setItems((prev) => [...prev, item]);
      timers.push(
        setTimeout(() => {
          setItems((prev) => prev.filter((t) => t.id !== item.id));
        }, DWELL[item.tone] ?? 4000)
      );
    }
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      /* Announced, not just drawn: a confirmation a screen reader never hears
         is the same silent write this component exists to end. */
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4 md:bottom-6"
    >
      <AnimatePresence>
        {items.map((t) => (
          <m.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className="pointer-events-auto flex w-full items-center gap-2.5 rounded-[14px] border border-sand bg-card px-4 py-3 text-[13px] font-semibold leading-snug text-ink shadow-lift"
          >
            {t.tone === "error" ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-soft" aria-hidden />
            ) : t.tone === "info" ? (
              /* Info is not a confirmation, so it does not get a tick — it gets
                 the accent mark the boards use to open a line. */
              <span
                className="h-4 w-[3px] shrink-0 rounded-full"
                style={{ background: "var(--accent-solid)" }}
                aria-hidden
              />
            ) : (
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                style={{ background: "var(--accent-solid)", color: "var(--accent-on)" }}
                aria-hidden
              >
                <Check className="h-3 w-3" />
              </span>
            )}
            <span className="flex-1">{t.message}</span>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
