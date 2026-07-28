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
 * The free tier is NOT a fourth reason. /kai used to be members-gated outright,
 * so a FAB for a free member was a button that only bounced; it is now a METERED
 * free surface (KAI_CHAT_DAILY_CAP.free questions a day, enforced server-side in
 * the chat route). A free member who taps the FAB lands on a working Kai and
 * spends a question, so the button leads somewhere and stays.
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
 *
 * `_tier` is retained for call-site compatibility (and because a future tier may
 * yet want its own corner); route is now the only thing that decides.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function showsKaiFab(pathname: string, _tier: string | undefined): boolean {
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

/* ══════════════════════════════════════════════════════════════════════════
   THE RESERVE, MEASURED HONESTLY.

   The class pair above is correct arithmetic against the BUTTON and wrong
   arithmetic against the FAB. The FAB is not a 3.5rem circle: it carries a 4px
   paper ring outside its border box, and the tuck control overhangs its top-left
   corner by another 8px. So the real footprint is 3.5rem + 12px, and a reserve
   built from 3.5rem leaves the last row of a board sitting under the ring with
   about 4px to spare — which is why Home, Discover and Family still read as
   covered after a reserve was added. They are the three surfaces whose page root
   is a narrow centred column of rows with values set flush right (ClubHomeV2 and
   DiscoverClient at max-w-2xl, FamilySurface at max-w-3xl), so 4px of clearance
   is the difference between a clean board and a number with a disc on it.

   WHY A CUSTOM PROPERTY AND AN INLINE STYLE, AND NOT ANOTHER CLASS. The three
   surfaces above each set their own bottom padding on their own root, and one
   of them (Family) is owned by another lane entirely. A variable stamped on
   <main> by the shell reaches all three without any of them being edited, and an
   inline padding cannot be undercut by class order or by a page that decides to
   own its own spacing. This is the ONLY place the number lives; the classes
   above stay exported for callers that still want the utility form.

   Kept in step with the button's own offsets in FloatingKaiButton — the two are
   one measurement, and they drifted apart once already.
   ══════════════════════════════════════════════════════════════════════════ */

/** Tab bar (4rem) + the gap the FAB floats above it. Phones only. */
const TAB_BAR = "4rem";
/** Button 3.5rem + 4px ring + 8px tuck-control overhang + 1rem to breathe. */
const FAB_FOOTPRINT = "5.25rem";
/** The FAB's own gap above the tab bar (phones) / the page edge (desktop). */
const FAB_GAP_PHONE = "0.75rem";
const FAB_GAP_DESKTOP = "1.5rem";

/**
 * The bottom room `<main>` must hold open, as a CSS length.
 *
 * Returned as a pair because the phone value has to clear the tab bar and the
 * desktop value must not (there is no tab bar there, and 9rem of dead space at
 * the foot of a desktop board is its own kind of broken).
 */
export function fabReserve(showsFab: boolean): { phone: string; desktop: string } {
  if (!showsFab) {
    return {
      phone: `calc(${TAB_BAR} + 0.5rem + env(safe-area-inset-bottom))`,
      desktop: "1.5rem",
    };
  }
  return {
    phone: `calc(${TAB_BAR} + ${FAB_GAP_PHONE} + ${FAB_FOOTPRINT} + env(safe-area-inset-bottom))`,
    desktop: `calc(${FAB_GAP_DESKTOP} + ${FAB_FOOTPRINT})`,
  };
}
