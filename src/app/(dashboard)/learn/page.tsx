export const dynamic = "force-dynamic";

import LearnWorld from "@/components/learn/LearnWorld";

/**
 * /learn — the canonical Learning World home (FIC-LEARNING-WORLD §3). Coexists
 * with /courses (which also renders the world for members); this is the clean
 * URL the ContinuePath object and future nav point at. Gating is enforced by the
 * lesson routes + the shell; a paid experience, so it is not a free-allowed
 * prefix (free members use the /courses sampler).
 */
export default function LearnPage() {
  return <LearnWorld />;
}
