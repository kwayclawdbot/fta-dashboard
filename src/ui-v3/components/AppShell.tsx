import type { ReactNode } from "react";
import BottomNav from "./BottomNav";
import styles from "./AppShell.module.css";

/**
 * Every v3 screen sits in this shell: a centred app column, the content well,
 * and whatever the artboard pins underneath it.
 *
 * The boards use three combinations and no others:
 *  - a nav destination — the five-slot nav under an 18px well (the default);
 *  - a detail screen — no nav, an action bar instead ("19 Alert Setup" arms an
 *    alert, "22 Belts" shows the next rung): `nav={false}` + `bar`;
 *  - a full-bleed screen — "23 Inside Circle", whose header, thesis bar, thread
 *    and composer each run to the column edge: `padding="bleed"`, no nav.
 *
 * `padding="bleed"` renders the children as direct children of the column, so a
 * band that should absorb the slack (the Circle's thread) keeps its own `flex:1`.
 * A bleed screen therefore has to make one of its bands grow, or its content sits
 * at the top of the column.
 */
export default function AppShell({
  children,
  nav = true,
  padding = "well",
  bar,
  className,
}: {
  children: ReactNode;
  /** The five-slot bottom nav. False on detail screens. */
  nav?: boolean;
  /** `well` = the artboard's 18px content well. `bleed` = the children own the column. */
  padding?: "well" | "bleed";
  /** Pinned bottom action bar: hairline, 12/18/24 padding, laid out as a row. */
  bar?: ReactNode;
  /** Lands on the column itself — for a screen that declares its own custom properties. */
  className?: string;
}) {
  return (
    <div className={styles.viewport}>
      <div className={`${styles.screen} ${className ?? ""}`}>
        {padding === "bleed" ? children : <div className={styles.body}>{children}</div>}
        {bar ? <div className={styles.bar}>{bar}</div> : null}
        {nav ? <BottomNav /> : null}
      </div>
    </div>
  );
}
