import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server/marketing";
import { processEmailQueue } from "@/lib/server/email-fallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Email-fallback processor. Flushes queued rows in notification_email_queue —
 * emailing users who have no push subscription for high-value notifications.
 *
 * The dispatch route already processes small batches inline, so this route is
 * the MANUAL / recovery path: an admin button or a scheduled sweep can flush a
 * larger backlog (e.g. everything accumulated while the Resend domain was
 * unverified, which will finally deliver once it verifies).
 *
 * Auth: shared push-dispatch secret (x-push-secret) OR an admin JWT
 * (Authorization: Bearer). Either is sufficient.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  const hasSecret = Boolean(secret) && req.headers.get("x-push-secret") === secret;

  if (!hasSecret) {
    const gate = await requireAdmin(req.headers.get("authorization"));
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
  }

  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") || "100") || 100,
    500
  );

  const admin = createAdminClient();
  const result = await processEmailQueue(admin, limit);
  return NextResponse.json({ ok: true, ...result });
}
