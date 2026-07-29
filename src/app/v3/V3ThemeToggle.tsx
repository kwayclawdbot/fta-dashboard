"use client";

import { useState } from "react";
import styles from "./v3.module.css";

/**
 * Flips `data-theme` on the nearest [data-ui="v3"] root so both token twins can
 * be proved in the browser. Scaffold-level only: no persistence, no coupling to
 * the old `fta-theme` preference.
 */
export default function V3ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next = theme === "dark" ? "light" : "dark";
    const root = event.currentTarget.closest<HTMLElement>('[data-ui="v3"]');
    root?.setAttribute("data-theme", next);
    setTheme(next);
  }

  return (
    <button type="button" onClick={toggle} className={styles.themeToggle}>
      <span className={styles.themeToggleDot} />
      {theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}
