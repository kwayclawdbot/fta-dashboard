/**
 * CourseMarks — the four learning-path marks, drawn.
 *
 * The paths used to be told apart by a pastel rainbow (orange / green / purple /
 * blue tiles) plus an emoji each — 📊 📈 🎯 🍫. Two problems, both fatal to the
 * colour law: green and orange already MEAN something in this app (price and
 * action), and an emoji is whichever art register the member's OS ships. The
 * rainbow is gone; the paths now sit on one warm surface and are told apart by
 * the mark, which is the job a mark exists to do.
 *
 * Four marks, one family, same brief as Belt/StreakFlame — single 2px line,
 * one flat fill, nothing that could have come from an icon set:
 *
 *   foundations  seedling growing out of a ruled ledger page
 *   charts       compass rose over a rule
 *   money        coin dropping into a jar
 *   discipline   stopwatch standing over a single candle
 *
 * The FTA register is metallic gold rather than volt orange, so each mark takes
 * a `tone` and the FTA hub passes "fta".
 */
import type { ReactNode } from "react";

export type CourseMarkTone = "club" | "fta" | "neutral";
export type CourseMarkKey = "foundations" | "charts" | "money" | "discipline";

const TONE_LINE: Record<CourseMarkTone, string> = {
  club: "var(--color-volt-600)",
  fta: "var(--fg600, #B8860B)",
  neutral: "currentColor",
};

const TONE_FILL: Record<CourseMarkTone, string> = {
  club: "color-mix(in srgb, var(--color-volt-500) 16%, transparent)",
  fta: "color-mix(in srgb, var(--fg600, #B8860B) 18%, transparent)",
  neutral: "color-mix(in srgb, currentColor 12%, transparent)",
};

export interface CourseMarkProps {
  mark?: CourseMarkKey;
  size?: number;
  tone?: CourseMarkTone;
  title?: string;
  className?: string;
}

function Frame({
  size,
  tone,
  title,
  className,
  children,
}: {
  size: number;
  tone: CourseMarkTone;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <g
        stroke={TONE_LINE[tone]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        {children}
      </g>
    </svg>
  );
}

/** Seedling in a ledger — the first principles path. */
export function FoundationsMark({ size = 32, tone = "club", title, className }: CourseMarkProps) {
  return (
    <Frame size={size} tone={tone} title={title} className={className}>
      <path d="M7 9h26v24H7z" fill={TONE_FILL[tone]} />
      <path d="M7 15h26M7 21h9M7 27h7" strokeOpacity={0.45} />
      <path d="M20 33V20" />
      <path d="M20 22c-1.5-3.5-4.5-4.5-7-4 .5 3.5 3.5 5.5 7 4Z" fill={TONE_FILL[tone]} />
      <path d="M20 25c1.5-4 4.8-5.2 7.5-4.6-.6 4-4 6-7.5 4.6Z" fill={TONE_FILL[tone]} />
    </Frame>
  );
}

/** Compass rose — reading a chart is orientation, not prediction. */
export function ChartsMark({ size = 32, tone = "club", title, className }: CourseMarkProps) {
  return (
    <Frame size={size} tone={tone} title={title} className={className}>
      <circle cx="20" cy="19" r="12" fill={TONE_FILL[tone]} />
      <path d="M25.5 13.5 22 21l-7.5 3.5L18 17Z" fill={TONE_FILL[tone]} />
      <path d="M20 4v3M20 31v3M5 19h3M32 19h3" />
    </Frame>
  );
}

/** Coin into a jar — the money path. */
export function MoneyMark({ size = 32, tone = "club", title, className }: CourseMarkProps) {
  return (
    <Frame size={size} tone={tone} title={title} className={className}>
      <path d="M11 18h18v12a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V18Z" fill={TONE_FILL[tone]} />
      <path d="M9.5 16.5h21" />
      <circle cx="20" cy="8" r="5" fill={TONE_FILL[tone]} />
      <path d="M20 5.5v5M18.5 7h3" strokeOpacity={0.7} />
      <path d="M16 24h8" strokeOpacity={0.45} />
    </Frame>
  );
}

/** Stopwatch over a candle — discipline is timing, held. */
export function DisciplineMark({ size = 32, tone = "club", title, className }: CourseMarkProps) {
  return (
    <Frame size={size} tone={tone} title={title} className={className}>
      <circle cx="20" cy="20" r="11" fill={TONE_FILL[tone]} />
      <path d="M17 4h6M20 4v3" />
      <path d="M20 14v6l4 3" />
      <path d="M31 31l3 3" strokeOpacity={0.5} />
    </Frame>
  );
}

const MARKS: Record<CourseMarkKey, (p: CourseMarkProps) => ReactNode> = {
  foundations: FoundationsMark,
  charts: ChartsMark,
  money: MoneyMark,
  discipline: DisciplineMark,
};

/** Pick a mark by key. Unknown keys fall back to the foundations seedling. */
export function CourseMark({ mark = "foundations", ...rest }: CourseMarkProps) {
  const C = MARKS[mark] ?? FoundationsMark;
  return <>{C(rest)}</>;
}

/**
 * Deterministic mark for a path slug — so a course that never declared a mark
 * still gets a stable, sensible one instead of a random draw per render.
 */
export function markForSlug(slug: string): CourseMarkKey {
  const s = (slug || "").toLowerCase();
  if (/found|start|basic|intro|first/.test(s)) return "foundations";
  if (/chart|technical|pattern|candle|read/.test(s)) return "charts";
  if (/money|invest|portfolio|save|budget|fund/.test(s)) return "money";
  if (/discipl|risk|psych|mindset|routine|plan/.test(s)) return "discipline";
  // stable hash → one of four, never Math.random
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (["foundations", "charts", "money", "discipline"] as const)[h % 4];
}

/**
 * Progress ring around a mark — replaces the "3/8" text tucked under a tile.
 * The ring IS the progress; the mark keeps its own identity inside it.
 */
export function CourseMarkRing({
  pct,
  mark,
  size = 56,
  tone = "club",
  title,
  className = "",
}: CourseMarkProps & { pct: number }) {
  const p = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--off-bg)" strokeWidth={2} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_LINE[tone]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${(c * p) / 100} ${c}`}
        />
      </svg>
      <CourseMark mark={mark} tone={tone} title={title} size={Math.round(size * 0.56)} />
    </span>
  );
}

export default CourseMark;
