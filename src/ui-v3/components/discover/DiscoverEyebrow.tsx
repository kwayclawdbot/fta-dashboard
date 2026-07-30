import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./DiscoverEyebrow.module.css";

/**
 * The section head used on "02 Discover" and "15 Discover Screener".
 *
 * It is NOT the Home eyebrow. Home draws the label in --text with at most one
 * accent run and puts an accent action on the right; both Discover artboards
 * invert that — the WHOLE label is accent, and the trailing action is the muted
 * text ramp. Rather than widen the shared SectionEyebrow (which other lanes are
 * building against), the Discover treatment lives here. See the lane report:
 * the two should be reconciled into one primitive at integration.
 *
 * `action` renders at 11px for a worded action ("See all") and 12px for the
 * bare "→" glyph — the artboard's own two sizes.
 */
export default function DiscoverEyebrow({
  children,
  caption,
  actionLabel,
  actionHref,
  actionSize = "word",
}: {
  children: ReactNode;
  caption?: string;
  actionLabel?: string;
  actionHref?: string;
  actionSize?: "word" | "glyph";
}) {
  return (
    <>
      <div className={styles.row}>
        <span className={styles.label}>{children}</span>
        {actionLabel ? (
          actionHref ? (
            <Link
              href={actionHref}
              className={`${styles.action} ${actionSize === "glyph" ? styles.glyph : ""}`}
            >
              {actionLabel}
            </Link>
          ) : (
            <span className={`${styles.action} ${actionSize === "glyph" ? styles.glyph : ""}`}>
              {actionLabel}
            </span>
          )
        ) : null}
      </div>
      {caption ? <div className={styles.caption}>{caption}</div> : null}
    </>
  );
}
