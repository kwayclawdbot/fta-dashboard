import Link from "next/link";
import styles from "./DiscoverTabs.module.css";

/**
 * The three-way Discover switch on "15 Discover Screener": the active tab is an
 * accent pill in --accent-on, the inactive two are bare 11px labels.
 *
 * Only two of the three have an artboard behind them — "02 Discover" is the FOR
 * YOU view and "15" is SCREENER. TRENDING has no screen, so it renders as the
 * label the artboard draws and links nowhere; inventing a destination for it
 * would be inventing a screen.
 */
const TABS = [
  { key: "foryou", label: "For you", href: "/v3/discover" },
  { key: "screener", label: "Screener", href: "/v3/discover/screener" },
  { key: "trending", label: "Trending", href: null },
] as const;

export default function DiscoverTabs({ active }: { active: "foryou" | "screener" | "trending" }) {
  return (
    <div className={styles.row}>
      {TABS.map((tab) =>
        tab.key === active ? (
          <span key={tab.key} className={styles.active}>
            {tab.label}
          </span>
        ) : tab.href ? (
          <Link key={tab.key} href={tab.href} className={styles.tab}>
            {tab.label}
          </Link>
        ) : (
          <span key={tab.key} className={styles.tab}>
            {tab.label}
          </span>
        ),
      )}
    </div>
  );
}
