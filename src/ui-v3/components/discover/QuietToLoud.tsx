import Link from "next/link";
import type { QuietToLoudVM } from "@/ui-v3/discover-data";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import Sparkline from "./Sparkline";
import styles from "./QuietToLoud.module.css";

/**
 * "FROM QUIET TO LOUD" — five equal columns, each a bare sparkline over its
 * ticker. No card, no border, no metric.
 *
 * The artboard strokes the five in four different colours (red / orange / gold
 * / green x2) while every path rises, so the colour there is decorative. Real
 * data has one honest tone axis — the name's own direction — so `tone` on the
 * view model is derived from that and only ever resolves to positive/negative.
 */
export default function QuietToLoud({ tiles }: { tiles: QuietToLoudVM[] }) {
  if (tiles.length === 0) return null;

  return (
    <section className={styles.section}>
      <SectionEyebrow labelTone="accent" caption="Names the Club just woke up on" captionGap={2}>
        From quiet to loud
      </SectionEyebrow>

      <div className={styles.row}>
        {tiles.map((tile) => (
          <Link key={tile.ticker} href="/v3/discover/screener" className={styles.item}>
            {tile.series ? (
              <Sparkline
                series={tile.series}
                viewWidth={60}
                viewHeight={30}
                strokeWidth={1.8}
                tone={tile.tone}
                stretch
              />
            ) : null}
            <div className={styles.ticker}>{tile.ticker}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
