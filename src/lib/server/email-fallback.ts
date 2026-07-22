/**
 * Email FALLBACK lane — how notifications reach users who have ZERO push
 * subscriptions, with no user action ever required.
 *
 * WHY: push only reaches devices the user enrolled. A member who never
 * installed the PWA / never granted permission would silently miss high-value
 * notifications. This lane closes that gap: for a curated set of HIGH-VALUE
 * types only, when the recipient has no push subscription, the dispatch route
 * enqueues a row here and this module emails them instead — reusing the
 * marketing Resend single-send path (lib/server/marketing.sendEmail).
 *
 * STATUS TODAY: the Resend domain (familyinvestingclub.com) is not yet
 * verified, so every real send returns HTTP 403. We capture that verbatim and
 * mark the row `failed` — the pipeline is COMPLETE and starts delivering the
 * instant the domain verifies, still with zero user action. Until then the
 * queue is a durable record of who should have been emailed.
 *
 * Service-role only. Never import from a client component.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, isDomainVerifyError, siteUrl } from "@/lib/server/marketing";

/** Only these notification types fall back to email — never chat noise. */
export const HIGH_VALUE_EMAIL_TYPES = new Set([
  "announcement",
  "broadcast",
  "new_lesson",
  "recording_posted",
]);

export function isHighValueEmailType(type: string): boolean {
  return HIGH_VALUE_EMAIL_TYPES.has(type);
}

interface QueueableNotification {
  id: string;
  user_id: string;
  type: string;
}

/**
 * Enqueue an email fallback for a notification whose recipient has no push
 * subscriptions. Idempotent via the (notification_id, user_id) partial unique
 * index — a duplicate insert is swallowed. Best-effort; never throws.
 */
export async function enqueueEmailFallback(
  admin: SupabaseClient,
  n: QueueableNotification
): Promise<void> {
  if (!isHighValueEmailType(n.type)) return;
  try {
    await admin.from("notification_email_queue").insert({
      user_id: n.user_id,
      notification_id: n.id,
      type: n.type,
      status: "queued",
    });
  } catch {
    // Unique violation (already queued) or transient — safe to ignore.
  }
}

function subjectFor(type: string, body: string): string {
  switch (type) {
    case "announcement":
    case "broadcast":
      return "New announcement from Family Investing Club";
    case "new_lesson":
      return "A new lesson just dropped";
    case "recording_posted":
      return "Your class recording is ready";
    default:
      return body.slice(0, 80) || "Family Investing Club";
  }
}

function emailHtml(title: string, body: string, url: string): string {
  const safeBody = (body || "").replace(/</g, "&lt;").replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
<p style="margin:0 0 20px;line-height:1.6;color:#3f3f46">${safeBody}</p>
<a href="${url}" style="display:inline-block;background:#c9a227;color:#1a1a1a;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:8px">Open in the app</a>
<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
<p style="font-size:12px;color:#a1a1aa;line-height:1.5;margin:0">
Family Investing Club · You're receiving this because notifications aren't set up on any of your devices. Turn on push in the app to get these instantly instead.
</p></div></body></html>`;
}

export interface ProcessResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  domain_blocked: boolean;
}

/**
 * Process queued email fallbacks. For each: resolve the recipient's email,
 * render from the source notification, send via Resend, and record the outcome.
 * Called inline by the dispatch route (small limit) and by the manual
 * /api/push/email-fallback processor route (larger limit).
 */
export async function processEmailQueue(
  admin: SupabaseClient,
  limit = 25
): Promise<ProcessResult> {
  const res: ProcessResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    domain_blocked: false,
  };

  const { data: rows } = await admin
    .from("notification_email_queue")
    .select("id, user_id, notification_id, type")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!rows || rows.length === 0) return res;

  for (const row of rows) {
    res.processed++;
    const nowIso = new Date().toISOString();

    // Resolve recipient email (lives in auth.users, not profiles).
    let email: string | null = null;
    try {
      const { data } = await admin.auth.admin.getUserById(row.user_id as string);
      email = data.user?.email ?? null;
    } catch {
      email = null;
    }

    if (!email) {
      await admin
        .from("notification_email_queue")
        .update({ status: "skipped", error: "no email", processed_at: nowIso })
        .eq("id", row.id);
      res.skipped++;
      continue;
    }

    // Pull the source notification for body/link.
    let body = "";
    let link = "/community";
    if (row.notification_id) {
      const { data: n } = await admin
        .from("notifications")
        .select("body, link")
        .eq("id", row.notification_id)
        .maybeSingle();
      if (n) {
        body = (n.body as string | null) || "";
        link = (n.link as string | null) || "/community";
      }
    }

    const title = subjectFor(row.type as string, body);
    const url = link.startsWith("http") ? link : `${siteUrl()}${link}`;

    const result = await sendEmail({
      to: email,
      subject: title,
      html: emailHtml(title, body, url),
    });

    if (result.ok) {
      await admin
        .from("notification_email_queue")
        .update({ status: "sent", processed_at: nowIso })
        .eq("id", row.id);
      res.sent++;
    } else {
      if (isDomainVerifyError(result.error)) res.domain_blocked = true;
      await admin
        .from("notification_email_queue")
        .update({ status: "failed", error: result.error, processed_at: nowIso })
        .eq("id", row.id);
      res.failed++;
    }
  }

  return res;
}
