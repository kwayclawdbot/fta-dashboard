"use client";

import { useCallback, useEffect, useRef } from "react";

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
 * five filled shapes in a row and re-introduce exactly the boxed-grid texture
 * the register bans; an underline is a rule, which is the system's own idiom.
 * The canvas (board 14) draws these as filled pills with a solid blue "Kai" —
 * deliberately not adopted, for the reason above.
 *
 * The accent is `gold-*`, which in Club mode IS volt orange AND flips with the
 * theme (--g600 #E85400 → #FF8A47), so the strip stays legible on the dark page.
 * The frozen volt ramp is deliberately not used.
 *
 * PER-TAB ACCENT: Kai Report carries the Kai-blue rule instead of the brand
 * rule, because colour law reserves blue for Kai/AI and a tab that IS Kai chrome
 * should say so. Everything else keeps the brand rule — one exception, not a
 * palette.
 *
 * SHARED GEOMETRY (canvas v2 L0): the selected bar is `.f0-seg-bar` and the
 * focus ring is `.f0-focus` — the same two classes SegmentedRail uses — so this
 * rail and the stance/post-type rails are one object with one motion and one
 * ring. What is NOT shared is the ROLE: SegmentedRail is a `radiogroup` (a form
 * control), and this is navigation over real `tabpanel`s with aria-controls.
 * Swapping in the radiogroup would have broken the panel relationship, so the
 * geometry is reused and the semantics are not.
 *
 * ACCESSIBILITY — a real tablist, not buttons that look like one:
 *   • role="tablist" / "tab" / "tabpanel" with aria-controls + aria-labelledby
 *   • ROVING TABINDEX: one stop in the tab order, arrows move between tabs
 *   • ←/→ wrap, Home/End jump to the ends, and focus follows selection
 *     (automatic activation, which is the correct pattern for cheap panels)
 * Sticky at top-14 clears the app TopBar so the strip stays reachable while a
 * long panel scrolls.
 */

export type ResearchTabKey =
  | "overview"
  | "technicals"
  | "fundamentals"
  | "kai"
  | "news";

export interface ResearchTabDef {
  key: ResearchTabKey;
  label: string;
  /** Tailwind bg for the 3px selected bar. Defaults to the brand rule. */
  barClassName?: string;
  /** Tailwind text colour for the selected label. Defaults to ink. */
  activeTextClassName?: string;
}

export const RESEARCH_TABS: ResearchTabDef[] = [
  { key: "overview", label: "Overview" },
  { key: "technicals", label: "Technicals" },
  { key: "fundamentals", label: "Fundamentals" },
  {
    key: "kai",
    label: "Kai Report",
    barClassName: "bg-kai-500",
    activeTextClassName: "text-kai-600 dark:text-kai-300",
  },
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

  // FIVE tabs no longer fit at 390px, so the rail scrolls — which means a
  // deep-linked tab (`?tab=kai`) could open its panel while its own label sits
  // off-screen to the right. Pull the selected tab into view whenever selection
  // changes; `inline: "nearest"` leaves an already-visible tab exactly where it
  // is rather than re-centring the rail on every click.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-selected="true"]'
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

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
        /* `-mx-1 px-1 -mt-1 pt-1`: overflow-x also clips VERTICALLY (overflow-y
           computes to auto the moment overflow-x isn't visible), so the shared
           focus ring — which sits 2px OUTSIDE the button by design — was being
           sheared off along the top edge and on the first/last tab. The
           negative margins give the track interior room without moving anything
           on screen; the bottom is untouched so the rail hairline stays exactly
           where the selected bar expects it. */
        className="club2-track -mx-1 -mt-1 flex gap-6 overflow-x-auto border-b border-sand px-1 pt-1"
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
              className={`f0-focus relative -mb-px shrink-0 whitespace-nowrap pb-3 pt-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                isActive ? t.activeTextClassName ?? "text-ink" : "text-soft hover:text-ink"
              }`}
            >
              {t.label}
              {isActive && (
                <span
                  aria-hidden
                  className={`f0-seg-bar ${t.barClassName ?? "bg-gold-500"}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
