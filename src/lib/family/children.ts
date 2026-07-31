/**
 * ADDING A CHILD TO A FAMILY — the shared vocabulary.
 *
 * WHY THIS EXISTS. Until now the only way a child joined a household was the
 * invite link: a parent minted a `family_invites` code and the child signed
 * themselves up at /signup/invite/[code]. That path works right up until the
 * child doesn't use it — a real household lost each other exactly this way, the
 * son signing up through normal signup instead of the link, landing in his own
 * one-person family with role 'parent', permanently unlinked from his dad.
 *
 * So the parent now does it from their own account, two ways:
 *   1. CREATE — the parent makes the child's account outright (server route
 *      /api/family/children), and hands them the password.
 *   2. LINK — the child already signed up alone; the parent pulls that existing
 *      account into the household (/api/family/children/link).
 *
 * This module is deliberately dependency-free so the client screen and the two
 * server routes agree on the same bands, the same regex and the same minimum
 * password without either side importing the other's world.
 */

/**
 * The two child bands a parent picks from. These are `profiles.age_group`
 * values verbatim (CHECK: 'kids' | 'teens' | 'adults', migration 001) — the
 * parent never types a raw age, and 'adults' is not on offer because this flow
 * only ever produces a child.
 *
 * `track` is written to the SAME value: the profiles_track_check constraint was
 * widened to ('kids','teens','adults') by migration 013, and the onboarding
 * wizard already writes `age_group` and `track` in lockstep
 * (src/app/(auth)/onboarding/page.tsx — `age_group: ageBand, track: ageBand`).
 */
export type AgeBand = "kids" | "teens";

export const AGE_BANDS: { value: AgeBand; label: string; hint: string }[] = [
  { value: "kids", label: "Kid", hint: "8–12" },
  { value: "teens", label: "Teen", hint: "13–17" },
];

export function isAgeBand(v: unknown): v is AgeBand {
  return v === "kids" || v === "teens";
}

/**
 * THE ROLE IS ALWAYS 'child'. There is no 'teen' role — `profiles.role` CHECKs
 * to ('parent','child','coach','admin'), and a teen is stored as role 'child'
 * with age_group 'teens'. That is exactly what deriveRegister (src/lib/register.ts)
 * and viewer_is_kid() (migration 137) both read, so a teen created here gets the
 * teen register and is correctly NOT behind the kid-only walls, while a kid is.
 * Nothing in the gating logic is touched by this flow — it inherits.
 */
export const CHILD_ROLE = "child" as const;

/** Same shape the funnel signup validates with (api/free-class/register). */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Matches the funnel signup minimum so a parent-set password is never weaker. */
export const MIN_PASSWORD = 8;

/**
 * FREE-TIER HOUSEHOLD SIZE. There is none.
 *
 * Investigated before building: migration 204 (free quotas) caps the WATCHLIST
 * at 5 and Ask Kai at 3/day via family_is_free(), and features.ts declares
 * exactly two free numbers — RESEARCH_FREE_WEEKLY_READS and
 * WATCHLIST_FREE_ACTIVE. Neither counts people. No migration constrains the
 * number of profiles per family, and neither invite producer counts the roster
 * before minting a code. A free family can already invite an unlimited number
 * of members today, so these two routes add no seat limit either — matching the
 * invite path exactly rather than inventing a paywall the rest of the app
 * doesn't have. If a seat cap is ever introduced it belongs in
 * src/lib/entitlements/features.ts beside the other two, mirrored into a
 * database trigger the way 204 mirrors the watchlist cap.
 */
export const FREE_FAMILY_MEMBER_CAP: number | null = null;
