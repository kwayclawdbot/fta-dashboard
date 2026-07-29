"use client";

/**
 * Abstract, typographic-free art layer for the Living Card face. Each asset's
 * personality is one of these patterns, tinted with its accent at low opacity so
 * it reads as an engraved substrate under the content — never a logo.
 */

import { useId } from "react";
import type { PatternKind } from "./art";

interface Props {
  pattern: PatternKind;
  accent: string;
  /** Big ghost monogram behind the substrate (usually the ticker). */
  monogram: string;
}

const VB = "0 0 300 420";

export default function CardArtBackdrop({ pattern, accent, monogram }: Props) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox={VB}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      style={{ color: accent }}
    >
      {/* Ghost monogram — the ticker as a huge, faint engraved letterform. */}
      <text
        x="50%"
        y="63%"
        textAnchor="middle"
        fontFamily="var(--font-display), sans-serif"
        fontWeight={800}
        fontSize={monogram.length > 3 ? 150 : 210}
        fill="currentColor"
        opacity={0.05}
        letterSpacing="-6"
      >
        {monogram}
      </text>
      <Pattern kind={pattern} uid={uid} />
    </svg>
  );
}

function Pattern({ kind, uid }: { kind: PatternKind; uid: string }) {
  const s = { stroke: "currentColor", fill: "none" as const };
  switch (kind) {
    case "circuit":
      return (
        <g opacity={0.22}>
          {[40, 120, 200, 280, 360].map((y) => (
            <path
              key={y}
              d={`M0 ${y} H90 L120 ${y - 30} H210 L240 ${y + 24} H300`}
              {...s}
              strokeWidth={1}
            />
          ))}
          {[
            [90, 40],
            [120, 90],
            [210, 200],
            [240, 224],
            [120, 170],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={3} fill="currentColor" />
          ))}
        </g>
      );
    case "lattice":
      return (
        <g opacity={0.16}>
          {Array.from({ length: 14 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 24} y1={0} x2={i * 24} y2={420} {...s} strokeWidth={0.6} />
          ))}
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 24} x2={300} y2={i * 24} {...s} strokeWidth={0.6} />
          ))}
        </g>
      );
    case "chevron":
      return (
        <g opacity={0.2}>
          {[70, 150, 230, 310, 390].map((y) => (
            <path key={y} d={`M-20 ${y} L150 ${y - 46} L320 ${y}`} {...s} strokeWidth={1.4} />
          ))}
        </g>
      );
    case "panes":
      return (
        <g opacity={0.18}>
          {[
            [40, 60],
            [162, 60],
            [40, 182],
            [162, 182],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width={98} height={98} rx={6} {...s} strokeWidth={1.2} />
          ))}
        </g>
      );
    case "orbit":
      return (
        <g opacity={0.2} transform="translate(150 210)">
          {[70, 116, 162].map((r, i) => (
            <ellipse
              key={r}
              rx={r}
              ry={r * 0.42}
              {...s}
              strokeWidth={1}
              transform={`rotate(${i * 60})`}
            />
          ))}
        </g>
      );
    case "rays":
      return (
        <g opacity={0.2} transform="translate(150 210)">
          {Array.from({ length: 18 }).map((_, i) => (
            <line
              key={i}
              x1={0}
              y1={0}
              x2={0}
              y2={-260}
              {...s}
              strokeWidth={0.8}
              transform={`rotate(${i * 20})`}
            />
          ))}
        </g>
      );
    case "prism":
      return (
        <g opacity={0.18}>
          {[0, 1, 2, 3].map((i) => (
            <polygon
              key={i}
              points="150,40 250,220 50,220"
              {...s}
              strokeWidth={1}
              transform={`translate(0 ${i * 46}) scale(1 0.7)`}
            />
          ))}
        </g>
      );
    case "strata":
      return (
        <g opacity={0.18}>
          {[80, 140, 200, 260, 320].map((y, i) => (
            <rect key={y} x={30 + i * 6} y={y} width={240 - i * 12} height={18} rx={3} {...s} strokeWidth={1} />
          ))}
        </g>
      );
    case "waves":
      return (
        <g opacity={0.2}>
          {[120, 170, 220, 270, 320].map((y) => (
            <path
              key={y}
              d={`M0 ${y} Q75 ${y - 26} 150 ${y} T300 ${y}`}
              {...s}
              strokeWidth={1.1}
            />
          ))}
        </g>
      );
    case "hex":
      return (
        <g opacity={0.18}>
          {Array.from({ length: 5 }).map((_, r) =>
            Array.from({ length: 4 }).map((_, c) => {
              const x = 40 + c * 72 + (r % 2 ? 36 : 0);
              const y = 50 + r * 84;
              return <Hexagon key={`${r}-${c}`} cx={x} cy={y} r={26} />;
            })
          )}
        </g>
      );
    case "bloom":
      return (
        <g opacity={0.2} transform="translate(150 210)">
          {Array.from({ length: 12 }).map((_, i) => (
            <ellipse key={i} rx={140} ry={40} {...s} strokeWidth={0.7} transform={`rotate(${i * 15})`} />
          ))}
        </g>
      );
    case "filmstrip":
      return (
        <g opacity={0.2}>
          {[26, 274].map((x) => (
            <g key={x}>
              {Array.from({ length: 12 }).map((_, i) => (
                <rect key={i} x={x - 8} y={16 + i * 34} width={16} height={20} rx={3} {...s} strokeWidth={1} />
              ))}
            </g>
          ))}
        </g>
      );
    default:
      return (
        <g opacity={0.14}>
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={i} x1={-40} y1={i * 56} x2={340} y2={i * 56 - 120} {...s} strokeWidth={0.7} />
          ))}
        </g>
      );
  }
}

function Hexagon({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return <polygon points={pts} stroke="currentColor" fill="none" strokeWidth={1} />;
}
