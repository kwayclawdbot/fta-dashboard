"use client";

import { useEffect, useRef } from "react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { PillTabs, type PillTabDef } from "@/components/research/board";

/**
 * RESEARCH NAV — the sticky head boards 12 / 13 / 14 draw on every ticker
 * subpage: a compact identity row (back · logo tile · ticker · mark · move)
 * with the analysis tabs as FILLED PILLS directly under it.
 *
 * This replaces the underline rail a previous pass shipped. The owner's
 * mockup draws pills — orange for the brand tabs, Kai blue for Kai — and the
 * compact head travels with them so the mark is on screen while a long panel
 * scrolls. Both are rebuilt to the board rather than reinterpreted.
 *
 * COLOUR LAW survives the rebuild: the Kai pill is the only blue object in the
 * rail, the move is `text-price-up` / `text-price-down` with no `dark:`
 * variant, and the active brand pill is the action colour.
 *
 * ACCESSIBILITY is unchanged from the rail it replaces — a real tablist with
 * aria-controls / aria-labelledby, one tab stop, arrow keys with wrap, and
 * Home/End. See PillTabs.
 */

export type ResearchTabKey =
  | "overview"
  | "technicals"
  | "fundamentals"
  | "kai"
  | "news";

export const RESEARCH_TABS: PillTabDef<ResearchTabKey>[] = [
  { key: "overview", label: "Overview" },
  { key: "technicals", label: "Technicals" },
  { key: "fundamentals", label: "Fundamentals" },
  { key: "kai", label: "Kai", tone: "kai" },
  { key: "news", label: "News" },
];

/** Stable ids so aria-controls / aria-labelledby actually resolve. */
export const tabId = (k: ResearchTabKey) => `research-tab-${k}`;
export const panelId = (k: ResearchTabKey) => `research-panel-${k}`;

export default function ResearchTabBar({
  tabs = RESEARCH_TABS,
  active,
  onSelect,
  /** The compact identity row above the pills (boards 12–14). */
  head,
}: {
  tabs?: PillTabDef<ResearchTabKey>[];
  active: ResearchTabKey;
  onSelect: (key: ResearchTabKey) => void;
  head?: {
    ticker: string;
    companyName: string;
    price: number | null;
    changePct: number | null;
  };
}) {
  const wrap = useRef<HTMLDivElement>(null);

  // A deep-linked tab (`?tab=kai`) can open its panel while its own pill sits
  // off-screen to the right — pull the selected pill into view. `inline:
  // "nearest"` leaves an already-visible pill exactly where it is.
  useEffect(() => {
    wrap.current
      ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const up = (head?.changePct ?? 0) >= 0;

  return (
    <div
      ref={wrap}
      className="sticky top-14 z-10 -mx-4 border-b border-sand bg-paper/95 px-4 pb-3 pt-2.5 backdrop-blur-md sm:-mx-6 sm:px-6"
    >
      {head && (
        <div className="mb-3 flex items-center gap-2.5">
          <CompanyLogo
            symbol={head.ticker}
            name={head.companyName}
            size={28}
            rounded="rounded-lg"
          />
          <span className="shrink-0 font-display text-[15px] font-extrabold text-ink">
            {head.ticker}
          </span>
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink">
            {head.price != null ? `$${head.price.toFixed(2)}` : "—"}
          </span>
          {head.changePct != null && (
            <span
              className={`shrink-0 font-mono text-[10.5px] font-semibold tabular-nums ${
                up ? "text-price-up" : "text-price-down"
              }`}
            >
              {up ? "▲" : "▼"}
              {Math.abs(head.changePct).toFixed(2)}%
            </span>
          )}
        </div>
      )}
      <PillTabs<ResearchTabKey>
        tabs={tabs}
        active={active}
        onSelect={onSelect}
        ariaLabel="Research sections"
        tabId={tabId}
        panelId={panelId}
      />
    </div>
  );
}
