"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { OHLC, LevelLine } from "@/lib/games/types";

const GREEN = "#22C55E";
const RED = "#DC2626";
const SUPPORT = "#22C55E"; // green-500 family — a floor
const RESISTANCE = "#EF4444"; // red-500 family — a ceiling
const PAD_X = 26;
const PAD_TOP = 20;
const PAD_BOT = 20;
const VH = 240;

/**
 * Crisp, data-true candlestick series drawn in pure SVG. Candles pop in one by
 * one (controlled by `revealed`) — "a chart is just battles in a row". The
 * price scale is computed from ALL candles (and any levels) so nothing
 * re-scales as bars appear. Meant to sit inside a `.night-island`.
 *
 * `levels` draws dashed horizontal support/resistance lines with small label
 * chips FIRST (before the candles pop in) so the scenario reads, plus a subtle
 * pulse where price touches a level.
 */
export default function CandleRenderer({
  candles,
  revealed,
  decisionIndex,
  highlightFrom,
  levels,
  height = VH,
}: {
  candles: OHLC[];
  revealed: number; // how many candles are shown
  decisionIndex?: number; // draws a dashed "your call" line
  highlightFrom?: number; // glow candles at/after this index (the resolution)
  levels?: LevelLine[]; // dashed S/R lines drawn before the candles
  height?: number;
}) {
  const reduce = useReducedMotion();
  const n = candles.length;
  const slot = 34;
  const bodyW = 17;
  const vw = PAD_X * 2 + n * slot;

  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    min = Math.min(min, c.l);
    max = Math.max(max, c.h);
  }
  // keep level lines in frame
  for (const lv of levels || []) {
    min = Math.min(min, lv.price);
    max = Math.max(max, lv.price);
  }
  const range = max - min || 1;
  min -= range * 0.08;
  max += range * 0.08;

  const yFor = (p: number) =>
    PAD_TOP + (1 - (p - min) / (max - min)) * (height - PAD_TOP - PAD_BOT);
  const xFor = (i: number) => PAD_X + i * slot + slot / 2;

  const shown = Math.max(0, Math.min(revealed, n));

  return (
    <svg
      viewBox={`0 0 ${vw} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
      className="block"
      role="img"
      aria-label="candlestick chart"
    >
      {/* faint gridlines */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={PAD_X}
          x2={vw - PAD_X}
          y1={PAD_TOP + g * (height - PAD_TOP - PAD_BOT)}
          y2={PAD_TOP + g * (height - PAD_TOP - PAD_BOT)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}

      {/* S/R level lines — drawn BEFORE candles so the scenario reads */}
      {(levels || []).map((lv, i) => {
        const y = yFor(lv.price);
        const stroke = lv.kind === "support" ? SUPPORT : RESISTANCE;
        const chipW = 8 + lv.label.length * 6.4;
        return (
          <motion.g
            key={`lv-${i}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: reduce ? 0 : 0.05 + i * 0.08 }}
          >
            {/* touch pulse where a candle meets the level */}
            {(() => {
              let bi = 0;
              let bd = Infinity;
              candles.forEach((c, ci) => {
                const d =
                  lv.kind === "support"
                    ? Math.abs(c.l - lv.price)
                    : Math.abs(c.h - lv.price);
                if (d < bd) {
                  bd = d;
                  bi = ci;
                }
              });
              return (
                <motion.circle
                  cx={xFor(bi)}
                  cy={y}
                  r={5}
                  fill={stroke}
                  animate={reduce ? { opacity: 0.3 } : { r: [4, 9, 4], opacity: [0.35, 0.05, 0.35] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
              );
            })()}
            <line
              x1={PAD_X}
              x2={vw - PAD_X}
              y1={y}
              y2={y}
              stroke={stroke}
              strokeWidth={1.5}
              strokeDasharray="6 5"
              opacity={0.85}
            />
            {/* label chip */}
            <rect
              x={vw - PAD_X - chipW}
              y={y - 9}
              width={chipW}
              height={18}
              rx={9}
              fill={stroke}
              opacity={0.9}
            />
            <text
              x={vw - PAD_X - chipW / 2}
              y={y + 4}
              textAnchor="middle"
              fill="#0b1220"
              fontSize={11}
              fontWeight={800}
              style={{ letterSpacing: "0.02em" }}
            >
              {lv.label}
            </text>
          </motion.g>
        );
      })}

      {/* decision divider */}
      {decisionIndex != null && decisionIndex < n && (
        <line
          x1={PAD_X + decisionIndex * slot}
          x2={PAD_X + decisionIndex * slot}
          y1={PAD_TOP - 6}
          y2={height - PAD_BOT + 6}
          stroke="rgba(251,191,36,0.45)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
      )}

      {candles.slice(0, shown).map((c, i) => {
        const up = c.c >= c.o;
        const color = up ? GREEN : RED;
        const x = xFor(i);
        const yHigh = yFor(c.h);
        const yLow = yFor(c.l);
        const yOpen = yFor(c.o);
        const yClose = yFor(c.c);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(Math.abs(yClose - yOpen), 2);
        const glow = highlightFrom != null && i >= highlightFrom;
        return (
          <motion.g
            key={i}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scaleY: 0.1 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 320, damping: 22 }
            }
          >
            {glow && (
              <rect
                x={x - bodyW / 2 - 3}
                y={bodyTop - 3}
                width={bodyW + 6}
                height={bodyH + 6}
                rx={4}
                fill={color}
                opacity={0.18}
              />
            )}
            <line
              x1={x}
              x2={x}
              y1={yHigh}
              y2={yLow}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <rect
              x={x - bodyW / 2}
              y={bodyTop}
              width={bodyW}
              height={bodyH}
              rx={2.5}
              fill={color}
            />
          </motion.g>
        );
      })}
    </svg>
  );
}
