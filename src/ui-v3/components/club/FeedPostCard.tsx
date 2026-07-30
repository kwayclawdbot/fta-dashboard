import Link from "next/link";
import type { ClubViewerVM, FeedPostVM } from "@/ui-v3/club-data";
import BeltChip from "./BeltChip";
import MemberDisc from "./MemberDisc";
import ReactionControl from "./ReactionControl";
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
 *
 * 👍 IS NOW A CONTROL — it writes `post_likes`, the same table its own count is
 * read from (see ReactionControl). It is always rendered, even at zero, because
 * unlike the passive counts beside it, its job is to be tappable: a control that
 * only appears once someone else has already tapped it can never receive the
 * first tap. 💬 and 🔖 remain inert; commenting and saving have no v3 route yet.
 */
export default function FeedPostCard({
  post,
  viewer,
}: {
  post: FeedPostVM;
  viewer: ClubViewerVM | null;
}) {
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
        <ReactionControl
          kind="like"
          targetId={post.id}
          count={post.likes ?? 0}
          mine={post.likedByMe}
          viewer={viewer}
        />
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
