import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { resolveHomeRoute } from "@/lib/club/home-route";
import { buildClubHomeSeed } from "@/lib/club/home-payload";
import ClubHomeV2 from "@/components/clubhome/ClubHomeV2";
import ClubHomeSkeleton from "@/components/clubhome/ClubHomeSkeleton";
import FreeHome from "@/components/dashboard/FreeHome";
import DashboardHomeClient from "./DashboardHomeClient";

/**
 * /dashboard — Home (CONVERGENCE S2 + S3: server-rendered persona AND data).
 *
 * S2 moved the persona round-1 resolution (auth → profile → home_state → tier →
 * register → solo verdict) onto the SERVER, so the Club home's shell + header
 * stream on first paint instead of after the client's hydrate → session →
 * profile → tier chain.
 *
 * S3 (this) moves the SECTION DATA too. It used to be client-fetched from
 * /api/club/home inside a useEffect, which meant two things:
 *
 *   1. EMPTY-FIRST FLASH. The effect only runs after hydration, so the first
 *      paint had no data and every section rendered its founding/empty branch
 *      before swapping to real content ("the board says empty first").
 *   2. SERIAL COST. The page's server work and the API's server work ran
 *      back-to-back with a full browser round trip between them.
 *
 * Now the page builds the payload itself, with the SAME assembler the API route
 * uses (src/lib/club/home-payload.ts), and hands the promise to ClubHomeV2.
 *
 * STREAMING, NOT BLOCKING. The promise is deliberately NOT awaited here: the
 * document (layout, nav, masthead shell) streams immediately at the old TTFB,
 * and the payload arrives through the Suspense boundary below as soon as the
 * nine cores settle. Awaiting it here would have pushed the whole document's
 * TTFB out by the cost of the slowest core. The fallback is a SKELETON, never
 * the founding copy — loading and empty stay distinct, which was the original
 * bug.
 *
 * The seed is only built for the club fast-path. Free / family / kid / teen fall
 * through exactly as before, and the client's own batched fetch remains the
 * fallback for any load without a seed (client-side navigation into Home, or a
 * seed that failed to build). Fixtures/preview never touch this path.
 */
export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const supabase = await createClient();
  const route = await resolveHomeRoute(supabase);

  if (route.kind === "club") {
    // Started here, awaited inside the boundary. buildClubHomeSeed never
    // rejects — it resolves to null on any failure, and a null seed makes
    // ClubHomeV2 fall back to its original client fetch.
    const seedPromise = buildClubHomeSeed(supabase);

    return (
      <Suspense fallback={<ClubHomeSkeleton />}>
        <ClubHomeV2
          firstName={route.firstName}
          register={route.register}
          learning={route.learning}
          challengeExpiresAt={route.challengeExpiresAt}
          seedPromise={seedPromise}
        />
      </Suspense>
    );
  }

  if (route.kind === "free") {
    return <FreeHome firstName={route.firstName} />;
  }

  // Family / kid / teen (and any ambiguous case) → the untouched client path.
  return <DashboardHomeClient />;
}
