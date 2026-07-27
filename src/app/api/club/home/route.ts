import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveClubCtx } from "@/lib/club/home-context";
import { buildClubHomePayload } from "@/lib/club/home-payload";

/**
 * GET /api/club/home — the BATCHED ClubHome load.
 *
 * Collapses the nine-endpoint client fan-out (pulse, collective, brief, trending,
 * thinking, debate, foryou, people, invite) into ONE server round trip. It builds
 * the shared request context ONCE (auth + profile + tier + register + the
 * canonical snapshot ledger + the metrics read-through are each resolved a single
 * time, memoised in home-context.ts) and runs every section's `*Core(ctx)` — the
 * SAME functions the individual routes wrap — so the batched output is byte-for-
 * byte what the nine endpoints return. All entitlement gates, kid walls, floors,
 * disclaimers, debate userVote and founding states are preserved because the code
 * that produces them is literally shared.
 *
 * The assembly itself now lives in src/lib/club/home-payload.ts, because the
 * /dashboard server component builds the SAME payload inline to seed first paint.
 * One definition, two callers — the two can never drift. See that file for the
 * full assembly semantics (200 → body, walled non-200 → null, throw → `_errors`).
 *
 * This route remains the client's FALLBACK path: it is what runs when the server
 * seed is absent (persona fell through to the client home, an RSC failure, or a
 * client-side navigation into Home).
 *
 * Freshness stays after()-deferred (bdd21c9): ctx.ensureFresh() triggers the
 * metrics read-through once; the expensive recompute runs post-response.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const payload = await buildClubHomePayload(ctx);
  return NextResponse.json(payload);
}
