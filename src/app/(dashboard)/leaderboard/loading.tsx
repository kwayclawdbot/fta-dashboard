/**
 * LOADING ≠ EMPTY. The shape of the ranked-card board arriving. The empty
 * window and the founding notes are designed copy inside the page.
 */
import V2Skeleton from "@/components/cc/V2Skeleton";
import { designV2Enabled } from "@/lib/design-flag";

export default function Loading() {
  // Flag on ⇒ the v2 shimmer skeleton on the same board footprint; flag off ⇒
  // the existing v1 warm-paper skeleton below, byte-identical to prod.
  if (designV2Enabled()) return <V2Skeleton variant="board" />;
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
      <div className="h-9 w-56 max-w-full rounded bg-sand/60 motion-safe:animate-pulse" />
      <div className="h-8 w-full rounded bg-sand/40 motion-safe:animate-pulse" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="club-b-card h-[62px] rounded-[14px] motion-safe:animate-pulse" />
        ))}
      </div>
      <span className="sr-only">Loading the board</span>
    </div>
  );
}
