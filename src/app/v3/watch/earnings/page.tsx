import { getWatchEarnings } from "@/ui-v3/watch-data";
import EarningsScreen from "@/ui-v3/components/watch/EarningsScreen";

/**
 * /v3/watch/earnings — the Earnings Calendar destination on "06 Watch".
 *
 * No artboard, and no earnings source in the application — see the verdict on
 * getWatchEarnings(). The screen renders its frame and says so.
 */
export const dynamic = "force-dynamic";

export default async function V3EarningsPage() {
  const model = await getWatchEarnings();
  return <EarningsScreen model={model} />;
}
