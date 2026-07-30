import type { IndexChipVM } from "@/ui-v3/home-data";
import GradientPanel from "./GradientPanel";
import IndexChips from "./IndexChips";
import styles from "./TodayIn30.module.css";

/**
 * The daily brief panel. "TODAY IN 30 SECONDS" is fixed chrome on the artboard;
 * the line beneath it is the club brief's lead item.
 *
 * `line` is null when the brief produced nothing worth reading — home-data.ts
 * filters the bare activity tallies out. The panel keeps its shape and its index
 * chips (those are real, live quotes) and says the brief is still coming, which
 * is true, instead of printing "1 research look across the Club".
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
          {line ? (
            <div className={styles.line}>{line}</div>
          ) : (
            <div className={`${styles.line} ${styles.lineWaiting}`}>
              Kai&rsquo;s brief will land with the next market snapshot.
            </div>
          )}
        </div>
        <button type="button" className={styles.play} aria-label="Play today's brief">
          <span className={styles.playGlyph} />
        </button>
      </div>
      <IndexChips initial={indices} />
    </GradientPanel>
  );
}
