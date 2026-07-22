import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin,
  sendEmail,
  sendSms,
  renderMerge,
  unsubUrl,
  isDomainVerifyError,
} from "@/lib/server/marketing";

export const dynamic = "force-dynamic";

/**
 * Individual 1:1 contact send (admin-gated, service role).
 *
 * This is the single-send counterpart to the campaign sender in
 * ../campaigns/send/route.ts. It deliberately REUSES the same channel senders
 * (sendEmail / sendSms) and merge/unsub helpers from @/lib/server/marketing —
 * the send primitives are factored there, not duplicated here.
 *
 * Unlike batch SMS (which is forced to dry-run on the shared Twilio number),
 * individual 1:1 sends are ALLOWED live — that is exactly the intended use. STOP
 * opt-out on the shared number is handled by the Kai inbound webhook.
 *
 * Logging:
 *   • lead contacts  → marketing_lead_events (emailed/smsed) + last_activity.
 *   • member contacts → contact_comms (channel/subject/body/status/error).
 * Sends to an 'unsubscribed' lead are blocked (409) with an explanation.
 *
 * Body: { channel, record, contact_id, email?, phone?, first_name?, subject?, body }
 */

function emailHtml(bodyText: string, unsub?: string): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`
    )
    .join("");
  const footer = unsub
    ? `<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
<p style="font-size:12px;color:#a1a1aa;line-height:1.5;margin:0">
Family Investing Club<br>
<a href="${unsub}" style="color:#a1a1aa">Unsubscribe</a>
</p>`
    : `<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
<p style="font-size:12px;color:#a1a1aa;line-height:1.5;margin:0">Family Investing Club</p>`;
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
${paragraphs}
${footer}
</div></body></html>`;
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req.headers.get("authorization"));
  if (!gate.ok)
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  const db = gate.db;
  const adminId = gate.userId;

  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const channel = body.channel === "sms" ? "sms" : "email";
  const record = body.record === "lead" ? "lead" : "member";
  const contactId = String(body.contact_id || "");
  const messageBody = String(body.body || "").trim();
  const subject = String(body.subject || "").trim();
  if (!contactId || !messageBody)
    return NextResponse.json(
      { error: "contact_id and body required" },
      { status: 400 }
    );

  const nowIso = () => new Date().toISOString();

  // ── Resolve authoritative contact identity server-side ─────────────────────
  let email: string | null = body.email ?? null;
  let phone: string | null = body.phone ?? null;
  let firstName: string | null = body.first_name ?? null;
  let lastName: string | null = null;
  let memberUserId: string | null = null;

  if (record === "lead") {
    const { data: lead } = await db
      .from("marketing_leads")
      .select("id, email, phone, first_name, last_name, stage")
      .eq("id", contactId)
      .single();
    if (!lead)
      return NextResponse.json({ error: "lead not found" }, { status: 404 });
    if (lead.stage === "unsubscribed")
      return NextResponse.json(
        {
          ok: false,
          status: "blocked",
          unsubscribed: true,
          error: "Contact is unsubscribed — sending is blocked.",
        },
        { status: 409 }
      );
    email = (lead.email as string) ?? null;
    phone = (lead.phone as string) ?? null;
    firstName = (lead.first_name as string) ?? null;
    lastName = (lead.last_name as string) ?? null;
  } else {
    const { data: prof } = await db
      .from("profiles")
      .select("id, email, display_name")
      .eq("id", contactId)
      .single();
    if (!prof)
      return NextResponse.json({ error: "member not found" }, { status: 404 });
    memberUserId = prof.id as string;
    email = (prof.email as string) ?? email;
    firstName =
      firstName ||
      ((prof.display_name as string) || "").trim().split(/\s+/)[0] ||
      null;
  }

  const mergeCtx = { first_name: firstName, last_name: lastName, email };
  const target = channel === "sms" ? phone : email;
  if (!target)
    return NextResponse.json(
      { error: `No ${channel === "sms" ? "phone" : "email"} on file` },
      { status: 400 }
    );

  // ── Send ───────────────────────────────────────────────────────────────────
  let result: { ok: boolean; error?: string; id?: string };
  const renderedBody = renderMerge(messageBody, mergeCtx);
  if (channel === "email") {
    const unsub = record === "lead" ? unsubUrl(contactId) : undefined;
    result = await sendEmail({
      to: email!,
      subject: renderMerge(subject || "A note from Family Investing Club", mergeCtx),
      html: emailHtml(renderedBody, unsub),
    });
  } else {
    const smsBody = `${renderedBody}\n\nReply STOP to opt out.`;
    result = await sendSms({ to: phone!, body: smsBody });
  }

  const status = result.ok ? "sent" : "failed";
  const domainBlocked = isDomainVerifyError(result.error);

  // ── Log ──────────────────────────────────────────────────────────────────
  if (record === "lead") {
    await db.from("marketing_lead_events").insert({
      lead_id: contactId,
      type: channel === "email" ? "emailed" : "smsed",
      meta: {
        individual: true,
        status,
        error: result.error ?? null,
        message_id: result.id ?? null,
        subject: channel === "email" ? subject || null : null,
        sent_by: adminId,
      },
    });
    if (result.ok) {
      await db
        .from("marketing_leads")
        .update({ last_activity_at: nowIso() })
        .eq("id", contactId);
    }
  } else {
    await db.from("contact_comms").insert({
      contact_email: email,
      user_id: memberUserId,
      channel,
      direction: "out",
      subject: channel === "email" ? subject || null : null,
      body: renderedBody,
      status,
      error: result.error ?? null,
      sent_by: adminId,
    });
  }

  return NextResponse.json({
    ok: result.ok,
    status,
    error: result.error ?? null,
    domain_blocked: domainBlocked,
    message_id: result.id ?? null,
  });
}
