"use client";

import { m, useReducedMotion } from "@/lib/motion";
import {
  PlayCircle,
  MessageCircle,
  Landmark,
  ListChecks,
  CalendarDays,
  Flag,
  Check,
} from "lucide-react";

/**
 * <SetupTrail> — the Start Here orientation checklist as a drawn journey. Six
 * stops on a winding path; each node fills with the accent as its step completes
 * and the connecting path draws in (framer pathLength — the lesson-SVG
 * technique) as progress advances. Turns a compliance checklist into a visible
 * journey with a destination. This is the canvas's Learn-Path node walk (App
 * board 20) applied to orientation.
 *
 * CANVAS V2 FIXES:
 *   · NO CONTAINER. It was a rounded gradient card with its own border — the
 *     banned generic card. The trail now sits directly on the paper under an
 *     eyebrow + hairline, so the DRAWING is the object.
 *   · COMPLETION IS NOT GREEN. The finished-journey node was #16A34A and the
 *     completion line was `text-green-600`. Green and red are PRICE colours and
 *     orientation has no price. Done reads as the accent fill plus the stated
 *     word, exactly like a collected mission.
 *   · NO INFINITE PING. The "you are here" node pulsed forever. A repeating
 *     pulse in this system means ON AIR and nothing else; wayfinding is carried
 *     by a static heavier ring and the accent stroke.
 *
 * Reduced-motion → nodes and path render in final state, no drawing.
 */

const NODE_ICONS: Record<string, React.ElementType> = {
  watch_orientation: PlayCircle,
  intro_post: MessageCircle,
  open_accounts: Landmark,
  add_watchlist: ListChecks,
  rsvp_class: CalendarDays,
  first_mission: Flag,
};

// Node layout along a gentle wave (viewBox 600 x 130).
const POINTS: [number, number][] = [
  [46, 82],
  [156, 44],
  [266, 86],
  [376, 44],
  [486, 84],
  [566, 50],
];

function wavePath(pts: [number, number][]): string {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

export default function SetupTrail({
  steps,
  completed,
  allDone,
}: {
  steps: { key: string; title: string }[];
  completed: Set<string>;
  allDone: boolean;
}) {
  const reduce = useReducedMotion();
  const total = steps.length;
  const doneCount = steps.filter((s) => completed.has(s.key)).length;
  const frac = total > 0 ? doneCount / total : 0;
  const pts = POINTS.slice(0, total);
  const d = wavePath(pts);

  // Index of the next incomplete step (the "you are here" node).
  const nextIdx = steps.findIndex((s) => !completed.has(s.key));

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-4">
        <h2 className="f0-section-rule min-w-0 flex-1 text-eyebrow font-display font-bold uppercase text-soft">
          <span className="shrink-0 whitespace-nowrap">
            {allDone ? "Your family is all set" : "Your setup journey"}
          </span>
        </h2>
        <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-soft">
          {doneCount}/{total} stops
        </span>
      </div>

      <svg viewBox="0 0 600 130" className="w-full" style={{ maxHeight: 150 }}>
        {/* base path */}
        <path
          d={d}
          fill="none"
          stroke="var(--sand)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="1 8"
        />
        {/* progress path draws in */}
        <m.path
          d={d}
          fill="none"
          stroke="var(--accent-solid)"
          strokeWidth="4"
          strokeLinecap="round"
          initial={reduce ? { pathLength: frac } : { pathLength: 0 }}
          animate={{ pathLength: frac }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
        />

        {pts.map(([x, y], i) => {
          const step = steps[i];
          const done = completed.has(step.key);
          const isNext = i === nextIdx && !allDone;
          const isFinal = i === total - 1;
          /* The destination stop keeps the flag once the journey is done; every
             other completed stop takes the tick. Identity by ICON, not by hue. */
          const Icon = done ? (isFinal && allDone ? Flag : Check) : NODE_ICONS[step.key] || PlayCircle;
          /* Unreached stops take the themed CARD surface, not literal white —
             a #FFFFFF node punched a hole in the page on the dark theme. The
             icon inside follows the faint text step (--m600) for the same
             reason. --accent-solid is the mode's own accent (gold in Family,
             volt orange in Club, metallic on the FTA desk) and --accent-on is
             its guaranteed-legible foreground, so nothing here needs a theme
             variant. */
          /* COLOUR LAW: the finished journey is NOT green — the destination
             node simply carries the accent at full weight like every other
             completed stop, and the flag icon plus the line below say the rest.
             `isFinal` still drives the icon, not the hue. */
          const fill = done ? "var(--accent-solid)" : "var(--card)";
          const stroke = done
            ? "var(--accent-solid)"
            : isNext
              ? "var(--accent-solid)"
              : "var(--sand)";
          const iconColor = done ? "var(--accent-on)" : isNext ? "var(--g700)" : "var(--m600)";
          return (
            <g key={step.key}>
              <m.circle
                cx={x}
                cy={y}
                r={done ? 15 : 13}
                fill={fill}
                stroke={stroke}
                strokeWidth={isNext ? 3 : 2}
                initial={reduce ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 240, damping: 16 }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
              {/* "You are here" — a static outer ring. A repeating pulse in
                  this system means ON AIR; borrowing it for a checklist step
                  would make the one signal that must interrupt stop working. */}
              {isNext && (
                <circle
                  cx={x}
                  cy={y}
                  r={19}
                  fill="none"
                  stroke="var(--accent-solid)"
                  strokeWidth={1.5}
                  opacity={0.45}
                />
              )}
              <foreignObject x={x - 8} y={y - 8} width={16} height={16}>
                <div className="flex h-4 w-4 items-center justify-center">
                  <Icon width={13} height={13} style={{ color: iconColor }} />
                </div>
              </foreignObject>
              <text
                x={x}
                y={y + 30}
                textAnchor="middle"
                className="fill-soft"
                style={{ fontSize: 9, fontWeight: 600 }}
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>

      {allDone && (
        <m.p
          className="mt-2 flex items-center justify-center gap-1.5 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-gold-700"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Flag className="h-4 w-4" />
          Orientation complete — welcome to the club
        </m.p>
      )}
    </div>
  );
}
