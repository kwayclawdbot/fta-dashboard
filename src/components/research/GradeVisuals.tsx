"use client";

/**
 * Grade visuals (Lane 9) — the WallStreetZen-style presentation the owner
 * screenshots mandate: circular LETTER-GRADE rings (A–F, colored arc) for the
 * four dimensions and one hero VERDICT GAUGE (dial + needle) with a plain-English
 * Strong/Solid/Mixed/Weak label — never buy/hold/sell.
 *
 * Letter colors are SEMANTIC (a green A is green in both themes) so they render
 * from fixed hex; surrounding text uses theme tokens.
 */

import type { Letter, Verdict } from "@/lib/research/grades";

const LETTER_HEX: Record<Letter, string> = {
  A: "#16a34a",
  B: "#65a30d",
  C: "#d97706",
  D: "#ea580c",
  F: "#dc2626",
};
const INSUFFICIENT_HEX = "#94a3b8";

export function letterColor(letter: Letter | null): string {
  return letter ? LETTER_HEX[letter] : INSUFFICIENT_HEX;
}

/** Fraction of the ring to fill by letter (A full → F sliver). */
const LETTER_FILL: Record<Letter, number> = { A: 1, B: 0.8, C: 0.6, D: 0.4, F: 0.22 };

/* ───────────────────────── Letter-grade ring ───────────────────────────── */

export function LetterGradeRing({
  letter,
  label,
  size = 68,
  onClick,
  active = false,
}: {
  letter: Letter | null;
  label: string;
  size?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fill = letter ? LETTER_FILL[letter] : 0;
  const color = letterColor(letter);
  const cx = size / 2;

  const Inner = (
    <span className="flex flex-col items-center gap-1.5">
      <span className="relative inline-flex" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block -rotate-90">
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            className="text-sand"
            stroke="currentColor"
            strokeWidth={stroke}
          />
          {letter && (
            <circle
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - fill)}
            />
          )}
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-display font-bold"
          style={{ color, fontSize: size * 0.34 }}
        >
          {letter ?? "—"}
        </span>
      </span>
      <span
        className={`text-[11px] font-semibold ${active ? "text-ink" : "text-soft"}`}
      >
        {label}
      </span>
    </span>
  );

  if (!onClick) return Inner;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl px-1.5 py-1 transition-colors hover:bg-paper ${
        active ? "bg-paper" : ""
      }`}
    >
      {Inner}
    </button>
  );
}

/* ───────────────────────────── Verdict gauge ───────────────────────────── */
// Semicircle dial: red → orange → amber → lime → green (Weak → Strong), a needle
// at `gauge` (0..1), and the plain-English verdict + overall letter under it.

export function VerdictGauge({
  gauge,
  label,
  letter,
  graded,
}: {
  gauge: number | null;
  label: Verdict | null;
  letter: Letter | null;
  graded: number;
}) {
  const W = 240;
  const H = 142;
  const cx = W / 2;
  const cy = H - 14;
  const rr = 100;
  const stroke = 16;

  // 5 arc segments across 180°.
  const segColors = ["#dc2626", "#ea580c", "#d97706", "#65a30d", "#16a34a"];
  const segs = segColors.map((col, i) => {
    const a0 = Math.PI - (i / 5) * Math.PI;
    const a1 = Math.PI - ((i + 1) / 5) * Math.PI;
    const p0 = { x: cx + rr * Math.cos(a0), y: cy - rr * Math.sin(a0) };
    const p1 = { x: cx + rr * Math.cos(a1), y: cy - rr * Math.sin(a1) };
    return { col, d: `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${rr} ${rr} 0 0 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}` };
  });

  const needleA = gauge != null ? Math.PI - gauge * Math.PI : Math.PI / 2;
  const nLen = rr - 6;
  const nx = cx + nLen * Math.cos(needleA);
  const ny = cy - nLen * Math.sin(needleA);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }} role="img" aria-label="Overall verdict gauge">
        {segs.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill="none"
            stroke={s.col}
            strokeWidth={stroke}
            strokeLinecap="butt"
            opacity={gauge == null ? 0.3 : 0.9}
          />
        ))}
        {gauge != null && (
          <>
            <line
              x1={cx}
              y1={cy}
              x2={nx.toFixed(1)}
              y2={ny.toFixed(1)}
              className="text-ink"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={6} className="text-ink" fill="currentColor" />
          </>
        )}
      </svg>
      <div className="-mt-4 flex flex-col items-center">
        {label && letter ? (
          <>
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full font-display text-lg font-bold text-white"
                style={{ backgroundColor: letterColor(letter) }}
              >
                {letter}
              </span>
              <span className="font-display text-2xl font-extrabold tracking-tight text-ink">{label}</span>
            </div>
            <span className="mt-1 text-[11px] text-soft">
              overall read · {graded} of 4 areas graded
            </span>
          </>
        ) : (
          <>
            <span className="font-display text-base font-bold text-soft">Not enough data</span>
            <span className="mt-0.5 text-[11px] text-soft">
              {graded === 1 ? "only one area could be graded" : "financials unavailable for this ticker"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
