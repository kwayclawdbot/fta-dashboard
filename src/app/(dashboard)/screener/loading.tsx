/**
 * Route shell for /screener. The masthead and the ledger geometry are known at
 * build time, so navigation lands on finished page furniture and only the rows
 * fill in — and it is the SAME shell the surface itself shows while the ~10k-row
 * universe streams, so the route resolving does not cause a second swap.
 *
 * (It used to be DashboardSkeleton's rounded-card list, a shape that appears
 * nowhere on the finished screener.)
 */
import { designV2Enabled } from "@/lib/design-flag";
import { ScreenerSkeleton } from "@/components/screener/ScreenerSurface";
import { ScreenerSkeletonV2 } from "@/components/screener/ScreenerSurfaceV2";

export default function Loading() {
  if (designV2Enabled()) return <ScreenerSkeletonV2 />;
  return <ScreenerSkeleton />;
}
