/**
 * THE SINGLE-FAB RULE.
 *
 * One floating action button per screen, ever. The Kai FAB is the app's default
 * occupant of the bottom-right corner; this module is the one place that decides
 * when it stands down, so the shell (which must reserve scroll room for it) and
 * the button itself (which must render it) can never disagree.
 *
 * WHAT WENT WRONG WITHOUT IT: the FAB drew on ~22 of 32 routes with no knowledge
 * of what was underneath, so it sat on top of rows, toggles and primary CTAs; on
 * /chart it shared the corner with the Club Chat launcher and the two buttons
 * stacked into each other; and on /kai it was a shortcut to the page you were
 * already standing on.
 *
 * Three reasons to stand down, and only three:
 *
 *   1. THE SURFACE OWNS THE CORNER. /community and /chart float their own Club
 *      Chat launcher, and /alerts/e/<id> pins a full-width action bar to the
 *      bottom. The surface's own affordance is the more specific one, so it
 *      wins. Kai is still one tap away on those screens through ⌘K / the search
 *      row's "Ask Kai", so nothing is lost.
 *   2. YOU ARE ALREADY THERE. /kai is the full Kai view.
 *   3. THE SCREEN IS A FLOW, NOT A PLACE. A composer or a checkout is a single
 *      task with its own primary action at the bottom; a second floating button
 *      over it is noise at best and a mis-tap at worst.
 *
 * Free tier is excluded everywhere — /kai is members-gated server-side, so a FAB
 * there would only bounce.
 */

/** The surface floats its own bottom-right affordance. */
const SURFACE_OWNS_CORNER = [
  "/community", // Club Chat launcher (covers /community/compose, /changed-my-mind)
  "/chart", // Club Chat launcher
  "/alerts/e", // pinned bottom action bar (DetailActions)
];

/** A single-task flow with its own bottom-anchored primary action. */
const FULL_SCREEN_FLOW = [
  "/checkout",
  "/challenge",
  "/onboarding",
  "/free-class",
];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Should the global Kai FAB render on this route?
 *
 * Kept free of React so the shell can call it during render to decide how much
 * bottom room the scroll container has to reserve — the FAB is the reason the
 * last row of a list was unreachable on a phone.
 */
export function showsKaiFab(pathname: string, tier: string | undefined): boolean {
  if ((tier ?? "fic") === "free") return false;
  if (pathname === "/kai" || pathname.startsWith("/kai/")) return false;
  if (matches(pathname, SURFACE_OWNS_CORNER)) return false;
  if (matches(pathname, FULL_SCREEN_FLOW)) return false;
  return true;
}

/**
 * Bottom padding `<main>` must carry so nothing ends up parked under the FAB.
 *
 * Phones: 4rem tab bar + 0.75rem gap + 3.5rem button + 1rem breathing room, on
 * top of the iOS safe area. Desktop: the FAB drops to bottom-6 and there is no
 * tab bar, so 1.5rem + 3.5rem + a little.
 *
 * Kept beside `showsKaiFab` on purpose — the offsets in FloatingKaiButton and
 * the room reserved here are one measurement, and they drifted apart once
 * already (the shell reserved 4.5rem for a button whose footprint ended at
 * 8.5rem, which is precisely why the FAB covered the last row on ~22 routes).
 */
export const MAIN_PADDING_WITH_FAB =
  "pb-[calc(9.25rem+env(safe-area-inset-bottom))] md:pb-24";

/** No FAB — only the mobile tab bar has to be cleared. */
export const MAIN_PADDING_NO_FAB =
  "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6";
