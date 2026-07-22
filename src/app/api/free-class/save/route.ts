import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Mid-funnel EMAIL CAPTURE — the partial-lead sweep.
 *
 * The instant an email is given (before the password step) we (1) persist it on
 * the funnel session, promoting status → 'email_captured', and (2) upsert a
 * marketing_leads row (source 'free_class', stage 'new', tags ['funnel',
 * 'partial']) so an abandoner is still a reachable lead. SMS opt-in is recorded
 * only (Twilio shared-number constraint — no send here). Full registration
 * later flips this lead to stage 'engaged' + tag 'registered'.
 */

interface SaveBody {
  id?: string;
  email?: string;
  phone?: string;
  smsOptin?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const id = (body.id || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim();
  const smsOptin = !!body.smsOptin;

  if (!id) return NextResponse.json({ error: "Missing session." }, { status: 400 });
  if (!EMAIL_RE.test(email))
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });

  const supabase = createAdminClient();

  // Load current session (need answers for the lead custom + guard registered).
  const { data: session } = await supabase
    .from("funnel_sessions")
    .select("id, status, answers")
    .eq("id", id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });

  // Persist email on the session (don't downgrade a registered session).
  const nextStatus = session.status === "registered" ? "registered" : "email_captured";
  await supabase
    .from("funnel_sessions")
    .update({
      email,
      phone: phone || null,
      sms_optin: smsOptin,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  await supabase.from("funnel_events").insert({
    session_id: id,
    step: "save",
    event: "submit",
    meta: { sms_optin: smsOptin, has_phone: !!phone },
  });

  // Partial-lead sweep — non-destructive upsert into marketing_leads.
  try {
    const { data: existing } = await supabase
      .from("marketing_leads")
      .select("id, tags, stage")
      .eq("email", email)
      .eq("source", "free_class")
      .maybeSingle();

    if (!existing) {
      const { data: lead } = await supabase
        .from("marketing_leads")
        .insert({
          email,
          phone: phone || null,
          source: "free_class",
          stage: "new",
          tags: ["funnel", "partial"],
          consent_source: "free_class_funnel",
          custom: { answers: session.answers || {}, phone: phone || null, sms_optin: smsOptin },
        })
        .select("id")
        .single();
      if (lead?.id) {
        await supabase.from("marketing_lead_events").insert({
          lead_id: lead.id,
          type: "imported",
          meta: { source: "free_class", partial: true },
        });
      }
    } else {
      // Keep whatever stage it has; just union tags + refresh activity.
      const tags = Array.from(new Set([...(existing.tags || []), "funnel", "partial"]));
      await supabase
        .from("marketing_leads")
        .update({
          tags,
          phone: phone || null,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
  } catch {
    // marketing table absent / mid-migration — never fail the capture.
  }

  return NextResponse.json({ ok: true });
}
