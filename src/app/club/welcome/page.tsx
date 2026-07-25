import { createAdminClient } from "@/lib/supabase/admin";
import { provisionClubMembership } from "@/lib/server/club-membership";
import { APP_ORIGIN } from "@/lib/server/drips";
import ClubWelcome from "@/components/club/ClubWelcome";

export const dynamic = "force-dynamic";

/**
 * /club/welcome — the landing after a $99 Cheat Code Club membership checkout
 * (marketing-site guest checkout). success_url carries ?session_id.
 *
 * Server responsibilities (guest-safe — the visitor may be unauthenticated):
 *   1. Verify the Stripe session server-side; a bogus/absent id degrades to a
 *      friendly "we couldn't find that" instead of throwing.
 *   2. Idempotent provisioning safety-net: call provisionClubMembership() in case
 *      the webhook is delayed/failed. It's keyed on the session id, so a normal
 *      (webhook already ran) load is a no-op — no double-provision, no double-email.
 *   3. Decide the account state: a brand-new guest account (needs a password →
 *      we mint a magic link so they can set one and land authenticated) vs an
 *      email that already had an account ("log in").
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
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default async function ClubWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const sessionId = (session_id || "").trim();

  const session = await retrieveStripeSession(sessionId);

  // Bogus / missing / non-Club session → graceful "not found".
  const meta = (session?.metadata as Record<string, unknown> | undefined) || {};
  const isClubSession = !!session && meta.kind === "club_membership";
  if (!isClubSession) {
    return <ClubWelcome state="not_found" />;
  }

  // Idempotent provisioning safety-net (webhook is primary).
  try {
    await provisionClubMembership(session as Record<string, unknown>);
  } catch (e) {
    console.error("club-welcome provision safety-net error:", e);
  }

  const details =
    (session as { customer_details?: { email?: string; name?: string } })
      .customer_details || {};
  const email = String(
    details.email || (session as { customer_email?: string }).customer_email || ""
  )
    .trim()
    .toLowerCase();
  const firstName = String(details.name || "").trim().split(/\s+/)[0] || "";

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
        // Magic link so the buyer sets a password and lands authenticated, then
        // runs the onboarding wizard (which claims the pending Club membership).
        const { data: link } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: `${APP_ORIGIN}/auth/callback?next=/onboarding` },
        });
        setupUrl = link?.properties?.action_link ?? null;
      }
    } catch (e) {
      console.error("club-welcome account-state error:", e);
    }
  }

  return (
    <ClubWelcome
      state="ok"
      accountState={accountState}
      setupUrl={setupUrl}
      firstName={firstName}
    />
  );
}
