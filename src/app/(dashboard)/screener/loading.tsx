/**
 * Route shell for /screener. The masthead and the ledger geometry are known at
 * build time, so navigation lands on finished page furniture and only the rows
 * fill in — and it is the SAME shell the surface itself shows while the ~10k-row
 * universe streams, so the route resolving does not cause a second swap.
 *
 * (It used to be DashboardSkeleton's rounded-card list, a shape that appears
 * nowhere on the finished screener.)
 */
import { ScreenerSkeleton } from "@/components/screener/ScreenerSurface";

export default function Loading() {
  return <ScreenerSkeleton />;
}
