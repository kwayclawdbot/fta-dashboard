export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getRequestClient,
  getRequestFamilyMemberCount,
  getRequestProfile,
  getRequestTierState,
  getRequestUser,
} from "@/lib/supabase/rsc";
import { effectiveClubTier } from "@/lib/tier";
import { isSoloAccount, deriveRegister } from "@/lib/register";
import DashboardShell from "@/components/dashboard/DashboardShell";
import ViewAsIndicator from "@/components/dashboard/ViewAsIndicator";
import { resolveViewAs } from "@/lib/server/view-as";
import { applyViewAs } from "@/lib/view-as";
import { EntitlementsProvider } from "@/components/entitlements/EntitlementsProvider";
import type { EntitlementState } from "@/lib/entitlements";
import { parseExperience, type ExperienceKey } from "@/lib/experience/registry";
import {
  CLUB_VIEW_COOKIE,
  clubHostLive,
  requestExperience,
} from "@/lib/experience/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // SPEED — this shell is the TTFB floor for EVERY route in the group (a page
  // as trivial as /courses could not stream a byte until it finished), and it
  // used to be a chain of SIX SEQUENTIAL Supabase round trips: getUser →
  // profiles → family_tiers → enrollments → challenge_vips → family_profiles.
  //
  // Two changes, no behavioural difference:
  //   • the session and the profile now come from the request-scoped helpers
  //     (src/lib/supabase/rsc.ts), so the auth check is a local signature
  //     verification instead of a GoTrue round trip, and the profile row is read
  //     ONCE for the whole render instead of once here and again in the page.
  //   • the four family-scoped reads all depend only on `family_id`, which is
  //     known after the profile — so they now run as ONE parallel batch. The
  //     `challenge_pass` read is no longer skipped for non-fic families; its
  //     RESULT is still gated on `tier === 'fic'` below, so what the shell shows
  //     is unchanged, it just stops costing a round trip to find out.
  const [supabase, user, profile] = await Promise.all([
    getRequestClient(),
    getRequestUser(),
    getRequestProfile(),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (profile && !profile.onboarding_complete) {
    redirect("/onboarding");
  }

  const familyId = profile?.family_id ?? null;
  const isOwnerRole = profile?.role === "parent" || profile?.role === "admin";

  const [
    { tier, clubLapsed },
    passRes,
    vipRes,
    fpRes,
    memberCount,
    doorRes,
  ] = await Promise.all([
    // Family membership tier (FIC/FTA) — kids inherit the family's tier. The
    // Club clock (migration 127): an fta family may be `clubLapsed` (past its
    // 12-month Challenge Club window) — still tier 'fta' for the FTA hub, but
    // the shell surfaces a renewal banner and Club-level pages gate at free.
    getRequestTierState(familyId),
    // Challenge-pass window (Lane C7): a family whose tier is 'fic' MAY actually
    // be a 5-Day Challenge pass-holder (full Club until expires_at, then free).
    familyId
      ? supabase
          .from("enrollments")
          .select("expires_at")
          .eq("family_id", familyId)
          .eq("program", "challenge_pass")
          .eq("status", "active")
          .not("expires_at", "is", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle()
      : Promise.resolve(null),
    // VIP ticket holder? (Lane C9b tour) — used to add the VIP-room stop to the
    // challenge walkthrough. Cheap own-family lookup.
    familyId
      ? supabase
          .from("challenge_vips")
          .select("id")
          .eq("family_id", familyId)
          .maybeSingle()
      : Promise.resolve(null),
    // Solo (individual, non-parent) member — a family of one. Only owners
    // (parent/admin) can be solo; kids/teens always belong to a parent's family.
    // Derived from a COMPLETED family_profiles household so unfinished/default
    // rows never read as solo, and the nav keeps its family framing for them.
    familyId && isOwnerRole
      ? supabase
          .from("family_profiles")
          .select("household, completed_at")
          .eq("family_id", familyId)
          .maybeSingle()
      : Promise.resolve(null),
    // …and the fact that answer is checked against: how many people are ACTUALLY
    // on this family. One cached `head` count, in the same parallel batch as
    // everything else keyed on family_id, so it costs no extra latency —
    // and it is only asked for the owners whose solo verdict can turn on it.
    familyId && isOwnerRole
      ? getRequestFamilyMemberCount(familyId)
      : Promise.resolve(null),
    // THE DOOR (migration 215) — the stored experience this household entered
    // through. It replaces the household-shape INFERENCE the shell used to make;
    // asked for every member (kids included, they inherit the family's door) and
    // in the same batch, so it costs no latency. Own-family read under RLS.
    familyId
      ? supabase
          .from("families")
          .select("door")
          .eq("id", familyId)
          .maybeSingle()
      : Promise.resolve(null),
  ]);

  // Gates unchanged — only the FETCHING moved. A pass read for a non-fic family
  // is discarded here exactly as it was never issued before.
  const challengeExpiresAt: string | null =
    tier === "fic" ? ((passRes?.data?.expires_at as string | null) ?? null) : null;
  const isVip = !!vipRes?.data;
  // SOLO IS A FACT ABOUT THE ROSTER, NOT AN ANSWER ON A FORM. This used to be
  // isSoloProfile(family_profiles.household) alone, and a parent whose signup
  // JSON said {adults:1, kids:0} was called solo even with a real teen sitting on
  // the same family_id — which took the Family group out of their navigation
  // entirely (no nav row, no drawer entry, nothing). The member count now has the
  // final word; the household JSON only breaks the one-row tie. See isSoloAccount.
  const isSolo = isSoloAccount(fpRes?.data ?? null, memberCount);

  // FTA renewal date for the lapsed banner copy (min Club window across active
  // fta enrollments). Still read only when actually lapsed — it is rare, and
  // keeping it conditional means the common path never pays for it at all.
  let clubUntil: string | null = null;
  if (clubLapsed && familyId) {
    const { data: en } = await supabase
      .from("enrollments")
      .select("club_until")
      .eq("family_id", familyId)
      .eq("program", "fta")
      .eq("status", "active")
      .not("club_until", "is", null)
      .order("club_until", { ascending: true })
      .limit(1)
      .maybeSingle();
    clubUntil = (en?.club_until as string | null) ?? null;
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

  // ── THE DOOR — stored experience in, inference out (E1) ────────────────────
  // The shell used to answer "Club or Family?" with `user.isSolo`, i.e. with the
  // shape of a household someone typed into a wizard. It now reads the stored
  // door. Three things can move it, in this order:
  //   1. the admin "view as" preview — its personas ARE doors (club vs the four
  //      family-side registers), so the switcher keeps repainting the shell;
  //   2. an accepted "view in Club Mode" session (see /switch) — ADULTS ONLY,
  //      re-checked here against the real register on every render, so the
  //      cookie alone can never give a kid or teen the Club skin;
  //   3. otherwise the family's own door.
  // No family yet (a member mid-provisioning) has no door to read, and falls
  // back to exactly the previous solo inference.
  const register = deriveRegister(ctx);
  const storedDoor = parseExperience(
    (doorRes?.data as { door?: string } | null)?.door
  );
  const viewAsDoor: ExperienceKey | null = viewAs
    ? viewAs === "club"
      ? "club"
      : "family"
    : null;
  const memberDoor: ExperienceKey =
    viewAsDoor ?? storedDoor ?? (ctx.isSolo ? "club" : "family");

  const hostExperience = await requestExperience();
  const clubViewCookie =
    (await cookies()).get(CLUB_VIEW_COOKIE)?.value === "1";
  const clubView =
    clubViewCookie &&
    register === "adult" &&
    hostExperience === "club" &&
    memberDoor === "family";

  // WRONG-DOMAIN INTERSTITIAL (spec §2 rule 3). Entirely gated on the club host
  // actually serving: while cheatcode.com is parked there is one live host, so
  // no member can be on the "wrong" one and this branch never fires in
  // production. Without the gate a club-door member on the family host would be
  // sent to a switcher whose only exit is a domain that does not resolve — a
  // trap, not a product surface. /switch lives outside this route group, so the
  // redirect can never loop back through this layout.
  if (
    clubHostLive() &&
    hostExperience !== memberDoor &&
    !clubView &&
    !viewAs
  ) {
    redirect("/switch");
  }

  // user_metadata rides in the signed token (and is refreshed with it), so the
  // fallback name is the same value getUser() would have returned — it is only
  // ever consulted when the profile has no display_name of its own.
  const meta = user.user_metadata as {
    display_name?: string;
    full_name?: string;
  };

  const userData = {
    email: user.email ?? undefined,
    display_name: profile?.display_name || meta?.display_name || meta?.full_name,
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
    register,
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
        door={memberDoor}
        clubView={clubView}
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
