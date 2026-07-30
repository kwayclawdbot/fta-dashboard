import { getOpinionChanges } from "@/ui-v3/watch-data";
import OpinionChangesScreen from "@/ui-v3/components/watch/OpinionChangesScreen";

/**
 * /v3/watch/changes — the Opinion Changes destination on "06 Watch".
 *
 * No artboard exists for this screen; it is composed from the grammar (§9).
 */
export const dynamic = "force-dynamic";

export default async function V3OpinionChangesPage() {
  const model = await getOpinionChanges();
  return <OpinionChangesScreen model={model} />;
}
