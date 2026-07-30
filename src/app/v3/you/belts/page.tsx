import { getBeltsViewModel } from "@/ui-v3/you-data";
import BeltsScreen from "@/ui-v3/components/you/BeltsScreen";

/**
 * /v3/you/belts — "22 Belts".
 *
 * A detail screen off the profile: no bottom nav, a pinned next-belt bar. All
 * data access happens in getBeltsViewModel().
 */
export const dynamic = "force-dynamic";

export default async function V3BeltsPage() {
  const model = await getBeltsViewModel();
  return <BeltsScreen model={model} />;
}
