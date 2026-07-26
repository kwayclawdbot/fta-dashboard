"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * §12 Challenge module slot — a reserved high-priority slot near the top of
 * ClubHome, rendered ONLY while a 5-Day Challenge pass is active. A designed
 * "pass" object (volt), not a generic card: DAY N OF 5 in big mono, 5 progress
 * pips, and a continue CTA into the challenge. Self-gates on the pass window.
 */

const CHALLENGE_DAYS = 5;

export default function ChallengeSlot({
  challengeExpiresAt,
}: {
  challengeExpiresAt: string | null;
}) {
  if (!challengeExpiresAt) return null;

  const msLeft = new Date(challengeExpiresAt).getTime() - Date.now();
  if (msLeft <= 0) return null;
  const daysLeft = Math.max(1, Math.min(CHALLENGE_DAYS, Math.ceil(msLeft / 86_400_000)));
  const day = Math.max(1, Math.min(CHALLENGE_DAYS, CHALLENGE_DAYS - daysLeft + 1));

  return (
    <Link
      href="/challenge"
      aria-label={`5-Day Challenge — day ${day} of ${CHALLENGE_DAYS}, continue`}
      className="group flex items-stretch overflow-hidden rounded-2xl border border-volt-500/40 bg-gradient-to-r from-volt-500/[0.10] to-teal-400/[0.06] shadow-soft transition-transform active:scale-[0.99]"
    >
      {/* left rail — the "ticket stub" */}
      <div className="club-hero-gradient flex shrink-0 flex-col items-center justify-center px-5 py-4 text-white">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-90">Day</span>
        <span className="font-display text-4xl font-black leading-none">{day}</span>
        <span className="font-mono text-[10px] font-semibold opacity-90">of {CHALLENGE_DAYS}</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-volt-700">
            5-Day Investing Challenge
          </p>
          <p className="mt-0.5 font-display text-lg font-bold text-ink">
            Continue where you left off
          </p>
          {/* progress pips */}
          <div className="mt-2 flex gap-1.5">
            {Array.from({ length: CHALLENGE_DAYS }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < day ? "bg-volt-500" : "bg-sand"}`}
              />
            ))}
          </div>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-volt-500 text-white transition-transform group-hover:translate-x-0.5">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
