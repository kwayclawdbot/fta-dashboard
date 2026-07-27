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
 * stops on a winding path; each node fills gold as its step completes and the
 * connecting path draws in (framer pathLength — the lesson-SVG technique) as
 * progress advances. The final node is a home/flag that celebrates at 6/6.
 * Turns a compliance checklist into a visible journey with a destination.
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
    <div className="relative w-full overflow-hidden rounded-2xl border border-gold-300/50 bg-gradient-to-b from-gold-50/60 to-paper p-5">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-display text-sm font-bold text-ink">
          {allDone ? "Your family is all set!" : "Your setup journey"}
        </span>
        <span className="text-xs font-semibold text-soft">
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
          stroke="var(--g500)"
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
          const Icon = done ? Check : NODE_ICONS[step.key] || PlayCircle;
          /* Unreached stops take the themed CARD surface, not literal white —
             a #FFFFFF node punched a hole in the page on the dark theme. The
             icon inside follows the faint text step (--m600) for the same
             reason. --g500/--g600 are the mode's own accent (gold in Family,
             volt in Club) and are already theme-correct. */
          const fill = done ? "var(--g500)" : isFinal && allDone ? "#16A34A" : "var(--card)";
          const stroke = done ? "var(--g600)" : isNext ? "var(--g500)" : "var(--sand)";
          const iconColor = done ? "#FFFFFF" : isNext ? "var(--g700)" : "var(--m600)";
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
              {isNext && !reduce && (
                <m.circle
                  cx={x}
                  cy={y}
                  r={15}
                  fill="none"
                  stroke="var(--g500)"
                  strokeWidth={2}
                  animate={{ r: [15, 22], opacity: [0.6, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
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
          className="mt-1 flex items-center justify-center gap-1.5 text-sm font-medium text-green-600"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Flag className="h-4 w-4" />
          Orientation complete — welcome to the club!
        </m.p>
      )}
    </div>
  );
}
