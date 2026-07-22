import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, siteUrl } from "@/lib/server/marketing";

export const dynamic = "force-dynamic";

/**
 * Admin-only: returns the Facebook Lead Ads webhook URL + verify token so the
 * owner can paste them into the Meta app's webhook config. Gated by admin JWT;
 * the verify token is a shared secret with Meta (not a public bundle value).
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  return NextResponse.json({
    webhook_url: `${siteUrl()}/api/marketing/fb-leads`,
    verify_token: process.env.FB_LEADS_VERIFY_TOKEN?.trim() || null,
    configured: Boolean(process.env.FB_LEADS_VERIFY_TOKEN?.trim()),
  });
}
