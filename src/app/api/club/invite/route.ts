import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { referralLink } from "@/lib/referral";
import { resolveClubCtx, type ClubCtx, type CoreResult } from "@/lib/club/home-context";

/**
 * GET /api/club/invite
 *   → { code, url, activatedCount, xpEarned, leaderboard:[{name,count}], kidWalled }
 *
 * Build-the-Club mechanics. Reuses the existing referral system (migration 036):
 *   • code  — get_or_create_club_invite_code() mints/returns a permanent code
 *             for adults AND teens (kids excluded by the same viewer_is_kid wall).
 *   • url   — /r/CODE, so click tracking + attach_referral attribution/XP all
 *             fire through the existing flow.
 *   • activatedCount — referral_events 'signup' rows for this member's code
 *             (an ACTIVATED invite = the invited user completed signup).
 *   • xpEarned — the +100/activation the referral system already awards, summed.
 *   • leaderboard — top inviters (club_top_inviters RPC), names + counts only.
 * Kid-walled: kids get { kidWalled:true } and no code.
 *
 * The body is `inviteCore(ctx)` — shared verbatim with GET /api/club/home. The
 * share-link origin comes from ctx.origin (NEXT_PUBLIC_SITE_URL → request origin
 * → siteUrl fallback), identical to the previous inline resolution.
 */
export const runtime = "nodejs";

export async function inviteCore(ctx: ClubCtx): Promise<CoreResult> {
  if ((await ctx.getRegister()) === "kid") {
    return { body: { kidWalled: true } };
  }

  // Mint/fetch this member's code (adults + teens).
  const { data: code } = await ctx.supabase.rpc("get_or_create_club_invite_code");
  if (!code) {
    return {
      body: { kidWalled: false, code: null, url: null, activatedCount: 0, xpEarned: 0, leaderboard: [] },
    };
  }

  const url = referralLink(ctx.origin, code as string);

  const admin = ctx.admin();
  const [{ count: activatedCount }, { data: xpRows }, { data: leaderboard }] = await Promise.all([
    admin.from("referral_events").select("id", { count: "exact", head: true }).eq("code", code).eq("kind", "signup"),
    admin.from("xp_events").select("amount").eq("user_id", ctx.user.id).eq("kind", "bonus").like("ref_id", "referral:signup:%"),
    admin.rpc("club_top_inviters", { p_limit: 10 }),
  ]);

  const xpEarned = (xpRows || []).reduce((s: number, r: { amount: number }) => s + (r.amount || 0), 0);

  return {
    body: {
      kidWalled: false,
      code,
      url,
      activatedCount: activatedCount || 0,
      xpEarned,
      leaderboard: (leaderboard as { name: string; count: number }[] | null) || [],
    },
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await resolveClubCtx(supabase, req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { status, body } = await inviteCore(ctx);
  return NextResponse.json(body, status ? { status } : undefined);
}
