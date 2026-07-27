export const dynamic = "force-dynamic";

import { ArrowRight } from "lucide-react";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";
import PricingMatrix from "@/components/entitlements/PricingMatrix";
import { DisplayHead, SectionRule, TextAction } from "@/components/f0/parts";

/**
 * /pricing — the canonical three-tier pricing surface (MONETIZATION-GATES.md).
 * Cheat Code Free / Cheat Code Club $99 / FTA, matrix-driven from the single
 * source of truth (src/lib/entitlements). Copy philosophy: free = participate in
 * the network; Club = unlock the intelligence. It MUST match the in-app walls —
 * it does, because both read PRICING_MATRIX / FEATURE_ACCESS.
 *
 * REBUILD NOTE (canvas): every price, plan name, entitlement description and
 * disclaimer below is preserved VERBATIM from the previous revision. The card
 * grid was the only thing that changed — the three tiers are now a hairline
 * ledger where the recommended tier is carried by TYPE and COLOUR (a brand rule,
 * a gold plan name, a display-2 price) rather than by a taller, ringed box.
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
      className={`py-6 ${
        featured ? "border-l-[3px] border-gold-500 pl-4 sm:pl-5" : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          {featured && (
            <p className="mb-1.5 text-eyebrow font-display font-bold uppercase text-gold-700">
              Recommended
            </p>
          )}
          <p
            className={`font-display font-extrabold ${
              featured
                ? "text-display-3 text-gold-700"
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

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 pb-16">
      <DisplayHead
        eyebrow="Membership"
        title="Participate free. Unlock the intelligence."
        lede="The whole community is free — read, post, vote, and shape what the Club is watching. Cheat Code Club adds the layer on top: interpretation, personalization, monitoring, and Kai working for you."
      />

      {/* The three tiers — a ledger, not a card tower. */}
      <section className="mt-10">
        <SectionRule>The three doors</SectionRule>
        <div className="f0-ledger mt-1">
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
                className="cta-button inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm"
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
      </section>

      {/* The binding matrix */}
      <section className="mt-12">
        <SectionRule>Compare every feature</SectionRule>
        <div className="mt-4">
          <PricingMatrix />
        </div>
      </section>

      <p className="f0-rule-top mt-10 max-w-[62ch] pt-5 text-xs leading-relaxed text-soft">
        Cheat Code measures and interprets community attention — it is education,
        never financial advice. One Club membership covers your entire household.
      </p>
    </div>
  );
}
