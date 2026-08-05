export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ClubMark } from "@/components/brand/ClubMark";
import {
  getRequestClient,
  getRequestFamilyMemberCount,
  getRequestProfile,
  getRequestUser,
} from "@/lib/supabase/rsc";
import { deriveRegister, isSoloAccount } from "@/lib/register";
import { experience, parseExperience } from "@/lib/experience/registry";
import { clubHostLive, requestExperience } from "@/lib/experience/server";
import ClubViewAccept from "@/components/experience/ClubViewAccept";

/**
 * WRONG-DOMAIN INTERSTITIAL (EXPERIENCE-ARCHITECTURE §2 rule 3).
 *
 * A member's door is stored on their family; the host they arrived on is a
 * separate fact. When the two disagree, that mismatch is a PRODUCT SURFACE, not
 * a silent redirect — the owner's decision, 2026-08-05. Two branches:
 *
 *   • Club-door member on the family host → the Family Mode pitch. Their door
 *     does not change from a visit; converting is an explicit action (E2).
 *   • Family-door member on the club host → "view in Club Mode", a
 *     SESSION-scoped skin override. ADULTS ONLY — a kid or teen never sees the
 *     offer and the cookie is re-checked against the real register on every
 *     dashboard render, so it can never be used to escalate a minor.
 *
 * Lives OUTSIDE the (dashboard) route group on purpose: the mismatch check runs
 * in that group's layout, so a route inside it could redirect to itself forever.
 *
 * Whole surface gated on the club host actually serving. While cheatcode.com is
 * parked there is one live host, no member can be on the wrong one, and sending
 * a Club member to a switcher whose only exit is a domain that does not resolve
 * would be a trap. Until then this route simply returns members to the app.
 */
export default async function SwitchPage() {
  const [user, profile] = await Promise.all([getRequestUser(), getRequestProfile()]);
  if (!user) redirect("/login");
  if (!clubHostLive()) redirect("/dashboard");

  const supabase = await getRequestClient();
  const familyId = profile?.family_id ?? null;

  const [doorRes, fpRes, memberCount] = await Promise.all([
    familyId
      ? supabase.from("families").select("door").eq("id", familyId).maybeSingle()
      : Promise.resolve(null),
    familyId
      ? supabase
          .from("family_profiles")
          .select("household, completed_at")
          .eq("family_id", familyId)
          .maybeSingle()
      : Promise.resolve(null),
    familyId ? getRequestFamilyMemberCount(familyId) : Promise.resolve(null),
  ]);

  const isSolo = isSoloAccount(fpRes?.data ?? null, memberCount);
  const door =
    parseExperience((doorRes?.data as { door?: string } | null)?.door) ??
    (isSolo ? "club" : "family");
  const host = await requestExperience();

  // Nothing to resolve — never leave a member parked here.
  if (host === door) redirect("/dashboard");

  const register = deriveRegister(profile);
  const isAdult = register === "adult";
  const target = experience(door);

  // Cross-host links are offered ONLY when the target is a different host AND
  // that host is serving. Never send anyone to a domain that does not resolve.
  const crossHost =
    target.canonicalHost !== experience(host).canonicalHost
      ? `https://${target.canonicalHost}/dashboard`
      : "/dashboard";

  return (
    <div data-mode={experience(host).appMode} className="relative min-h-dvh bg-paper text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px]"
        style={{
          background:
            "radial-gradient(130% 100% at 50% 0%, color-mix(in srgb, var(--accent-solid) 16%, var(--paper)) 0%, var(--paper) 72%)",
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-12 pt-14 sm:pt-20">
        <header className="flex flex-col items-center text-center">
          <ClubMark size={40} />
          <p className="mt-4 font-display text-[12px] font-extrabold uppercase tracking-[0.2em] text-ink">
            {experience(host).brand}
          </p>
        </header>

        <main className="mt-12 flex-1">
          {door === "club" ? (
            <>
              <h1 className="font-display text-[28px] font-extrabold leading-[1.05] tracking-tight text-ink">
                This is the family door.
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-soft">
                Your membership is {experience("club").brand} — the individual
                side. Family Mode is the same membership with your household on
                it: shared lessons, kid accounts, and the family desk.
              </p>

              <div className="f0-rule-top mt-8 pt-6">
                {/* TODO (E2): point at the real "Add your family" conversion
                    flow — the lane-C1 surface that flips families.door to
                    'family'. Settings is the honest interim destination. */}
                <Link
                  href="/settings"
                  className="f0-press f0-focus inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-3 font-display text-sm font-bold text-[color:var(--accent-on)]"
                >
                  Register for Family Mode
                </Link>
                <a
                  href={crossHost}
                  className="mt-4 block text-center text-[13px] font-semibold text-soft transition-colors hover:text-ink"
                >
                  Take me to my Club home
                </a>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display text-[28px] font-extrabold leading-[1.05] tracking-tight text-ink">
                {isAdult
                  ? "Want to view in Club Mode?"
                  : "This is the Club door."}
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-soft">
                {isAdult
                  ? `You're a ${experience("family").brand} member. You can look around in Club Mode for this session — nothing about your membership changes, and your family home is one tap away.`
                  : `Your membership lives on ${experience("family").brand}. Let's get you back there.`}
              </p>

              <div className="f0-rule-top mt-8 pt-6">
                {isAdult && <ClubViewAccept />}
                <a
                  href={crossHost}
                  className={
                    isAdult
                      ? "mt-4 block text-center text-[13px] font-semibold text-soft transition-colors hover:text-ink"
                      : "f0-press f0-focus inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-3 font-display text-sm font-bold text-[color:var(--accent-on)]"
                  }
                >
                  {isAdult ? "No thanks — my family home" : "Go to my family home"}
                </a>
              </div>
            </>
          )}
        </main>

        <footer className="f0-rule-top mt-12 pt-5 text-center text-[11px] text-soft">
          Your membership is the same on either door.
        </footer>
      </div>
    </div>
  );
}
