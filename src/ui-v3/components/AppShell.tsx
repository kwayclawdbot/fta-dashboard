import type { ReactNode } from "react";
import BottomNav from "./BottomNav";
import styles from "./AppShell.module.css";

/**
 * Every v3 screen sits in this shell: a centred app column with the content
 * well on top and the five-slot nav pinned underneath.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.viewport}>
      <div className={styles.screen}>
        <div className={styles.body}>{children}</div>
        <BottomNav />
      </div>
    </div>
  );
}
