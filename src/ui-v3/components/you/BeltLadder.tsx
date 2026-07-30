import type { CSSProperties } from "react";
import type { BeltRungVM } from "@/ui-v3/you-data";
import { beltToneVar } from "./belt-tone";
import styles from "./BeltLadder.module.css";

/**
 * The belt ladder from board "22 Belts".
 *
 * The `gate` line is whatever the adapter can honestly state about how a rung is
 * earned, and `share` (the artboard's "62% OF CLUB") is omitted when null —
 * no member-distribution figure is computed anywhere in the app.
 */
export default function BeltLadder({ rungs }: { rungs: BeltRungVM[] }) {
  return (
    <div className={styles.list}>
      {rungs.map((rung) => (
        <div
          key={rung.key}
          className={`${styles.row} ${rung.isHere ? styles.rowHere : ""}`}
          style={{ "--belt-tone": beltToneVar(rung.tone) } as CSSProperties}
        >
          <div className={`${styles.knot} ${rung.isHere ? styles.knotHere : ""}`}>
            <span className={styles.knotBar} />
            {rung.isHere ? <span className={styles.knotStar}>★</span> : null}
          </div>

          <div className={styles.body}>
            <div className={`${styles.name} ${rung.isHere ? styles.nameHere : ""}`}>
              {rung.name}
              {rung.isHere ? <span className={styles.hereTag}> — YOU ARE HERE</span> : null}
            </div>
            {rung.gate ? (
              <div className={`${styles.gate} ${rung.isHere ? styles.gateHere : ""}`}>
                {rung.gate}
              </div>
            ) : null}
          </div>

          {rung.share ? (
            <span
              className={`${styles.share} ${rung.isHere ? styles.shareHere : ""}`}
              data-numeric
            >
              {rung.share}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
