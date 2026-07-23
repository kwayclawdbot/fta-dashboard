"use client";

import { m, useReducedMotion } from "@/lib/motion";
import type { OHLC, LevelLine, Trendline } from "@/lib/games/types";

const GREEN = "#22C55E";
const RED = "#DC2626";
const SUPPORT = "#22C55E"; // green-500 family — a floor
const RESISTANCE = "#EF4444"; // red-500 family — a ceiling
const TREND_GOLD = "#FBBF24"; // gold-400 — a swing / broken trendline
const TREND_SOFT = "rgba(226,232,240,0.9)"; // soft-white — a second line (e.g. slow MA)
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
  trendlines,
  height = VH,
}: {
  candles: OHLC[];
  revealed: number; // how many candles are shown
  decisionIndex?: number; // draws a dashed "your call" line
  highlightFrom?: number; // glow candles at/after this index (the resolution)
  levels?: LevelLine[]; // dashed S/R lines drawn before the candles
  trendlines?: Trendline[]; // diagonal swing / MA / broken-trend lines
  height?: number;
}) {
  const reduce = useReducedMotion();
  const n = candles.length;
  const slot = 34;
  const bodyW = 17;
  const vw = PAD_X * 2 + n * slot;

  // --- price domain ---------------------------------------------------------
  // The chart shows a "setup" (candles[0..di)) during the call, then reveals a
  // "resolution" (the rest). Scaling to the FULL series crushes the setup into
  // an unreadable sliver whenever the resolution move is large (breakouts,
  // squeezes, floods) — the shape the player must read no longer matches the
  // scenario text. So we anchor the domain to the SETUP + every annotation, and
  // only when that setup would occupy less than SETUP_OCC of the frame do we
  // expand toward the resolution side(s) just enough to hit SETUP_OCC. The
  // resolution can then run past the frame — `.night-island` clips it, which
  // reads as a decisive move. The domain is derived from constants (candles,
  // levels, trendlines, di) so it is identical in the decision and resolution
  // phases: the chart never rescales as candles reveal.
  const SETUP_OCC = 0.6;
  const di = decisionIndex != null ? decisionIndex : n;
  const setupCount = di > 0 && di < n ? di : n;

  let sMin = Infinity;
  let sMax = -Infinity;
  const seeSetup = (v: number) => {
    if (v < sMin) sMin = v;
    if (v > sMax) sMax = v;
  };
  for (let i = 0; i < setupCount; i++) {
    seeSetup(candles[i].l);
    seeSetup(candles[i].h);
  }
  // annotations must always be fully framed (their setup-side anchors define the
  // shape; far trendline ends may sit in the resolution and are handled below)
  for (const lv of levels || []) seeSetup(lv.price);
  for (const tl of trendlines || []) {
    const pts = tl.points?.length ? tl.points : [tl.from, tl.to];
    for (const p of pts) if (p.index <= setupCount) seeSetup(p.price);
  }
  if (!isFinite(sMin) || !isFinite(sMax)) {
    for (const c of candles) {
      seeSetup(c.l);
      seeSetup(c.h);
    }
  }

  // full extent — resolution candles + far trendline ends
  let fMin = sMin;
  let fMax = sMax;
  for (const c of candles) {
    if (c.l < fMin) fMin = c.l;
    if (c.h > fMax) fMax = c.h;
  }
  for (const tl of trendlines || []) {
    const pts = tl.points?.length ? tl.points : [tl.from, tl.to];
    for (const p of pts) {
      if (p.price < fMin) fMin = p.price;
      if (p.price > fMax) fMax = p.price;
    }
  }

  const setupRange = sMax - sMin || 1;
  const fullRange = fMax - fMin || 1;
  let min: number;
  let max: number;
  if (setupRange / fullRange >= SETUP_OCC) {
    // the setup is already legible in the natural frame — show everything
    min = fMin;
    max = fMax;
  } else {
    // expand the domain around the setup to give it exactly SETUP_OCC, biasing
    // the added room toward wherever the resolution actually goes
    const domain = setupRange / SETUP_OCC;
    const slack = domain - setupRange;
    const upRoom = Math.max(0, fMax - sMax);
    const dnRoom = Math.max(0, sMin - fMin);
    const roomTot = upRoom + dnRoom || 1;
    min = sMin - slack * (dnRoom / roomTot);
    max = sMax + slack * (upRoom / roomTot);
  }
  const pad = (max - min) * 0.08 || 1;
  min -= pad;
  max += pad;

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
          <m.g
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
                <m.circle
                  cx={xFor(bi)}
                  cy={y}
                  r={5}
                  fill={stroke}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  initial={{ scale: 1, opacity: 0.35 }}
                  animate={
                    reduce
                      ? { opacity: 0.3 }
                      : { scale: [0.8, 1.9, 0.8], opacity: [0.4, 0.05, 0.4] }
                  }
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
          </m.g>
        );
      })}

      {/* diagonal trendlines — swing / MA / broken-trend, drawn BEFORE candles */}
      {(trendlines || []).map((tl, i) => {
        const soft = tl.tone === "soft";
        const stroke = soft ? TREND_SOFT : TREND_GOLD;
        const poly = tl.points?.length ? tl.points : [tl.from, tl.to];
        const pathD = poly
          .map((p, k) => `${k === 0 ? "M" : "L"} ${xFor(p.index)} ${yFor(p.price)}`)
          .join(" ");
        const anchor = poly[poly.length - 1];
        const rawAx = xFor(anchor.index);
        const ay = yFor(anchor.price);
        const chipW = 10 + tl.label.length * 6.2;
        // keep the chip inside the frame
        const ax = Math.max(PAD_X + chipW / 2, Math.min(vw - PAD_X - chipW / 2, rawAx));
        // above the endpoint, or below if it would clip the top
        const chipY = ay < PAD_TOP + 26 ? ay + 8 : ay - 26;
        return (
          <m.g
            key={`tl-${i}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: reduce ? 0 : 0.12 + i * 0.1 }}
          >
            <path
              d={pathD}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeDasharray="7 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.92}
            />
            <rect
              x={ax - chipW / 2}
              y={chipY}
              width={chipW}
              height={18}
              rx={9}
              fill={stroke}
              opacity={0.95}
            />
            <text
              x={ax}
              y={chipY + 13}
              textAnchor="middle"
              fill="#0b1220"
              fontSize={11}
              fontWeight={800}
              style={{ letterSpacing: "0.02em" }}
            >
              {tl.label}
            </text>
          </m.g>
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
          <m.g
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
          </m.g>
        );
      })}
    </svg>
  );
}
