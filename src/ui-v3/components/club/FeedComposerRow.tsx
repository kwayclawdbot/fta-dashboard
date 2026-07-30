import MemberDisc from "./MemberDisc";
import styles from "./FeedComposerRow.module.css";

/**
 * The "What's your take?" prompt at the top of the feed.
 *
 * DISPLAY-ONLY. The old app writes a post straight to `feed_posts` from a client
 * component under RLS; no write path is wired on the v3 routes yet, so this
 * renders the artboard's row without an editor behind it.
 */
export default function FeedComposerRow({ initials }: { initials: string }) {
  return (
    <div className={styles.row}>
      {initials ? <MemberDisc initials={initials} /> : null}
      <div className={styles.copy}>
        <div className={styles.prompt}>What&rsquo;s your take?</div>
        <div className={styles.hint}>Share an opinion, chart, or question</div>
      </div>
      <span className={styles.tools} aria-hidden="true">
        📈 🖼
      </span>
    </div>
  );
}
