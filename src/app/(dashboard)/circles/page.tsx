import type { Metadata } from "next";
import CirclesSurface from "@/components/circles/CirclesSurface";

export const metadata: Metadata = {
  title: "Circles",
  description:
    "Breakout rooms around one event or one thesis, on a 30-day clock.",
};

/**
 * /circles — Club Circles (canvas v2, App board 16).
 *
 * Schema-backed by migration 190. Until that migration is applied the surface
 * renders a stated absence rather than a fabricated room — see CirclesSurface.
 */
export default function CirclesPage() {
  return <CirclesSurface />;
}
