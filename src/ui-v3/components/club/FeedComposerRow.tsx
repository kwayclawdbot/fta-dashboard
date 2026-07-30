import Link from "next/link";
import type { ClubViewerVM } from "@/ui-v3/club-data";
import MemberDisc from "./MemberDisc";
import styles from "./FeedComposerRow.module.css";

/**
 * The "What's your take?" prompt at the top of the feed.
 *
 * It is the ENTRANCE to "05 Share your call" (/v3/club/compose), which is where
 * the write happens — board 05 draws the composer as a whole screen, so this row
 * navigates rather than expanding into an editor.
 *
 * Two postures besides the link, both stated rather than hidden:
 *
 *  · SIGNED OUT — still a link. It leads to the composer, which asks for a name.
 *    Hiding the row would make the feed look like something you read rather than
 *    something you join, which is the opposite of what this row is for.
 *  · KID REGISTER — the prompt is replaced by that register's own note and the
 *    row stops being a link. This mirrors the RLS policy on `feed_posts`
 *    (migration 161) rather than guessing at it: the server would refuse the
 *    insert, so the UI must not offer it.
 */
export default function FeedComposerRow({
  initials,
  viewer,
}: {
  initials: string;
  viewer: ClubViewerVM | null;
}) {
  const readOnly = !!viewer && !viewer.canPost;

  const inner = (
    <>
      {initials ? <MemberDisc initials={initials} /> : null}
      <div className={styles.copy}>
        <div className={styles.prompt}>
          {readOnly ? "Reading the Club" : "What’s your take?"}
        </div>
        <div className={styles.hint}>
          {readOnly ? viewer?.readOnlyNote : "Share an opinion, chart, or question"}
        </div>
      </div>
      <span className={styles.tools} aria-hidden="true">
        {readOnly ? "📖" : "📈 🖼"}
      </span>
    </>
  );

  if (readOnly) {
    return <div className={styles.row}>{inner}</div>;
  }

  return (
    <Link href="/v3/club/compose" className={styles.row}>
      {inner}
    </Link>
  );
}
