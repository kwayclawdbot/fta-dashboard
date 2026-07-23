"use client";

/**
 * Collapsible section (Lane 9 progressive disclosure). Sections below the chart
 * are collapsed by default and remember their open-state per user via
 * localStorage — reopening a stock you dug into keeps your view.
 */

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { m } from "@/lib/motion";

export default function Collapsible({
  storageKey,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  storageKey: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const lsKey = `fic-research-open-${storageKey}`;
  const [open, setOpen] = useState(defaultOpen);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(lsKey);
      // Intentional: hydrate open-state from localStorage after mount so the
      // server render (default) and first client render match (no mismatch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v != null) setOpen(v === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [lsKey]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(lsKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <section className="rounded-2xl border border-sand bg-midnight-900 shadow-soft">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="block font-display text-base font-bold text-ink">{title}</span>
          {subtitle && <span className="mt-0.5 block text-xs text-soft">{subtitle}</span>}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-soft transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {ready && open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border-t border-sand px-5 py-5"
        >
          {children}
        </m.div>
      )}
    </section>
  );
}
