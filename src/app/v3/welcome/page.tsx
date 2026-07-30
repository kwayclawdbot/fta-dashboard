import { redirect } from "next/navigation";
import { getRequestUser } from "@/lib/supabase/rsc";
import SplashScreen from "@/ui-v3/components/onboard/SplashScreen";

/**
 * /v3/welcome — "09 Splash". The front door.
 *
 * GUARD: a member who already has a session has nothing to be welcomed to, so
 * they go straight to Home. This is a page-level check on purpose — the
 * middleware's protected-path list is the OLD app's and is deliberately not
 * touched by the v3 rebuild.
 */
export const dynamic = "force-dynamic";

export default async function V3WelcomePage() {
  const user = await getRequestUser();
  if (user) redirect("/v3");

  return <SplashScreen next="/v3/login" />;
}
