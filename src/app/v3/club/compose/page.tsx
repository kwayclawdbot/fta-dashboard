import { getComposeViewer } from "@/ui-v3/club-data";
import ComposeScreen from "@/ui-v3/components/club/ComposeScreen";

/**
 * /v3/club/compose — "05 Share your call".
 *
 * The server half resolves ONE thing: who is writing, and whether they are
 * allowed to. Everything else on this screen is a client-side write against the
 * member's own session, so there is nothing else worth reading here.
 */
export const dynamic = "force-dynamic";

export default async function V3ComposePage() {
  const viewer = await getComposeViewer();
  return <ComposeScreen viewer={viewer} />;
}
