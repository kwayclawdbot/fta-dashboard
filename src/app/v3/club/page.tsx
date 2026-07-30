import { getClubFeedViewModel } from "@/ui-v3/club-data";
import ClubFeedScreen from "@/ui-v3/components/club/ClubFeedScreen";

/**
 * /v3/club — "04 Club Feed".
 *
 * All data access happens in getClubFeedViewModel(); the screen below is pure
 * presentation. /v3 is outside the middleware's protected paths, so an anonymous
 * visitor gets the same screen rendered from fixtures.
 */
export const dynamic = "force-dynamic";

export default async function V3ClubPage() {
  const model = await getClubFeedViewModel();
  return <ClubFeedScreen model={model} />;
}
