import type { CSSProperties } from "react";
import type { BeltKey } from "@/lib/belts";
import { beltPaint } from "./belt-paint";
import styles from "./BeltChip.module.css";

/**
 * The belt chip beside a name — "04 Club Feed" draws "Black Belt" and
 * "Blue Belt"; "23 Inside Circle" draws the same chip abbreviated.
 *
 * `label` is the real belt name off `beltForXp()`. The artboard chip carries no
 * degree numeral, so the adapter passes the belt name rather than the full
 * "Blue Belt II" rank label.
 */
export default function BeltChip({
  belt,
  label,
  size = "md",
}: {
  belt: BeltKey;
  label: string;
  size?: "md" | "sm";
}) {
  const paint = beltPaint(belt);
  return (
    <span
      className={`${styles.chip} ${size === "sm" ? styles.sm : styles.md}`}
      style={{ "--chip-bg": paint.bg, "--chip-fg": paint.fg } as CSSProperties}
    >
      {label}
    </span>
  );
}
