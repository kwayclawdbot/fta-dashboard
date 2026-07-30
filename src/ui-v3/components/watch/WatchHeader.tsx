import Link from "next/link";
import styles from "./WatchHeader.module.css";

/**
 * The head both Watch artboards open with: the script "watch" mark and the
 * four-tab rail beneath it.
 *
 * All four tabs are now real destinations. WATCHLIST and KAI WATCH have no
 * artboard of their own — they are composed from the grammar (GRAMMAR §9) — but
 * a rail where half the labels are inert is the reason this screen read as a
 * dead end once you were logged in, so the tab goes where the label says.
 */

/**
 * `none` is for the two screens the HUB opens that are not tabs at all —
 * Earnings Calendar and Opinion Changes. Lighting the OVERVIEW pill on them
 * would say you are on a tab you are not, so the rail draws all four as the
 * plain inactive labels it already draws, and those screens carry 06's own ✕
 * back to the hub instead.
 */
export type WatchTab = "overview" | "watchlist" | "kai-watch" | "alerts" | "none";

const TABS: { id: WatchTab; label: string; href: string | null }[] = [
  { id: "overview", label: "OVERVIEW", href: "/v3/watch" },
  { id: "watchlist", label: "WATCHLIST", href: "/v3/watch/list" },
  { id: "kai-watch", label: "KAI WATCH", href: "/v3/watch/setups" },
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
