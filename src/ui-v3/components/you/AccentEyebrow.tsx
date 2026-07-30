import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./AccentEyebrow.module.css";

/**
 * The section eyebrow as the You boards draw it: mono / 9.5px / .16em /
 * uppercase in --accent, with an optional dim action on the same baseline.
 *
 * Deliberately NOT the shared <SectionEyebrow>, whose colour assignment is the
 * opposite (see AccentEyebrow.module.css).
 */
export default function AccentEyebrow({
  children,
  actionLabel,
  actionHref,
}: {
  children: ReactNode;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{children}</span>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className={styles.action}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
