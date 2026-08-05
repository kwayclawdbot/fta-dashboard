import { AGE_META, ageGroupOf } from "@/lib/feed";

/**
 * ONE NAME FOR A CHILD'S AGE BAND.
 *
 * The same eleven-year-old was three different people depending on the page:
 * /family called every child a "Teen" (a hard-coded string), /family/corner
 * printed the raw `age_group` column capitalised ("Kids"), and /family/members
 * did the same in a different case ("Kids"). A parent reading their own
 * household should not have to work out whether those are three labels or three
 * children.
 *
 * The vocabulary already existed — `AGE_META` in lib/feed.ts is what the
 * community's AgeBadge renders — so this is not a new naming system, it is the
 * existing one made reachable from the family surfaces. `age_group` is
 * authoritative and `role` is the fallback, exactly as `ageGroupOf` decides it
 * everywhere else.
 *
 * FOLLOW-UP: /family/members still formats the raw column itself. That file is
 * owned by another lane right now; it should adopt this helper next.
 */
export function ageGroupLabel(
  role: string | null | undefined,
  ageGroup: string | null | undefined
): string {
  return AGE_META[ageGroupOf(role, ageGroup)].label;
}
