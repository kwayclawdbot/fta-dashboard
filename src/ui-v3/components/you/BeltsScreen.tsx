import type { CSSProperties } from "react";
import Link from "next/link";
import type { BeltsViewModel } from "@/ui-v3/you-data";
import BeltLadder from "./BeltLadder";
import BeltShowcase from "./BeltShowcase";
import styles from "./BeltsScreen.module.css";

/**
 * "22 Belts", translated from the artboard.
 *
 * ONE DELIBERATE DIVERGENCE FROM THE ARTBOARD, and it is not cosmetic. The board
 * draws SIX rungs gated on graded-call volume and accuracy (10/40/100/250/500
 * calls at 50–70%), including a Green Belt. The shipped ladder — owner-set,
 * src/lib/belts.ts — is FIVE belts (White · Yellow · Blue · Purple · Black) gated
 * on lifetime XP, with no Green rung and no accuracy engine behind it. The form
 * below is the artboard's; the ladder in it is the real one. See you-data.ts.
 */
export default function BeltsScreen({ model }: { model: BeltsViewModel }) {
  return (
    <div className={styles.viewport}>
      <div className={styles.screen}>
        <div className={styles.body}>
          <div className={styles.titleRow}>
            <Link href="/v3/you" className={styles.back} aria-label="Back to profile">
              ←
            </Link>
            <div className={styles.title}>belts</div>
          </div>

          <p className={styles.blurb}>
            Rank is earned from the work you put in, not follower counts. Your belt travels
            with you everywhere in the Club.
          </p>

          <BeltLadder rungs={model.rungs} />
          <BeltShowcase />
        </div>

        {model.next ? (
          <div className={styles.footer}>
            <div className={styles.nextCard}>
              <span className={styles.nextGlyph}>🎯</span>
              <div className={styles.nextBody}>
                <div className={styles.nextTitle}>{model.next.title}</div>
                {model.next.detail ? (
                  <div className={styles.nextDetail}>{model.next.detail}</div>
                ) : null}
              </div>
              <div className={styles.track}>
                <div
                  className={styles.fill}
                  style={{ "--fill-pct": `${model.next.pct}%` } as CSSProperties}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
