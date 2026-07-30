import type { IndexChipVM } from "@/ui-v3/home-data";
import BriefPlayButton from "./BriefPlayButton";
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
 *
 * THE ▶ FOLLOWS THAT SAME NULL. It reads the brief aloud (see BriefPlayButton
 * and /api/v3/brief-audio), so on a brief with nothing in it there is nothing to
 * play and the button is not drawn at all — offering a play control over the
 * sentence "the brief will land later" would be the panel promising twice.
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
        {line ? <BriefPlayButton /> : null}
      </div>
      <IndexChips initial={indices} />
    </GradientPanel>
  );
}
