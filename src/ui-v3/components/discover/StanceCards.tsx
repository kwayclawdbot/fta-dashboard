import type { StanceRowVM } from "@/ui-v3/discover-data";
import styles from "./StanceCards.module.css";

/**
 * "CLUB'S MOST BULLISH" / "CLUB'S MOST BEARISH" — two flat cards side by side.
 *
 * These are the only containers on either Discover artboard whose border is
 * tinted rather than neutral: a dark green and a dark rose that exist in the
 * mockups for these two cards alone. They are declared in the module, scoped to
 * the theme, exactly as GradientPanel keeps its washes.
 */
export default function StanceCards({
  bullish,
  bearish,
}: {
  bullish: StanceRowVM[];
  bearish: StanceRowVM[];
}) {
  if (bullish.length === 0 && bearish.length === 0) return null;

  return (
    <div className={styles.row}>
      <StanceCard title="Club's most bullish" rows={bullish} tone="bull" />
      <StanceCard title="Club's most bearish" rows={bearish} tone="bear" />
    </div>
  );
}

function StanceCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: StanceRowVM[];
  tone: "bull" | "bear";
}) {
  return (
    <div className={`${styles.card} ${styles[tone]}`}>
      <div className={styles.title}>{title}</div>
      <div className={styles.list}>
        {rows.map((row) => (
          <div key={row.ticker} className={styles.item}>
            <span className={styles.ticker}>{row.ticker}</span>
            <span className={styles.pct} data-numeric>
              {row.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
