import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./GradientPanel.module.css";

/**
 * The warm gradient panel that marks a "this is about you / today" moment.
 *
 * Five tones, each read off an artboard — `brief` and `you` from "01 Home",
 * `streak` from "07 You Profile", `close` from "06 Watch", `pro` from
 * "11 Pricing". The first four differ only in the gradient angle, the stop, the
 * radius and the padding.
 *
 * `pro` is the one that also changes the hairline: the paid plan card is the
 * only panel on any board drawn with a FULL-accent 1.5px border and an accent
 * halo instead of the shared `--accent-soft` hairline. That is the artboard
 * saying "this is the selected plan", so it is a tone rather than a second
 * component. Do not add a sixth without a mockup that shows one.
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
  tone: "brief" | "you" | "streak" | "close" | "pro";
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
