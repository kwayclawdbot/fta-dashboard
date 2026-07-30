import Link from "next/link";
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
 *
 * A count of zero is printed as NOTHING. "👍 0 · 💬 0" under every post is the
 * artboard's engagement row filled in with the absence of engagement, and it made
 * a real feed look abandoned. The artboard only ever draws these counts with
 * numbers in them; zero is the state where the count has not started.
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
          {post.ticker ? (
            <Link href={`/v3/ticker/${post.ticker}`} className={styles.ticker}>
              ${post.ticker}
            </Link>
          ) : null}
        </div>
        <span className={styles.time}>{post.time} ···</span>
      </div>

      <p className={styles.body}>{post.body}</p>

      <div className={styles.actions}>
        {post.likes !== null && post.likes > 0 ? (
          <span data-numeric>👍 {post.likes}</span>
        ) : null}
        {post.comments !== null && post.comments > 0 ? (
          <span data-numeric>💬 {post.comments}</span>
        ) : null}
        <span className={styles.save} aria-hidden="true">
          🔖
        </span>
      </div>
    </article>
  );
}
