import type { CSSProperties } from "react";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import { TICKER_EMPTY, type StanceVM } from "@/ui-v3/ticker-data";
import styles from "./ClubStance.module.css";

/**
 * "WHERE THE CLUB STANDS · Raw sentiment" — the bull column, the dial, the bear
 * column.
 *
 * THE DOT GRIDS ARE THE PERCENTAGE, DRAWN. The artboard puts ten dots under
 * "71%" with seven lit, and six under "21%" with two lit — i.e. a grid whose
 * lit share IS the number above it. So the grid here is always ten dots with
 * `round(pct / 10)` lit; it is a second reading of one real value, never a
 * second value.
 *
 * THE DIAL IS NOT A `SignalRing`. The artboard draws it at 116px with a 26px
 * BODY-weight value and a two-line 7px caption; SignalRing's three sizes are
 * 48/64/88 with a mono value. Bending the primitive to cover a fourth,
 * differently-voiced object would make every existing ring configurable for a
 * shape only this board uses, so this board draws its own — and nothing else
 * may use it.
 *
 * THE CAPTION IS "CLUB SCORE", NOT "WEIGHTED SIGNAL". No belt-weighted signal
 * is computed anywhere in the data layer; the 0-100 dial that does exist is the
 * trending core's club score. Same object, honest label.
 */
export default function ClubStance({
  stance,
  clubScore,
}: {
  stance: StanceVM | null;
  clubScore: number | null;
}) {
  return (
    <section className={styles.section}>
      <SectionEyebrow labelTone="accent" caption="Raw sentiment" captionGap={2}>
        Where the club stands
      </SectionEyebrow>

      {stance === null ? (
        <EmptyNote tall>{TICKER_EMPTY.stance}</EmptyNote>
      ) : (
        <div className={styles.row}>
          <StanceColumn pct={stance.bullPct} label="BULLISH" tone="bull" />

          {clubScore !== null ? (
            <div
              className={styles.dial}
              style={{ "--dial-pct": `${Math.max(0, Math.min(100, clubScore))}%` } as CSSProperties}
            >
              <div className={styles.dialArc} />
              <div className={styles.dialDisc}>
                <div>
                  <div className={styles.dialValue} data-numeric>
                    {Math.round(clubScore)}
                  </div>
                  <div className={styles.dialCaption}>
                    CLUB
                    <br />
                    SCORE
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <StanceColumn pct={stance.bearPct} label="BEARISH" tone="bear" />
        </div>
      )}
    </section>
  );
}

const GRID_DOTS = 10;

function StanceColumn({
  pct,
  label,
  tone,
}: {
  pct: number;
  label: string;
  tone: "bull" | "bear";
}) {
  const lit = Math.round((pct / 100) * GRID_DOTS);
  return (
    <div className={`${styles.col} ${tone === "bear" ? styles.bear : styles.bull}`}>
      <div className={styles.pct} data-numeric>
        {pct}%
      </div>
      <div className={styles.colLabel}>{label}</div>
      <div className={styles.dots} aria-hidden="true">
        {Array.from({ length: GRID_DOTS }, (_, i) => (
          <span key={i} className={`${styles.dot} ${i < lit ? styles.dotOn : ""}`} />
        ))}
      </div>
    </div>
  );
}
