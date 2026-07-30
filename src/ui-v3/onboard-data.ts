import "server-only";

import { getRequestClient, getRequestProfile, getRequestUser } from "@/lib/supabase/rsc";
import { BASE_TODAY_CENTS } from "@/lib/checkout-bumps";
import { PRICING_MATRIX, WATCHLIST_FREE_ACTIVE } from "@/lib/entitlements/features";

/**
 * ui-v3 Onboarding — the ONLY data access the four onboarding screens perform.
 *
 * Same contract as `home-data.ts` and `watch-data.ts`: everything under
 * `src/ui-v3/components/onboard` is pure presentation and receives a view model.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE THESE SCREENS DEPART FROM THEIR ARTBOARDS, AND WHY
 *
 * Boards 09/10/11 were drawn as a design story, and three of the things they
 * draw do not exist in this product. The grammar's rule 9.5 ("never fill a hole
 * with a fabricated metric") governs, so the artboards' FORM is translated
 * verbatim and their FICTIONAL CONTENT is replaced with the real thing or
 * omitted. Every departure is listed here and in the component that makes it.
 *
 *  1. PRICE. Board 11 prints "$99/yr", a "$8.25/mo" equivalent, and an
 *     "Annual −33% / Monthly" toggle. There is exactly ONE Club price and it is
 *     $99 PER MONTH (`BASE_TODAY_CENTS.club`, and CLUB_MONTHLY_PRICE in
 *     src/lib/server/checkout-sessions.ts). No annual price exists in Stripe, so
 *     the toggle has nothing to toggle and is not drawn.
 *
 *  2. TRIAL. Board 11's CTA is "Start 7-day free trial" and its footnote is
 *     "Billed $99 after trial". `createClubCheckoutSession()` sets NO
 *     `trial_period_days` — the Club charges immediately. The CTA says what the
 *     button does.
 *
 *  3. FEATURE COPY. Board 11's bullets are invented marketing lines. The real
 *     tier split is `PRICING_MATRIX` in src/lib/entitlements/features.ts, which
 *     is the SAME source the server-side `can()` gate reads — so the pricing
 *     card and the paywall can never drift apart. The bullets below are matrix
 *     rows, verbatim.
 *
 *  4. SOCIAL PROOF. "25,842 members", "4.8 · 12K ratings" and the "DK"
 *     testimonial have no source anywhere in this codebase. They are omitted
 *     rather than approximated. (The old login page rejected the same member
 *     count for the same reason — see src/app/(auth)/login/page.tsx.)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ── view model: 11 Pricing ───────────────────────────────────────────────── */

export interface PlanVM {
  name: string;
  tagline: string;
  /** "$99" — already formatted, because the interval is rendered beside it. */
  price: string;
  /** "/mo", or null for the free plan whose price line is the word "Free". */
  interval: string | null;
  /** Real `PRICING_MATRIX` rows, rendered as the artboard's check list. */
  features: string[];
}

export interface PricingVM {
  paid: PlanVM;
  free: PlanVM;
  /** The artboard's pinned CTA. Wired to the real checkout entry point. */
  ctaLabel: string;
  ctaHref: string;
  /** The line under the CTA. States the real billing terms. */
  ctaFootnote: string;
  /** Where ✕ goes: back into the app for a member, back to sign-in otherwise. */
  closeHref: string;
}

/**
 * The five matrix surfaces the paid card leads with, and the three the free card
 * does. Chosen for being the rows where the two columns differ MOST — a bullet
 * that reads the same on both plans tells a visitor nothing — and named by
 * `surface` so the copy itself always comes from the matrix.
 */
const PAID_ROWS = [
  "Kai Watch / custom AI alerts",
  "Watchlist",
  "Kai Brief — what changed since you left",
  "Live Club sessions",
  "Club Score",
];
const FREE_ROWS = ["Community feed", "Watchlist", "Research reads"];

/** "Watchlist — Unlimited + Intelligent Watchlist" from the matrix row. */
function bullet(surface: string, column: "free" | "club"): string | null {
  const row = PRICING_MATRIX.find((r) => r.surface === surface);
  if (!row) return null;
  const cell = row[column];
  // "✓" and "—" are matrix shorthand for included / not included. A bullet that
  // renders as a bare tick says nothing, so the surface name carries it.
  if (!cell || cell === "—") return null;
  return cell === "✓" ? row.surface : `${row.surface} — ${cell}`;
}

