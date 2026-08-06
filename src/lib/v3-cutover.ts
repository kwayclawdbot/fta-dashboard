import type { NextRequest } from "next/server";

/**
 * THE V3 CUTOVER HARNESS.
 *
 * v3 is a strangler rebuild: it grew beside the old app under /v3/* and has
 * been reviewable there the whole time. This is the switch that puts it in
 * front of the OLD urls — /discover serving the v3 screen instead of the old
 * one — without deleting a single old route.
 *
 * It is a REWRITE, never a redirect. The url in the address bar stays the old
 * one, so nothing about a member's bookmarks, links, or the auth callback
 * changes; only the tree that answers does. Flip the switch off and the old
 * screens answer again on the very next request, with no deploy.
 *
 * DEFAULT OFF. Every mechanism below has to be turned on deliberately, so a
 * production deploy of this branch changes nothing until someone opts in.
 *
 * /v3/* stays directly reachable either way — this only adds a second door to
 * those screens, it never closes the first one.
 */

/** Cookie the ?v3= switch writes. Present so a reviewer can flip the harness on
 *  a deployment whose env they cannot edit — and, just as importantly, flip it
 *  back OFF to compare against the old screen on the same url. */
export const CUTOVER_COOKIE = "v3_cutover";

/** The query switch: ?v3=1 turns it on, ?v3=0 turns it off, both sticky. */
export const CUTOVER_QUERY = "v3";

/**
 * THE STAGED WAVE — exactly the screens the owner cleared for cutover
 * (2026-08-05).
 *
 * The Club feed routes (04/16/23 + compose) are deliberately NOT here: their
 * drift against main is still being reconciled, and shipping them behind the
 * same switch would mean the switch could not be turned on until that lands.
 * Keeping the wave small is what makes it flippable.
 */
const EXACT_ROUTES: Record<string, string> = {
  "/": "/v3",
  "/discover": "/v3/discover",
  "/discover/screener": "/v3/discover/screener",
  "/you": "/v3/you",
  "/you/belts": "/v3/you/belts",
  "/welcome": "/v3/welcome",
  "/login": "/v3/login",
  "/pricing": "/v3/pricing",
};

/**
 * The ticker screen and its three tabs. A symbol is letters and dots only
 * (BRK.B), which also keeps this from matching a deeper path we never staged.
 */
const TICKER_ROUTE = /^\/ticker\/([A-Za-z.]{1,10})(\/(?:technicals|fundamentals|kai))?$/;

/**
 * The v3 path that should answer this old path, or null to leave it alone.
 *
 * Pure and total: it looks at a pathname and nothing else. Whether the harness
 * is ON is a separate question (`isCutoverEnabled`) so that the two can be
 * reasoned about — and tested — independently.
 */
export function resolveV3Rewrite(pathname: string): string | null {
  // Never re-enter. /v3/* is already the destination; rewriting it would loop.
  if (pathname === "/v3" || pathname.startsWith("/v3/")) return null;

  const exact = EXACT_ROUTES[pathname];
  if (exact) return exact;

  const ticker = TICKER_ROUTE.exec(pathname);
  if (ticker) return `/v3/ticker/${ticker[1].toUpperCase()}${ticker[2] ?? ""}`;

  return null;
}

/**
 * Is the harness on for THIS request?
 *
 * Precedence is most-explicit-wins:
 *   1. ?v3=1 / ?v3=0  — what the reviewer just asked for, this request
 *   2. the cookie      — what the reviewer asked for earlier, still standing
 *   3. NEXT_PUBLIC_V3_CUTOVER — what the deployment was built to do
 *
 * The env var is last on purpose: a preview built with the flag ON must still
 * be comparable against the old screens, and ?v3=0 is how that happens.
 */
export function isCutoverEnabled(request: NextRequest): boolean {
  const q = request.nextUrl.searchParams.get(CUTOVER_QUERY);
  if (q === "1") return true;
  if (q === "0") return false;

  const cookie = request.cookies.get(CUTOVER_COOKIE)?.value;
  if (cookie === "1") return true;
  if (cookie === "0") return false;

  return process.env.NEXT_PUBLIC_V3_CUTOVER?.trim() === "1";
}

/**
 * The value ?v3= asked to persist, or null when it said nothing. The caller
 * writes this onto the response so the choice survives the next navigation —
 * without it the reviewer would have to append ?v3=1 to every link they tap.
 */
export function cutoverCookieWrite(request: NextRequest): "1" | "0" | null {
  const q = request.nextUrl.searchParams.get(CUTOVER_QUERY);
  return q === "1" ? "1" : q === "0" ? "0" : null;
}
