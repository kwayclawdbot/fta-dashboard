import Link from "next/link";
import type { TickerTab } from "@/ui-v3/ticker-data";
import styles from "./TickerTabs.module.css";

/**
 * The four-slot rail boards 12, 13 and 14 carry under the header.
 *
 * The rail is drawn on those three boards only — "03 Ticker NVDA" predates it
 * and shows no rail at all. But its "Overview" pill is the way back from every
 * other tab, so the four screens are one destination with four tabs, and the
 * rail therefore appears on Overview too, in the same slot the other three put
 * it: directly beneath the identity block.
 *
 * TWO ACTIVE PAINTS, and they are the artboards' own, not a preference: the
 * first three tabs light up in --accent on --accent-on, and Kai lights up in the
 * Kai blue (#5BC4F0 — the raw palette's `--p-5bc4f0`, theme-literal because the
 * light twin keeps the identical value). Kai is a different voice everywhere it
 * appears in the app, and board 14 paints its own pill that way.
 */
const TABS: { key: TickerTab; label: string; slug: string }[] = [
  { key: "overview", label: "Overview", slug: "" },
  { key: "technicals", label: "Technicals", slug: "/technicals" },
  { key: "fundamentals", label: "Fundamentals", slug: "/fundamentals" },
  { key: "kai", label: "Kai", slug: "/kai" },
];

export default function TickerTabs({
  symbol,
  active,
}: {
  symbol: string;
  active: TickerTab;
}) {
  return (
    <nav className={styles.rail} aria-label="Ticker sections">
      {TABS.map((tab) => {
        const on = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`/v3/ticker/${symbol}${tab.slug}`}
            className={`${styles.tab} ${
              on ? (tab.key === "kai" ? styles.activeKai : styles.active) : styles.idle
            }`}
            aria-current={on ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
