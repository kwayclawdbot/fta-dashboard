/**
 * Challenge VIP provisioning (Lane C9) — SERVER ONLY.
 *
 * Called from the Stripe webhook on a completed checkout carrying
 * metadata.kind='challenge_vip'. It is fully idempotent (keyed on the Stripe
 * session id) and best-effort on every side-effect: a hiccup in the textbook
 * order or the receipt email must never 500 the webhook (Stripe would retry and
 * we'd double-provision). The durable record is the challenge_vips row.
 *
 * A VIP purchase grants, additively on top of the free challenge pass:
 *   1. tier=vip marker (challenge_vips row) → VIP room + VIP email steps,
 *   2. a real Cheat Code Club membership (an 'fic' enrollment — Club continues at
 *      $99/mo via the Stripe subscription; the family_tiers view already resolves
 *      an active 'fic' enrollment to full Club, so no tier-view change is needed),
 *   3. a printed textbook order (through the existing Lulu shop lane; degrades to
 *      the /admin/shop manual queue when print files aren't set up yet),
 *   4. a VIP receipt email now + a pre-charge reminder 3 days before the first
 *      $99 charge (both gated by challenge_emails_enabled + drip_optouts).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrderFromSession, attemptFulfillment, normalizeShipping } from "@/lib/server/shop";
import { renderChallengeSequenceEmail } from "@/lib/server/challenge-sequence-emails";
import { APP_ORIGIN, dripUnsubUrl, sendDripEmail } from "@/lib/server/drips";

const TEXTBOOK_SLUG = "challenge-textbook";
/** First-month/trial length before the recurring $99/mo begins. */
const FIRST_MONTH_DAYS = 30;
/** Pre-charge reminder lead time (email fires this many days before renewal). */
const PRECHARGE_LEAD_DAYS = 3;

export interface VipProvisionResult {
  ok: boolean;
  created: boolean;
  vipId?: string;
  textbookOrderId?: string | null;
  enrollment?: "created" | "exists" | "no_family";
  receipt?: { sent: boolean; skipped?: string; error?: string };
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Session = Record<string, any>;

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

export async function provisionChallengeVip(session: Session): Promise<VipProvisionResult> {
  const db = createAdminClient();
  const sessionId = String(session.id || "");
  if (!sessionId) return { ok: false, created: false, error: "no session id" };

  // Idempotency — a VIP row for this session already exists ⇒ done.
  const { data: existing } = await db
    .from("challenge_vips")
    .select("id, textbook_order_id")
    .eq("stripe_session", sessionId)
    .maybeSingle();
  if (existing) {
    return { ok: true, created: false, vipId: existing.id, textbookOrderId: existing.textbook_order_id };
  }

  const email = String(
    session.customer_details?.email || session.customer_email || ""
  ).trim().toLowerCase();
  const userId: string | null =
    (typeof session.client_reference_id === "string" && session.client_reference_id) || null;
  const subscription: string | null =
    typeof session.subscription === "string" ? session.subscription : null;
  const shipping = normalizeShipping(session);
  const clubUntil = daysFromNow(FIRST_MONTH_DAYS);

  // Resolve the family from the buyer (client_reference_id = app user id).
  let familyId: string | null = null;
  let resolvedUserId: string | null = userId;
  if (userId) {
    const { data: prof } = await db
      .from("profiles")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    familyId = prof?.family_id ?? null;
  }
  // Fallback: match by email if client_reference_id was absent.
  if (!familyId && email) {
    const { data: prof } = await db
      .from("profiles")
      .select("id, family_id")
      .eq("email", email)
      .maybeSingle();
    if (prof) {
      resolvedUserId = resolvedUserId || prof.id;
      familyId = prof.family_id ?? null;
    }
  }

  // 1. Textbook order (best-effort) — through the existing Lulu shop lane.
  let textbookOrderId: string | null = null;
  try {
    const { data: product } = await db
      .from("shop_products")
      .select("id")
      .eq("slug", TEXTBOOK_SLUG)
      .maybeSingle();
    if (product) {
      const { orderId } = await createOrderFromSession({ session, productId: product.id, quantity: 1 });
      textbookOrderId = orderId;
      // Degrades to 'awaiting_fulfillment_setup' (manual queue in /admin/shop)
      // when Lulu creds / print files aren't set up. Never throws upward here.
      await attemptFulfillment(orderId).catch((e) =>
        console.error("vip textbook fulfillment error:", orderId, e)
      );
    } else {
      console.error("vip: textbook shop_product missing (slug=%s)", TEXTBOOK_SLUG);
    }
  } catch (e) {
    console.error("vip textbook order error:", e);
  }

  // 2. Insert the VIP marker row (the durable record).
  const { data: vip, error: vipErr } = await db
    .from("challenge_vips")
    .insert({
      user_id: resolvedUserId,
      family_id: familyId,
      email: email || null,
      stripe_session: sessionId,
      stripe_subscription: subscription,
      amount_total: typeof session.amount_total === "number" ? session.amount_total : null,
      shipping: shipping as unknown as Record<string, unknown>,
      textbook_order_id: textbookOrderId,
      club_until: clubUntil.toISOString(),
    })
    .select("id")
    .single();
  if (vipErr || !vip) {
    // Unique violation ⇒ a concurrent delivery won; treat as idempotent success.
    const { data: race } = await db
      .from("challenge_vips")
      .select("id, textbook_order_id")
      .eq("stripe_session", sessionId)
      .maybeSingle();
    if (race) return { ok: true, created: false, vipId: race.id, textbookOrderId: race.textbook_order_id };
    return { ok: false, created: false, error: vipErr?.message || "vip insert failed" };
  }

  // 3. Provision the Club membership (fic enrollment) — idempotent.
  let enrollment: "created" | "exists" | "no_family" = "no_family";
  if (familyId) {
    const { data: active } = await db
      .from("enrollments")
      .select("id")
      .eq("family_id", familyId)
      .eq("program", "fic")
      .eq("status", "active")
      .maybeSingle();
    if (active) {
      enrollment = "exists";
    } else {
      const { error: enrErr } = await db.from("enrollments").insert({
        family_id: familyId,
        program: "fic",
        status: "active",
      });
      enrollment = enrErr ? "no_family" : "created";
      if (enrErr) console.error("vip fic enrollment error:", enrErr.message);
    }
  }

  // 4. VIP emails — receipt now, pre-charge reminder scheduled. Gated exactly
  //    like the rest of the challenge machine (challenge_emails_enabled +
  //    drip_optouts). Nothing sends when the gate is off.
  const receipt = await sendVipEmails(db, {
    userId: resolvedUserId,
    familyId,
    email: email || null,
    firstName: shipping.name?.split(/\s+/)[0] || "there",
    clubUntil,
  });

  return {
    ok: true,
    created: true,
    vipId: vip.id,
    textbookOrderId,
    enrollment,
    receipt,
  };
}

/**
 * Send the VIP receipt now and schedule the pre-charge reminder. Both are logged
 * into challenge_sequences (idempotent via the unique (user_id, step) constraint)
 * so the admin dashboard and opt-out plumbing see them like any other step.
 */
async function sendVipEmails(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: ReturnType<typeof createAdminClient>,
  opts: {
    userId: string | null;
    familyId: string | null;
    email: string | null;
    firstName: string;
    clubUntil: Date;
  }
): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  const { userId, familyId, email, firstName, clubUntil } = opts;

