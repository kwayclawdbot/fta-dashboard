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

/** All nine cores. Kept exported for any caller that genuinely wants the full
 *  set — the Home surface deliberately does not (see HOME_KEYS). */
export const KEYS = Object.keys(CORES) as ClubSectionKey[];

/**
 * WHAT THE HOME PAGE ACTUALLY RENDERS — the seed's whole key set.
 *
 * The server component was running all NINE cores and ClubHomeV2 reads SEVEN of
 * them: `trending` (TOP IN THE CLUB + the split's ledger), `brief` (TODAY IN 30
 * SECONDS, on its own boundary), `foryou` (YOUR SIGNALS), `debate` + `thinking`
 * (WHERE THE CLUB SPLITS) and `collective` + `people` (THE ROOM).
 *
 * `pulse` and `invite` are read by NOTHING on this surface — `data.pulse` and
 * `data.invite` have zero references in src/components/clubhome — so the page
 * was paying for two whole section cores (pulse alone is a snapshot-ledger read
 * plus up to three club_events scans) to build objects it then dropped on the
 * floor. They are simply not asked for here any more.
 *
 * THE ENDPOINTS THEMSELVES STAY ALIVE. /api/club/pulse and /api/club/invite are
 * unchanged and still serve any other caller; this trims the HOME PAGE's server
 * render path, not the API surface. The client's `applyBatch` already treats an
 * absent key as "leave alone" rather than "null it out", so a seed that omits
 * them needs no change on the consumer side.
 */
const HOME_KEYS: ClubSectionKey[] = [
  "brief",
  "trending",
  "foryou",
  "thinking",
  "debate",
  "collective",
  "people",
];

/** Everything the home renders except the brief — see buildClubHomeSeedSplit. */
const HOME_KEYS_WITHOUT_BRIEF = HOME_KEYS.filter((k) => k !== "brief");

/**
 * Run the section cores against an already-resolved context and assemble the
 * batch envelope. Never throws: a failing core degrades to `null` + an `_errors`
 * entry.
 *
 * `keys` defaults to HOME_KEYS — the seven sections the Home surface actually
 * renders, NOT all nine cores (see HOME_KEYS for what was dropped and why).
 * The /dashboard server component passes the six-key subset so the brief can
 * stream on its own boundary — see buildClubHomeSeedSplit. Sections not in
 * `keys` are simply absent from the envelope, which the client's `applyBatch`
 * already treats as "leave alone" rather than "null it out", so nothing
 * downstream needed to change. `KEYS` (all nine) is still available for any
 * caller that genuinely wants the full set.
 */
export async function buildClubHomePayload(
  ctx: ClubCtx,
  keys: ClubSectionKey[] = HOME_KEYS
): Promise<ClubHomePayload> {
  // PERF: the metrics read-through is memoised and the cores that depend on it
  // (trending, pulse) already await it themselves — so kicking it off WITHOUT
  // awaiting keeps single-flight behaviour while letting the independent cores
  // start immediately. The floating promise is caught so a failed refresh can
  // never reject the request.
  void ctx.ensureFresh().catch(() => {});

  const settled = await Promise.all(
    keys.map(async (key) => {
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

/* `buildClubHomeSeed` — the single-boundary seed — was removed with the payload
   trim: it had zero importers. buildClubHomeSeedSplit superseded it the moment
   the brief moved onto its own Suspense boundary, and keeping a second entry
   point around only meant a second place for the key set to drift. */

/** The two-boundary seed — see buildClubHomeSeedSplit. */
export interface ClubHomeSplitSeed {
  /** Everything except the brief. Gates the board's Suspense boundary. */
  rest: Promise<ClubHomePayload | null>;
  /** The brief body alone (BriefResponse-shaped), or null when walled/failed. */
  brief: Promise<unknown>;
}

/**
 * SPLIT SEED — the outstanding speed fix (plan §4).
 *
 * `briefCore` is the board's sole long pole (~2.9s): it derives the deltas and
 * then optionally waits on an LLM polish. Because buildClubHomePayload awaits
 * `Promise.all` over every core, that one section was holding the OTHER EIGHT —
 * and therefore the whole Home Suspense boundary — behind it. Every member paid
 * three seconds of skeleton for one paragraph.
 *
 * This resolves the request context ONCE (so nothing is fetched twice) and hands
 * back two independent promises. /dashboard puts them on two Suspense
 * boundaries: the board streams as soon as the six fast cores settle, and the
 * "Today in 30 seconds" field fills in on its own a beat later behind its own
 * skeleton. Loading still never renders as empty — each boundary has its own
 * skeleton — it just stops being one shared 2.9s gate.
 *
 * SAFETY: identical to buildClubHomeSeed. Neither promise can reject (a
 * rejection would blow up a client component that `use()`s it), and either
 * resolving to null degrades to the pre-existing client fetch path.
 */
export function buildClubHomeSeedSplit(
  supabase: SupabaseClient
): ClubHomeSplitSeed {
  const ctxPromise: Promise<ClubCtx | null> = resolveClubCtx(supabase).catch(
    (err) => {
      console.error("[club/home] split seed context failed:", err);
      return null;
    }
  );

  const rest = ctxPromise
    .then((ctx) => (ctx ? buildClubHomePayload(ctx, HOME_KEYS_WITHOUT_BRIEF) : null))
    .catch((err) => {
      console.error("[club/home] split seed (rest) failed:", err);
      return null;
    });

  const brief = ctxPromise
    .then(async (ctx) => {
      if (!ctx) return null;
      const r = await CORES.brief(ctx);
      // A deliberate wall (free tier → 403) is an absence, not an error, exactly
      // as the batched assembler treats it.
      if (!r || (r.status && r.status !== 200)) return null;
      return r.body;
    })
    .catch((err) => {
      console.error("[club/home] split seed (brief) failed:", err);
      return null;
    });

  return { rest, brief };
}
