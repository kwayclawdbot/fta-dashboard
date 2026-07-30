import type { FeedPostVM } from "@/ui-v3/club-data";
import BeltChip from "./BeltChip";
import MemberDisc from "./MemberDisc";
import styles from "./FeedPostCard.module.css";

/**
 * A member's post. Translated from "04 Club Feed".
 *
 * The artboard's action row is 👍 / 💬 / 💡 / 🔖. Only the first two have a
 * source (`post_likes`, `post_comments`); the 💡 count does not exist for a feed
 * post, so it is omitted rather than shown at zero. 🔖 has no count in the
 * artboard either and stays a bare mark.
 */
export default function FeedPostCard({ post }: { post: FeedPostVM }) {
  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <MemberDisc initials={post.initials} />
        <div className={styles.identity}>
          <span className={styles.name}>{post.authorName}</span>{" "}
          {post.beltKey && post.beltLabel ? (
            <BeltChip belt={post.beltKey} label={`${post.beltLabel} Belt`} />
          ) : null}
          {post.ticker ? <div className={styles.ticker}>${post.ticker}</div> : null}
        </div>
        <span className={styles.time}>{post.time} ···</span>
      </div>

      <p className={styles.body}>{post.body}</p>

      <div className={styles.actions}>
        {post.likes !== null ? (
          <span data-numeric>👍 {post.likes}</span>
        ) : null}
        {post.comments !== null ? (
          <span data-numeric>💬 {post.comments}</span>
        ) : null}
        <span className={styles.save} aria-hidden="true">
          🔖
        </span>
      </div>
    </article>
  );
}
