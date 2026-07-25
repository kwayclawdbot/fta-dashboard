/**
 * Cheat Code Club $99/mo membership provisioning (marketing-site guest checkout)
 * — SERVER ONLY.
 *
 * Called from the Stripe webhook on a completed checkout carrying
 * metadata.kind='club_membership', and again as a best-effort safety-net from the
 * /club/welcome page in case the webhook is delayed.
 *
 * It is idempotent, keyed on the Stripe session id via the durable
 * pending_memberships.stripe_session marker: the FIRST call runs the hardened
 * $99 membership machinery (provisionMembership — creates/links the account and
 * sends the branded Resend invite for guests, or activates an existing family);
 * every later call for the same session is a no-op. This is what keeps the
 * webhook + welcome-page safety-net (and any Stripe retry, and the legacy
 * amount-mapped payment-link path) from ever double-provisioning.
 *
 * On top of provisioning it upserts the buyer into the app's built-in CRM
 * (marketing_leads, source='membership', tags src:*) so membership buyers surface
 * alongside the funnel cohorts. Best-effort — CRM hiccups never fail the webhook.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionMembership } from "@/lib/server/membership";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Session = Record<string, any>;

export interface ClubProvisionResult {
  ok: boolean;
  created: boolean;
  /** provisionMembership mode on the first (creating) call, if available. */
  mode?: string;
  error?: string;
}

function cleanSrc(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 64) : "";
}

export async function provisionClubMembership(session: Session): Promise<ClubProvisionResult> {
  const db = createAdminClient();
  const sessionId = String(session.id || "");
  if (!sessionId) return { ok: false, created: false, error: "no session id" };

  const email = String(
    session.customer_details?.email || session.customer_email || ""
  )
    .trim()
    .toLowerCase();
  if (!email) return { ok: false, created: false, error: "no email" };

  // Idempotency — a pending_memberships row already stamped with this session id
  // means provisioning ran (webhook or an earlier safety-net). Treat as done.
  const { data: existing } = await db
    .from("pending_memberships")
    .select("id")
    .eq("stripe_session", sessionId)
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, created: false };

  const result = await provisionMembership({
    email,
    program: "fic",
    source: "stripe",
    stripeSession: sessionId,
  });
  if (!result.ok) {
    return { ok: false, created: false, error: result.error };
  }

  // CRM — surface the membership buyer in the app's built-in marketing_leads.
  const src = cleanSrc(session.metadata?.src);
  const firstName =
    String(session.customer_details?.name || "").trim().split(/\s+/)[0] || null;
  const phone = String(session.customer_details?.phone || "").trim() || null;
  try {
    const leadTags = ["membership", "club", "registered", ...(src ? [`src:${src}`] : [])];
    const leadCustom = { src: src || null, program: "fic" };
    const { data: lead } = await db
      .from("marketing_leads")
      .select("id, tags")
      .eq("email", email)
      .eq("source", "membership")
      .maybeSingle();
    if (lead) {
      const tags = Array.from(new Set([...(lead.tags || []), ...leadTags]));
      await db
        .from("marketing_leads")
        .update({
          first_name: firstName || undefined,
          phone: phone || undefined,
          stage: "converted",
          tags,
          custom: leadCustom,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
    } else {
      await db.from("marketing_leads").insert({
        email,
        first_name: firstName,
        phone,
        source: "membership",
        stage: "converted",
        tags: leadTags,
        consent_source: "club_membership",
        custom: leadCustom,
      });
    }
  } catch (e) {
    console.error("club marketing_leads upsert error:", e);
  }

  return { ok: true, created: true, mode: (result as { mode?: string }).mode };
}
