import Link from "next/link";
import styles from "./DestinationList.module.css";

/**
 * A destination plus the one number that says why you'd go there.
 *
 * Promoted from `watch/WatchDestinations` unchanged — same markup, same
 * stylesheet, same pixels. It moved up because "06 Watch" is no longer its only
 * caller: the interim Learn and Live entries on Home and Club are the same
 * object, and a Watch-named component sitting on Home would be the wrong name
 * on the wrong screen rather than a shared primitive.
 */
export interface DestinationRowVM {
  /** The row's own leading emoji, kept as text the way the nav glyphs are. */
  glyph: string;
  title: string;
  /** The one number that says why you'd go here. Null when there is no source. */
  caption: string | null;
  /** A live count worth an accent pill; null renders the chevron instead. */
  badge: number | null;
  /** Null leaves the row inert — a destination with nowhere to go yet. */
  href: string | null;
  /**
   * TRUE = this row leaves v3 for the old app.
   *
   * v3 rows normally never link into old chrome (it breaks out of the rebuilt
   * shell mid-journey). Learn and Live are the deliberate exception: the owner's
   * interim IA keeps the five-tab nav and points these two at the existing
   * old-chrome screens until they get artboards of their own. Marking them says
   * so in the markup instead of leaving a silent one-way door.
   */
  leavesV3?: boolean;
}

export default function DestinationList({
  rows,
  spacing = "standalone",
}: {
  rows: DestinationRowVM[];
  /**
   * `standalone` — opens a region on its own ("06 Watch", straight off the
   * header). `underEyebrow` — sits beneath a SectionEyebrow as that section's
   * content. The two are different vertical steps in the grammar (§2), not a
   * preference.
   */
  spacing?: "standalone" | "underEyebrow";
}) {
  return (
    <div
      className={`${styles.list} ${
        spacing === "underEyebrow" ? styles.listUnderEyebrow : ""
      }`}
    >
      {rows.map((row) => {
        const inner = (
          <>
            <span className={styles.glyph} aria-hidden="true">
              {row.glyph}
            </span>
            <span className={styles.copy}>
              <span className={styles.title}>{row.title}</span>
              {row.caption ? <span className={styles.caption}>{row.caption}</span> : null}
            </span>
            {row.badge !== null ? (
              <span className={styles.badge} data-numeric>
                {row.badge}
              </span>
            ) : (
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            )}
          </>
        );

        // A row with no destination yet is inert rather than a dead link. Rows
        // that DO leave v3 say so to assistive tech, since the shell, the nav
        // and the type all change on the other side of the tap.
        return row.href ? (
          <Link
            key={row.title}
            href={row.href}
            className={styles.row}
            data-leaves-v3={row.leavesV3 ? "" : undefined}
          >
            {inner}
            {row.leavesV3 ? (
              <span className={styles.srOnly}>Opens the classic view</span>
            ) : null}
          </Link>
        ) : (
          <div key={row.title} className={styles.row}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
