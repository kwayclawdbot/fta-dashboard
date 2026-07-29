import styles from "./RankPip.module.css";

/**
 * The rank disc on a ranked card. `lead` is the accent treatment the artboards
 * reserve for rank 1 — accent is rationed, so only one pip per strip wears it.
 */
export default function RankPip({ rank, lead = false }: { rank: number; lead?: boolean }) {
  return (
    <span className={`${styles.pip} ${lead ? styles.lead : ""}`} data-numeric>
      {rank}
    </span>
  );
}
