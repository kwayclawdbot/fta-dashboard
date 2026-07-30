import styles from "./Sparkline.module.css";

/**
 * The artboards' attention/price sparkline: a single open polyline, no fill, no
 * axis, no dot. Three call sites exist and they differ only in box and weight:
 *
 *   02 Discover · Rising fast     90x22, stroke 1.8, stretched to the card width
 *   02 Discover · Quiet to loud   60x30, stroke 1.8, stretched to the column
 *   15 Screener · row             52x18, stroke 1.6, fixed size
 *
 * `series` is the real number series; the component only maps it into the box.
 * It never invents points — a caller with no series must not render one.
 */

export type SparkTone = "positive" | "negative" | "accent" | "gold";

export default function Sparkline({
  series,
  viewWidth,
  viewHeight,
  strokeWidth,
  tone,
  stretch = false,
}: {
  series: number[];
  viewWidth: number;
  viewHeight: number;
  strokeWidth: number;
  tone: SparkTone;
  /** true → width:100% + preserveAspectRatio="none" (the two 02 Discover uses). */
  stretch?: boolean;
}) {
  if (series.length < 2) return null;

  // All three artboard sparklines draw inside ~76% of their box height, centred
  // (22px box → y 2..19, 30px → 4..27, 18px → 2..15). One ratio reproduces all
  // three, and it keeps the stroke cap clear of the edges at every size.
  const pad = viewHeight * 0.12;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const usable = viewHeight - pad * 2;

  const d = series
    .map((value, i) => {
      const x = (i / (series.length - 1)) * viewWidth;
      const y = pad + (1 - (value - min) / span) * usable;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className={`${styles.spark} ${stretch ? styles.stretch : ""} ${styles[tone]}`}
      width={stretch ? "100%" : viewWidth}
      height={viewHeight}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      preserveAspectRatio={stretch ? "none" : undefined}
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}
