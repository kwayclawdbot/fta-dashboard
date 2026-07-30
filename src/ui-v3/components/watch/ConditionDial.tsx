import SignalRing from "@/ui-v3/components/SignalRing";

/**
 * met / total, drawn as the artboard's 88px arc — <SignalRing size="lg">.
 *
 * The arc is the fraction itself — nothing is smoothed, projected, or padded.
 * A setup with zero conditions evaluated yields an empty arc rather than a
 * flattering default. Unlike the other two dials the artboard leaves this one
 * uncaptioned: the reading is the fraction in the middle.
 */
export default function ConditionDial({ met, total }: { met: number; total: number }) {
  const pct = total > 0 ? Math.round((met / total) * 100) : 0;
  return <SignalRing size="lg" pct={pct} value={`${met}/${total}`} />;
}
