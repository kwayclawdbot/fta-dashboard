export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getRequestHomeBoot,
  getRequestProfile,
  getRequestUser,
} from "@/lib/supabase/rsc";
import { normalizeTier } from "@/lib/tier";
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
  // as trivial as /courses could not stream a byte until it finished).
  //
  // It began as a chain of SIX SEQUENTIAL Supabase round trips (getUser →
  // profiles → family_tiers → enrollments → challenge_vips → family_profiles),
  // became one profile read plus a six-way PARALLEL batch, and is now ONE RPC:
  //   • the session is a LOCAL signature verification, not a GoTrue call;
  //   • `get_home_boot` (migration 217) returns the tier, the Club clock, the
  //     challenge-pass window, the VIP flag, the household, the member count and
  //     the door in a single payload — the six family-scoped reads this batch
  //     used to fan out, joined inside Postgres instead of over six HTTPS
  //     connections. The SAME payload also carries what /dashboard's page and
  //     its Today loop need, and it is request-scoped, so the whole render pays
  //     for it once.
  // Every gate below is byte-identical; only the fetching moved.
  const [user, profile, boot] = await Promise.all([
    getRequestUser(),
    getRequestProfile(),
    getRequestHomeBoot(),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (profile && !profile.onboarding_complete) {
    redirect("/onboarding");
  }

  const familyId = profile?.family_id ?? null;
  const isOwnerRole = profile?.role === "parent" || profile?.role === "admin";

  // The boot degrades to null on any failure; the shell then renders on the
  // no-family defaults, which is exactly what it did for a member without one.
  const fam = boot?.family ?? null;

  // Family membership tier (FIC/FTA) — kids inherit the family's tier. The Club
  // clock (migration 127): an fta family may be `clubLapsed` (past its 12-month
  // Challenge Club window) — still tier 'fta' for the FTA hub, but the shell
  // surfaces a renewal banner and Club-level pages gate at free.
  const tier = normalizeTier(fam?.tier);
  const clubLapsed = fam?.club_lapsed === true;

  // Challenge-pass window (Lane C7): a family whose tier is 'fic' MAY actually
  // be a 5-Day Challenge pass-holder (full Club until expires_at, then free).
  // The RESULT is gated on `tier === 'fic'` exactly as before.
  const challengeExpiresAt: string | null =
    tier === "fic" ? (fam?.challenge_expires_at ?? null) : null;
  // VIP ticket holder? (Lane C9b tour) — adds the VIP-room stop to the
  // challenge walkthrough.
  const isVip = fam?.is_vip === true;
  // SOLO IS A FACT ABOUT THE ROSTER, NOT AN ANSWER ON A FORM. This used to be
  // isSoloProfile(family_profiles.household) alone, and a parent whose signup
  // JSON said {adults:1, kids:0} was called solo even with a real teen sitting on
  // the same family_id — which took the Family group out of their navigation
  // entirely (no nav row, no drawer entry, nothing). The member count now has the
  // final word; the household JSON only breaks the one-row tie. See isSoloAccount.
  //
  // The two inputs used to be a family_profiles read and a `head` count, both
  // asked for ONLY when the viewer's role could actually be solo. They now ride
  // the boot, so the gate is applied to the ANSWER instead of to the fetch — a
  // non-owner still can never read as solo, it just no longer costs two round
  // trips to establish that.
  const isSolo =
    familyId && isOwnerRole
      ? isSoloAccount(
          fam
            ? {
                household: fam.household as never,
                completed_at: fam.household_completed_at,
              }
            : null,
          fam?.member_count ?? null
        )
      : false;

  // FTA renewal date for the lapsed banner copy (min Club window across active
  // fta enrollments). It used to be a SEVENTH round trip, conditional on the
  // lapse so the common path never paid for it; the boot returns it as one more
  // scalar sub-select, so it now costs nothing at all and the branch is gone.
  const clubUntil: string | null = clubLapsed ? (fam?.club_until ?? null) : null;

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
  const storedDoor = parseExperience(fam?.door);
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
