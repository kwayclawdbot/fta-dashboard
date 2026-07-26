export const dynamic = "force-dynamic";

import CourseCatalog from "@/components/learn/CourseCatalog";

/**
 * /learn/catalog — the full course catalog, demoted under "Explore curriculum".
 * The classic course→unit→lesson grid (foundations + the 6-week live program),
 * reachable from the Learning World but no longer the front door.
 */
export default function LearnCatalogPage() {
  return <CourseCatalog />;
}
