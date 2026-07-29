import styles from "./ScreenPlaceholder.module.css";

/** A named, not-yet-translated screen. Keeps the nav honest and navigable. */
export default function ScreenPlaceholder({ name }: { name: string }) {
  return (
    <div className={styles.wrap}>
      <div>
        <div className={styles.name}>{name}</div>
        <div className={styles.note}>Not translated yet</div>
      </div>
    </div>
  );
}
