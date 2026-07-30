import { getWatchAlerts } from "@/ui-v3/watch-data";
import AlertsScreen from "@/ui-v3/components/watch/AlertsScreen";

/** /v3/watch/alerts — "18 Kai Alerts". */
export const dynamic = "force-dynamic";

export default async function V3WatchAlertsPage() {
  const model = await getWatchAlerts();
  return <AlertsScreen model={model} />;
}
