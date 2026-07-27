export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFamilyTierState, effectiveClubTier } from "@/lib/tier";
import { isSoloProfile, deriveRegister } from "@/lib/register";
import DashboardShell from "@/components/dashboard/DashboardShell";
import ViewAsIndicator from "@/components/dashboard/ViewAsIndicator";
import { resolveViewAs } from "@/lib/server/view-as";
import { applyViewAs } from "@/lib/view-as";
import { EntitlementsProvider } from "@/components/entitlements/EntitlementsProvider";
import type { EntitlementState } from "@/lib/entitlements";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track, display_name, avatar_url, onboarding_complete, family_id")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarding_complete) {
    redirect("/onboarding");
  }

  // Family membership tier (FIC/FTA) — kids inherit the family's tier. The
  // Club clock (migration 127): an fta family may be `clubLapsed` (past its
  // 12-month Challenge Club window) — still tier 'fta' for the FTA hub, but the
  // shell surfaces a renewal banner and Club-level pages gate at free.
  const { tier, clubLapsed } = await getFamilyTierState(
    supabase,
    profile?.family_id
  );

  // FTA renewal date for the lapsed banner copy (min Club window across active
  // fta enrollments). Only read when actually lapsed — cheap + rarely true.
  let clubUntil: string | null = null;
  if (clubLapsed && profile?.family_id) {
    const { data: en } = await supabase
      .from("enrollments")
      .select("club_until")
      .eq("family_id", profile.family_id)
      .eq("program", "fta")
      .eq("status", "active")
      .not("club_until", "is", null)
      .order("club_until", { ascending: true })
      .limit(1)
      .maybeSingle();
    clubUntil = (en?.club_until as string | null) ?? null;
  }

  // Challenge-pass window (Lane C7): a family whose tier is 'fic' MAY actually
  // be a 5-Day Challenge pass-holder (full Club until expires_at, then free).
  // Surface the expiry so the shell can show a friendly days-left banner. Only
  // meaningful while the pass is still active; once expired the tier is 'free'.
  let challengeExpiresAt: string | null = null;
  if (profile?.family_id && tier === "fic") {
    const { data: pass } = await supabase
      .from("enrollments")
      .select("expires_at")
      .eq("family_id", profile.family_id)
      .eq("program", "challenge_pass")
      .eq("status", "active")
      .not("expires_at", "is", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    challengeExpiresAt = (pass?.expires_at as string | null) ?? null;
  }

  // VIP ticket holder? (Lane C9b tour) — used to add the VIP-room stop to the
  // challenge walkthrough. Cheap own-family lookup.
  let isVip = false;
  if (profile?.family_id) {
    const { data: vip } = await supabase
      .from("challenge_vips")
      .select("id")
      .eq("family_id", profile.family_id)
      .maybeSingle();
    isVip = !!vip;
  }

  // Solo (individual, non-parent) member — a family of one. Only owners
  // (parent/admin) can be solo; kids/teens always belong to a parent's family.
  // Derived from a COMPLETED family_profiles household so unfinished/default
  // rows never read as solo, and the nav keeps its family framing for them.
  let isSolo = false;
  if (
    profile?.family_id &&
    (profile.role === "parent" || profile.role === "admin")
  ) {
    const { data: fp } = await supabase
      .from("family_profiles")
      .select("household, completed_at")
      .eq("family_id", profile.family_id)
      .maybeSingle();
    isSolo = isSoloProfile(fp);
  }

  // ── ADMIN "VIEW AS" — the single override point (src/lib/view-as.ts) ───────
  // Everything the shell keys off (nav, register, brand/palette, tier gating)
  // is derived from the five fields below, so the preview is applied HERE, once,
  // and every downstream surface follows without a line of its own. Two hard
  // properties of this placement:
  //   • resolveViewAs is passed the REAL profile role read above from the
  //     authenticated session. A cookie on a non-admin's browser returns null
  //     and is never even read — the cookie is not the authority.
  //   • it is a pure in-memory transform. No row is written; the admin's real
  //     tier, role and age_group are exactly as the database has them, and every
  //     API route still re-derives from the real profile (so writes, RLS and
  //     analytics see the real member, never the preview).
  const viewAs = await resolveViewAs(profile?.role);
  const ctx = applyViewAs(
    {
      role: profile?.role ?? undefined,
      age_group: profile?.age_group ?? undefined,
      track: profile?.track ?? undefined,
      tier,
      isSolo,
      clubLapsed,
    },
    viewAs
  );

  const userData = {
    email: user.email,
    display_name:
      profile?.display_name ||
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name,
    role: ctx.role,
    age_group: ctx.age_group,
    track: ctx.track,
    avatar_url: profile?.avatar_url ?? undefined,
    tier: ctx.tier,
    isSolo: ctx.isSolo,
    // Challenge walkthrough signals (Lane C9b): a challenge_pass holder gets the
    // challenge-flavored tour; VIPs additionally get the VIP-room stop.
    isChallenge: !!challengeExpiresAt,
    isVip,
  };

  // Central entitlement snapshot (src/lib/entitlements) — computed ONCE from the
  // values this layout already derived (no extra queries), then provided to every
  // client <Gated>. Fail-closed: a lapsed FTA family reads 'free' for Club gates.
  const entitlements: EntitlementState = {
    tier: effectiveClubTier(ctx.tier, ctx.clubLapsed),
    realTier: ctx.tier,
    register: deriveRegister(ctx),
    clubLapsed: ctx.clubLapsed,
    challenge: challengeExpiresAt
      ? {
          active: true,
          expiresAt: challengeExpiresAt,
          daysRemaining: Math.max(
            0,
            Math.ceil(
              (new Date(challengeExpiresAt).getTime() - Date.now()) / 86_400_000
            )
          ),
        }
      : null,
  };

  return (
    <>
      <DashboardShell
        user={userData}
        challengeExpiresAt={challengeExpiresAt}
        clubLapsed={ctx.clubLapsed}
        clubUntil={clubUntil}
        viewAs={viewAs}
      >
        <EntitlementsProvider value={entitlements}>
          {children}
        </EntitlementsProvider>
      </DashboardShell>

      {/* Standing "you are previewing" marker. Rendered as a sibling of the
          shell so its fixed frame can never be trapped in a nested stacking
          context, and only when the SERVER honoured the override. */}
      {viewAs && <ViewAsIndicator view={viewAs} />}
    </>
  );
}
