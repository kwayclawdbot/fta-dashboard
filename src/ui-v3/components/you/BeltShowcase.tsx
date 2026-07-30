import type { CSSProperties } from "react";
import AccentEyebrow from "./AccentEyebrow";
import { beltChipInkVar, beltToneVar, type BeltTone } from "./belt-tone";
import styles from "./BeltShowcase.module.css";

/**
 * "How belts show up" — the legend at the foot of board "22 Belts".
 *
 * This region is EXPLANATORY, not a data surface: its three rows exist to show
 * where the belt colour, the belt chip and the apex live-node appear elsewhere
 * in the Club. The example members are therefore the artboard's own illustrative
 * copy and are intentionally static — they are a key, not a member list.
 */

interface ShowcaseRow {
  initials: string;
  name: string;
  tone: BeltTone;
  chip: string;
  /** The apex belt's orange live-node dot. */
  node?: boolean;
  /** The artboard's "🔥×7" run beside the chip. */
  flame?: string;
  note: string;
}

const ROWS: ShowcaseRow[] = [
  {
    initials: "TR",
    name: "Tiffany R.",
    tone: "blue",
    chip: "Blue Belt",
    note: "Avatar ring = belt color, everywhere",
  },
  {
    initials: "OG",
    name: "OptionsOG",
    tone: "black",
    chip: "Black Belt",
    node: true,
    flame: "🔥×7",
    note: "Black Belts get the orange live-node dot",
  },
  {
    initials: "DK",
    name: "DeShawn K.",
    tone: "yellow",
    chip: "Yellow Belt",
    note: "Belt chip sits beside the name on every post",
  },
];

export default function BeltShowcase() {
  return (
    <div className={styles.section}>
      <AccentEyebrow>How belts show up</AccentEyebrow>

      <div className={styles.card}>
        {ROWS.map((row) => (
          <div
            key={row.name}
            className={styles.row}
            style={
              {
                "--belt-tone": beltToneVar(row.tone),
                "--belt-ink": beltChipInkVar(row.tone),
              } as CSSProperties
            }
          >
            <div className={styles.avatar}>
              {row.initials}
              {row.node ? <span className={styles.node} /> : null}
            </div>
            <div className={styles.body}>
              <span className={styles.name}>{row.name}</span>{" "}
              <span className={styles.chip}>{row.chip}</span>
              {row.flame ? <span className={styles.flame}> {row.flame}</span> : null}
              <div className={styles.note}>{row.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
