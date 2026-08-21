import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_TTL_SECONDS } from "@/lib/club/club-cache";
import { FLOORS, floorMet } from "@/lib/club/score";
import { isMemberVisibleOnDoor } from "@/lib/register";
import type { ExperienceKey } from "@/lib/experience/registry";
import { resolveClubCtx, type ClubCtx, type CoreResult } from "@/lib/club/home-context";

/**
 * GET /api/club/collective
 *   → { connectedMinds, actionsToday, breakdown{watches,reactions,comments,
 *       saves,kaiQuestions}, floorMet, avatars:[{id,url}] }
 *
 * Reads the cached 'collective' KV (precomputed counts) + a small, bounded avatar
 * roster. `floorMet` is false below FLOORS.connectedMinds → the UI renders the
 * founding-era / Build-the-Club growth engine instead of raw small counts.
 * Avatars: only members who set an avatar (a light consent proxy) AND who are
 * visible on the viewer's door — kids never (214), teens to the family door only
 * (216), so the club-door constellation is adult faces.
 *
 * The body is `collectiveCore(ctx)` — shared verbatim with GET /api/club/home.
 */
export const runtime = "nodejs";

export async function collectiveCore(ctx: ClubCtx): Promise<CoreResult> {
  // The read-through freshness trigger stays on the per-request path (it
  // schedules an after()-deferred recompute, which is an effect, not a value).
  await ctx.ensureFresh();
  // IDENTICAL FOR EVERY MEMBER ON THE SAME DOOR; 60s revalidate.
  return { body: await getCachedCollective(await ctx.getDoor()) };
}

/**
 * THE ROOM'S COUNTS + FACES, COMPUTED ONCE PER MINUTE PER DOOR.
 *
 * Nothing here is keyed by the viewer — only by their DOOR, which has exactly
 * two values (club / family). The counts come straight off the precomputed
 * `collective` KV and the avatar roster is a bounded, consent-proxied profiles
 * read; both answer the same question for every member standing at the same
 * door, and both were being re-read on every pageview.
 *
 * SAFE TO SHARE ONE ENTRY PER DOOR:
 *   • club_metrics_kv → `for select to authenticated using (true)` (mig 140),
 *     so the service-role read here returns the same row the session-scoped
 *     read did.
 *   • profiles → already read through the SERVICE-ROLE client before this
 *     change, precisely so the register filter could be applied in code. The
 *     door wall (isMemberVisibleOnDoor: kids never, teens family-door-only) is
 *     therefore still the ONLY thing standing between a profile and the wire —
 *     and because the door is the cache key, a club-door member can never be
 *     served a family-door roster.
 * Only id + avatar url ever leave; no names, no emails.
 */
const getCachedCollective = unstable_cache(
  async (door: ExperienceKey) => {
    const admin = createAdminClient();

    const [{ data: kv }, { data: people }] = await Promise.all([
      admin.from("club_metrics_kv").select("value").eq("key", "collective").maybeSingle(),
      // Avatar roster — non-kid, avatar set. Admin client so we can filter by
      // register across families without widening profiles RLS; we return only
      // id + avatar url (no names/emails).
      admin
        .from("profiles")
        .select("id, avatar_url, role, age_group, track")
        .not("avatar_url", "is", null)
        .limit(60),
    ]);

    const v = (kv?.value as {
      connectedMinds?: number;
      actionsToday?: number;
      breakdown?: Record<string, number>;
    }) || {};
    const connectedMinds = v.connectedMinds ?? 0;

    const avatars = (people || [])
      .filter((p) => isMemberVisibleOnDoor(p, door))
      .slice(0, 24)
      .map((p) => ({ id: p.id, url: p.avatar_url as string }));

    return {
      connectedMinds,
      actionsToday: v.actionsToday ?? 0,
      breakdown: {
        watches: v.breakdown?.watches ?? 0,
        reactions: v.breakdown?.reactions ?? 0,
        comments: v.breakdown?.comments ?? 0,
        saves: v.breakdown?.saves ?? 0,
        kaiQuestions: v.breakdown?.kaiQuestions ?? 0,
      },
      floorMet: floorMet(connectedMinds, FLOORS.connectedMinds),
      avatars,
    };
  },
  ["club:collective"],
  { revalidate: CLUB_TTL_SECONDS, tags: ["club-collective"] }
);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status, body } = await collectiveCore(ctx);
  return NextResponse.json(body, status ? { status } : undefined);
}
