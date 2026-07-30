import styles from "./DiscoverHeader.module.css";

/**
 * "02 Discover" opens with the script wordmark rather than the Home top bar:
 * `discover` in Kaushan at 34px, a one-line subtitle, and two 34px round
 * actions (search, and the artboard's ≋ filter glyph).
 *
 * This is the first artboard to use --font-script, so it is also where the
 * script voice gets its rule: screen identity on a section screen, 34px, --text,
 * line-height 1, lowercase as authored. Nothing else on the screen may use it.
 *
 * "15 Discover Screener" reuses the same wordmark with no subtitle and no
 * actions, which is why both are optional.
 */
export default function DiscoverHeader({ subtitle }: { subtitle?: string }) {
  if (!subtitle) return <div className={styles.wordmark}>discover</div>;

  return (
    <div className={styles.bar}>
      <div>
        <div className={styles.wordmark}>discover</div>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>
      <div className={styles.actions}>
        <div className={styles.action}>
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M16.2 16.2 21 21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className={`${styles.action} ${styles.glyphAction}`} aria-hidden="true">
          ≋
        </div>
      </div>
    </div>
  );
}
