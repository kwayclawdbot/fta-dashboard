import type { CSSProperties } from "react";
import Link from "next/link";
import { compactCount, CIRCLE_DAYS, type CircleBubbleVM } from "@/ui-v3/club-data";
import { circleGlyph, circlePaint } from "./circle-paint";
import styles from "./CircleBubble.module.css";

/**
 * A Circle, drawn as the artboards' 96px bubble.
 *
 * THE RING IS THE CLOCK. "16 Club Circles" paints it
 * `conic-gradient(<arc> 0 P%, --border P% 100%)`, and the same Circle appears
 * again on "23 Inside Circle" at the same P (22%) — so P is the elapsed share of
 * that Circle's own 30-day clock, and the arc colour is the same one the clock
 * text takes: --accent normally, --negative when the Circle is nearly out of
 * time (the artboard's Fed Decision, 1d 20h, is drawn --negative on both).
 *
 * THE DISC IS THE TICKER — see ./circle-paint.ts. The artboards give tickerless
 * Circles an emoji instead of a glyph, but no emoji column exists.
 *
 * `variant` matches the two the artboards draw:
 *   "feed" — "04 Club Feed": 104px column, 3px ring, "· 1.8K joined" meta.
 *   "grid" — "16 Club Circles": 110px column, 4px ring, "Topic · 6d 14h · 1.8K".
 */
export default function CircleBubble({
  circle,
  variant,
}: {
  circle: CircleBubbleVM;
  variant: "feed" | "grid";
}) {
  const paint = circlePaint(circle.ticker);
  const glyph = circleGlyph(circle.ticker, circle.topic);

  const style = {
    "--arc": circle.urgent ? "var(--negative)" : "var(--accent)",
    "--pct": `${circle.elapsedPct}%`,
    "--disc-bg": paint.bg,
    "--disc-fg": paint.fg,
  } as CSSProperties;

  return (
    <Link
      href={`/v3/club/circles/${circle.slug}`}
      className={`${styles.cell} ${variant === "grid" ? styles.grid : styles.feed}`}
    >
      <div className={styles.ring} style={style}>
        <div className={styles.disc} aria-hidden="true">
          {glyph}
        </div>
      </div>
      <div className={styles.title}>{circle.title}</div>
      <div className={styles.meta}>
        {variant === "grid" ? (
          <>
            {circle.topic} ·{" "}
            <Clock circle={circle} /> · <span data-numeric>{compactCount(circle.members)}</span>
          </>
        ) : (
          <>
            <Clock circle={circle} prefix="⏳ " /> ·{" "}
            <span data-numeric>{compactCount(circle.members)}</span> joined
          </>
        )}
      </div>
    </Link>
  );
}

/** The mono clock run. --negative under 48h, --accent-strong above. */
function Clock({ circle, prefix = "" }: { circle: CircleBubbleVM; prefix?: string }) {
  if (!circle.clock) return <span className={styles.closed}>closed</span>;
  return (
    <span className={circle.urgent ? styles.clockUrgent : styles.clock} data-numeric>
      {prefix}
      {circle.clock}
    </span>
  );
}

/**
 * The artboard's ninth grid cell: a dashed opener bubble with a full --positive
 * ring. It opens a real Circle — `club_circles` + the opener's own
 * `club_circle_members` row — via /v3/club/circles/new.
 *
 * Withheld entirely from a register that cannot open one, rather than rendered
 * inert: this cell IS the affordance, so an unclickable copy of it would just be
 * a grid cell that does nothing.
 */
export function StartCircleBubble({ canPost = true }: { canPost?: boolean }) {
  if (!canPost) return null;
  return (
    <Link href="/v3/club/circles/new" className={`${styles.cell} ${styles.grid}`}>
      <div className={styles.ring} style={{ "--arc": "var(--positive)", "--pct": "100%" } as CSSProperties}>
        <div className={styles.discOpen} aria-hidden="true">
          +
        </div>
      </div>
      <div className={styles.titleIdle}>Start yours</div>
      <div className={styles.metaFaint}>{CIRCLE_DAYS} days on the clock</div>
    </Link>
  );
}
