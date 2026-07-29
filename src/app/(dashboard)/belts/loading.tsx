/**
 * LOADING ≠ EMPTY. The shape of board 22 arriving: the wordmark, the lede, and
 * the five rung cards. The founding states (an empty ladder, an unreadable
 * distribution) are designed copy inside BeltLadder.
 */
import V2Skeleton from "@/components/cc/V2Skeleton";
import { designV2Enabled } from "@/lib/design-flag";

export default function Loading() {
  // Flag on ⇒ the v2 shimmer skeleton on the same ladder footprint; flag off ⇒
  // the existing v1 warm-paper skeleton below, byte-identical to prod.
  if (designV2Enabled()) return <V2Skeleton variant="ladder" />;
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
      <div className="h-9 w-28 rounded bg-sand/60 motion-safe:animate-pulse" />
      <div className="h-8 w-full max-w-md rounded bg-sand/40 motion-safe:animate-pulse" />
      <div className="space-y-2 pt-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="club-b-card h-[62px] rounded-[13px] motion-safe:animate-pulse" />
        ))}
      </div>
      <span className="sr-only">Loading the belt ladder</span>
    </div>
  );
}
