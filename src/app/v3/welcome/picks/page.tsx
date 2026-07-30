import { redirect } from "next/navigation";
import { getPicksViewModel } from "@/ui-v3/onboard-data";
import PicksScreen from "@/ui-v3/components/onboard/PicksScreen";

/**
 * /v3/welcome/picks — the watchlist seeding step. No artboard; composed from the
 * grammar (see PicksScreen).
 *
 * GUARDS, in order:
 *   no session          → /v3/login   (there is nothing to seed and no honest
 *                                      fixture for "your watchlist")
 *   watchlist not empty → /v3         (a returning member is not asked to pick
 *                                      three names they already have)
 *   otherwise           → the step, which is itself skippable
 *
 * This is also where sign-in lands, so the second guard is what makes the step
 * a one-time event rather than a toll gate on every login.
 */
export const dynamic = "force-dynamic";

export default async function V3PicksPage() {
  const model = await getPicksViewModel();
  if (!model) redirect("/v3/login");
  if (model.existing.length > 0) redirect("/v3");

  return <PicksScreen model={model} done="/v3" />;
}
