import { getWatchOverview } from "@/ui-v3/watch-data";
import WatchScreen from "@/ui-v3/components/watch/WatchScreen";

/**
 * /v3/watch — "06 Watch".
 *
 * All data access happens in getWatchOverview(); the screen below is pure
 * presentation. /v3 is outside the middleware's protected paths, so an
 * anonymous visitor gets the same screen rendered from fixtures.
 */
export const dynamic = "force-dynamic";

export default async function V3WatchPage() {
  const model = await getWatchOverview();
  return <WatchScreen model={model} />;
}
