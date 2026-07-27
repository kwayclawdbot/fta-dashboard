import type { StateTone } from "@/lib/alerts/watch-ui";

/* ══════════════════════════════════════════════════════════════════════════
   PROXIMITY METER — canvas board 06, "Getting close · 2/3".

   The canvas answers "how close is this to happening" with a conic donut. We
   do not adopt donuts (plan §1.5 — the club-sentiment arc stays the only one),
   and a dial is the wrong instrument here anyway: the reader's question is
   "nearly, or nowhere near", which is a distance, and a distance reads on a
   line.

   WHAT IT IS DRAWN FROM: `watch_states.detail.progress`, a 0..1 closeness the
   Lane-A cron already computes and stores on every transition (fraction of a
   move/volume threshold reached, RSI points from the line, % of the way to a
   price level). It was being written, selected, and then thrown away by the UI.
   Nothing here is estimated.

   WHY NO PERCENTAGE IS PRINTED: `progress` is a normaliser across seven
   different condition kinds, not a probability. "78%" next to a stock would be
   read as a likelihood, which it is not. The number sizes the meter and rides
   `aria-valuetext` for screen readers; what the member READS is the measured
   quantity itself (`detail.metric` — "RSI 63, needs 70") when the cron recorded
   one.

   TICKS, NOT A BAR: a continuous bar implies continuous precision. Ten discrete
   cells say "roughly this far" — which is exactly the claim the data supports.

   COLOUR: the state tone, which is the shipped watch language (volt = live /
   at the doorstep, teal = building, kai blue = scheduled, quiet = ambient).
   No price ramp: nothing on this object is a price.
   ══════════════════════════════════════════════════════════════════════════ */

const CELLS = 10;

const TONE_FILL: Record<StateTone, string> = {
  volt: "bg-volt-500",
  teal: "bg-teal-500",
  kai: "bg-kai-500",
  quiet: "bg-soft/45",
};

export default function ProximityMeter({
  progress,
  tone = "quiet",
  /** The measured quantity the cron recorded, e.g. "RSI 63 vs 70". */
  metric,
  label = "How close",
  className = "",
}: {
  progress: number | null | undefined;
  tone?: StateTone;
  metric?: string | null;
  label?: string;
  className?: string;
}) {
  if (typeof progress !== "number" || !Number.isFinite(progress)) return null;
  const p = Math.min(1, Math.max(0, progress));
  const lit = Math.max(1, Math.round(p * CELLS));
  const fill = TONE_FILL[tone] ?? TONE_FILL.quiet;

  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft/70">
          {label}
        </span>
        <span
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={CELLS}
          aria-valuenow={lit}
          aria-valuetext={`${lit} of ${CELLS} of the way to the condition`}
          className="flex min-w-0 flex-1 items-center gap-[3px]"
        >
          {Array.from({ length: CELLS }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={`h-[3px] flex-1 rounded-full ${
                i < lit ? fill : "bg-sand"
              }`}
            />
          ))}
        </span>
      </div>
      {metric && (
        <p className="mt-1.5 font-mono text-[10.5px] leading-snug text-soft/80">
          {metric}
        </p>
      )}
    </div>
  );
}
