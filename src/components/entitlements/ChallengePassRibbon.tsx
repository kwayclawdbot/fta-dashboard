"use client";

import { Clock } from "lucide-react";

/**
 * The Challenge Pass countdown ribbon (MONETIZATION-GATES.md "CHALLENGE PASS =
 * TEMPORARY CLUB"). On every premium surface a pass-holder sees this INSTEAD of
 * a paywall — loss-aversion framing ("you have this, you're going to lose it")
 * beats upgrade framing.
 *
 * Copy is fixed: "Included with your Challenge Pass · N days remaining". N is
 * computed SERVER-SIDE (getEntitlements → state.challenge.daysRemaining) and
 * passed in — never derived from a client clock.
 */
export default function ChallengePassRibbon({
  daysRemaining,
  className = "",
}: {
  daysRemaining: number;
  className?: string;
}) {
  const days = Math.max(0, daysRemaining);
  const dayWord = days === 1 ? "day" : "days";
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-gold-300 bg-gold-400/10 px-4 py-2.5 text-sm ${className}`}
      role="status"
    >
      <Clock className="h-4 w-4 shrink-0 text-gold-700" />
      <span className="font-display font-semibold text-ink">
        Included with your Challenge Pass
      </span>
      <span className="text-soft">·</span>
      <span className="text-soft">
        {days} {dayWord} remaining
      </span>
    </div>
  );
}
