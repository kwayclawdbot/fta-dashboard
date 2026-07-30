import Link from "next/link";
import type { AlertDigestVM } from "@/ui-v3/watch-data";
import styles from "./AlertDigestRow.module.css";

const KIND_CLASS = {
  buy: styles.buy,
  sell: styles.sell,
  headsup: styles.headsup,
} as const;

/**
 * A previous day's alert. The trailing figure is the observational
 * follow-through (what the stock did since it fired) — a factual readout that
 * the data layer explicitly refuses to grade as a win or a loss, so this row
 * shows the move and nothing else. Absent follow-through renders as the status
 * alone.
 */
export default function AlertDigestRow({ alert }: { alert: AlertDigestVM }) {
  const inner = (
    <>
      <span className={`${styles.kind} ${KIND_CLASS[alert.kind]}`}>{alert.kindLabel}</span>
      <span className={styles.ticker}>{alert.ticker}</span>
      <span className={styles.text}>
        {alert.status}
        {alert.sincePct !== null ? (
          <>
            {" · "}
            <span
              className={`${styles.since} ${alert.sincePct >= 0 ? styles.up : styles.down}`}
              data-numeric
            >
              {alert.sincePct >= 0 ? "+" : ""}
              {alert.sincePct.toFixed(1)}% since
            </span>
          </>
        ) : null}
      </span>
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </>
  );

  return alert.href ? (
    <Link href={alert.href} className={styles.row}>
      {inner}
    </Link>
  ) : (
    <div className={styles.row}>{inner}</div>
  );
}
