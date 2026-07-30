import { getWatchlist } from "@/ui-v3/watch-data";
import WatchlistScreen from "@/ui-v3/components/watch/WatchlistScreen";

/**
 * /v3/watch/list — the WATCHLIST tab of "06 Watch".
 *
 * No artboard exists for this screen; it is composed from the grammar (§9).
 * All data access happens in getWatchlist(); an anonymous visitor gets the same
 * screen rendered from fixtures, read-only.
 */
export const dynamic = "force-dynamic";

export default async function V3WatchlistPage() {
  const model = await getWatchlist();
  return <WatchlistScreen model={model} />;
}
