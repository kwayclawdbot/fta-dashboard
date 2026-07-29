import styles from "./TopBarV3.module.css";

/**
 * The Home top bar: brand mark + wordmark on the left, bell and avatar chip on
 * the right. Translated verbatim from the "01 Home" artboard.
 *
 * The bell badge renders only when a count is supplied. No notifications source
 * exists in the data layer yet, so on live data it is absent by design rather
 * than showing a placeholder number.
 */
export default function TopBarV3({
  initials,
  notificationCount,
}: {
  initials: string;
  notificationCount: number | null;
}) {
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
        <div className={styles.bell}>
          <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          {notificationCount !== null && notificationCount > 0 ? (
            <span className={styles.bellBadge} data-numeric>
              {notificationCount}
            </span>
          ) : null}
        </div>
        {initials ? <div className={styles.avatar}>{initials}</div> : null}
      </div>
    </div>
  );
}
