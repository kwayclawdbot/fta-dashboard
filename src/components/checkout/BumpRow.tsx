"use client";

import { Check } from "lucide-react";
import { USD, type BumpDisplay } from "@/lib/checkout-bumps";

/**
 * A quiet, single-line order-bump row — a small ticket-stub add-on, clearly
 * subordinate to the payment block (owner: bumps must read as ~1/4 the weight of
 * the checkout, not dominate it). Checkbox + one-line title + a modest
 * strikethrough anchor. No loud SAVE chips or big anchors.
 */
export default function BumpRow({
  bump,
  selected,
  disabled,
  onToggle,
}: {
  bump: BumpDisplay;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors " +
        (selected
          ? "bg-chip-amber ring-1 ring-gold-500"
          : "ring-1 ring-sand hover:bg-paper/50") +
        (disabled ? " opacity-60" : "")
      }
    >
      <span
        className={
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors " +
          (selected
            ? "border-gold-500 bg-gold-500 text-white"
            : "border-sand bg-card text-transparent")
        }
      >
        <Check className="h-2.5 w-2.5" strokeWidth={4} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">
          {bump.kicker}
        </span>
        <span className="block truncate text-[11px] text-soft">{bump.title}</span>
      </span>
      <span className="shrink-0 text-right leading-tight">
        <span className="block font-mono text-[13px] font-bold text-ink">
          +{USD(bump.priceCents)}
        </span>
        <span className="block font-mono text-[10px] text-soft line-through">
          {USD(bump.anchorCents)}
        </span>
      </span>
    </button>
  );
}
