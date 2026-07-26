"use client";

import type { ReactNode, ElementType } from "react";

/**
 * Tabs — the ONE tab primitive for the app (Lane A visual normalization).
 *
 * Replaces the five divergent treatments the cohesion audit catalogued (gold
 * pill · black pill · orange underline · segmented-in-a-container · text+count)
 * with a single underline strip modelled on the Research / Alerts / Live-Classes
 * pattern the v3 language already blessed.
 *
 * ACCENT IS REGISTER-AWARE FOR FREE: the active label + underline use the
 * `gold-*` ramp, which globals.css remaps per `data-mode` — gold in Family Mode,
 * VOLT ORANGE in Club, metallic on the FTA desk. No component forks; the same
 * strip recolors itself to whichever register the shell is in.
 *
 * The rail scrolls horizontally on narrow screens (no page overflow), scrollbar
 * hidden. Supports optional leading icons and trailing count badges so it can
 * absorb the icon-tabs (Discover) and count-tabs (Live Classes) variants too.
 */

export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
  icon?: ElementType;
  /** Optional trailing count badge (e.g. Live Classes "Upcoming 3"). */
  count?: number;
  /** Extra attributes forwarded to the button (e.g. `data-tour` hooks). */
  dataAttrs?: Record<string, string>;
}

export default function Tabs<K extends string>({
  tabs,
  active,
  onSelect,
  ariaLabel,
  size = "md",
  sticky = false,
  className = "",
}: {
  tabs: TabItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  ariaLabel?: string;
  /** md = default section tabs · sm = tighter inline tabs. */
  size?: "sm" | "md";
  /** Stick under the app TopBar (h-14) when the tab body scrolls. */
  sticky?: boolean;
  className?: string;
}) {
  const pad = size === "sm" ? "px-2.5 py-2 text-[13px]" : "px-3 py-2.5 text-sm";
  return (
    <div
      className={`${
        sticky
          ? "sticky top-14 z-10 -mx-4 border-b border-sand bg-paper/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6"
          : "border-b border-sand"
      } ${className}`}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(t.key)}
              {...t.dataAttrs}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold transition-colors ${pad} ${
                isActive ? "text-gold-700" : "text-soft hover:text-ink"
              }`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {t.label}
              {typeof t.count === "number" && (
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    isActive ? "bg-gold-400/20 text-gold-700" : "bg-sand text-soft"
                  }`}
                >
                  {t.count}
                </span>
              )}
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
