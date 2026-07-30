import Link from "next/link";
import type { TrendingChipVM } from "@/ui-v3/discover-data";
import DiscoverEyebrow from "./DiscoverEyebrow";
import styles from "./TrendingChips.module.css";

/**
 * "TRENDING IN THE CLUB" — a wrapping rail of ticker + delta chips, the two
 * leaders flamed.
 *
 * `isPct` is false on live data because the delta is the ledger's score-point
 * change, not a percentage; the chip omits the sign rather than implying one.
 */
export default function TrendingChips({ chips }: { chips: TrendingChipVM[] }) {
  if (chips.length === 0) return null;

  return (
    <section className={styles.section}>
      <DiscoverEyebrow>Trending in the club</DiscoverEyebrow>

      <div className={styles.rail}>
        {chips.map((chip) => (
          <Link key={chip.ticker} href="/v3/discover" className={styles.chip}>
            {chip.hot ? <span aria-hidden="true">🔥 </span> : null}
            {chip.ticker}{" "}
            <span
              className={chip.change < 0 ? styles.down : styles.up}
              data-numeric
            >
              {chip.change < 0 ? "−" : "+"}
              {Math.abs(Math.round(chip.change))}
              {chip.isPct ? "%" : ""}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
