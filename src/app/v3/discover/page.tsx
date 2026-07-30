import { getDiscoverViewModel } from "@/ui-v3/discover-data";
import DiscoverScreen from "@/ui-v3/components/discover/DiscoverScreen";

/**
 * /v3/discover — "02 Discover".
 *
 * All data access happens in getDiscoverViewModel(); the screen below is pure
 * presentation. /v3 is outside the middleware's protected paths, so an
 * anonymous visitor gets the same screen rendered from the anonymous branch.
 */
export const dynamic = "force-dynamic";

export default async function V3DiscoverPage() {
  const model = await getDiscoverViewModel();
  return <DiscoverScreen model={model} />;
}
