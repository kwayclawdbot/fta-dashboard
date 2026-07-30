import { notFound } from "next/navigation";
import { getWatchSetup } from "@/ui-v3/watch-data";
import SetupScreen from "@/ui-v3/components/watch/SetupScreen";

/**
 * /v3/watch/alerts/[id] — "19 Alert Setup".
 *
 * `id` is an `alert_setups.id`. An id that resolves to nothing readable is a
 * 404 rather than an empty screen; the fixture id resolves only when there is
 * no session, so a signed-in member is never shown fixture prices.
 */
export const dynamic = "force-dynamic";

export default async function V3AlertSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const model = await getWatchSetup(id);
  if (!model) notFound();
  return <SetupScreen model={model} />;
}
