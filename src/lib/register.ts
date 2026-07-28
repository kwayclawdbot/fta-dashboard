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

// ── Solo (individual, non-parent) members ────────────────────────────────────
// The platform is family-first, but a solo adult is stored as a family of ONE
// (the data model never changes): family_profiles.household = { adults:1,
// kids:0, kid_age_ranges:[] }. Every surface should read "just you", not "your
// family", for them. Derive it here so no page re-implements the check.

/** The household block on family_profiles (migration 075) — minimal shape. */
export interface SoloHousehold {
  adults?: number | null;
  kids?: number | null;
  kid_age_ranges?: unknown[] | null;
}

/**
 * Is this household SOLO — one adult, no kids?
 *   • adults ≤ 1 AND kids === 0 AND no kid age ranges → solo.
 *   • null / absent household → NOT solo. Unknown always keeps the family
 *     framing (the safe default); we never guess "solo" from missing data.
 *
 * CAUTION: the wizard's emptyDraft() is itself {adults:1,kids:0}, so a family
 * who simply hasn't answered yet is solo-SHAPED. To avoid mislabeling them,
 * always resolve solo from a COMPLETED profile — use isSoloProfile(), or pass a
 * household you know came from a finished family_profiles row.
 */
export function isSoloHousehold(h: SoloHousehold | null | undefined): boolean {
  if (!h) return false;
  const adults = typeof h.adults === "number" ? h.adults : 1;
  const kids = typeof h.kids === "number" ? h.kids : 0;
  const ranges = Array.isArray(h.kid_age_ranges) ? h.kid_age_ranges.length : 0;
  return adults <= 1 && kids === 0 && ranges === 0;
}

/**
 * Solo verdict for a member from their family_profiles row. Requires a
 * COMPLETED profile (completed_at set) so an unfinished / default-shaped row is
 * never mistaken for a deliberate solo household.
 */
export function isSoloProfile(
  profile:
    | { household?: SoloHousehold | null; completed_at?: string | null }
    | null
    | undefined
): boolean {
  if (!profile || !profile.completed_at) return false;
  return isSoloHousehold(profile.household);
}

/**
 * THE SOLO VERDICT, RESOLVED FROM MEMBERSHIP — not from the signup form.
 *
 * isSoloProfile() above reads `family_profiles.household`, which is what the
 * parent TYPED during onboarding. That answer can be stale or simply wrong: the
 * wizard's own empty draft is `{adults:1, kids:0}`, and a parent who later adds
 * a teen never goes back to edit it. The live defect this fixes: a parent with a
 * real teen in `profiles` was classified solo, and the navigation dropped the
 * Family group entirely — no Family row, no Family anywhere — for a household
 * that plainly had a second member.
 *
 * The rule, in one line: **the roster is the fact, the questionnaire only breaks
 * ties.**
 *   • two or more profile rows on the family  → NEVER solo, whatever the JSON says.
 *   • exactly one (or zero) rows              → the completed household decides,
 *     so a parent who declared kids but hasn't invited them yet keeps the family
 *     framing, and a deliberate individual member keeps the club framing.
 *   • member count unknown (no family, or the count failed to read) → the JSON
 *     verdict stands, exactly as before. A failed count never reclassifies anyone.
 */
export function isSoloAccount(
  profile:
    | { household?: SoloHousehold | null; completed_at?: string | null }
    | null
    | undefined,
  memberCount: number | null | undefined
): boolean {
  if (!isSoloProfile(profile)) return false;
  if (memberCount == null) return true;
  return memberCount <= 1;
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
