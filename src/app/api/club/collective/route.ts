import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureClubMetricsFresh } from "@/lib/club/cache";
import { FLOORS, floorMet } from "@/lib/club/score";
import { deriveRegister } from "@/lib/register";

/**
 * GET /api/club/collective
 *   → { connectedMinds, actionsToday, breakdown{watches,reactions,comments,
 *       saves,kaiQuestions}, floorMet, avatars:[{id,url}] }
 *
 * Reads the cached 'collective' KV (precomputed counts) + a small, bounded avatar
 * roster. `floorMet` is false below FLOORS.connectedMinds → the UI renders the
 * founding-era / Build-the-Club growth engine instead of raw small counts.
 * Avatars: adults+teens only, and only members who set an avatar (a light
 * consent proxy — kids are never surfaced in the constellation).
 */
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureClubMetricsFresh();

  const { data: kv } = await supabase
    .from("club_metrics_kv")
    .select("value")
    .eq("key", "collective")
    .maybeSingle();

  const v = (kv?.value as {
    connectedMinds?: number;
    actionsToday?: number;
    breakdown?: Record<string, number>;
  }) || {};
  const connectedMinds = v.connectedMinds ?? 0;

  // Avatar roster — non-kid, avatar set. Admin client so we can filter by
  // register across families without widening profiles RLS; we return only
  // id + avatar url (no names/emails).
  const admin = createAdminClient();
  const { data: people } = await admin
    .from("profiles")
    .select("id, avatar_url, role, age_group, track")
    .not("avatar_url", "is", null)
    .limit(60);

  const avatars = (people || [])
    .filter((p) => deriveRegister(p) !== "kid")
    .slice(0, 24)
    .map((p) => ({ id: p.id, url: p.avatar_url as string }));

  return NextResponse.json({
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
  });
}
