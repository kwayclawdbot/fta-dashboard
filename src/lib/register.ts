/**
 * Register — the single source of truth for "who am I talking to" across the
 * club surfaces (kid / teen / adult). Voice, celebration weight, sound opt-in,
 * empty-state copy and setup nudges all key off this so no page re-derives it
 * inconsistently again (the audit found missions used age_group/role, dashboard
 * used `track`, courses used `role && age_group` — three different answers).
 *
 * Precedence (documented, deliberate):
 *   1. `age_group` is authoritative when set — it is chosen in onboarding and is
 *      the explicit "kids | teens | adults" band. It always wins.
 *   2. Only when `age_group` is absent (legacy rows) do we fall back to `role`:
 *      a bare `child` → the youngest/safest register (kid), a `teen` role → teen,
 *      everything else (parent/coach/admin/null) → adult.
 *
 * This means a 15-year-old with `age_group='teens'` is NEVER a kid even if their
 * role is stored as `child`, and an adult with no age band is never baby-talked.
 */

export type Register = "kid" | "teen" | "adult";

/** The celebration system speaks kid/teen/parent; adult maps to parent there. */
export type CelebrateRegister = "kid" | "teen" | "parent";

export interface RegisterProfile {
  role?: string | null;
  age_group?: string | null;
  /** legacy content-track column; only used as a last resort. */
  track?: string | null;
}

/** Derive the register for a member from their profile. See precedence above. */
export function deriveRegister(
  profile: RegisterProfile | null | undefined
): Register {
  const age = profile?.age_group;
  if (age === "kids") return "kid";
  if (age === "teens") return "teen";
  if (age === "adults") return "adult";

  // No explicit age band — fall back to role, then legacy track.
  const role = profile?.role;
  if (role === "teen") return "teen";
  if (role === "child") return "kid";

  const track = profile?.track;
  if (track === "kids") return "kid";
  if (track === "teens") return "teen";

  return "adult";
}

/** Map a Register onto the celebration system's kid/teen/parent vocabulary. */
export function celebrateRegister(r: Register): CelebrateRegister {
  return r === "adult" ? "parent" : r;
}

export function isKidRegister(
  profile: RegisterProfile | null | undefined
): boolean {
  return deriveRegister(profile) === "kid";
}

export function isTeenRegister(
  profile: RegisterProfile | null | undefined
): boolean {
  return deriveRegister(profile) === "teen";
}

export function isAdultRegister(
  profile: RegisterProfile | null | undefined
): boolean {
  return deriveRegister(profile) === "adult";
}

/**
 * Should this member see the "Finish setting up your family" nudge?
 * Only a parent can complete family/account setup — kids and teens can't, and
 * the audit flagged children being shown a 0/6 parent chore. Nav lane consumes
 * this from register.ts so the gate lives in exactly one place.
 */
export function shouldShowFamilySetupNudge(
  profile: RegisterProfile | null | undefined
): boolean {
  return profile?.role === "parent";
}

/**
 * Kid-appropriate "next step" copy for a new kid at zero progress. Consumed by
 * the Kids Corner home (nav lane) in place of the parent account-setup steps and
 * the "You did it! All caught up" win-screen the audit flagged at 0 lessons.
 */
export const KID_FIRST_ADVENTURE = {
  title: "Start your first adventure",
  body: "Your very first lesson is waiting. Press play and let's learn how money grows!",
  cta: "Start my first lesson",
  href: "/courses",
} as const;
