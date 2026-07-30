import { redirect } from "next/navigation";
import { getRequestUser } from "@/lib/supabase/rsc";
import LoginScreen from "@/ui-v3/components/onboard/LoginScreen";

/**
 * /v3/login — "10 Login". Real Supabase auth, same as the old /login page.
 *
 * GUARD: an authenticated visitor is sent to Home, mirroring what the middleware
 * does for the old /login and /signup. It is enforced here rather than there
 * because this lane does not modify middleware or the old auth pages.
 *
 * Sign-in hands off to /v3/welcome/picks, which is itself a guard: it decides
 * between the seeding step and Home based on whether the member's watchlist is
 * empty. Doing it there rather than here means the OAuth round trip and the
 * password path land in the same place.
 */
export const dynamic = "force-dynamic";

export default async function V3LoginPage() {
  const user = await getRequestUser();
  if (user) redirect("/v3");

  return <LoginScreen next="/v3/welcome/picks" />;
}
