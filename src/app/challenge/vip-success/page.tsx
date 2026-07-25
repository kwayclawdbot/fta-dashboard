import { createAdminClient } from "@/lib/supabase/admin";
import { provisionChallengeVip } from "@/lib/server/challenge-vip";
import { normalizeShipping } from "@/lib/server/shop";
import { APP_ORIGIN } from "@/lib/server/drips";
import VipSuccess from "@/components/challenge/VipSuccess";

export const dynamic = "force-dynamic";

/**
 * /challenge/vip-success — the landing after a $197 Challenge VIP checkout
 * (Lane C9 guest-checkout rework). Reached by BOTH the guest funnel buyer and
 * the in-app upsell buyer (success_url carries ?session_id).
 *
 * Server responsibilities (guest-safe — the visitor may be unauthenticated):
 *   1. Verify the Stripe session server-side; a bogus/absent id degrades to a
 *      friendly "we couldn't find that" instead of throwing.
 *   2. Idempotent provisioning safety-net: call provisionChallengeVip() in case
 *      the webhook is delayed/failed. It's keyed on the session id, so a normal
 *      (webhook already ran) load is a no-op.
 *   3. Decide the account state: a brand-new guest account (needs a password →
 *      we mint a magic link so they can set one and land authenticated) vs an
 *      email that already had an account ("you're upgraded — log in").
 */
async function retrieveStripeSession(
  sessionId: string
): Promise<Record<string, unknown> | null> {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk || !sessionId) return null;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${sk}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    return json;
  } catch {
    return null;
  }
}

export default async function VipSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const sessionId = (session_id || "").trim();

  const session = await retrieveStripeSession(sessionId);

  // Bogus / missing / non-VIP session → graceful "not found".
  const meta = (session?.metadata as Record<string, unknown> | undefined) || {};
  const isVipSession = !!session && meta.kind === "challenge_vip";
  if (!isVipSession) {
    return <VipSuccess state="not_found" />;
  }

  // Idempotent provisioning safety-net (webhook is primary).
  try {
    await provisionChallengeVip(session as Record<string, unknown>);
  } catch (e) {
    console.error("vip-success provision safety-net error:", e);
  }

  const shipping = normalizeShipping(session as Record<string, unknown>);
  const email = String(
    (session as Record<string, unknown>).customer_details &&
      ((session as { customer_details?: { email?: string } }).customer_details?.email ||
        "") ||
      (session as { customer_email?: string }).customer_email ||
      ""
  )
    .trim()
    .toLowerCase();

  // Account state — new guest (set password) vs existing (log in).
  let accountState: "new" | "existing" = "existing";
  let setupUrl: string | null = null;
  if (email) {
    const admin = createAdminClient();
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const user = list?.users?.find((u) => u.email?.toLowerCase() === email);
      const needsPassword =
        !!user &&
        user.user_metadata?.password_set !== true &&
        (user.user_metadata?.needs_password === true || !!user.invited_at);
      if (needsPassword) {
        accountState = "new";
        // Magic link so the buyer sets a password and lands authenticated. The
        // action link verifies at Supabase, then redirects (hash-fragment
        // session) to /auth/callback → /auth/finish → the onboarding wizard,
        // whose password preamble now shows (see /api/auth/password-status).
        const { data: link } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: `${APP_ORIGIN}/auth/callback?next=/onboarding` },
        });
        setupUrl = link?.properties?.action_link ?? null;
      }
    } catch (e) {
      console.error("vip-success account-state error:", e);
    }
  }

  return (
    <VipSuccess
      state="ok"
      accountState={accountState}
      setupUrl={setupUrl}
      firstName={shipping.name?.split(/\s+/)[0] || ""}
      shippingName={shipping.name || ""}
      address={shipping.address}
    />
  );
}
