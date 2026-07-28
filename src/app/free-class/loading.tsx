import { FunnelSkeleton } from "@/components/free-class/ui";

/**
 * Route-level loading for the free-class funnel landing. Reuses the lane's own
 * skeleton so navigating in shows the funnel's warm-paper chrome (top bar, then
 * a shimmer holding the masthead / card / action slots) instead of a white flash
 * or an anonymous spinner. LOADING IS NOT EMPTY: the layout is kept, the objects
 * shimmer, nothing states an absence.
 */
export default function Loading() {
  return <FunnelSkeleton />;
}
