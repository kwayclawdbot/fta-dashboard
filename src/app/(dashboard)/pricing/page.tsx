export const dynamic = "force-dynamic";

import { ArrowRight } from "lucide-react";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";
import PricingMatrix from "@/components/entitlements/PricingMatrix";
import { TextAction } from "@/components/f0/parts";
import { BoardSection } from "@/components/clubhome/board";
import ModeSwap from "@/components/ModeSwap";
import { redirectKids } from "@/lib/server/viewer-register";

/**
 * /pricing — the canonical three-tier pricing surface (MONETIZATION-GATES.md).
 * Cheat Code Free / Cheat Code Club $99 / FTA, matrix-driven from the single
 * source of truth (src/lib/entitlements). Copy philosophy: free = participate in
 * the network; Club = unlock the intelligence. It MUST match the in-app walls —
 * it does, because both read PRICING_MATRIX / FEATURE_ACCESS.
 *
 * REBUILD NOTE (board 01 + the board-r1c1 pricing card): every price, plan name,
 * entitlement description and disclaimer below is preserved VERBATIM across both
 * rebuilds. Only the container changed. The interim hairline-ledger revision is
 * gone; the tiers are now the board's white `club-b-card` objects on paper, the
 * recommended tier carrying the board's orange edge (`club-b-card-lead`) and a
 * hung orange pill, exactly as the board draws its BEST VALUE plan. Section
 * marks are `BoardSection` tracked mono caps, not rules.
 */

const FTA_URL = "/upgrade"; // FTA is a separate advanced upgrade (its own page).

function Tier({
  name,
  price,
  per,
  body,
  action,
  featured,
}: {
  name: string;
  price: string;
  per?: string;
  body: string;
  action?: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div
      className={`relative p-5 sm:p-6 ${
        featured ? "club-b-card club-b-card-lead" : "club-b-card"
      }`}
    >
      {/* The board hangs its BEST VALUE pill half off the card's top edge. */}
      {featured && (
        <p className="absolute -top-2.5 right-5 rounded-full bg-accent px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-on)]">
          Recommended
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <p
            className={`font-display font-extrabold ${
              featured
                ? "text-display-3 text-accent"
                : "text-[19px] leading-tight text-ink"
            }`}
          >
            {name}
          </p>
        </div>
        <p
          className={`font-display font-extrabold tabular-nums text-ink ${
            featured ? "text-display-2" : "text-display-3"
          }`}
        >
          {price}
          {per && (
            <span className="ml-0.5 font-body text-base font-medium text-soft">
              {per}
            </span>
          )}
        </p>
      </div>
      <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-soft">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default async function PricingPage() {
  // Price tags are a parent's business. The nav has never shown this to a kid,
  // but hiding a row is not a gate — a typed URL or a stale link walked a child
  // straight onto the $99/$2,997 checkout surface. Same server-side redirect
  // /screener uses.
  await redirectKids();

  /* CLUB TERMINAL SKIN (.planning/CLUB-TERMINAL-STYLE.md, 2026-08-09): this is
     a SERVER page, so the mode branch rides <ModeSwap/> — both subtrees are
     built here with the commercial copy byte-identical; only the chrome
     (mono eyebrow, white-caps section labels) differs. Checkout URL, matrix,
     kid redirect and the family render are untouched. */
  const tiers = (
    <div className="mt-4 space-y-4">
      <Tier
        name="Cheat Code Free"
        price="$0"
        body="Participate in the network. Community, starter lessons, a taste of Kai and research."
      />
      <Tier
        featured
        name="Cheat Code Club"
        price="$99"
        per="/mo"
        body="Unlock the intelligence — Kai Watch, Club Intelligence, unlimited research, and the whole household included."
        action={
          <a
            href={FIC_CHECKOUT_URL}
            className="f0-focus f0-press inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 font-display text-sm font-bold tracking-[0.02em] text-[color:var(--accent-on)]"
          >
            Join the Club <ArrowRight className="h-4 w-4" />
          </a>
        }
      />
      <Tier
        name="FTA"
        price="Advanced"
        body="The trade-ready academy — a 6-week live trading program on top of your Club membership."
        action={
          <TextAction href={FTA_URL}>
            Explore FTA <ArrowRight className="h-4 w-4" />
          </TextAction>
        }
      />
    </div>
  );

  const matrix = (
    <div className="mt-4">
      <PricingMatrix />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 pb-16">
      {/* Hand-composed masthead (not DisplayHead) for ONE reason: the canvas's
          signature emphasis is a drawn underline under a single word, and
          DisplayHead takes a plain string. The words are byte-identical to the
          previous revision — only the mark on "intelligence" is new. */}
      <header>
        <ModeSwap
          club={
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-soft">
              Membership
            </p>
          }
          family={
            <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
              Membership
            </p>
          }
        />
        <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase text-ink">
          Participate free. Unlock the{" "}
          <span className="f0-underline-mark">intelligence</span>.
        </h1>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-soft">
          The whole community is free — read, post, vote, and shape what the
          Club is watching. Cheat Code Club adds the layer on top:
          interpretation, personalization, monitoring, and Kai working for you.
        </p>
      </header>

      {/* The three tiers — white board cards on paper, lead card carrying the
          edge. Club: the same cards under the law's white-caps section label
          (the cards themselves already ride --card/--sand). */}
      <div className="mt-10">
        <ModeSwap
          club={
            <section aria-labelledby="pricing-doors">
              <h2
                id="pricing-doors"
                className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink"
              >
                The three doors
              </h2>
              {tiers}
            </section>
          }
          family={
            <BoardSection label="The three" mark="doors" id="pricing-doors">
              {tiers}
            </BoardSection>
          }
        />
      </div>

      {/* The binding matrix */}
      <div className="mt-12">
        <ModeSwap
          club={
            <section aria-labelledby="pricing-matrix">
              <h2
                id="pricing-matrix"
                className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink"
              >
                Compare every feature
              </h2>
              {matrix}
            </section>
          }
          family={
            <BoardSection label="Compare every" mark="feature" id="pricing-matrix">
              {matrix}
            </BoardSection>
          }
        />
      </div>

      <p className="f0-rule-top mt-10 max-w-[62ch] pt-5 text-xs leading-relaxed text-soft">
        Cheat Code measures and interprets community attention — it is education,
        never financial advice. One Club membership covers your entire household.
      </p>
    </div>
  );
}
