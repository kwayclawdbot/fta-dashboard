import { getComposeViewer } from "@/ui-v3/club-data";
import StartCircleScreen from "@/ui-v3/components/club/StartCircleScreen";

/**
 * /v3/club/circles/new — the destination behind both "Start a Circle"
 * affordances on "16 Club Circles".
 *
 * Like the composer route, the only server-side question is who is opening it
 * and whether they may; `openCircle()` runs client-side under the member's own
 * RLS.
 */
export const dynamic = "force-dynamic";

export default async function V3StartCirclePage() {
  const viewer = await getComposeViewer();
  return <StartCircleScreen viewer={viewer} />;
}