  // Hard gate — the whole challenge machine's flag.
  const { data: flag } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "challenge_emails_enabled")
    .maybeSingle();
  const enabled = flag?.value !== false; // default true

  const { data: optedOut } = userId
    ? await db.from("drip_optouts").select("user_id").eq("user_id", userId).maybeSingle()
    : { data: null };

  const willSend = enabled && !optedOut && !!userId;

  // Schedule the pre-charge reminder (day 27 = renewal − 3d). Suppressed if the
  // machine is off or the user opted out — the row still records intent.
  const prechargeAt = new Date(clubUntil.getTime() - PRECHARGE_LEAD_DAYS * 24 * 60 * 60 * 1000);
  if (userId) {
    await db
      .from("challenge_sequences")
      .upsert(
        {
          user_id: userId,
          family_id: familyId,
          step: "vip_precharge",
          scheduled_at: prechargeAt.toISOString(),
          status: willSend ? "pending" : "suppressed",
        },
        { onConflict: "user_id,step", ignoreDuplicates: true }
      )
      .then(undefined, () => {});
  }

  if (!willSend) {
    if (userId) {
      await logVipReceiptRow(db, userId, familyId, "suppressed", null,
        !userId ? "no user" : !enabled ? "challenge_emails_enabled=false" : "opted out");
    }
    return { sent: false, skipped: !enabled ? "emails disabled" : optedOut ? "opted out" : "no user" };
  }
  if (!email) {
    await logVipReceiptRow(db, userId!, familyId, "skipped", null, "no email");
    return { sent: false, skipped: "no email" };
  }

  const unsubUrl = dripUnsubUrl(userId!);
  const { subject, html, text } = renderChallengeSequenceEmail("vip_receipt", {
    firstName,
    appUrl: APP_ORIGIN,
    unsubUrl,
    continueUrl: `${APP_ORIGIN}/settings`,
    ftaUrl: `${APP_ORIGIN}/upgrade`,
    vipRoomUrl: `${APP_ORIGIN}/vip-room`,
  });
  const result = await sendDripEmail({ to: email, subject, html, text, unsubUrl });
  await logVipReceiptRow(
    db,
    userId!,
    familyId,
    result.ok ? "sent" : "failed",
    result.ok ? result.id ?? null : null,
    result.ok ? null : result.error ?? "send failed"
  );
  return result.ok ? { sent: true } : { sent: false, error: result.error };
}

async function logVipReceiptRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  familyId: string | null,
  status: "sent" | "failed" | "skipped" | "suppressed",
  resendId: string | null,
  error: string | null
): Promise<void> {
  await db
    .from("challenge_sequences")
    .upsert(
      {
        user_id: userId,
        family_id: familyId,
        step: "vip_receipt",
        scheduled_at: new Date().toISOString(),
        sent_at: status === "sent" ? new Date().toISOString() : null,
        resend_id: resendId,
        status,
        error,
      },
      { onConflict: "user_id,step", ignoreDuplicates: true }
    )
    .then(undefined, () => {});
}
