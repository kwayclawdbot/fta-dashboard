import { getHomeViewModel } from "@/ui-v3/home-data";
import HomeScreen from "@/ui-v3/components/HomeScreen";

/**
 * /v3 — "01 Home".
 *
 * All data access happens in getHomeViewModel(); the screen below is pure
 * presentation. /v3 is outside the middleware's protected paths, so an
 * anonymous visitor gets the same screen rendered from fixtures.
 */
export const dynamic = "force-dynamic";

export default async function V3HomePage() {
  const model = await getHomeViewModel();
  return <HomeScreen model={model} />;
}
