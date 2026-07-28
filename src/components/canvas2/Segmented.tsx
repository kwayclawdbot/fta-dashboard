"use client";

import { useRef } from "react";
import ScrollRow from "./ScrollRow";

/* ══════════════════════════════════════════════════════════════════════════
   SEGMENTED RAIL — the shared "pick one of N" mechanism behind StanceControl
   and PostTypeControl.

   WHY IT IS SHARED: the canvas draws both selectors as filled pills, and the
   two would otherwise have been built twice, diverging in exactly the way the
   f0 primitives diverged before they were pulled onto one foundation (four
   lanes, four different oranges). One rail means one keyboard model, one focus
   ring, one underline geometry — and one place to change them.

   WHY A RAIL AND NOT PILLS: the system already answers "one of N" with an
   underline (f0-section-rule, TabRail). Pills would have made a third answer,
   and filled pills specifically are what the brand register calls pill soup:
   four rounded rectangles of equal weight, where the selected one is told apart
   by fill colour alone. Here the choice is carried by TYPE WEIGHT first and the
   bar second, so it still reads correctly with colour stripped.

   WHY THE BAR COLOUR IS THE CALLER'S: post type is an authoring action (orange
   by law) and stance is community sentiment (lime by law). A shared "selected"
   colour would have quietly merged two things the colour law keeps apart.

   SEMANTICS: this is a form control, not navigation — radiogroup/radio, not
   tablist/tab. Roving tabindex, so the group is one tab stop and arrows move
   within it, which is what a radiogroup is required to do.

   OVERFLOW: the packing (non-`fill`) form runs off the right edge on a phone
   the moment the labels are long — four post types at 390px, the club
   watchlist's sort rail, the leaderboard's period rails. It now scrolls inside
   <ScrollRow>, which supplies the edge fade and clears it at the end of the
   track, so the systemic affordance arrives everywhere this rail is used
   rather than being hand-rolled per surface. The `fill` form distributes and
   cannot overflow, so it stays a plain rail.
   ══════════════════════════════════════════════════════════════════════════ */

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  /** Optional second line under the label (a count, a split, a hint). */
  meta?: React.ReactNode;
}

export default function SegmentedRail<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  /** Tailwind background class for the 3px selected bar. Caller's by law. */
  barClassName,
  /** Tailwind text class for the selected label. */
  activeTextClassName = "text-ink",
  disabled = false,
  /** Distributes cells evenly (stance: three equal choices on one axis) vs
   *  packing them left and scrolling (post type: four labels of very unequal
   *  length, which look broken forced to equal width at 390px). */
  fill = false,
  size = "md",
  className = "",
  railClassName = "border-b border-sand",
  fadeTone = "paper",
}: {
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (id: T) => void;
  ariaLabel: string;
  barClassName: string;
  activeTextClassName?: string;
  disabled?: boolean;
  fill?: boolean;
  size?: "sm" | "md";
  className?: string;
  /**
   * The RAIL itself — its hairline. Defaults to the underscored rail the
   * canvas draws. The escape hatch exists because the hairline is what stops
   * this primitive sitting INLINE in a compact transport row (a strip of
   * controls that already has its own rule beneath it gets a second one), and
   * the simulator forked a private `SimChipGroup` rather than fight it. Pass
   * `railClassName=""` to drop the rule; pair it with `--f0-seg-bar-offset` if
   * the selected bar then needs to sit somewhere other than -1px.
   */
  railClassName?: string;
  /** What the overflow fade fades to — set "card" for a rail inside a card. */
  fadeTone?: "paper" | "card";
}) {
  const railRef = useRef<HTMLDivElement>(null);

  function move(delta: number, from: number) {
    if (disabled) return;
    const next = (from + delta + options.length) % options.length;
    onChange(options[next].id);
    const btns = railRef.current?.querySelectorAll<HTMLButtonElement>("[data-seg]");
    btns?.[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(1, i);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(-1, i);
    }
  }

  // The roving tab stop. With nothing selected the FIRST cell holds it, so an
  // untouched control is still reachable by keyboard — a radiogroup where
  // nothing is checked must not become a dead zone.
  const focusIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value)
  );

  const label = size === "sm" ? "text-[10px]" : "text-[11px]";
  const pad = size === "sm" ? "pb-2.5" : "pb-3";

  const cells = (
    <>
      {options.map((o, i) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            data-seg
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            tabIndex={i === focusIndex ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onChange(o.id)}
            className={`f0-focus relative -mb-px shrink-0 ${pad} ${
              fill ? "flex-1 px-1" : ""
            } font-display ${label} font-extrabold uppercase tracking-[0.12em] transition-colors disabled:opacity-45 ${
              on ? activeTextClassName : "text-soft hover:text-ink"
            }`}
          >
            <span className="block whitespace-nowrap">{o.label}</span>
            {o.meta != null && <span className="mt-1 block">{o.meta}</span>}
            {on && <span className={`f0-seg-bar ${barClassName}`} aria-hidden />}
          </button>
        );
      })}
    </>
  );

  // `fill` distributes and can never overflow, so it stays a plain rail — no
  // wrapper, no observer, nothing to clear.
  if (fill) {
    return (
      <div
        ref={railRef}
        role="radiogroup"
        aria-label={ariaLabel}
        className={`flex ${railClassName} ${className}`}
      >
        {cells}
      </div>
    );
  }

  return (
    <ScrollRow
      ref={railRef}
      role="radiogroup"
      aria-label={ariaLabel}
      tone={fadeTone}
      className={`flex ${railClassName} gap-6 ${className}`}
    >
      {cells}
    </ScrollRow>
  );
}
