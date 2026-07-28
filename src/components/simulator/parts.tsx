"use client";

import * as React from "react";

import { Card, CardLabel } from "@/components/research/board";

/* ══════════════════════════════════════════════════════════════════════════
   PRACTICE — the shared vocabulary for the simulator cluster (Trading Floor,
   Pattern Practice, Simbot).

   Each object in this cluster is a CARD carrying a brand-orange mono label,
   matching the owner's mockup, with hairline rows, underlined mono fields and
   pill chips inside it. An earlier pass built these as un-boxed section rules
   on bare paper and the owner rejected that reading — `SimSection` is now the
   board's card, so every consumer (the order ticket, the positions list, the
   trade history, the time controls, the drawing tools, the scenario panels)
   picks the change up from one place.

   COLOUR LAW (hard):
     green / red = PRICE only · lime = community sentiment only ·
     orange = brand + ACTION only · Kai blue = Kai/AI only.
   Selecting a side, a size or a speed is an ACTION, so the on-state of a chip
   is the brand orange — never green for "buy" and red for "sell", which would
   spend the price colours on a control. Direction is carried by the word and
   the icon instead.

   ORANGE TEXT: `text-volt-*` is frozen across themes and lands ~2.5:1 on the
   night page. The GOLD ramp IS volt orange in club mode AND it flips, so every
   orange TYPE here is `text-gold-600/700` and never `dark:text-volt-*`.

   NOTE on `.f0-ledger-row`: it is UNLAYERED css, so it beats Tailwind's
   `items-*` utilities. A row whose control side wraps must align its children
   with `self-start`, which is what `wrap` does below.
   ══════════════════════════════════════════════════════════════════════════ */

/** One object on the practice surface: a card with a brand mono label. */
export function SimSection({
  id,
  label,
  action,
  children,
}: {
  id: string;
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <Card radius="md" className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <h2 id={id} className="min-w-0">
            <CardLabel tone="brand" className="truncate">
              {label}
            </CardLabel>
          </h2>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        <div className="mt-3">{children}</div>
      </Card>
    </section>
  );
}

/** One ruled line: label (+ plain-English hint) left, control right. */
export function SimRow({
  label,
  hint,
  wrap = false,
  children,
}: {
  label: string;
  hint?: string;
  wrap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="f0-ledger-row justify-between gap-4">
      <div className={`min-w-0 ${wrap ? "self-start pt-1" : ""}`}>
        <p className="font-display text-[13.5px] font-bold text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-soft">{hint}</p>}
      </div>
      <div
        className={`flex min-w-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-2 ${
          wrap ? "self-start" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/** A read-only market number on the right of a row. */
export function SimValue({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={`font-mono text-[14px] font-semibold tabular-nums ${tone ?? "text-ink"}`}>
      {children}
    </span>
  );
}

/** An underlined mono field. Affixes carry the unit so the field stays a number. */
export function SimNumField({
  value,
  onChange,
  ariaLabel,
  prefix,
  suffix,
  placeholder = "—",
  width = "w-20",
  step,
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  width?: string;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="inline-flex items-baseline gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-soft">
      {prefix && <span aria-hidden>{prefix}</span>}
      <input
        type="number"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        className={`${width} border-b border-sand bg-transparent py-1 text-right font-mono text-[14px] font-semibold tabular-nums tracking-normal text-ink outline-none transition-colors placeholder:text-soft/60 hover:border-gold-400 focus:border-gold-500`}
      />
      {suffix && <span aria-hidden>{suffix}</span>}
    </label>
  );
}

/**
 * A one-of-N group of chips with a SINGULAR keyboard model: one tab stop, arrows
 * move within it, exactly like SegmentedRail. Used where the canvas itself draws
 * pills rather than a ruled rail (App Light L277-284 — the timeframe switcher on
 * the ticker screen is six independent pills) and where a bottom-ruled rail would
 * break an inline transport row.
 *
 * Children must be <SimChip role="radio"> — pass `radio` on each.
 */
export function SimChipGroup({
  ariaLabel,
  children,
  className = "",
}: {
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
    const btns = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)') ?? []
    );
    if (btns.length === 0) return;
    e.preventDefault();
    const from = btns.findIndex((b) => b === document.activeElement);
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const next = btns[(Math.max(from, 0) + delta + btns.length) % btns.length];
    next.focus();
    next.click();
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
    >
      {children}
    </div>
  );
}

/** A pill toggle. On-state = brand orange, because selecting is an action. */
export function SimChip({
  active,
  onClick,
  disabled,
  title,
  radio = false,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  /** Renders as a radio inside a <SimChipGroup> — one tab stop for the set. */
  radio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      {...(radio
        ? { role: "radio" as const, "aria-checked": !!active, tabIndex: active ? 0 : -1 }
        : { "aria-pressed": active })}
      disabled={disabled}
      onClick={onClick}
      className={`f0-focus f0-press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition disabled:opacity-40 ${
        active
          ? "border-gold-400 bg-chip-amber text-gold-700"
          : "border-sand text-soft hover:border-gold-300 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** A quiet icon control (play, step, reset, close). */
export function SimIconButton({
  onClick,
  label,
  disabled,
  active,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`f0-focus f0-press inline-flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-35 ${
        active
          ? "border-gold-400 bg-chip-amber text-gold-700"
          : "border-sand text-soft hover:border-gold-300 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
