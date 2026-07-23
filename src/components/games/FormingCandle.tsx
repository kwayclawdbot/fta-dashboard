"use client";

import { m, useReducedMotion } from "@/lib/motion";
import type { CandleChart } from "@/lib/games/types";

const GREEN = "#22C55E";
const RED = "#DC2626";
const VW = 360;
const VH = 246;
const LX0 = 30; // price-line lane start
const LX1 = 210; // price-line lane end
const CX = 292; // forming-candle center x
const BODY_W = 46;

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2));

/**
 * A single candle forming LIVE from an intraday tick path. The wiggling line is
 * the tug-of-war; the candle on the right is the scoreboard — its body grows,
 * shrinks and FLIPS COLOR as price crosses the open, and its wicks stretch to
 * the running extremes. Driven entirely by `progress` (0..1) from the parent's
 * animation loop, so it stays crisp and data-true.
 */
export default function FormingCandle({
  data,
  progress,
  reveal = false,
}: {
  data: CandleChart;
  progress: number;
  reveal?: boolean;
}) {
  const reduce = useReducedMotion();
  const { o, h, l, c, path } = data;
  const N = path.length;

  const pad = (h - l) * 0.1 || 1;
  const pMin = l - pad;
  const pMax = h + pad;
  const yFor = (p: number) =>
    18 + (1 - (p - pMin) / (pMax - pMin)) * (VH - 36);

  const k = Math.max(1, Math.min(Math.ceil(progress * N), N));
  const visible = path.slice(0, k);
  const current = reveal ? c : visible[visible.length - 1];
  const runHigh = reveal ? h : Math.max(...visible);
  const runLow = reveal ? l : Math.min(...visible);

  const xLine = (i: number) => LX0 + (i / (N - 1)) * (LX1 - LX0);
  const linePts = visible.map((v, i) => `${xLine(i)},${yFor(v)}`).join(" ");

  const up = current >= o;
  const color = up ? GREEN : RED;
  const yOpen = yFor(o);
  const yCur = yFor(current);
  const bodyTop = Math.min(yOpen, yCur);
  const bodyH = Math.max(Math.abs(yCur - yOpen), 2);
  const yHigh = yFor(runHigh);
  const yLow = yFor(runLow);
  const dotX = xLine(k - 1);

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%"
      height={VH}
      preserveAspectRatio="xMidYMid meet"
      className="block"
      role="img"
      aria-label="a candle forming from live price"
    >
      {/* open reference line */}
      <line
        x1={20}
        x2={VW - 12}
        y1={yOpen}
        y2={yOpen}
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={1}
        strokeDasharray="5 5"
      />
      <text x={22} y={yOpen - 5} fill="rgba(255,255,255,0.55)" fontSize={10} fontWeight={600}>
        open {fmt(o)}
      </text>

      {/* the tug-of-war price line */}
      <polyline
        points={linePts}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
      {/* live price dot */}
      {!reveal && (
        <>
          <m.circle
            cx={dotX}
            cy={yCur}
            r={7}
            fill={color}
            opacity={0.25}
            animate={reduce ? {} : { r: [6, 10, 6], opacity: [0.25, 0.05, 0.25] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <circle cx={dotX} cy={yCur} r={3.2} fill="#fff" />
        </>
      )}

      {/* divider between lane and scoreboard candle */}
      <line x1={244} x2={244} y1={12} y2={VH - 12} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

      {/* the forming candle (scoreboard) */}
      <m.g
        animate={
          reveal && !reduce
            ? { filter: [`drop-shadow(0 0 0px ${color})`, `drop-shadow(0 0 14px ${color})`] }
            : {}
        }
        transition={{ duration: 0.5 }}
      >
        <line
          x1={CX}
          x2={CX}
          y1={yHigh}
          y2={yLow}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <rect
          x={CX - BODY_W / 2}
          y={bodyTop}
          width={BODY_W}
          height={bodyH}
          rx={4}
          fill={color}
          stroke={reveal ? "#fff" : "transparent"}
          strokeWidth={reveal ? 1.5 : 0}
        />
      </m.g>

      {/* high / low tags on the scoreboard candle */}
      <text x={CX + BODY_W / 2 + 6} y={yHigh + 4} fill="rgba(255,255,255,0.6)" fontSize={10}>
        high {fmt(runHigh)}
      </text>
      <text x={CX + BODY_W / 2 + 6} y={yLow + 4} fill="rgba(255,255,255,0.6)" fontSize={10}>
        low {fmt(runLow)}
      </text>

      {/* winner tag */}
      <text
        x={CX}
        y={VH - 4}
        textAnchor="middle"
        fill={color}
        fontSize={11}
        fontWeight={800}
        style={{ letterSpacing: "0.04em" }}
      >
        {up ? "GREEN" : "RED"} {fmt(current)}
      </text>
    </svg>
  );
}
