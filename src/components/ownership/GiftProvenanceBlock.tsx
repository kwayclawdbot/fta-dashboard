"use client";

/**
 * GiftProvenanceBlock — the heirloom block on the card detail panel.
 * Shows the full gift story: from, date, message, value at gift, and whether
 * it was verified via brokerage or self-reported. This is permanent provenance.
 */

import { Gift, ShieldCheck, CircleDot } from "lucide-react";
import type { GiftProvenance } from "@/lib/ownership/types";
import { formatMoney, formatDate } from "./format";
import { giftVerified } from "./transfer-format";

export default function GiftProvenanceBlock({ gift }: { gift: GiftProvenance }) {
  const verified = giftVerified(gift);
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-gold-500/25 bg-gradient-to-b from-gold-400/[0.06] to-transparent p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-400/15 text-gold-700">
          <Gift className="h-4 w-4" />
        </span>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
            Provenance
          </div>
          <div className="font-display text-base font-extrabold leading-tight text-ink">
            Gifted by {gift.fromDisplayName || "family"}
          </div>
        </div>
      </div>

      {gift.message && (
        <blockquote className="mt-4 border-l-2 border-gold-500/40 pl-3.5 text-sm italic leading-relaxed text-ink/90">
          &ldquo;{gift.message}&rdquo;
        </blockquote>
      )}

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
        <Field label="Gifted on" value={formatDate(gift.giftedAt)} />
        <Field label="Value at gift" value={formatMoney(gift.originalValueAtGift)} />
        {gift.fromDisplayName && (
          <Field label="From" value={gift.fromDisplayName} />
        )}
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
            Record
          </div>
          <div
            className={`mt-0.5 flex items-center gap-1.5 font-mono text-sm ${
              verified ? "text-teal-500" : "text-gold-700"
            }`}
          >
            {verified ? (
              <ShieldCheck className="h-3.5 w-3.5" />
            ) : (
              <CircleDot className="h-3.5 w-3.5" />
            )}
            {verified ? "Verified" : "Self-reported"}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-sm text-ink" title={value}>
        {value}
      </div>
    </div>
  );
}
