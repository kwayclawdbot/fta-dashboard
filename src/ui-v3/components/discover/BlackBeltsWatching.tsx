import type { CSSProperties } from "react";
import Link from "next/link";
import { DISCOVER_EMPTY } from "@/ui-v3/discover-copy";
import type { BeltWatchVM } from "@/ui-v3/discover-data";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import { tickerPaint } from "@/ui-v3/ticker-palette";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import styles from "./BlackBeltsWatching.module.css";

/**
 * "BLACK BELTS ARE WATCHING" — a row of 46px round brand discs with the ticker
 * beneath. Same brand pair as the square tile; the artboards just draw this one
 * as a circle with a 1.5px border, so it is a local shape rather than a
 * TickerTile size.
 *
 * A club with no black belts yet is a real, temporary state — and on a founding
 * club it is the NORMAL one. The section keeps its frame and says so, instead of
 * disappearing and leaving a gap where a band of the design should be.
 */
export default function BlackBeltsWatching({ tickers }: { tickers: BeltWatchVM[] }) {
  if (tickers.length === 0) {
    return (
      <section className={styles.section}>
        <SectionEyebrow labelTone="accent">Black belts are watching</SectionEyebrow>
        <EmptyNote>{DISCOVER_EMPTY.beltWatch}</EmptyNote>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <SectionEyebrow
        labelTone="accent"
        actionLabel="See all"
        actionHref="/v3/discover/screener"
        actionTone="dim"
      >
        Black belts are watching
      </SectionEyebrow>

      <div className={styles.row}>
        {tickers.map((item) => {
          const paint = tickerPaint(item.ticker);
          return (
            <Link key={item.ticker} href={`/v3/ticker/${item.ticker}`} className={styles.item}>
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
