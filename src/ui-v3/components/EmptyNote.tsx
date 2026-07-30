import type { ReactNode } from "react";
import styles from "./EmptyNote.module.css";

/**
 * What a section renders when its data is genuinely empty.
 *
 * The artboards never draw an empty state — they are all shot on a full club —
 * so the honest move is NOT to invent a new visual pattern for absence. This is
 * the artboards' own container: the same --surface fill, 1px --border and
 * radius the flat cards on "02 Discover" and "07 You Profile" carry, holding one
 * muted sentence at the caption ramp. The section keeps its eyebrow, so the
 * screen's rhythm is identical whether the region is full or waiting.
 *
 * `tall` matches the height of the panel it stands in for (the Most-divisive
 * donut, the Getting-close panel) so the screen does not jump when data lands.
 */
export default function EmptyNote({
  children,
  tall = false,
  center = false,
}: {
  children: ReactNode;
  tall?: boolean;
  center?: boolean;
}) {
  return (
    <div
      className={`${styles.note} ${tall ? styles.tall : ""} ${center ? styles.center : ""}`}
    >
      {children}
    </div>
  );
}
