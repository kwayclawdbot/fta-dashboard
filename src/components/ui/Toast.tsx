"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "@/lib/motion";
import { Check, X } from "lucide-react";

/**
 * Minimal, dependency-free toast. Fire from anywhere (client) with `toast()`;
 * a single <Toaster/> mounted in DashboardShell renders them. Intentionally
 * tiny — used for the silent-enrollment success confirmation ("Notifications
 * on") and other one-line confirmations. No provider/context needed: it rides
 * a window CustomEvent so server components and deep children can call it.
 */

export interface ToastPayload {
  id: number;
  message: string;
  tone: "success" | "info" | "error";
}

const EVENT = "fic:toast";

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
    function onToast(e: Event) {
      const detail = (e as CustomEvent<Omit<ToastPayload, "id">>).detail;
      const item: ToastPayload = { id: ++seq, ...detail };
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== item.id));
      }, 4000);
    }
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div className="fixed z-[100] bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
      <AnimatePresence>
        {items.map((t) => (
          <m.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className={`pointer-events-auto flex items-center gap-2.5 w-full rounded-xl px-4 py-3 shadow-lg backdrop-blur border text-sm font-medium ${
              t.tone === "error"
                ? "bg-red-950/90 border-red-500/30 text-red-100"
                : t.tone === "info"
                  ? "bg-midnight-900/95 border-sand text-midnight-100"
                  : "bg-midnight-900/95 border-gold-400/30 text-midnight-50"
            }`}
          >
            {t.tone === "success" && (
              <span className="grid place-items-center w-5 h-5 rounded-full bg-green-500/20 text-green-400 shrink-0">
                <Check className="w-3 h-3" />
              </span>
            )}
            {t.tone === "error" && <X className="w-4 h-4 text-red-400 shrink-0" />}
            <span className="flex-1">{t.message}</span>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
