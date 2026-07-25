/**
 * Order-bump registry (CLIENT-SAFE — display data only; no secrets, no Stripe
 * price ids). Both the checkout summary UI and the server session builder /
 * fulfillment reference these ids. Server-only mappings (Stripe price ids,
 * Shopify variant ids) live in src/lib/server/checkout-sessions.ts and
 * src/lib/server/order-bumps.ts.
 *
 * The bumps are one-time PHYSICAL products shipped from shop.cheatcode.com. Copy
 * is honest — book value anchors only, no performance language.
 *
 * Honest anchors:
 *   • textbook       $119  (retail $197 — the adults Investing Textbook).
 *   • parents_bundle $297  (retail $494 = kids 4-book set $297 + textbook $197).
 *     Owner's spoken anchor was "$497"; the honest retail sum is $494, so we
 *     display $494. (Flagged to owner.)
 */

export type BumpId = "textbook" | "parents_bundle" | "kids_bundle";
export type BumpChoice = "none" | BumpId;
export type CheckoutFlow = "club" | "vip";

export interface BumpDisplay {
  id: BumpId;
  /** Short kicker shown on the stub. */
  kicker: string;
  title: string;
  /** One-line description of what ships. */
  blurb: string;
  /** Price charged (cents). */
  priceCents: number;
  /** Honest retail anchor (cents) shown struck-through. */
  anchorCents: number;
  /** Optional breakdown chips for the anchor (e.g. bundle math). */
  breakdown?: string;
}

export const USD = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

const TEXTBOOK: BumpDisplay = {
  id: "textbook",
  kicker: "Add the textbook",
  title: "Intro to Stocks — the printed Investing Textbook",
  blurb: "The full adults textbook, printed and shipped to your door.",
  priceCents: 11900,
  anchorCents: 19700,
};

const PARENTS_BUNDLE_CLUB: BumpDisplay = {
  id: "parents_bundle",
  kicker: "Add the parents bundle",
  title: "Parents Curriculum Bundle — teach your kids too",
  blurb:
    "The Stock Market Homeschool Curriculum (4-book set, grades 5–10) plus the adults Investing Textbook — shipped to your door.",
  priceCents: 29700,
  anchorCents: 49400,
  breakdown: "Kids 4-book set $297 + adults textbook $197",
};

// VIP already ships the adults textbook with the ticket, so its only bump is the
// kids' 4-book curriculum for the household — at $97 (normally $297).
const KIDS_BUNDLE_VIP: BumpDisplay = {
  id: "kids_bundle",
  kicker: "Add the kids' curriculum",
  title: "Stock Market Homeschool Curriculum — 4-Book Set",
  blurb:
    "Your VIP ticket already ships the adults textbook — add the kids' 4-book curriculum (grades 5–10) for the whole household.",
  priceCents: 9700,
  anchorCents: 29700,
};

/** Which bumps show, in order, for each flow. */
export function bumpsForFlow(flow: CheckoutFlow): BumpDisplay[] {
  if (flow === "vip") return [KIDS_BUNDLE_VIP];
  return [TEXTBOOK, PARENTS_BUNDLE_CLUB];
}

/** Base charged-today amount per flow (cents), before any bump. */
export const BASE_TODAY_CENTS: Record<CheckoutFlow, number> = {
  club: 9900, // $99/mo, charged immediately (no trial)
  vip: 19700, // $197 ticket today; the $99/mo Club is trialed (0 today)
};

/** Any physical bump requires a shipping address. */
export function bumpNeedsShipping(bump: BumpChoice): boolean {
  return bump === "textbook" || bump === "parents_bundle";
}
