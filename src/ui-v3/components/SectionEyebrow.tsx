import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./SectionEyebrow.module.css";

/**
 * Opens a section. Mono / 9.5px / .16em / uppercase — the artboards use this
 * exact treatment for every section head across all 23 boards, with a small set
 * of variations that are real differences between boards, not preference:
 *
 * | variant       | values                | drawn by                          |
 * | ------------- | --------------------- | --------------------------------- |
 * | `labelTone`   | `text` (default)      | Home, Club Feed                   |
 * |               | `accent`              | Discover ×5, You Profile, Belts   |
 * | `actionTone`  | `accent` (default)    | Home "See all"                    |
 * |               | `dim`                 | Discover, Club Feed, You "See all"|
 * | `actionSize`  | `word` 11px (default) | "See all"                         |
 * |               | `glyph` 12px          | the bare "→" on 02 Discover       |
 * | `captionGap`  | `3` (default)         | Home                              |
 * |               | `2`                   | every Discover caption            |
 *
 * When `labelTone` is `text` the label may carry ONE <EyebrowAccent> run
 * ("TOP IN *the club*"). An all-accent label is `labelTone="accent"` instead —
 * the two are different boards, never combined.
 *
 * The action renders as a Link when `actionHref` is given and as inert text when
 * it is not (the screener's "→" marks a section that has no destination yet).
 */
export default function SectionEyebrow({
  children,
  caption,
  captionGap = 3,
  labelTone = "text",
  actionLabel,
  actionHref,
  actionTone = "accent",
  actionSize = "word",
}: {
  children: ReactNode;
  caption?: string;
  /** Artboard's caption offset, in px. */
  captionGap?: 2 | 3;
  labelTone?: "text" | "accent";
  actionLabel?: string;
  actionHref?: string;
  actionTone?: "accent" | "dim";
  actionSize?: "word" | "glyph";
}) {
  const actionClass = [
    styles.action,
    actionTone === "dim" ? styles.actionDim : "",
    actionSize === "glyph" ? styles.glyph : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={styles.row}>
        <span
          className={`${styles.label} ${labelTone === "accent" ? styles.labelAccent : ""}`}
        >
          {children}
        </span>
        {actionLabel ? (
          actionHref ? (
            <Link href={actionHref} className={actionClass}>
              {actionLabel}
            </Link>
          ) : (
            <span className={actionClass}>{actionLabel}</span>
          )
        ) : null}
      </div>
      {caption ? (
        <div className={`${styles.caption} ${captionGap === 2 ? styles.captionGap2 : ""}`}>
          {caption}
        </div>
      ) : null}
    </>
  );
}

/** The accent-tinted run inside a `labelTone="text"` eyebrow. */
export function EyebrowAccent({ children }: { children: ReactNode }) {
  return <span className={styles.accent}>{children}</span>;
}
