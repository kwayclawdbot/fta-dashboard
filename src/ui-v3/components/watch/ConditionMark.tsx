import styles from "./ConditionMark.module.css";

/**
 * Whether one condition of a setup currently holds. `met` is the evaluated
 * truth from the setup engine — there is no third "probably" state, and the
 * component will not render one.
 */
export default function ConditionMark({
  met,
  size = "sm",
}: {
  met: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`${styles.mark} ${size === "md" ? styles.md : styles.sm} ${
        met ? styles.met : styles.pending
      }`}
      aria-hidden="true"
    >
      {met ? "✓" : "●"}
    </span>
  );
}
