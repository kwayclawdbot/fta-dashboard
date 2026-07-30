"use client";

import type { InputHTMLAttributes } from "react";
import styles from "./FieldInput.module.css";

/**
 * The text field, exactly as board 10 draws it: `--surface` fill, 1px `--border`,
 * radius 14, 13/15 padding, 13px text with the placeholder at `--text-faint`.
 *
 * Board 10 draws ONE of these (the email address). Login needs two, because the
 * auth this app actually runs is email + password — so the second field is the
 * same primitive repeated, not a new pattern. The seeding step's search box is
 * the same box again.
 *
 * The label is visually hidden rather than absent: the artboard leans on the
 * placeholder alone, which leaves a screen reader with an unnamed input.
 */
export default function FieldInput({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input className={styles.input} {...props} />
    </label>
  );
}
