import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import V2Skeleton from "@/components/cc/V2Skeleton";
import { designV2Enabled } from "@/lib/design-flag";

export default function Loading() {
  // Flag on ⇒ the v2 warm-black/paper shimmer skeleton (design-project-v2);
  // flag off ⇒ the existing v1 warm-paper skeleton, byte-identical to prod.
  if (designV2Enabled()) return <V2Skeleton variant="home" />;
  return <DashboardSkeleton variant="default" />;
}
