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
 * Campaign send route (admin-gated, service role).
 *
 * Body shapes:
 *  A) { campaign_id, dry_run }        — batch over the campaign's segment.
 *  B) { test: { channel, to, body, subject? } } — single real send, no DB
 *     writes. Used for the owner SMS proof and connectivity checks.
 *
 * Safety: SMS batch sends are FORCED to dry-run unless allow_live_sms:true is
 * passed, because this Twilio number is shared with the Kai product's inbound
 * webhook. The UI never sets allow_live_sms, so it cannot blast the number.
 * Email 403s on the unverified domain are surfaced verbatim (UI shows a DNS
 * banner) and recorded as failed sends — the pipeline is complete and will work
 * the moment familyinvestingclub.com is verified in Resend.
 */

interface LeadRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  stage: string;
  tags: string[];
}

function emailHtml(bodyText: string, leadId: string): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const unsub = unsubUrl(leadId);
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
${paragraphs}
<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
<p style="font-size:12px;color:#a1a1aa;line-height:1.5;margin:0">
Cheat Code Club · You're receiving this because you joined one of our lists.<br>
<a href="${unsub}" style="color:#a1a1aa">Unsubscribe</a>
</p></div></body></html>`;
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const db = gate.db;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // ── Shape B: single test send ─────────────────────────────────────────────
  if (body.test) {
    const t = body.test;
    if (!t.to || !t.channel)
      return NextResponse.json({ error: "test requires channel + to" }, { status: 400 });
    const result =
      t.channel === "sms"
        ? await sendSms({ to: t.to, body: t.body || "Test" })
        : await sendEmail({
            to: t.to,
            subject: t.subject || "Test",
            html: `<p>${(t.body || "Test").replace(/\n/g, "<br>")}</p>`,
          });
    return NextResponse.json({
      ok: result.ok,
      id: result.id,
      error: result.error,
      domain_blocked: isDomainVerifyError(result.error),
    });
  }

  // ── Shape A: campaign batch ────────────────────────────────────────────────
  const campaignId = String(body.campaign_id || "");
  const dryRunInput = body.dry_run !== false; // default to dry-run for safety
  const allowLiveSms = body.allow_live_sms === true;
  if (!campaignId)
    return NextResponse.json({ error: "campaign_id required" }, { status: 400 });

  const { data: campaign, error: cErr } = await db
    .from("marketing_campaigns")
    .select("id, name, channel, subject, body, segment, status")
    .eq("id", campaignId)
    .single();
  if (cErr || !campaign)
    return NextResponse.json({ error: "campaign not found" }, { status: 404 });

  // Force dry-run for live SMS on the shared Twilio number unless explicitly allowed.
  const dryRun = campaign.channel === "sms" && !allowLiveSms ? true : dryRunInput;

  // Resolve recipients (segment; always exclude unsubscribed).
  const seg = (campaign.segment || {}) as { stages?: string[]; tags?: string[] };
  let q = db
    .from("marketing_leads")
    .select("id, email, first_name, last_name, phone, stage, tags")
    .neq("stage", "unsubscribed");
  if (Array.isArray(seg.stages) && seg.stages.length > 0)
    q = q.in("stage", seg.stages);
  if (Array.isArray(seg.tags) && seg.tags.length > 0)
    q = q.overlaps("tags", seg.tags);
  const { data: leads, error: lErr } = await q;
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  const recipients = (leads || []) as LeadRow[];

  await db.from("marketing_campaigns").update({ status: "sending" }).eq("id", campaignId);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let domainBlocked = false;
  const nowIso = () => new Date().toISOString();

  for (const lead of recipients) {
    // Channel-specific target validation.
    const target = campaign.channel === "sms" ? lead.phone : lead.email;
    if (!target) {
      await db.from("marketing_sends").insert({
        campaign_id: campaignId,
        lead_id: lead.id,
        status: "skipped",
        error: campaign.channel === "sms" ? "no phone" : "no email",
      });
      skipped++;
      continue;
    }

    if (dryRun) {
      await db.from("marketing_sends").insert({
        campaign_id: campaignId,
        lead_id: lead.id,
        status: "skipped",
        error: "dry-run",
      });
      skipped++;
      continue;
    }

    let result;
    if (campaign.channel === "email") {
      result = await sendEmail({
        to: lead.email,
        subject: renderMerge(campaign.subject || "", lead),
        html: emailHtml(renderMerge(campaign.body, lead), lead.id),
      });
    } else {
      const smsBody = `${renderMerge(campaign.body, lead)}\n\nReply STOP to opt out.`;
      result = await sendSms({ to: lead.phone!, body: smsBody });
    }

    if (result.ok) {
      await db.from("marketing_sends").insert({
        campaign_id: campaignId,
        lead_id: lead.id,
        status: "sent",
        sent_at: nowIso(),
      });
      await db.from("marketing_lead_events").insert({
        lead_id: lead.id,
        type: campaign.channel === "email" ? "emailed" : "smsed",
        meta: { campaign_id: campaignId, message_id: result.id || null },
      });
      await db
        .from("marketing_leads")
        .update({ last_activity_at: nowIso() })
        .eq("id", lead.id);
      sent++;
    } else {
      if (isDomainVerifyError(result.error)) domainBlocked = true;
      await db.from("marketing_sends").insert({
        campaign_id: campaignId,
        lead_id: lead.id,
        status: "failed",
        error: result.error,
      });
      failed++;
    }
  }

  const finalStatus = dryRun
    ? "draft" // dry-run leaves the campaign re-sendable
    : failed > 0 && sent === 0
      ? "failed"
      : "sent";

  await db
    .from("marketing_campaigns")
    .update({
      status: finalStatus,
      sent_at: dryRun ? null : nowIso(),
      stats: { recipients: recipients.length, sent, failed, skipped, dry_run: dryRun },
    })
    .eq("id", campaignId);

  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    forced_dry_run: campaign.channel === "sms" && !allowLiveSms && dryRunInput === false,
    recipients: recipients.length,
    sent,
    failed,
    skipped,
    domain_blocked: domainBlocked,
    status: finalStatus,
  });
}
