import type { IndexChipVM } from "@/ui-v3/home-data";
import GradientPanel from "./GradientPanel";
import IndexChips from "./IndexChips";
import styles from "./TodayIn30.module.css";

/**
 * The daily brief panel. "TODAY IN 30 SECONDS" is fixed chrome on the artboard;
 * the line beneath it is the club brief's lead item.
 */
export default function TodayIn30({
  line,
  indices,
}: {
  line: string | null;
  indices: IndexChipVM[] | null;
}) {
  return (
    <GradientPanel tone="brief" className={styles.section}>
      <div className={styles.head}>
        <div className={styles.headline}>
          TODAY IN 30 SECONDS
          {line ? <div className={styles.line}>{line}</div> : null}
        </div>
        <button type="button" className={styles.play} aria-label="Play today's brief">
          <span className={styles.playGlyph} />
        </button>
      </div>
      <IndexChips initial={indices} />
    </GradientPanel>
  );
}
