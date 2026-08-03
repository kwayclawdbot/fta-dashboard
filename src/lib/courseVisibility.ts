import type { Register } from "@/lib/register";

/**
 * COURSE VISIBILITY — the ONE rule that decides which courses a register may
 * see, extracted from /courses so every surface agrees BY CONSTRUCTION.
 *
 * The rule already existed, but only inside the catalogue's `load()`, spread
 * across three separate expressions:
 *
 *   1. `{ftaCard && !isKid && …}`        — the live FTA program is never shown
 *                                          to a kid (the ICT day-trading cohort
 *                                          is not a young child's surface).
 *   2. `mine = fic.filter(c => c.modules.some(m => m.track === userTrack))`
 *                                        — your OWN track's course.
 *   3. `others = profile?.role !== "child" ? …rest… : []`
 *                                        — the rest of the family library, for
 *                                          anyone who is not a child row.
 *
 * The catalogue obeyed it; the COURSE page and the LESSON page under
 * /courses/[slug] never did (a kid could open /courses/fic-adult-foundations or
 * /courses/fta-trade-ready and read every lesson), and /progress listed those
 * same adult courses as clickable rows in the kid's "My Badges" surface. Those
 * three surfaces now call this function instead of re-deriving anything.
 *
 * TWO DELIBERATE CORRECTIONS to the shape the catalogue had:
 *
 *   • THE TRACK COMES FROM THE REGISTER, not from the raw columns. The catalogue
 *     read `age_group || track || "adults"`, so a legacy `role='child'` row with
 *     a null age_group resolved to the ADULTS track — the exact row deriveRegister
 *     calls a kid. The register is the single source of truth for who is being
 *     spoken to, so the track is derived from it (see trackForRegister).
 *   • A KID NEVER GETS THE WHOLE LIBRARY, whatever `role` says. The catalogue's
 *     "others" test was `role !== 'child'`; a kid whose role is stored as
 *     anything else would have inherited the full adult library from it. The kid
 *     branch is now decided by the register, above role. The TEEN branch keeps
 *     the catalogue's role test verbatim, so teen visibility is unchanged.
 */

/** The content track a register reads. Registers and tracks are 1:1. */
export function trackForRegister(register: Register): string {
  if (register === "kid") return "kids";
  if (register === "teen") return "teens";
  return "adults";
}

/** The course, reduced to the only two facts visibility turns on. */
export interface CourseVisibilityShape {
  /** `courses.program` — "fic" (foundations) | "fta" (the live academy). */
  program: string | null | undefined;
  /** `modules.track` for every module on the course (nulls tolerated). */
  tracks: (string | null | undefined)[];
}

/** The viewer, reduced to the same. */
export interface CourseViewer {
  register: Register;
  /** `profiles.role` — only consulted for the teen branch (see above). */
  role?: string | null;
}

/**
 * May this viewer see this course at all? Used identically by the catalogue
 * (which courses to list), the course/lesson guard (whether to render the
 * syllabus or the door) and /progress (which course rows to list).
 *
 * It answers VISIBILITY only. Membership tier (canAccessCourse), the free
 * sampler and the drip clock are separate gates and are untouched by it.
 */
export function canSeeCourse(
  viewer: CourseViewer,
  course: CourseVisibilityShape
): boolean {
  const { register, role } = viewer;

  // ── The live FTA program: teens and adults, never a kid. ──
  if (course.program === "fta") return register !== "kid";

  // ── Foundations (fic) and anything else that is tracked content. ──
  const tracks = course.tracks.filter(
    (t): t is string => typeof t === "string" && t.length > 0
  );

  // A kid sees their OWN track and nothing else. An untracked course is not a
  // kids course, so it stays closed — the safe answer for the youngest register.
  if (register === "kid") return tracks.includes("kids");

  // A teen: exactly the catalogue's rule. A `child` row is held to its own
  // track; a `teen` row inherits the whole family library, as it always did.
  if (register === "teen") {
    return role === "child" ? tracks.includes("teens") : true;
  }

  // Adults get the family library, unchanged.
  return true;
}
