import type { CSSProperties } from "react";
import { DISCOVER_EMPTY, type DivisiveVM } from "@/ui-v3/discover-data";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import { discoverPaint } from "./discover-palette";
import DiscoverEyebrow from "./DiscoverEyebrow";
import styles from "./MostDivisive.module.css";

/**
 * "MOST DIVISIVE" — one ticker, the club's bull/bear split drawn twice: as the
 * two flanking columns and as the conic donut the ticker sits inside.
 *
 * The three discs under each percentage are the artboard's anonymous member
 * stack. They carry no identity in the design (flat surface fills, no image, no
 * initial), so they are reproduced as-is and are not wired to real members.
 *
 * The section frame is ALWAYS drawn. Returning null here removed a whole band
 * from the middle of Discover, which is what left the live screen mostly black
 * and read as a broken page rather than a young club.
 */
export default function MostDivisive({ divisive }: { divisive: DivisiveVM | null }) {
  if (!divisive) {
    return (
      <section className={styles.section}>
        <DiscoverEyebrow caption="Biggest split in opinions">Most divisive</DiscoverEyebrow>
        <EmptyNote tall center>
          {DISCOVER_EMPTY.divisive}
        </EmptyNote>
      </section>
    );
  }

  const paint = discoverPaint(divisive.ticker);

  return (
    <section className={styles.section}>
      <DiscoverEyebrow caption="Biggest split in opinions" actionLabel="→" actionSize="glyph">
        Most divisive
      </DiscoverEyebrow>

      <div className={styles.panel}>
        <div className={styles.side}>
          <div className={`${styles.pct} ${styles.bull}`} data-numeric>
            {divisive.bullPct}%
          </div>
          <div className={`${styles.stance} ${styles.bull}`}>Bullish</div>
          <MemberStack />
        </div>

        <div className={styles.donut}>
          <div
            className={styles.ring}
            style={{ "--bull": `${divisive.bullPct}%` } as CSSProperties}
          />
          <div className={styles.hub}>
            <div>
              <div
                className={styles.tile}
                style={
                  { "--tile-bg": paint.bg, "--tile-fg": paint.fg } as CSSProperties
                }
                aria-hidden="true"
              >
                {divisive.ticker.charAt(0)}
              </div>
              <div className={styles.ticker}>{divisive.ticker}</div>
            </div>
          </div>
        </div>

        <div className={styles.side}>
          <div className={`${styles.pct} ${styles.bear}`} data-numeric>
            {divisive.bearPct}%
          </div>
          <div className={`${styles.stance} ${styles.bear}`}>Bearish</div>
          <MemberStack />
        </div>
      </div>

      {divisive.opinionsLabel ? (
        <div className={styles.opinions}>{divisive.opinionsLabel}</div>
      ) : null}
    </section>
  );
}

/** The artboard's three overlapping anonymous discs. Decoration, not data. */
function MemberStack() {
  return (
    <div className={styles.stack} aria-hidden="true">
      <span className={styles.disc} />
      <span className={`${styles.disc} ${styles.discAlt}`} />
      <span className={styles.disc} />
    </div>
  );
}
