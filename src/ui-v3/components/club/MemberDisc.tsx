import type { CSSProperties } from "react";
import type { BeltKey } from "@/lib/belts";
import { beltPaint } from "./belt-paint";
import styles from "./MemberDisc.module.css";

/**
 * A member's initials disc. Two sizes, both off the artboards:
 *   "md" 32px — "04 Club Feed" (composer row and every post head)
 *   "lg" 36px — "23 Inside Circle" (a note author, ringed in their belt colour)
 *
 * No avatar image is drawn: the artboards draw initials in every one of these
 * slots, so a `profiles.avatar_url` would be a different element than the one
 * the design specifies.
 */
export default function MemberDisc({
  initials,
  size = "md",
  belt,
}: {
  initials: string;
  size?: "md" | "lg";
  belt?: BeltKey | null;
}) {
  const ring = belt ? beltPaint(belt).ring : null;
  return (
    <div
      className={`${styles.disc} ${size === "lg" ? styles.lg : styles.md} ${ring ? styles.ringed : ""}`}
      style={ring ? ({ "--ring": ring } as CSSProperties) : undefined}
    >
      {initials}
    </div>
  );
}
