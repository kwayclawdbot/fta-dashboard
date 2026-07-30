import type { CSSProperties } from "react";
import Link from "next/link";
import type { YouStripVM } from "@/ui-v3/home-data";
import GradientPanel from "./GradientPanel";
import SignalRing from "./SignalRing";
import styles from "./YouStrip.module.css";

/**
 * The member status strip: belt, XP against the next threshold, a progress bar,
 * and a ring.
 *
 * The artboard labels the ring "SCORE". There is no member-score metric in the
 * data layer, so rather than invent one the ring shows the same belt-progress
 * percentage as the bar and is labelled "XP". Form preserved, number honest.
 */
export default function YouStrip({ you }: { you: YouStripVM }) {
  return (
    <GradientPanel tone="you" className={styles.section}>
      <div className={styles.mark}>
        <div className={styles.markGlyph} />
      </div>

      <div className={styles.body}>
        <div className={styles.label}>
          YOU · <Link href="/v3/you" className={styles.belt}>{you.beltLabel}</Link>
        </div>
        <div className={styles.xp} data-numeric>
          XP {you.xp.toLocaleString()} / {you.target.toLocaleString()}
        </div>
        <div className={styles.track}>
          <div
            className={styles.fill}
            style={{ "--fill-pct": `${you.pct}%` } as CSSProperties}
          />
        </div>
      </div>

      <SignalRing pct={you.pct} value={String(you.pct)} caption="XP" />
    </GradientPanel>
  );
}
