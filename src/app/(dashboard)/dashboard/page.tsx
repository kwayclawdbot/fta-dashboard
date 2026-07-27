import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { resolveHomeRoute } from "@/lib/club/home-route";
import { buildClubHomeSeedSplit } from "@/lib/club/home-payload";
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
 * S3 moved the SECTION DATA too. It used to be client-fetched from
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
 * CANVAS V2 (M1) adds the SPLIT. `briefCore` alone cost ~2.9s — it derives the
 * deltas and then optionally waits on an LLM polish — and because the assembler
 * awaited Promise.all over every core, that one paragraph was holding the other
 * eight sections, and therefore the whole Home boundary, behind it. The seed is
 * now TWO promises on TWO boundaries:
 *
 *   · `rest`  — eight fast cores. Gates the board's skeleton, as before.
 *   · `brief` — the long pole, resolved independently and awaited only by the
 *               "Today in 30 seconds" field, behind its own skeleton.
 *
 * The request context is still resolved ONCE, so nothing is fetched twice.
 *
 * STREAMING, NOT BLOCKING. Neither promise is awaited here: the document
 * (layout, nav, masthead shell) streams immediately at the old TTFB and the
 * payloads arrive through their boundaries. Awaiting either would push the
 * document's TTFB out by the cost of the slowest core. Both fallbacks are
 * SKELETONS, never founding copy — loading and empty stay distinct, which was
 * the original bug.
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
    // Started here, awaited inside the boundaries. Neither promise ever rejects
    // (buildClubHomeSeedSplit catches), and either resolving to null makes
    // ClubHomeV2 fall back to its original client fetch.
    const { rest, brief } = buildClubHomeSeedSplit(supabase);

    return (
      <Suspense fallback={<ClubHomeSkeleton />}>
        <ClubHomeV2
          firstName={route.firstName}
          register={route.register}
          learning={route.learning}
          challengeExpiresAt={route.challengeExpiresAt}
          xp={route.xp}
          seedPromise={rest}
          briefPromise={brief}
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
