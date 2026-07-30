import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./PillButton.module.css";

/**
 * The radius-24 pill the onboarding boards use for every full-width action.
 * Two tones, both drawn on board 10:
 *
 *  - `accent` — the one primary action in the region ("Sign in", "Join the
 *    Club"). Accent fill, `--accent-on` text, the accent halo. Grammar §4.4.
 *  - `surface` — a secondary provider button ("Continue with Google"):
 *    `--surface` fill, `--border` hairline, `--text`.
 *
 * `size` is the 1px the two boards disagree by: board 10's sign-in pill sets its
 * label at 14px, board 11's pinned CTA at 14.5px. Named after the difference.
 */
export default function PillButton({
  tone = "accent",
  size = "form",
  children,
  ...props
}: {
  tone?: "accent" | "surface";
  size?: "form" | "bar";
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${styles.pill} ${styles[tone]} ${size === "bar" ? styles.bar : ""}`}
    >
      {children}
    </button>
  );
}

/** The same pill when the action is a navigation rather than a submit. */
export function PillLink({
  href,
  tone = "accent",
  size = "form",
  children,
}: {
  href: string;
  tone?: "accent" | "surface";
  size?: "form" | "bar";
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={`${styles.pill} ${styles[tone]} ${size === "bar" ? styles.bar : ""}`}
    >
      {children}
    </a>
  );
}
