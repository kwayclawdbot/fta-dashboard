import type { CSSProperties } from "react";
import type { FigureCardVM, StrengthBarVM } from "@/ui-v3/you-data";
import styles from "./StandingCards.module.css";

/**
 * The card pair from board "07 You Profile": a headline figure beside a set of
 * ranked bars.
 *
 * Either half can be absent. When both are, the whole row is omitted — a card
 * is never shown holding a fabricated number.
 */
export default function StandingCards({
  figure,
  strengths,
}: {
  figure: FigureCardVM | null;
  strengths: { eyebrow: string; bars: StrengthBarVM[] } | null;
}) {
  if (!figure && !strengths) return null;

  return (
    <div className={styles.row}>
      {figure ? (
        <div className={`${styles.card} ${styles.figureCard}`}>
          <div className={styles.eyebrow}>{figure.eyebrow}</div>
          <div className={styles.figure} data-numeric>
            {figure.value}
          </div>
          {figure.note ? <div className={styles.figureNote}>{figure.note}</div> : null}
        </div>
      ) : null}

      {strengths ? (
        <div className={`${styles.card} ${styles.barsCard}`}>
          <div className={styles.eyebrow}>{strengths.eyebrow}</div>
          <div className={styles.bars}>
            {strengths.bars.map((bar) => (
              <div key={bar.name} className={styles.bar}>
                <div className={styles.barHead}>
                  <span className={styles.barName}>{bar.name}</span>
                  <span className={styles.barValue}>{bar.value}</span>
                </div>
                <div className={styles.track}>
                  <div
                    className={styles.fill}
                    style={{ "--fill-pct": `${bar.pct}%` } as CSSProperties}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
