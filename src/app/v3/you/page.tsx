import { getYouViewModel } from "@/ui-v3/you-data";
import YouScreen from "@/ui-v3/components/you/YouScreen";

/**
 * /v3/you — "07 You Profile".
 *
 * All data access happens in getYouViewModel(); the screen below is pure
 * presentation. /v3 is outside the middleware's protected paths, so an
 * anonymous visitor gets the same screen rendered from fixtures.
 */
export const dynamic = "force-dynamic";

export default async function V3YouPage() {
  const model = await getYouViewModel();
  return <YouScreen model={model} />;
}
