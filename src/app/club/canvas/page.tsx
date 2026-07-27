import { notFound } from "next/navigation";
import CanvasHarness from "@/components/canvas/CanvasHarness";

/**
 * /club/canvas — walk-in review harness for the CANVAS REBUILD lane. Renders the
 * seven pixel-faithful club-mode screen rebuilds in phone frames for side-by-side
 * review against the App-UI artboards. PROD-GUARDED (404 in production) — the
 * screens themselves ship in-app at their real routes; this is only the review
 * board, reachable in dev / vercel preview with no auth.
 */
export const dynamic = "force-dynamic";

function previewAllowed(): boolean {
  const env = process.env.VERCEL_ENV;
  if (env) return env !== "production";
  return process.env.NODE_ENV !== "production";
}

export default function CanvasReviewPage() {
  if (!previewAllowed()) notFound();
  return <CanvasHarness />;
}
