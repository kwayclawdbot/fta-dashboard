import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./ClubHeader.module.css";

export type ClubTab = "feed" | "circles" | "live";

/**
 * The Club section head, shared by "04 Club Feed" and "16 Club Circles":
 * the script "club" mark, one right-hand slot, and the FEED / CIRCLES / LIVE
 * tab row beneath.
 *
 * This is the first use of the script voice (DESIGN-GRAMMAR §1 records it as
 * unexercised on Home) — 34px, --text, line-height 1, no tracking.
 *
 * LIVE has no v3 route yet, so it renders as an inert tab rather than a link to
 * nowhere.
 */
export default function ClubHeader({
  active,
  right,
}: {
  active: ClubTab;
  right?: ReactNode;
}) {
  return (
    <>
      <div className={styles.top}>
        <div className={styles.wordmark}>club</div>
        {right}
      </div>

      <div className={styles.tabs}>
        <Tab tab="feed" active={active} href="/v3/club">
          FEED
        </Tab>
        <Tab tab="circles" active={active} href="/v3/club/circles">
          CIRCLES
        </Tab>
        <Tab tab="live" active={active}>
          LIVE
        </Tab>
      </div>
    </>
  );
}

function Tab({
  tab,
  active,
  href,
  children,
}: {
  tab: ClubTab;
  active: ClubTab;
  href?: string;
  children: ReactNode;
}) {
  if (tab === active) {
    return <span className={styles.tabActive}>{children}</span>;
  }
  if (!href) {
    return (
      <span className={styles.tabIdle} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={styles.tabIdle}>
      {children}
    </Link>
  );
}

/**
 * The two 34px round buttons on the feed head.
 *
 * "+" is the composer — the same destination the "What's your take?" row leads
 * to, which is what the board's plus means on a feed. It therefore has to
 * answer to the SAME gate that row answers to: a kid whose composer row
 * correctly says "explore and react" must not find the composer one tap away
 * behind a plus sign. (The route refuses them either way, so nothing could
 * leak — but an affordance that exists only to be refused is a worse lie than
 * no affordance.)
 *
 * The magnifier stays inert: v3 has no search route, and a button that
 * navigates nowhere is worse than one that is visibly not a button yet.
 */
export function ClubHeadActions({ canPost = true }: { canPost?: boolean }) {
  return (
    <div className={styles.actions}>
      {canPost ? (
        <Link href="/v3/club/compose" className={styles.circleBtn} aria-label="Post your take">
          <span className={styles.plus}>+</span>
        </Link>
      ) : (
        <div className={styles.circleBtn} aria-hidden="true">
          <span className={styles.plus}>+</span>
        </div>
      )}
      <div className={styles.circleBtn} aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16.2 16.2 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

/**
 * The accent CTA on the Circles head — opens a Circle (`club_circles`).
 *
 * Gated for the same reason the feed's plus is: `club_circles` INSERT carries
 * the same non-kid clause, so offering the opener to a kid is offering a door
 * that is already locked.
 */
export function StartCircleCta({ canPost = true }: { canPost?: boolean }) {
  if (!canPost) return null;
  return (
    <Link href="/v3/club/circles/new" className={styles.cta}>
      + Start a Circle
    </Link>
  );
}
