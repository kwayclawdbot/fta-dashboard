import type { CSSProperties } from "react";
import type { FigureCardVM, StrengthBarVM } from "@/ui-v3/you-data";
import styles from "./StandingCards.module.css";

/**
 * The card pair from board "07 You Profile": a headline figure beside a set of
 * ranked bars.
 *
 * BOTH CARDS ALWAYS RENDER. Omitting them is what made a new member's profile
 * two thirds empty black — the identity block, five zeroes, and then nothing
 * where the design has a card pair and a call list. A card holding an honest
 * "here is what fills this" is still the artboard's object; a missing card is a
 * hole in the layout. No number is fabricated either way: the empty card prints
 * copy, never a zero dressed as a metric.
 */
export default function StandingCards({
  figure,
  strengths,
}: {
  figure: FigureCardVM | null;
  strengths: { eyebrow: string; bars: StrengthBarVM[] } | null;
}) {
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
      ) : (
        <div className={`${styles.card} ${styles.figureCard}`}>
          <div className={styles.eyebrow}>Conviction</div>
          <div className={styles.empty}>
            Your first posted take starts this card — it reads the bull share of your open
            positions.
          </div>
        </div>
      )}

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
      ) : (
        <div className={`${styles.card} ${styles.barsCard}`}>
          <div className={styles.eyebrow}>Where your reps come from</div>
          <div className={styles.empty}>
            Earn XP from lessons, quizzes, games and Club reps and this ranks where yours
            actually came from.
          </div>
        </div>
      )}
    </div>
  );
}
