import Link from "next/link";
import TickerTile from "@/ui-v3/components/TickerTile";
import type { TickerHeadVM } from "@/ui-v3/ticker-data";
import styles from "./TickerHero.module.css";

/**
 * "03 Ticker NVDA"'s identity block: the utility row, the 40px tile beside the
 * company name, the club-rank pill, the quote, and the watcher line.
 *
 * THE STAR IS A STATE, NOT A CONTROL. The artboard draws a filled gold ★; the
 * real read behind it is whether this name sits on the community watchlist, and
 * v3 wires no write paths (the same rule the Club composers follow). So it
 * renders filled or hollow from that read and is not a button — a star that
 * looks tappable and does nothing is worse than a star that reads as a badge.
 *
 * The artboard's second glyph (↗ share) has no destination anywhere in the app,
 * so it is inert text — the same treatment the screener's bare "→" gets.
 *
 * The watcher row's three overlapped discs are the artboard's own anonymous
 * grey pips: they carry no identity there and none is available here, so they
 * are drawn as a count cue (one pip per watcher, capped at three) and the whole
 * row is omitted when the count is absent.
 */
export default function TickerHero({ head }: { head: TickerHeadVM }) {
  const pips = head.watchers === null ? 0 : Math.min(3, Math.max(1, head.watchers));

  return (
    <header>
      <div className={styles.utility}>
        <Link href="/v3/discover" className={styles.back} aria-label="Back to Discover">
          ←
        </Link>
        <div className={styles.glyphs}>
          <span
            className={`${styles.star} ${head.onWatchlist ? styles.starOn : ""}`}
            title={head.onWatchlist ? "On the community watchlist" : "Not on the community watchlist"}
          >
            {head.onWatchlist ? "★" : "☆"}
          </span>
          <span className={styles.share} aria-hidden="true">
            ↗
          </span>
        </div>
      </div>

      <div className={styles.identity}>
        <div className={styles.name}>
          <TickerTile ticker={head.symbol} size="xl" />
          <div className={styles.company}>{head.name ?? head.symbol}</div>
        </div>
        {head.clubRank !== null ? (
          <Link href="/v3/discover" className={styles.rank}>
            #{head.clubRank} in the Club ›
          </Link>
        ) : null}
      </div>

      {head.price !== null ? (
        <div className={styles.quote}>
          <span className={styles.price} data-numeric>
            ${head.price.toFixed(2)}
          </span>
          {head.changePct !== null ? (
            <span
              className={`${styles.change} ${head.changePct < 0 ? styles.down : ""}`}
              data-numeric
            >
              {head.changePct < 0 ? "▼" : "▲"} {Math.abs(head.changePct).toFixed(2)}% today
            </span>
          ) : null}
        </div>
      ) : null}

      {head.watchers !== null && head.watchers > 0 ? (
        <div className={styles.watching}>
          <div className={styles.pips} aria-hidden="true">
            {Array.from({ length: pips }, (_, i) => (
              <span key={i} className={styles.pip} />
            ))}
          </div>
          <span className={styles.watchCount}>
            {head.watchers.toLocaleString("en-US")} watching
          </span>
        </div>
      ) : null}
    </header>
  );
}
