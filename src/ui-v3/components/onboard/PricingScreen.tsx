import Link from "next/link";
import type { PlanVM, PricingVM } from "@/ui-v3/onboard-data";
import AppShell from "@/ui-v3/components/AppShell";
import GradientPanel from "@/ui-v3/components/GradientPanel";
import { PillLink } from "./PillButton";
import styles from "./PricingScreen.module.css";

/**
 * "11 Pricing", translated from the artboard.
 *
 * The FORM is the board's: the ✕ row, the script headline, the accent-bordered
 * paid card with its BEST VALUE tab and tick list, the flat free card beneath
 * it, and the pinned CTA over its footnote.
 *
 * The CONTENT is this product's, because four of the board's are fiction —
 * "$99/yr" (the price is $99/mo), the Annual/Monthly toggle (only one price
 * exists), the 7-day trial (the Club charges immediately), and the invented
 * social proof. onboard-data.ts records each one and where the real value comes
 * from; the feature bullets are `PRICING_MATRIX` rows, the same source the
 * server-side `can()` gate reads.
 *
 * The board's ratings tile, member-count tile and "DK" testimonial are not
 * drawn: no source exists for any of them. Only "Cancel anytime" survived that
 * row, and one lone tile is not a row — it is said in the CTA footnote instead.
 */
export default function PricingScreen({ model }: { model: PricingVM }) {
  return (
    <AppShell
      nav={false}
      padding="bleed"
      bar={
        <div className={styles.barStack}>
          <PillLink href={model.ctaHref} size="bar">
            {model.ctaLabel}
          </PillLink>
          <p className={styles.footnote}>{model.ctaFootnote}</p>
        </div>
      }
    >
      <div className={styles.well}>
        <div className={styles.topRow}>
          <Link href={model.closeHref} className={styles.close} aria-label="Close">
            ✕
          </Link>
        </div>

        <h1 className={styles.headline}>go pro</h1>
        <p className={styles.subtitle}>Unlock the full signal. Keep your edge.</p>

        <GradientPanel tone="pro" className={styles.paid}>
          <span className={styles.badge}>BEST VALUE</span>
          <PlanHead plan={model.paid} priceSize="lg" />
          <FeatureList features={model.paid.features} tone="accent" />
        </GradientPanel>

        <div className={styles.free}>
          <PlanHead plan={model.free} priceSize="sm" />
          <FeatureList features={model.free.features} tone="muted" />
        </div>
      </div>
    </AppShell>
  );
}

/** Name + tagline on the left, price on the right — both cards, same row. */
function PlanHead({ plan, priceSize }: { plan: PlanVM; priceSize: "lg" | "sm" }) {
  return (
    <div className={styles.planHead}>
      <div>
        <div className={priceSize === "lg" ? styles.planName : styles.planNameSm}>
          {plan.name}
        </div>
        <div className={priceSize === "lg" ? styles.planTag : styles.planTagSm}>
          {plan.tagline}
        </div>
      </div>
      <div
        className={priceSize === "lg" ? styles.price : styles.priceSm}
        data-numeric
      >
        {plan.price}
        {plan.interval ? <span className={styles.interval}>{plan.interval}</span> : null}
      </div>
    </div>
  );
}

/** The board's tick list: a filled disc holding a ✓, then the line. */
function FeatureList({
  features,
  tone,
}: {
  features: string[];
  tone: "accent" | "muted";
}) {
  return (
    <ul className={`${styles.features} ${tone === "muted" ? styles.featuresMuted : ""}`}>
      {features.map((f) => (
        <li key={f} className={styles.feature}>
          <span className={styles.check} aria-hidden="true">
            ✓
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}
