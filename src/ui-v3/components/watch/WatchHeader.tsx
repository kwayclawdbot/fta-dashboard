import Link from "next/link";
import styles from "./WatchHeader.module.css";

/**
 * The head both Watch artboards open with: the script "watch" mark and the
 * four-tab rail beneath it.
 *
 * Only two of the four tabs have a v3 route today (OVERVIEW → /v3/watch,
 * ALERTS → /v3/watch/alerts). WATCHLIST and KAI WATCH have no artboard and no
 * v3 screen, so they render as the plain inactive labels the mockup draws
 * rather than as links to nothing.
 */

export type WatchTab = "overview" | "watchlist" | "kai-watch" | "alerts";

const TABS: { id: WatchTab; label: string; href: string | null }[] = [
  { id: "overview", label: "OVERVIEW", href: "/v3/watch" },
  { id: "watchlist", label: "WATCHLIST", href: null },
  { id: "kai-watch", label: "KAI WATCH", href: null },
  { id: "alerts", label: "ALERTS", href: "/v3/watch/alerts" },
];

export default function WatchHeader({
  active,
  /** 06 draws a dismiss glyph beside the mark; 18 does not. */
  closeHref,
  /** 06 spaces the rail at 16px, 18 at 14px. */
  tabGap = "16px",
}: {
  active: WatchTab;
  closeHref?: string;
  tabGap?: string;
}) {
  return (
    <>
      <div className={styles.head}>
        <div className={styles.mark}>watch</div>
        {closeHref ? (
          <Link href={closeHref} className={styles.close} aria-label="Close Watch">
            ✕
          </Link>
        ) : null}
      </div>

      <nav className={styles.tabs} style={{ "--tabs-gap": tabGap } as React.CSSProperties}>
        {TABS.map((tab) => {
          const className = tab.id === active ? styles.tabActive : styles.tab;
          if (tab.href && tab.id !== active) {
            return (
              <Link key={tab.id} href={tab.href} className={className}>
                {tab.label}
              </Link>
            );
          }
          return (
            <span
              key={tab.id}
              className={className}
              aria-current={tab.id === active ? "page" : undefined}
            >
              {tab.label}
            </span>
          );
        })}
      </nav>
    </>
  );
}
