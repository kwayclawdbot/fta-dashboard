"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * §12 Challenge module slot — a reserved high-priority slot near the top of
 * ClubHome, rendered ONLY while a 5-Day Challenge pass is active. A designed
 * "pass" object, not a generic card: a ticket stub carrying DAY N OF 5 in big
 * display numerals, five progress pips, and a continue CTA into the challenge.
 * Self-gates on the pass window.
 *
 * CANVAS V2 (M1): the bordered gradient box is gone — the object now sits on the
 * shared brand-tinted field (.f0-brief-field) that Home's digest and the family
 * briefing use, so a "there is something running" object looks the same wherever
 * it appears. The ticket stub keeps the dual-brand gradient, which is what gives
 * it identity without a container. Orange TEXT moves from the frozen volt ramp
 * to gold-700, which is the same orange in club mode AND lifts in dark.
 *
 * PURITY: the day comes from the viewer's clock, read through an external-store
 * snapshot rather than from Date.now() in the render body. The old version was
 * non-idempotent — a re-render straddling midnight silently changed the day —
 * and it tripped the compiler's impure-call rule.
 */

const CHALLENGE_DAYS = 5;
const HOUR_MS = 3_600_000;

/* The viewer's clock as an EXTERNAL STORE, bucketed to the hour.
   Two rules are in tension here: the day must come from the viewer's clock (the
   server cannot know it), and a component may not read an impure function during
   render. useSyncExternalStore is the sanctioned bridge — and the snapshot has to
   be STABLE between calls or React would spin, which is why it is the hour
   bucket rather than the raw millisecond. An hour of precision is far finer than
   a counter that ceils to whole days. The server snapshot is null, so the server
   and the first client render agree and the slot fills in after hydration. */
const SUBSCRIBE = () => () => {};
const CLIENT_HOUR = () => Math.floor(Date.now() / HOUR_MS);
const SERVER_HOUR = () => null;

export default function ChallengeSlot({
  challengeExpiresAt,
}: {
  challengeExpiresAt: string | null;
}) {
  const hour = useSyncExternalStore(SUBSCRIBE, CLIENT_HOUR, SERVER_HOUR);

  if (!challengeExpiresAt || hour == null) return null;

  const msLeft = new Date(challengeExpiresAt).getTime() - hour * HOUR_MS;
  if (msLeft <= 0) return null;
  const daysLeft = Math.max(1, Math.min(CHALLENGE_DAYS, Math.ceil(msLeft / 86_400_000)));
  const day = Math.max(1, Math.min(CHALLENGE_DAYS, CHALLENGE_DAYS - daysLeft + 1));

  return (
    <Link
      href="/community"
      aria-label={`5-Day Challenge — day ${day} of ${CHALLENGE_DAYS}, continue`}
      className="f0-brief-field f0-focus f0-press group flex items-stretch"
    >
      {/* left rail — the "ticket stub" */}
      <div className="club-hero-gradient flex shrink-0 flex-col items-center justify-center px-5 py-4 text-white">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-90">
          Day
        </span>
        <span className="font-display text-4xl font-black leading-none tabular-nums">
          {day}
        </span>
        <span className="font-mono text-[10px] font-semibold opacity-90">
          of {CHALLENGE_DAYS}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-eyebrow font-bold uppercase text-gold-700">
            5-Day Investing Challenge
          </p>
          <p className="mt-1 font-display text-[17px] font-extrabold text-ink">
            Continue where you left off
          </p>
          {/* progress pips */}
          <div className="mt-2.5 flex gap-1.5" aria-hidden>
            {Array.from({ length: CHALLENGE_DAYS }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < day ? "bg-accent" : "bg-sand"}`}
              />
            ))}
          </div>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
