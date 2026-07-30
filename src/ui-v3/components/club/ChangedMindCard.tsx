import type { ChangedMindVM } from "@/ui-v3/club-data";
import BeltChip from "./BeltChip";
import MemberDisc from "./MemberDisc";
import styles from "./ChangedMindCard.module.css";

/**
 * The "Changed my mind" card — a `stance_events` flip, which is a first-class
 * table (migration 151) read through `get_changed_minds`.
 *
 * The artboard tones the OLD stance and leaves the new one neutral, so the flip
 * reads as a direction rather than a verdict. 🔥 is the event's `respect` count;
 * the artboard's 💬 has no source on a stance event and is omitted.
 */
export default function ChangedMindCard({ flip }: { flip: ChangedMindVM }) {
  const fromTone =
    flip.fromStance === "bull"
      ? styles.bull
      : flip.fromStance === "bear"
        ? styles.bear
        : styles.flat;

  return (
    <article className={styles.card}>
      <div className={styles.eyebrow}>Changed my mind</div>

      <div className={styles.head}>
        <MemberDisc initials={flip.initials} />
        <div className={styles.identity}>
          <span className={styles.name}>{flip.authorName}</span>{" "}
          {flip.beltKey && flip.beltLabel ? (
            <BeltChip belt={flip.beltKey} label={`${flip.beltLabel} Belt`} />
          ) : null}
        </div>
        <span className={styles.ticker}>${flip.ticker}</span>
      </div>

      <div className={styles.flip}>
        {flip.fromLabel ? (
          <>
            <span className={`${styles.stance} ${fromTone}`}>{flip.fromLabel}</span>
            <span className={styles.arrow}>→</span>
          </>
        ) : null}
        <span className={`${styles.stance} ${styles.to}`}>{flip.toLabel}</span>
      </div>

      {flip.note ? <p className={styles.note}>{flip.note}</p> : null}

      <div className={styles.actions}>
        {/* Zero respect is not a count worth printing — same rule as the post
            card's 👍/💬 row. */}
        {flip.respect !== null && flip.respect > 0 ? (
          <span data-numeric>🔥 {flip.respect}</span>
        ) : null}
        <span className={styles.save} aria-hidden="true">
          🔖
        </span>
      </div>
    </article>
  );
}
