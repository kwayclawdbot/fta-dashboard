import type { SetupChartVM } from "@/ui-v3/watch-data";
import styles from "./SetupChart.module.css";

/**
 * The setup drawn on its own levels: the entry zone, the invalidation zone, and
 * the real close series running through them.
 *
 * Geometry arrives fully resolved from the adapter, which maps real prices into
 * the artboard's 330x120 user space. This component only paints. `preserveAspect
 * Ratio="none"` is the artboard's own setting — the box stretches to the card.
 */
export default function SetupChart({
  chart,
  quote,
}: {
  chart: SetupChartVM;
  quote: { price: number; changePct: number | null } | null;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.label}>The setup on the chart</span>
        {quote ? (
          <span className={styles.quote} data-numeric>
            ${quote.price.toFixed(2)}
            {quote.changePct !== null ? (
              <>
                {" "}
                <span className={quote.changePct >= 0 ? styles.up : styles.down}>
                  {quote.changePct >= 0 ? "▲" : "▼"}
                  {Math.abs(quote.changePct).toFixed(1)}%
                </span>
              </>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className={styles.plot}>
        <svg
          className={styles.svg}
          viewBox="0 0 330 120"
          preserveAspectRatio="none"
          role="img"
          aria-label="Price history against the setup's entry and invalidation levels"
        >
          {chart.entryBand ? (
            <rect
              className={styles.entryZone}
              x="0"
              y={chart.entryBand.y}
              width="330"
              height={chart.entryBand.height}
            />
          ) : null}
          {chart.invalidBand ? (
            <rect
              className={styles.invalidZone}
              x="0"
              y={chart.invalidBand.y}
              width="330"
              height={chart.invalidBand.height}
            />
          ) : null}
          {chart.entryEdges.map((y) => (
            <path key={`e${y}`} className={styles.entryRule} d={`M0 ${y} L330 ${y}`} />
          ))}
          {chart.invalidEdge !== null ? (
            <path
              className={styles.invalidRule}
              d={`M0 ${chart.invalidEdge} L330 ${chart.invalidEdge}`}
            />
          ) : null}
          <path className={styles.line} d={chart.path} />
          <circle className={styles.marker} cx={chart.markerX} cy={chart.markerY} r="4" />
        </svg>

        {chart.entryLabel ? (
          <span className={`${styles.tag} ${styles.entryTag}`}>{chart.entryLabel}</span>
        ) : null}
        {chart.invalidLabel ? (
          <span className={`${styles.tag} ${styles.invalidTag}`}>{chart.invalidLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
