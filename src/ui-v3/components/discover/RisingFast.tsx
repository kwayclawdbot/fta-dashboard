import Link from "next/link";
import { DISCOVER_EMPTY, type RisingTileVM } from "@/ui-v3/discover-data";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import DiscoverEyebrow from "./DiscoverEyebrow";
import Sparkline from "./Sparkline";
import styles from "./RisingFast.module.css";

/**
 * "RISING FAST" — three equal flat cards, each ticker + attention delta +
 * sparkline + watcher line.
 *
 * Every one of those four is optional on the view model, because only the
 * ticker is guaranteed by the data layer. A card with no series draws no
 * sparkline rather than a fabricated one.
 *
 * The watcher line's BOX is always reserved, even when the count is absent:
 * three cards in a row, one of them shorter than the others because that name
 * happens to have no watcher count, read as a rendering fault. Reserving keeps
 * the row square without printing anything untrue.
 */
export default function RisingFast({ tiles }: { tiles: RisingTileVM[] }) {
  if (tiles.length === 0) {
    return (
      <section className={styles.section}>
        <DiscoverEyebrow caption="Attention over the last 24h">Rising fast</DiscoverEyebrow>
        <EmptyNote>{DISCOVER_EMPTY.rising}</EmptyNote>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <DiscoverEyebrow
        caption="Attention over the last 24h"
        actionLabel="See all"
        actionHref="/v3/discover/screener"
      >
        Rising fast
      </DiscoverEyebrow>

      <div className={styles.row}>
        {tiles.map((tile) => (
          <Link key={tile.ticker} href="/v3/discover/screener" className={styles.card}>
            <div className={styles.ticker}>{tile.ticker}</div>
            {tile.change !== null ? (
              <div
                className={`${styles.delta} ${tile.change < 0 ? styles.deltaDown : ""}`}
                data-numeric
              >
                {tile.change < 0 ? "▼" : "▲"} {Math.abs(Math.round(tile.change))}
                {tile.isPct ? "%" : ""}
              </div>
            ) : null}
            {tile.series ? (
              <div className={styles.spark}>
                <Sparkline
                  series={tile.series}
                  viewWidth={90}
                  viewHeight={22}
                  strokeWidth={1.8}
                  tone={tile.tone}
                  stretch
                />
              </div>
            ) : (
              <div className={`${styles.spark} ${styles.sparkGap}`} aria-hidden="true" />
            )}
            <div className={styles.watchers}>{tile.watchersLabel ?? ""}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
