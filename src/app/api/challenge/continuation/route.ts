import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyContinuationToken } from "@/lib/server/challenge-token";

export const dynamic = "force-dynamic";

/**
 * GET /api/challenge/continuation?t=<token> — resolve an email-first continuation
 * token for the OTO + shortened setup pages (C9b). Returns just enough to render
 * without re-asking the email: { valid, email, src, isVip }. Never exposes the
 * user id. Invalid/expired ⇒ { valid:false }.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || "";
  const c = verifyContinuationToken(token);
  if (!c) return NextResponse.json({ valid: false });

  // Already VIP? (so the OTO can show a confirmation instead of re-pitching.)
  let isVip = false;
  const db = createAdminClient();
  const { data: prof } = await db
    .from("profiles")
    .select("family_id")
    .eq("id", c.userId)
    .maybeSingle();
  if (prof?.family_id) {
    const { data: vip } = await db
      .from("challenge_vips")
      .select("id")
      .eq("family_id", prof.family_id)
      .maybeSingle();
    isVip = !!vip;
  }

  return NextResponse.json({ valid: true, email: c.email, src: c.src, name: c.name || "", isVip });
}
