import styles from "./BrandMark.module.css";

/**
 * The brand mark at the two sizes the onboarding boards draw it: an accent disc
 * with a rotated square knocked out of it in `--bg`.
 *
 * | size     | disc | glyph | rings | board      |
 * | -------- | ---- | ----- | ----- | ---------- |
 * | `splash` | 92   | 26    | two   | 09 Splash  |
 * | `auth`   | 64   | 17    | none  | 10 Login   |
 *
 * Board 01 draws the same object at 30px inside `TopBarV3`, which still owns its
 * own copy. Consolidating the three would touch a shipped primitive on Home, and
 * the grammar's rule for that is capture-then-diff across every screen — a job
 * for its own pass, not a side effect of adding two new sizes.
 *
 * The splash's inner ring pings (`cping` in the mockup's own <style>). Under
 * `prefers-reduced-motion` it holds at its rest frame rather than disappearing,
 * so the mark keeps the same silhouette either way.
 */
export default function BrandMark({ size }: { size: "splash" | "auth" }) {
  if (size === "auth") {
    return (
      <div className={`${styles.disc} ${styles.discAuth}`}>
        <div className={`${styles.glyph} ${styles.glyphAuth}`} />
      </div>
    );
  }

  return (
    <div className={styles.splash}>
      <span className={styles.ping} />
      <span className={styles.halo} />
      <div className={`${styles.disc} ${styles.discSplash}`}>
        <div className={`${styles.glyph} ${styles.glyphSplash}`} />
      </div>
    </div>
  );
}
