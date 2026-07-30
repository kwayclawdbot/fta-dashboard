import { TICKER_EMPTY, type LevelVM } from "@/ui-v3/ticker-data";
import styles from "./KeyLevels.module.css";

/**
 * "KEY LEVELS" — the resistance/support ladder with the live price seated in it.
 *
 * These are floor-trader pivots off the last REPORTED session bar: a closed-form
 * transform of a real high, low and close, the same standing as the price line
 * itself. Nothing here is a target or a projection.
 *
 * The rows arrive already sorted high-to-low with the price row slotted into its
 * true position, so a price that has run above R1 renders above R1 rather than
 * always sitting in the middle the way the artboard's static drawing does.
 */
export default function KeyLevels({ levels }: { levels: LevelVM[] }) {
  return (
    <section className={styles.card}>
      <div className={styles.eyebrow}>Key levels</div>
      {levels.length === 0 ? (
        <p className={styles.empty}>{TICKER_EMPTY.levels}</p>
      ) : (
        <div className={styles.ladder}>
          {levels.map((level, i) => (
            <div key={`${level.kind}-${i}`} className={styles.row}>
              {level.kind === "price" ? (
                <span className={styles.priceTag} data-numeric>
                  {level.value.toFixed(2)}
                </span>
              ) : (
                <span
                  className={`${styles.tag} ${
                    level.kind === "resistance" ? styles.resistance : styles.support
                  }`}
                  data-numeric
                >
                  {level.label} {Math.round(level.value)}
                </span>
              )}
              <div
                className={
                  level.kind === "price"
                    ? styles.priceRule
                    : `${styles.rule} ${
                        level.kind === "resistance" ? styles.ruleUp : styles.ruleDown
                      }`
                }
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
