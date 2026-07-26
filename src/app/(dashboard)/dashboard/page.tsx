import { createClient } from "@/lib/supabase/server";
import { resolveHomeRoute } from "@/lib/club/home-route";
import ClubHomeV2 from "@/components/clubhome/ClubHomeV2";
import FreeHome from "@/components/dashboard/FreeHome";
import DashboardHomeClient from "./DashboardHomeClient";

/**
 * /dashboard — Home (CONVERGENCE S2: server-rendered persona resolution).
 *
 * The persona round-1 resolution (auth → profile → home_state → tier → register
 * → solo verdict) now runs on the SERVER (resolveHomeRoute), so the Club home's
 * shell + header stream on first paint instead of after the client's
 * hydrate → session → profile → tier chain (the ~1.4s FCP item). Section data
 * still hydrates client-side via the batched GET /api/club/home.
 *
 * Only the club-solo surface takes the fast path; the family / kid / free
 * personas fall through to DashboardHomeClient UNCHANGED. Auth is already
 * enforced by the (dashboard) layout.
 */
export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const supabase = await createClient();
  const route = await resolveHomeRoute(supabase);

  if (route.kind === "club") {
    return (
      <ClubHomeV2
        firstName={route.firstName}
        register={route.register}
        learning={route.learning}
        challengeExpiresAt={route.challengeExpiresAt}
      />
    );
  }

  if (route.kind === "free") {
    return <FreeHome firstName={route.firstName} />;
  }

  // Family / kid / teen (and any ambiguous case) → the untouched client path.
  return <DashboardHomeClient />;
}
