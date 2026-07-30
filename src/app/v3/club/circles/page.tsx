import { getClubCirclesViewModel } from "@/ui-v3/club-data";
import ClubCirclesScreen from "@/ui-v3/components/club/ClubCirclesScreen";

/** /v3/club/circles — "16 Club Circles". */
export const dynamic = "force-dynamic";

export default async function V3ClubCirclesPage() {
  const model = await getClubCirclesViewModel();
  return <ClubCirclesScreen model={model} />;
}
