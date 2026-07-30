import Link from "next/link";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import { TICKER_EMPTY, type RangeChipVM, type TickerChartVM } from "@/ui-v3/ticker-data";
import styles from "./PriceChart.module.css";

/**
 * "03 Ticker NVDA"'s price plot: an open polyline over a soft fill, a four-tick
 * time axis, and the six range chips.
 *
 * No chart library. The geometry arrives fully resolved from the adapter in the
 * artboard's own 354x128 user space, and this component only paints — the same
 * split the Watch board's SetupChart uses.
 *
 * The artboard pins three member markers (TR / KD / OG) on the line. Nothing in
 * the schema associates a member with a point on a price series, so they are
 * not drawn; see the omissions list in src/ui-v3/ticker-data.ts.
 *
 * The stroke tone follows THE LINE'S OWN direction, never a neighbouring
 * number — a plot that visibly falls is never stroked green.
 */
export default function PriceChart({
  chart,
  ranges,
}: {
  chart: TickerChartVM | null;
  ranges: RangeChipVM[];
}) {
  return (
    <section>
      {chart ? (
        <>
          <div className={`${styles.plot} ${chart.rising ? styles.up : styles.down}`}>
            <svg
              className={styles.svg}
              viewBox="0 0 354 128"
              preserveAspectRatio="none"
              role="img"
              aria-label="Price history for the selected range"
            >
              <path className={styles.area} d={chart.areaPath} />
              <path className={styles.line} d={chart.path} />
            </svg>
          </div>
          <div className={styles.axis}>
            {chart.axis.map((label, i) => (
              <span key={i} data-numeric>
                {label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <EmptyNote tall>{TICKER_EMPTY.chart}</EmptyNote>
      )}

      <div className={styles.ranges}>
        {ranges.map((r) => (
          <Link
            key={r.key}
            href={r.href}
            className={`${styles.chip} ${r.active ? styles.chipOn : ""}`}
            aria-current={r.active ? "true" : undefined}
            scroll={false}
          >
            {r.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
