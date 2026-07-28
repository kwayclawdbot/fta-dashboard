/**
 * FAMILY NIGHT — the shared constants.
 *
 * Small on purpose. These two values are read by the surface that PROMISES the
 * payout (/family/tonight) and by the route that PAYS it (/api/family/night),
 * and the pair has to agree or the screen lies about what landed. They live in
 * lib rather than in the route module because a route.ts file may only export
 * route handlers — importing a constant out of one is a Next.js type error.
 */

/** What showing up to family night pays each attendee. */
export const FAMILY_NIGHT_XP = 20;

/** The xp_events de-dupe key for one night. One payout per member per date. */
export function familyNightRef(night: string): string {
  return `family_night:${night}`;
}
