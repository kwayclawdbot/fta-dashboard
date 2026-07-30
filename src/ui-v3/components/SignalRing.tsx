import type { CSSProperties } from "react";
import styles from "./SignalRing.module.css";

/**
 * A conic progress dial with a value in the middle.
 *
 * `pct` fills the ring; `value` and `caption` are what the inner disc reads.
 * The caller decides what the number means — this primitive never derives it.
 *
 * Three sizes, one per artboard, plus the disc tone (see SignalRing.module.css):
 *   sm 48px, --surface disc — "01 Home", the YOU strip
 *   md 64px, --bg disc      — "07 You Profile", where the disc is a hole in the page
 *   lg 88px, --surface disc — "06 Watch", a met/total fraction with no caption
 *
 * `caption` takes an array when the artboard stacks it on two lines
 * ("OPINION" / "SCORE"), and is omitted entirely on the Watch dial.
 */
export default function SignalRing({
  pct,
  value,
  caption,
  size = "sm",
  discTone = "surface",
}: {
  /** 0-100. The conic hard stop. */
  pct: number;
  value: string;
  /** One entry per line. Omit for a dial the artboard leaves uncaptioned. */
  caption?: string | string[];
  size?: "sm" | "md" | "lg";
  discTone?: "surface" | "bg";
}) {
  const lines = caption === undefined ? [] : Array.isArray(caption) ? caption : [caption];

  return (
    <div
      className={`${styles.ring} ${styles[size]} ${
        discTone === "bg" ? styles.discBg : styles.discSurface
      }`}
      style={{ "--ring-pct": `${Math.max(0, Math.min(100, pct))}%` } as CSSProperties}
    >
      <div className={styles.disc}>
        <div>
          <div className={styles.value} data-numeric>
            {value}
          </div>
          {lines.length > 0 ? (
            <div className={styles.label}>
              {lines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
