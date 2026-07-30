import type { CSSProperties } from "react";
import Link from "next/link";
import type { BeltWatchVM } from "@/ui-v3/discover-data";
import { discoverPaint } from "./discover-palette";
import DiscoverEyebrow from "./DiscoverEyebrow";
import styles from "./BlackBeltsWatching.module.css";

/**
 * "BLACK BELTS ARE WATCHING" — a row of 46px round brand discs with the ticker
 * beneath. Same brand pair as the square tile; the artboards just draw this one
 * as a circle with a 1.5px border, so it is a local shape rather than a
 * TickerTile size.
 */
export default function BlackBeltsWatching({ tickers }: { tickers: BeltWatchVM[] }) {
  if (tickers.length === 0) return null;

  return (
    <section className={styles.section}>
      <DiscoverEyebrow actionLabel="See all" actionHref="/v3/discover/screener">
        Black belts are watching
      </DiscoverEyebrow>

      <div className={styles.row}>
        {tickers.map((item) => {
          const paint = discoverPaint(item.ticker);
          return (
            <Link key={item.ticker} href="/v3/discover/screener" className={styles.item}>
              <div
                className={styles.disc}
                style={{ "--tile-bg": paint.bg, "--tile-fg": paint.fg } as CSSProperties}
                aria-hidden="true"
              >
                {item.ticker.charAt(0)}
              </div>
              <div className={styles.ticker}>{item.ticker}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
