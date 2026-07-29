import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./SectionEyebrow.module.css";

/**
 * Opens a section. Mono / 9.5px / .16em / uppercase — the artboards use this
 * exact treatment for every section head, with two optional extras:
 * a right-aligned accent action on the same baseline, and a caption beneath.
 */
export default function SectionEyebrow({
  children,
  caption,
  actionLabel,
  actionHref,
}: {
  children: ReactNode;
  caption?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <>
      <div className={styles.row}>
        <span className={styles.label}>{children}</span>
        {actionLabel && actionHref ? (
          <Link href={actionHref} className={styles.action}>
            {actionLabel}
          </Link>
        ) : null}
      </div>
      {caption ? <div className={styles.caption}>{caption}</div> : null}
    </>
  );
}

/** The accent-tinted run inside an eyebrow. */
export function EyebrowAccent({ children }: { children: ReactNode }) {
  return <span className={styles.accent}>{children}</span>;
}
