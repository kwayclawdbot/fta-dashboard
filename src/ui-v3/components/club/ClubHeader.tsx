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

/** The two 34px round buttons on the feed head. Display-only: no route exists. */
export function ClubHeadActions() {
  return (
    <div className={styles.actions}>
      <div className={styles.circleBtn}>
        <span className={styles.plus}>+</span>
      </div>
      <div className={styles.circleBtn}>
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16.2 16.2 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

/** The accent CTA on the Circles head. */
export function StartCircleCta() {
  return <span className={styles.cta}>+ Start a Circle</span>;
}
