import { getScreenerViewModel } from "@/ui-v3/discover-data";
import ScreenerScreen from "@/ui-v3/components/discover/ScreenerScreen";

/** /v3/discover/screener — "15 Discover Screener". */
export const dynamic = "force-dynamic";

export default async function V3ScreenerPage() {
  const model = await getScreenerViewModel();
  return <ScreenerScreen model={model} />;
}
