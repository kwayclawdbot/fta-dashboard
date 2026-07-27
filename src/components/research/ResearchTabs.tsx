"use client";

import { useCallback, useRef } from "react";

/**
 * RESEARCH TAB BAR — the analysis navigation on /research/[ticker].
 *
 * The owner's note: everything from strengths-and-weaknesses down was one
 * vertical scroll sitting under the comments. This restores it as real
 * navigation — four subpages the member clicks through — while the discussion
 * is lifted OUT of the stack entirely (see TickerDiscussion).
 *
 * CONTROL LANGUAGE: an underline strip, not pills. Mono uppercase labels on a
 * hairline baseline with one accent rule under the active tab. Pills would put
 * four filled shapes in a row and re-introduce exactly the boxed-grid texture
 * the register bans; an underline is a rule, which is the system's own idiom.
 *
 * The accent is `gold-*`, which in Club mode IS volt orange AND flips with the
 * theme (--g600 #E85400 → #FF8A47), so the strip stays legible on the dark page.
 * The frozen volt ramp is deliberately not used.
 *
 * ACCESSIBILITY — a real tablist, not buttons that look like one:
 *   • role="tablist" / "tab" / "tabpanel" with aria-controls + aria-labelledby
 *   • ROVING TABINDEX: one stop in the tab order, arrows move between tabs
 *   • ←/→ wrap, Home/End jump to the ends, and focus follows selection
 *     (automatic activation, which is the correct pattern for cheap panels)
 * Sticky at top-14 clears the app TopBar so the strip stays reachable while a
 * long panel scrolls.
 */

export type ResearchTabKey = "overview" | "technicals" | "fundamentals" | "news";

export interface ResearchTabDef {
  key: ResearchTabKey;
  label: string;
}

export const RESEARCH_TABS: ResearchTabDef[] = [
  { key: "overview", label: "Overview" },
  { key: "technicals", label: "Technicals" },
  { key: "fundamentals", label: "Fundamentals" },
  { key: "news", label: "News" },
];

/** Stable ids so aria-controls / aria-labelledby actually resolve. */
export const tabId = (k: ResearchTabKey) => `research-tab-${k}`;
export const panelId = (k: ResearchTabKey) => `research-panel-${k}`;

export default function ResearchTabBar({
  tabs = RESEARCH_TABS,
  active,
  onSelect,
}: {
  tabs?: ResearchTabDef[];
  active: ResearchTabKey;
  onSelect: (key: ResearchTabKey) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const i = tabs.findIndex((t) => t.key === active);
      if (i < 0) return;
      let next = -1;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next < 0) return;
      e.preventDefault();
      onSelect(tabs[next].key);
      // Move focus with selection so the roving tabindex stays coherent.
      stripRef.current
        ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
        ?.[next]?.focus();
    },
    [tabs, active, onSelect]
  );

  return (
    <div className="sticky top-14 z-10 -mx-4 bg-paper/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Research sections"
        onKeyDown={onKeyDown}
        className="flex gap-6 overflow-x-auto border-b border-sand [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              id={tabId(t.key)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId(t.key)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(t.key)}
              className={`relative shrink-0 whitespace-nowrap pb-3 pt-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                isActive ? "text-ink" : "text-soft hover:text-ink"
              }`}
            >
              {t.label}
              <span
                aria-hidden
                className={`absolute inset-x-0 -bottom-px h-[2px] rounded-full transition-opacity duration-200 ${
                  isActive ? "bg-gold-500 opacity-100" : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
