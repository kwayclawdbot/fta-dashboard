import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveClubCtx, type ClubCtx, type CoreResult } from "@/lib/club/home-context";

import { pulseCore } from "@/app/api/club/pulse/route";
import { collectiveCore } from "@/app/api/club/collective/route";
import { briefCore } from "@/app/api/club/brief/route";
import { trendingCore } from "@/app/api/club/trending/route";
import { thinkingCore } from "@/app/api/club/thinking/route";
import { debateCore } from "@/app/api/club/debate/route";
import { forYouCore } from "@/app/api/club/foryou/route";
import { peopleCore } from "@/app/api/club/people/route";
import { inviteCore } from "@/app/api/club/invite/route";

/**
 * THE ClubHome batch assembly — the SINGLE definition of "the whole home
 * payload", shared by two callers so they can never drift:
 *
 *   • GET /api/club/home  — the client's one-round-trip batch (and the fallback
 *     path when the server seed is absent).
 *   • /dashboard (RSC)    — the server component builds the SAME payload inline
 *     and hands it to ClubHomeV2 already populated, so first paint carries real
 *     club data instead of nine founding/empty branches.
 *
 * Assembly semantics (see src/lib/clubhome/client.ts for the consumer side):
 *   • a section that resolves 200 → its body verbatim.
 *   • a section walled with a non-200 (brief/free 403) → null. A 403 read is a
 *     null section on the client today, so this is exact parity — and NOT an
 *     error, so the client does NOT re-fetch it individually.
 *   • a section whose core THROWS → null AND its key in `_errors`, so the
 *     consumer falls back to fetching that ONE individual endpoint (graceful
 *     per-section degradation). One broken section never sinks the other eight.
 *
 * Every entitlement gate, the free-tier trending cap, kid-register stripping and
 * all floor logic live inside the cores themselves — this file only orchestrates
 * them, so behaviour is identical no matter which caller runs it.
 */

export type ClubSectionKey =
  | "pulse" | "collective" | "brief" | "trending"
  | "thinking" | "debate" | "foryou" | "people" | "invite";

/** The wire shape of GET /api/club/home (and of the server seed). */
export type ClubHomePayload = {
  [K in ClubSectionKey]?: unknown;
} & { _errors: ClubSectionKey[] };

const CORES: Record<ClubSectionKey, (ctx: ClubCtx) => Promise<CoreResult>> = {
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

const KEYS = Object.keys(CORES) as ClubSectionKey[];

/**
 * Run all nine section cores against an already-resolved context and assemble
 * the batch envelope. Never throws: a failing core degrades to `null` + an
 * `_errors` entry.
 */
export async function buildClubHomePayload(ctx: ClubCtx): Promise<ClubHomePayload> {
  // PERF: the metrics read-through is memoised and the cores that depend on it
  // (trending, pulse) already await it themselves — so kicking it off WITHOUT
  // awaiting keeps single-flight behaviour while letting the independent cores
  // start immediately. The floating promise is caught so a failed refresh can
  // never reject the request.
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
  const errors: ClubSectionKey[] = [];
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

  return { ...out, _errors: errors } as ClubHomePayload;
}

/**
 * Server-component entry point: resolve the context from an RSC supabase client
 * and build the payload.
 *
 * SAFETY: this NEVER rejects and NEVER throws. The returned promise is handed
 * straight to a client component and resolved with `use()`, so a rejection would
 * blow up the whole Home surface. `null` means "no server seed" and the client
 * transparently falls back to its own batched fetch — the pre-existing path.
 */
export function buildClubHomeSeed(
  supabase: SupabaseClient
): Promise<ClubHomePayload | null> {
  return (async () => {
    const ctx = await resolveClubCtx(supabase);
    if (!ctx) return null;
    return await buildClubHomePayload(ctx);
  })().catch((err) => {
    console.error("[club/home] server seed failed:", err);
    return null;
  });
}
