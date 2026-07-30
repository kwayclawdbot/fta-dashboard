import Link from "next/link";
import styles from "./TopBarV3.module.css";

/**
 * The Home top bar: brand mark + wordmark on the left, bell and avatar chip on
 * the right. Translated verbatim from the "01 Home" artboard.
 *
 * THE BELL IS THE WAY INTO THE ALERT STREAM. It was a `<div>` — a drawn bell
 * over a badge with no source — which made the one control on Home that looks
 * like a notification centre the one control that did nothing. It is now the
 * link to /v3/watch/alerts, which is the screen that stream lives on.
 *
 * The badge is the REAL unseen count: alert events fired since this member's
 * `alert_prefs.hub_seen_at` watermark, computed in home-data.ts. It stays absent
 * on a first visit, because a member who has never opened the hub is owed an
 * introduction, not a pile of unread mail — and absent for anonymous visitors,
 * who have no stream at all.
 */
export default function TopBarV3({
  initials,
  notificationCount,
}: {
  initials: string;
  notificationCount: number | null;
}) {
  const unseen = notificationCount !== null && notificationCount > 0;
  return (
    <div className={styles.bar}>
      <div className={styles.brand}>
        <div className={styles.mark}>
          <div className={styles.markGlyph} />
        </div>
        <span className={styles.wordmark}>
          Cheat Code <span className={styles.wordmarkClub}>Club</span>
        </span>
      </div>

      <div className={styles.actions}>
        <Link
          href="/v3/watch/alerts"
          className={styles.bell}
          aria-label={unseen ? `Alerts — ${notificationCount} new` : "Alerts"}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          {unseen ? (
            <span className={styles.bellBadge} data-numeric>
              {notificationCount}
            </span>
          ) : null}
        </Link>
        {initials ? <div className={styles.avatar}>{initials}</div> : null}
      </div>
    </div>
  );
}
