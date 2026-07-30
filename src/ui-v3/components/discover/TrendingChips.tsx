import Link from "next/link";
import { DISCOVER_EMPTY } from "@/ui-v3/discover-copy";
import type { TrendingChipVM } from "@/ui-v3/discover-data";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import styles from "./TrendingChips.module.css";

/**
 * "TRENDING IN THE CLUB" — a wrapping rail of ticker + delta chips, the two
 * leaders flamed.
 *
 * `isPct` is false on live data because the delta is the ledger's score-point
 * change, not a percentage; the chip omits the sign rather than implying one.
 *
 * This is the Screener's trending region, so it carries the trending contract's
 * compliance disclaimer.
 */
export default function TrendingChips({
  chips,
  disclaimer,
}: {
  chips: TrendingChipVM[];
  disclaimer: string;
}) {
  if (chips.length === 0) {
    return (
      <section className={styles.section}>
        <SectionEyebrow labelTone="accent">Trending in the club</SectionEyebrow>
        <EmptyNote>{DISCOVER_EMPTY.trendingChips}</EmptyNote>
        <p className={styles.disclaimer}>{disclaimer}</p>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <SectionEyebrow labelTone="accent">Trending in the club</SectionEyebrow>

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

      <p className={styles.disclaimer}>{disclaimer}</p>
    </section>
  );
}
