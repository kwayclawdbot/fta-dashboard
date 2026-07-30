import { getKaiWatch } from "@/ui-v3/watch-data";
import KaiWatchScreen from "@/ui-v3/components/watch/KaiWatchScreen";

/**
 * /v3/watch/setups — the KAI WATCH tab of "06 Watch".
 *
 * No artboard exists for this screen; it is composed from the grammar (§9).
 */
export const dynamic = "force-dynamic";

export default async function V3KaiWatchPage() {
  const model = await getKaiWatch();
  return <KaiWatchScreen model={model} />;
}
