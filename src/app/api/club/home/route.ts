import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveClubCtx, type ClubCtx, type CoreResult } from "@/lib/club/home-context";

import { pulseCore } from "../pulse/route";
import { collectiveCore } from "../collective/route";
import { briefCore } from "../brief/route";
import { trendingCore } from "../trending/route";
import { thinkingCore } from "../thinking/route";
import { debateCore } from "../debate/route";
import { forYouCore } from "../foryou/route";
import { peopleCore } from "../people/route";
import { inviteCore } from "../invite/route";

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
 * Assembly semantics (client parity, see src/lib/clubhome/client.ts):
 *   • a section that resolves 200 → its body verbatim.
 *   • a section walled with a non-200 (brief/free 403) → null. A 403 read is a
 *     null section on the client today, so this is exact parity — and NOT an
 *     error, so the client does NOT re-fetch it individually.
 *   • a section whose core THROWS → null AND its key in `_errors`, so the client
 *     falls back to fetching that ONE individual endpoint (graceful per-section
 *     degradation). One slow/broken section never sinks the other eight.
 *
 * Freshness stays after()-deferred (bdd21c9): ctx.ensureFresh() triggers the
 * metrics read-through once; the expensive recompute runs post-response.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

type SectionKey =
  | "pulse" | "collective" | "brief" | "trending"
  | "thinking" | "debate" | "foryou" | "people" | "invite";

const CORES: Record<SectionKey, (ctx: ClubCtx) => Promise<CoreResult>> = {
  pulse: pulseCore,
  collective: collectiveCore,
  brief: briefCore,
  trending: trendingCore,
  thinking: thinkingCore,
  debate: debateCore,
  foryou: forYouCore,
  people: peopleCore,
  invite: inviteCore,
};

const KEYS = Object.keys(CORES) as SectionKey[];

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // PERF: this used to `await ctx.ensureFresh()` here, which serialised the
  // metrics read-through AHEAD of all nine cores. The call is memoised and the
  // cores that actually depend on it (trending, pulse) already await it
  // themselves — so blocking here bought nothing and delayed the five sections
  // that never touch it (thinking, debate, foryou, people, invite).
  //
  // Kicking it off WITHOUT awaiting keeps the single-flight behaviour (same
  // memoised promise) while letting the independent cores start immediately.
  // The floating promise is caught so a failed refresh can never reject the
  // request — each core still degrades on its own.
  void ctx.ensureFresh().catch(() => {});

  const settled = await Promise.all(
    KEYS.map(async (key) => {
      try {
        const r = await CORES[key](ctx);
        return { key, r, threw: false as const };
      } catch (err) {
        console.error(`[club/home] ${key} core failed:`, err);
        return { key, r: null, threw: true as const };
      }
    })
  );

  const out: Record<string, unknown> = {};
  const errors: SectionKey[] = [];
  for (const { key, r, threw } of settled) {
    if (threw || !r) {
      out[key] = null;
      errors.push(key);
      continue;
    }
    // A deliberate non-200 wall (e.g. brief/free 403) is a null section on the
    // client — NOT an error, so it is not queued for individual fallback.
    out[key] = r.status && r.status !== 200 ? null : r.body;
  }

  return NextResponse.json({ ...out, _errors: errors });
}
