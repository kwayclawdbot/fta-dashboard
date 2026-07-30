import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./GradientPanel.module.css";

/**
 * The warm gradient panel that marks a "this is about you / today" moment.
 *
 * Four tones, each read off an artboard — `brief` and `you` from "01 Home",
 * `streak` from "07 You Profile", `close` from "06 Watch". They differ in the
 * gradient angle, the stop, the radius and the padding; nothing else. Do not add
 * a fifth without a mockup that shows one.
 *
 * `href` makes the whole panel its tap target (the Watch board's "getting close"
 * panel navigates to the setup) without changing the box.
 */
export default function GradientPanel({
  tone,
  href,
  className,
  children,
}: {
  tone: "brief" | "you" | "streak" | "close";
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  const cls = `${styles.panel} ${styles[tone]} ${className ?? ""}`;

  return href ? (
    <Link href={href} className={`${cls} ${styles.link}`}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}
