import styles from "./KaiDigestHeader.module.css";

/**
 * "Kai's daily alerts for you" — whose stream this is, when it was generated,
 * and how much of it is unseen.
 *
 * The count pill renders only from a real unseen count. On a first visit
 * `alert_prefs.hub_seen_at` is null, the adapter yields null, and the pill is
 * absent rather than declaring the whole stream new.
 */
export default function KaiDigestHeader({
  caption,
  newCount,
}: {
  caption: string | null;
  newCount: number | null;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.mark} aria-hidden="true">
        🐋
      </div>
      <div className={styles.copy}>
        <div className={styles.title}>Kai&rsquo;s daily alerts for you</div>
        {caption ? <div className={styles.caption}>{caption}</div> : null}
      </div>
      {newCount !== null && newCount > 0 ? (
        <span className={styles.count} data-numeric>
          {newCount} NEW
        </span>
      ) : null}
    </div>
  );
}

/** The mono day rule that opens each group ("TODAY", "YESTERDAY"). */
export function DayRule({ children }: { children: string }) {
  return <div className={styles.day}>{children}</div>;
}
