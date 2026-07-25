"use client";

import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import BumpRow from "@/components/checkout/BumpRow";
import {
  bumpsForFlow,
  BASE_TODAY_CENTS,
  USD,
  type BumpChoice,
  type CheckoutFlow,
  type BumpDisplay,
} from "@/lib/checkout-bumps";

/**
 * The order summary — a compact, subordinate receipt object (owner: it must NOT
 * dominate the payment step). On mobile it collapses to a slim expandable total
 * bar; on desktop the body is always shown. Quiet order-bump rows sit beneath it,
 * clearly optional.
 */
export default function OrderPanel({
  flow,
  bump,
  disabled,
  onBump,
}: {
  flow: CheckoutFlow;
  bump: BumpChoice;
  disabled?: boolean;
  onBump: (b: BumpChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const bumps: BumpDisplay[] = bumpsForFlow(flow);
  const selected = bumps.find((b) => b.id === bump);
  const total = BASE_TODAY_CENTS[flow] + (selected?.priceCents || 0);

  return (
    <div className="overflow-hidden rounded-xl border border-sand bg-card shadow-soft">
      {/* Header / mobile total bar */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left lg:pointer-events-none"
      >
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-soft">
          Order summary
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-ink lg:hidden">
            {USD(total)}
          </span>
          <ChevronDown
            className={
              "h-4 w-4 text-soft transition-transform lg:hidden " +
              (open ? "rotate-180" : "")
            }
          />
        </span>
      </button>

      <div className={(open ? "block" : "hidden") + " lg:block"}>
        <div className="px-4 pb-4">
          {/* Line items */}
          <div className="space-y-2 border-t border-sand pt-3">
            {flow === "vip" ? (
              <>
                <Line label="Challenge VIP ticket" value="$197" />
                <p className="text-[11px] leading-relaxed text-soft">
                  Includes your first month of Club — then $99/mo after a 30-day
                  reminder.
                </p>
              </>
            ) : (
              <Line label="Club membership" value="$99/mo" />
            )}
            {selected && (
              <Line label={selected.kicker} value={`+${USD(selected.priceCents)}`} />
            )}
          </div>

          {/* Total */}
          <div className="mt-3 flex items-end justify-between border-t border-dashed border-sand pt-3">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-soft">
              Due today
            </span>
            <span className="font-mono text-xl font-bold text-ink">{USD(total)}</span>
          </div>

          {/* Bumps — quiet optional add-ons */}
          <div className="mt-4">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-soft">
              Optional add-ons
            </p>
            <div className="space-y-2">
              {bumps.map((b) => (
                <BumpRow
                  key={b.id}
                  bump={b}
                  selected={bump === b.id}
                  disabled={disabled}
                  onToggle={() => onBump(bump === b.id ? "none" : b.id)}
                />
              ))}
            </div>
          </div>

          {/* Disclosure */}
          <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-soft">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
            {flow === "vip" ? (
              <span>
                $197 today · includes your first month of Club · $99/mo after —
                we&apos;ll remind you 3 days before, cancel in one click.
              </span>
            ) : (
              <span>$99/mo · cancel anytime in one click.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-ink">{label}</span>
      <span className="shrink-0 font-mono text-[13px] font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}
