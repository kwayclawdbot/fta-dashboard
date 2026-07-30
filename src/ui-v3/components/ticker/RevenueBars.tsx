import type { CSSProperties } from "react";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import { TICKER_EMPTY, type RevenueBarVM } from "@/ui-v3/ticker-data";
import styles from "./RevenueBars.module.css";

/**
 * "REVENUE" — reported annual revenue, oldest to newest.
 *
 * The artboard's fourth bar is a hatched "FY26E" consensus estimate. Polygon
 * serves REPORTED financials on this account and no estimates feed exists, so
 * that bar is dropped rather than drawn from a number nobody published. What is
 * left is four real years, and the newest one is the lead bar — which is the
 * bar the artboard's hatching was drawing attention away from anyway.
 *
 * The "+114% YoY" figure is the real change between the last two reported
 * years, computed from the same two bars it sits above.
 */
export default function RevenueBars({
  revenue,
}: {
  revenue: { bars: RevenueBarVM[]; yoyPct: number | null } | null;
}) {
  if (!revenue) {
    return (
      <section className={styles.card}>
        <div className={styles.head}>
          <span className={styles.eyebrow}>Revenue</span>
        </div>
        <EmptyNote>{TICKER_EMPTY.revenue}</EmptyNote>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Revenue</span>
        {revenue.yoyPct !== null ? (
          <span
            className={`${styles.yoy} ${revenue.yoyPct < 0 ? styles.down : ""}`}
            data-numeric
          >
            {revenue.yoyPct >= 0 ? "+" : ""}
            {revenue.yoyPct}% YoY
          </span>
        ) : null}
      </div>

      <div className={styles.plot}>
        {revenue.bars.map((bar) => (
          <div key={bar.label} className={styles.col}>
            <span className={`${styles.amount} ${bar.lead ? styles.amountLead : ""}`} data-numeric>
              {bar.valueLabel}
            </span>
            <div
              className={`${styles.bar} ${bar.lead ? styles.barLead : ""}`}
              style={{ "--h": `${bar.pct}%` } as CSSProperties}
            />
            <span className={styles.year} data-numeric>
              {bar.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