function bullets(surfaces: string[], column: "free" | "club"): string[] {
  return surfaces.map((s) => bullet(s, column)).filter((v): v is string => v !== null);
}

/** 9900 → "$99". Whole dollars only; the Club has never had a cents price. */
function dollars(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/**
 * Build the pricing view model.
 *
 * Nothing here is member-specific except where ✕ goes, so this renders
 * identically for a visitor and a signed-in member — which is what makes the
 * artboard side-by-side possible with no credentials.
 */
export async function getPricingViewModel(): Promise<PricingVM> {
  const user = await getRequestUser();
  const price = dollars(BASE_TODAY_CENTS.club);

  return {
    paid: {
      // The product is "Cheat Code Club" everywhere else in the codebase
      // (entitlements, checkout metadata, the emails). Board 11's "Club Pro" is
      // a tier that does not exist.
      name: "Cheat Code Club",
      tagline: "Everything. Every signal.",
      price,
      interval: "/mo",
      features: bullets(PAID_ROWS, "club"),
    },
    free: {
      name: "Cheat Code Free",
      tagline: "Run with the Club",
      price: "Free",
      interval: null,
      features: bullets(FREE_ROWS, "free"),
    },
    // POST /api/club/checkout is the authed in-app upgrade and returns JSON;
    // GET is the stable public entry point that redirects into the branded
    // checkout page. A link wants the GET, with this screen as its attribution.
    ctaLabel: "Join the Club",
    ctaHref: "/api/club/checkout?src=v3_pricing",
    // No trial exists, so the footnote states the charge that actually happens.
    ctaFootnote: `Cancel anytime · ${price}/mo, billed today`,
    closeHref: user ? "/v3" : "/v3/login",
  };
}

/* ── view model: the watchlist seeding step ───────────────────────────────── */

export interface SeedPickVM {
  ticker: string;
  name: string;
}

export interface PicksVM {
  /** Null when the member has no family row — seeding cannot write without one. */
  familyId: string | null;
  /** Written to `champion_id`, exactly as the three existing add flows do. */
  userId: string;
  /** Tickers already on the family watchlist, uppercased. Never re-added. */
  existing: string[];
  /**
   * How many more this family may add before the free cap bites, or null when
   * they are on a paid tier and there is no cap. The DB trigger
   * `enforce_free_watchlist_cap` is the real limit; this only lets the screen
   * say so before the insert fails.
   */
  remaining: number | null;
  /** The step asks for three. */
  target: number;
}

/** The seeding step asks for three names — enough to make Home mean something. */
export const SEED_TARGET = 3;

/**
 * Build the seeding step's view model.
 *
 * Returns null when there is no session: the step is only reachable signed in
 * (the route redirects), and unlike the other v3 screens there is no honest
 * fixture for "your watchlist" — a fixture here would be a list the visitor
 * cannot actually save.
 */
export async function getPicksViewModel(): Promise<PicksVM | null> {
  const user = await getRequestUser();
  if (!user) return null;

  const [supabase, profile] = await Promise.all([getRequestClient(), getRequestProfile()]);
  const familyId = profile?.family_id ?? null;
  if (!familyId) {
    return {
      familyId: null,
      userId: user.id,
      existing: [],
      remaining: null,
      target: SEED_TARGET,
    };
  }

  const [rows, isFree] = await Promise.all([
    supabase
      .from("family_watchlist")
      .select("ticker")
      .eq("family_id", familyId)
      .then(({ data }) => (data ?? []) as { ticker: string | null }[])
      .then((d) => d.map((r) => (r.ticker ?? "").toUpperCase()).filter(Boolean)),
    // The same question the cap trigger asks. A missing tier row means free —
    // it fails closed there, so it fails closed here too.
    supabase
      .rpc("family_is_free", { p_family_id: familyId })
      .then(({ data, error }) => (error ? true : data !== false)),
  ]);

  return {
    familyId,
    userId: user.id,
    existing: rows,
    remaining: isFree ? Math.max(0, WATCHLIST_FREE_ACTIVE - rows.length) : null,
    target: SEED_TARGET,
  };
}

/**
 * Has this member already got a watchlist?
 *
 * The flow only shows the seeding step to someone whose watchlist is EMPTY —
 * a returning member does not get asked to pick three names they already have.
 */
export async function hasSeededWatchlist(): Promise<boolean> {
  const model = await getPicksViewModel();
  return (model?.existing.length ?? 0) > 0;
}
