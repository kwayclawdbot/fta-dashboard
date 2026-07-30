import Link from "next/link";
import type { AlertCardVM } from "@/ui-v3/watch-data";
import styles from "./AlertCard.module.css";

/**
 * One Kai alert, in the three kinds the artboard draws (buy / sell / heads-up).
 *
 * The body is a segment list rather than a formatted string: the adapter builds
 * the sentence out of the alert's real narrative and its real levels, and marks
 * which runs are entry / invalidation / a figure so this component can set them
 * in mono without parsing prose.
 *
 * Evidence chips, and the action pair, are omitted when the alert carries none
 * — the heads-up card in the artboard is exactly that case.
 */
const KIND_CLASS = {
  buy: styles.buy,
  sell: styles.sell,
  headsup: styles.headsup,
} as const;

export default function AlertCard({ alert }: { alert: AlertCardVM }) {
  return (
    <article className={`${styles.card} ${KIND_CLASS[alert.kind]}`}>
      <div className={styles.head}>
        <span className={styles.kind}>{alert.kindLabel}</span>
        <span className={styles.ticker}>{alert.ticker}</span>
        {alert.time ? (
          <span className={styles.time} data-numeric>
            {alert.time}
          </span>
        ) : null}
      </div>

      <p className={styles.copy}>
        {alert.body.map((segment, i) =>
          segment.tone ? (
            <span key={i} className={styles[segment.tone]} data-numeric>
              {segment.text}
            </span>
          ) : (
            <span key={i}>{segment.text}</span>
          )
        )}
      </p>

      {alert.chips.length > 0 ? (
        <div className={styles.chips}>
          {alert.chips.map((chip) => (
            <span key={chip} className={styles.chip}>
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {alert.primary || alert.secondary ? (
        <div className={styles.actions}>
          {alert.primary ? (
            <Link href={alert.primary.href} className={styles.primary}>
              {alert.primary.label}
            </Link>
          ) : null}
          {alert.secondary ? (
            <Link href={alert.secondary.href} className={styles.secondary}>
              {alert.secondary.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
