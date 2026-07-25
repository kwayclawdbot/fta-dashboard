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
import { createOrderFromSession, normalizeShipping } from "@/lib/server/shop";
import { createShopifyTextbookOrder } from "@/lib/server/shopify";
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
  /**
   * How the buyer's account was resolved:
   *   'created'  — a brand-new account was made from the checkout email (guest
   *                checkout) and still needs a password (vip-success prompts one);
   *   'existing' — the email already had an account (VIP attached; log in);
   *   'linked'   — an authed in-app buyer (client_reference_id present);
   *   'none'     — no user/email could be resolved (should not happen).
   */
  account?: "created" | "existing" | "linked" | "none";
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
  const src = cleanSrc(session.metadata?.src);
  const firstName = shipping.name?.split(/\s+/)[0] || "there";
  const phone = shipping.phone || null;

  // Resolve the family from the buyer (client_reference_id = app user id).
  let familyId: string | null = null;
  let resolvedUserId: string | null = userId;
  let account: VipProvisionResult["account"] = userId ? "linked" : "none";
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
      account = "existing";
    }
  }
  // Guest checkout — the marketing-site "Go VIP" button paid with no account.
  // Create one now (email-confirmed, NO password — vip-success prompts a password
  // via magic link) plus the family/profile so the fic enrollment below has a
  // family to attach to and the buyer lands as a full member.
  if (!resolvedUserId && email) {
    const guest = await ensureGuestAccount(db, email, firstName);
    resolvedUserId = guest.userId;
    familyId = guest.familyId ?? familyId;
    account = guest.created ? "created" : "existing";
  }

  // 1. Textbook fulfillment (best-effort) — via the LIVE Shopify store
  //    (shop.cheatcode.com), whose Lulu integration prints & ships the book. We
  //    keep an app-side shop_orders row as the tracking record and stamp the
  //    Shopify order id on it. If the Shopify Admin token isn't configured (or
  //    the call fails), the order stays in the /admin/shop queue for manual
  //    fulfillment — the FIRST real purchase doubles as the live fulfillment
  //    test. Never throws upward.
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
      const shop = await createShopifyTextbookOrder({ email: email || undefined, shipping });
      if (shop.ok && shop.orderId) {
        await db
          .from("shop_orders")
          .update({
            // Tracking pointer to the Shopify order (its Lulu app fulfills).
            lulu_job_id: `shopify:${shop.orderName || shop.orderId}`,
            status: "submitted",
          })
          .eq("id", orderId);
      } else if (shop.error) {
        // Not configured / failed → row stays 'paid' for the manual queue.
        console.error("vip shopify order not created:", orderId, shop.error);
      }
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
    firstName,
    clubUntil,
  });

  // 5. CRM (the app's built-in marketing_leads) — surface the VIP buyer in the
  //    same challenge cohort as free tickets. Guest buyers never touch the quiz
  //    funnel, so without this they'd be invisible in /admin/crm/challenge.
  //    source='challenge' is what admin_challenge_cohort keys off; tag ticket-vip
  //    + custom.ticket='vip' drive the free/vip/partial split. Best-effort.
  if (email) {
    try {
      const leadTags = ["challenge", "ticket-vip", "registered", ...(src ? [`src:${src}`] : [])];
      const leadCustom = {
        src: src || null,
        ticket: "vip",
        city: shipping.address.city || null,
        state: shipping.address.state || null,
      };
      const { data: lead } = await db
        .from("marketing_leads")
        .select("id, tags")
        .eq("email", email)
        .eq("source", "challenge")
        .maybeSingle();
      if (lead) {
        const tags = Array.from(new Set([...(lead.tags || []), ...leadTags]));
        await db
          .from("marketing_leads")
          .update({
            first_name: firstName !== "there" ? firstName : undefined,
            phone: phone || undefined,
            stage: "engaged",
            tags,
            converted_profile_id: resolvedUserId,
            custom: leadCustom,
            last_activity_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", lead.id);
      } else {
        await db.from("marketing_leads").insert({
          email,
          first_name: firstName !== "there" ? firstName : null,
          phone: phone || null,
          source: "challenge",
          stage: "engaged",
          tags: leadTags,
          consent_source: "challenge_vip",
          converted_profile_id: resolvedUserId,
          custom: leadCustom,
        });
      }
    } catch (e) {
      console.error("vip marketing_leads upsert error:", e);
    }
  }

  return {
    ok: true,
    created: true,
    vipId: vip.id,
    textbookOrderId,
    enrollment,
    account,
    receipt,
  };
}

function cleanSrc(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 64) : "";
}

/**
 * Ensure an app account exists for a guest VIP buyer (checkout with no prior
 * login). Creates the auth user email-confirmed with NO password (a magic-link
 * set-password preamble runs on vip-success) plus the family + parent profile,
 * mirroring the free-class register route. If the email already has an auth user
 * (rare — profile missing but auth row present), links to it instead.
 *
 * Returns the resolved user id, the family id (may be null if family creation
 * failed — the caller's enrollment step then no-ops), and whether it was created.
 */
async function ensureGuestAccount(
  db: ReturnType<typeof createAdminClient>,
  email: string,
  firstName: string
): Promise<{ userId: string | null; familyId: string | null; created: boolean }> {
  const displayName = firstName && firstName !== "there" ? firstName : "Friend";

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      role: "parent",
      // Guest VIP buyers have no password yet; onboarding's password preamble
      // keys off this marker (see /api/auth/password-status).
      needs_password: true,
      password_set: false,
    },
  });

  if (createErr || !created?.user) {
    // Already-registered (auth row exists) — link to it and read any family.
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (!existing) {
      console.error("vip guest account: create failed and no existing user:", createErr?.message);
      return { userId: null, familyId: null, created: false };
    }
    const { data: prof } = await db
      .from("profiles")
      .select("family_id")
      .eq("id", existing.id)
      .maybeSingle();
    return { userId: existing.id, familyId: prof?.family_id ?? null, created: false };
  }

  const userId = created.user.id;

  // Family (Club access derives from the fic enrollment the caller adds next).
  const { data: fam, error: famErr } = await db
    .from("families")
    .insert({ name: `${displayName}'s Family` })
    .select("id")
    .single();
  if (famErr || !fam) {
    console.error("vip guest account: family create failed:", famErr?.message);
    return { userId, familyId: null, created: true };
  }
  const familyId = fam.id as string;

  // Link the parent profile (handle_new_user already inserted the row). Leave
  // onboarding_complete false so the buyer runs the short wizard (which includes
  // the set-password preamble) after the vip-success magic link signs them in.
  await db
    .from("profiles")
    .update({
      family_id: familyId,
      role: "parent",
      age_group: "adults",
      track: "adults",
      display_name: displayName,
      onboarding_complete: false,
    })
    .eq("id", userId);

  return { userId, familyId, created: true };
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
