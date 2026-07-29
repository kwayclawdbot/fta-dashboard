import type { ReactNode } from "react";
import styles from "./GradientPanel.module.css";

/**
 * The warm gradient panel that marks the two "this is about you / today"
 * moments on Home. Two tones, both from the artboards — do not add a third
 * without a mockup that shows one.
 */
export default function GradientPanel({
  tone,
  className,
  children,
}: {
  tone: "brief" | "you";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${styles.panel} ${styles[tone]} ${className ?? ""}`}>{children}</div>
  );
}
