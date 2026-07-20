/**
 * FIC decorative motif kit — the reusable gold vocabulary lifted from the
 * avatar packs + story art (sun-circle, gold leaf sprig, four-point sparkle,
 * halftone dot cluster). These are the connective tissue that make every new
 * surface read as one warm-paper family: drop them behind emblems, empty
 * states, celebration cards, the setup trail.
 *
 * Pure inline SVG, no client JS — safe in server or client components.
 * Gold defaults (#F59E0B / #FBBF24); pass `className` for sizing/color.
 */

export function SunCircle({
  className = "",
  color = "#FBBF24",
  opacity = 0.18,
}: {
  className?: string;
  color?: string;
  opacity?: number;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill={color} opacity={opacity} />
    </svg>
  );
}

export function Sparkle({
  className = "",
  color = "#F59E0B",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 1c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"
        fill={color}
      />
    </svg>
  );
}

export function LeafSprig({
  className = "",
  color = "#F59E0B",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 48 24" className={className} aria-hidden="true" fill="none">
      <path
        d="M4 20C14 20 22 15 30 4"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {[8, 14, 20, 26].map((x, i) => (
        <path
          key={i}
          d={`M${x} ${18 - i * 2.6}c2-2.4 5-2.8 7-1-1.6 2.2-4.6 2.8-7 1z`}
          fill={color}
          opacity={0.85}
        />
      ))}
    </svg>
  );
}

export function DotCluster({
  className = "",
  color = "#FBBF24",
}: {
  className?: string;
  color?: string;
}) {
  const rows = 4;
  const cols = 5;
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Fade the cluster out toward the bottom-right (halftone feel).
      const op = 0.9 - (r + c) * 0.09;
      if (op <= 0.05) continue;
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={4 + c * 6}
          cy={4 + r * 6}
          r={1.6}
          fill={color}
          opacity={op}
        />
      );
    }
  }
  return (
    <svg viewBox="0 0 34 28" className={className} aria-hidden="true">
      {dots}
    </svg>
  );
}

/**
 * A soft warm-paper arch/halo backdrop for a subject — the rounded arch that
 * recurs behind the avatar illustrations. Absolutely positioned; place inside a
 * relative container behind content.
 */
export function PaperHalo({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 -z-10 ${className}`}
      aria-hidden="true"
    >
      <div className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-gold-400/10 to-transparent" />
    </div>
  );
}
