"use client";

/**
 * ResearchTabBar (Lane 11B) — the sticky, horizontally-scrollable tab strip that
 * restructures /research/[ticker] from one long scroll into analysis subpages.
 * Sits directly under the always-visible hero + scorecard summary and sticks to
 * the top (below the app TopBar, h-14) when the tab body scrolls. On 390px the
 * strip scrolls horizontally (no page overflow) with the scrollbar hidden.
 */

export type ResearchTabKey =
  | "overview"
  | "charts"
  | "financials"
  | "news"
  | "kai"
  | "community";

export interface ResearchTabDef {
  key: ResearchTabKey;
  label: string;
}

export default function ResearchTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: ResearchTabDef[];
  active: ResearchTabKey;
  onSelect: (key: ResearchTabKey) => void;
}) {
  return (
    <div className="sticky top-14 z-10 -mx-4 border-b border-sand bg-paper/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div
        role="tablist"
        aria-label="Research sections"
        className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(t.key)}
              className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive ? "text-gold-700" : "text-soft hover:text-ink"
              }`}
            >
              {t.label}
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
