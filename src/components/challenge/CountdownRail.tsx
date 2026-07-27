"use client";

import { pad2, useCountdown } from "@/lib/challenge/clock";

/**
 * The kickoff countdown — DAYS · HRS · MIN · SEC as four numerals under four
 * small-caps labels, separated by hairlines. No boxes.
 *
 * TIME AUTHORITY: the target comes from `challenge_cohorts.kickoff_at` in the
 * database and the current moment comes from the SERVER (`challenge_state().now`),
 * shifted onto this device's ticking clock by `useCountdown`. A device whose
 * clock is a day fast counts down to exactly the same instant everyone else does.
 *
 * FIRST FRAME: `useCountdown` returns null until hydration, so the rail renders
 * em-dashes rather than a fabricated 00 : 00 : 00 : 00. A zero that is really
 * "not yet known" is the same lie as a made-up member count.
 */
export default function CountdownRail({
  serverNow,
  target,
  label,
  compact = false,
}: {
  serverNow: string | null;
  target: string | null;
  label?: string;
  compact?: boolean;
}) {
  const cd = useCountdown(serverNow, target);

  const cells: { k: string; v: string; l: string }[] = [
    { k: "d", v: cd ? String(cd.days) : "—", l: "Days" },
    { k: "h", v: cd ? pad2(cd.hours) : "—", l: "Hrs" },
    { k: "m", v: cd ? pad2(cd.minutes) : "—", l: "Min" },
    { k: "s", v: cd ? pad2(cd.seconds) : "—", l: "Sec" },
  ];

  if (cd?.past) {
    return (
      <p className="font-display text-display-3 font-extrabold text-ink">
        {label ? `${label} — ` : ""}It&rsquo;s here.
      </p>
    );
  }

  return (
    <div>
      {label && (
        <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
          {label}
        </p>
      )}
      <div className="mt-2 flex items-stretch" aria-live="off">
        {cells.map((c, i) => (
          <div
            key={c.k}
            className={`min-w-0 flex-1 ${
              i > 0 ? "border-l border-sand/70 pl-3 sm:pl-5" : "pr-3 sm:pr-5"
            } ${i > 0 && i < cells.length - 1 ? "pr-3 sm:pr-5" : ""}`}
          >
            <p
              className={`font-display ${
                compact ? "text-display-3" : "text-display-2"
              } font-extrabold tabular-nums text-ink`}
            >
              {c.v}
            </p>
            <p className="mt-1 text-eyebrow font-display font-bold uppercase text-soft">
              {c.l}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
