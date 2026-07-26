"use client";

import Link from "next/link";
import { m, useReducedMotion } from "@/lib/motion";
import {
  Check,
  Lock,
  PlayCircle,
  Gamepad2,
  Trophy,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { Register } from "@/lib/register";
import {
  registerSkin,
  worldLabel,
  type Journey,
  type JourneyNode,
  type JourneyWorld,
  type NodeKind,
  type NodeState,
} from "@/lib/learn/worlds";

/**
 * JourneyMap — the vertical scrolling path (FIC-LEARNING-WORLD §3).
 *
 * Worlds are editorial chapters (numeral + name + hairline — never a boxed card,
 * per the brand register's standing rule). Nodes sit on a center spine with
 * connectors, gently alternating so the eye follows a winding path (kid/teen);
 * the adult skin keeps the winding subtle. State reads instantly: done ✓ /
 * current ● (pulse) / available / locked 🔒. Motion communicates progression —
 * nodes stagger in on scroll, the current node pulses (a genuinely live "you are
 * here"), press gives physical feedback. Reduced-motion drops every transform.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function nodeIcon(kind: NodeKind, state: NodeState) {
  if (state === "locked") return Lock;
  if (state === "done") return Check;
  switch (kind) {
    case "game":
      return Gamepad2;
    case "review":
      return RotateCcw;
    case "boss":
      return Trophy;
    default:
      return PlayCircle;
  }
}

/** Node circle styling by state — identity through the register accent, not a box. */
function nodeClasses(state: NodeState, size: string): string {
  const base = `relative grid ${size} shrink-0 place-items-center rounded-full transition-transform duration-150 ease-out`;
  switch (state) {
    case "done":
      return `${base} bg-[var(--accent-solid)] text-white shadow-[var(--shadow-lift)]`;
    case "current":
      return `${base} bg-[var(--accent-solid)] text-white shadow-[var(--shadow-lift)] ring-4 ring-[color-mix(in_srgb,var(--accent-solid)_28%,transparent)]`;
    case "available":
      return `${base} border-2 border-[var(--accent-strong)] bg-paper text-[var(--accent-strong)]`;
    default: // locked
      return `${base} border border-sand bg-sand/50 text-midnight-500`;
  }
}

function PathNode({
  node,
  register,
  index,
  offset,
}: {
  node: JourneyNode;
  register: Register;
  index: number;
  offset: "left" | "center" | "right";
}) {
  const reduce = useReducedMotion();
  const skin = registerSkin(register);
  const Icon = nodeIcon(node.kind, node.state);
  const isCurrent = node.state === "current";
  const clickable = !!node.href;

  // Alternating horizontal offset gives the winding-path read (subtle for adults).
  const shift =
    register === "adult"
      ? offset === "left"
        ? "-translate-x-4 sm:-translate-x-8"
        : offset === "right"
          ? "translate-x-4 sm:translate-x-8"
          : ""
      : offset === "left"
        ? "-translate-x-6 sm:-translate-x-16"
        : offset === "right"
          ? "translate-x-6 sm:translate-x-16"
          : "";

  const circle = (
    <div className={`${nodeClasses(node.state, skin.nodeSize)} ${clickable ? "group-active:scale-95" : ""}`}>
      {/* Live "you are here" pulse — only for the current node, reduced-motion safe. */}
      {isCurrent && !reduce && (
        <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-[var(--accent-solid)] animate-ping opacity-60" />
      )}
      <Icon className={skin.nodeIcon} strokeWidth={2.2} />
    </div>
  );

  const label = (
    <div
      className={`min-w-0 ${
        offset === "right" ? "text-right" : "text-left"
      }`}
    >
      <p
        className={`font-display font-semibold leading-tight ${
          node.state === "locked" ? "text-midnight-500" : "text-ink"
        } ${register === "kid" ? "text-[15px]" : "text-sm"}`}
      >
        {node.title}
      </p>
      <p className="text-[11px] text-soft">{node.meta}</p>
      {isCurrent && (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--accent-solid)_16%,transparent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-strong)]">
          {register === "kid" ? "Play now" : "You're here"}
        </span>
      )}
    </div>
  );

  const row = (
    <div
      className={`group flex items-center gap-3 ${shift} ${
        offset === "right" ? "flex-row-reverse" : ""
      } ${offset === "center" ? "justify-center" : ""}`}
    >
      {circle}
      {label}
    </div>
  );

  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.05, ease: EASE_OUT }}
    >
      {clickable ? (
        <Link href={node.href!} className="block" aria-label={`${node.title} — ${node.meta}`}>
          {row}
        </Link>
      ) : (
        <div
          className={node.state === "locked" ? "cursor-default" : "cursor-default"}
          aria-label={`${node.title} — ${node.meta}`}
        >
          {row}
        </div>
      )}
    </m.div>
  );
}

function WorldChapter({
  world,
  register,
  isLast,
}: {
  world: JourneyWorld;
  register: Register;
  isLast: boolean;
}) {
  const skin = registerSkin(register);
  const label = worldLabel(world.world, register);
  const stateChip =
    world.state === "done"
      ? "Complete"
      : world.state === "current"
        ? "In progress"
        : world.state === "locked"
          ? "Locked"
          : "Ready";

  const offsetFor = (i: number): "left" | "center" | "right" =>
    i % 2 === 0 ? "left" : "right";

  return (
    <section className="relative">
      {/* Chapter head — editorial, no card. Numeral / glyph + name + hairline. */}
      <div className="mb-6 flex items-center gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-display font-black ${
            world.state === "locked"
              ? "bg-sand/50 text-midnight-500"
              : "bg-[color-mix(in_srgb,var(--accent-solid)_14%,transparent)] text-[var(--accent-strong)]"
          }`}
          aria-hidden
        >
          {skin.showGlyph ? (
            <span className="text-xl">{world.world.glyph}</span>
          ) : (
            world.index + 1
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              className={`font-display font-bold leading-tight tracking-tight text-ink ${skin.chapterSize}`}
            >
              {label}
            </h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                world.state === "done"
                  ? "bg-chip-green text-green-700"
                  : world.state === "locked"
                    ? "bg-sand/60 text-soft"
                    : "bg-[color-mix(in_srgb,var(--accent-solid)_16%,transparent)] text-[var(--accent-strong)]"
              }`}
            >
              {stateChip}
            </span>
          </div>
          {skin.showBlurb && (
            <p className="mt-0.5 max-w-[52ch] text-sm leading-relaxed text-soft">
              {world.world.blurb}
            </p>
          )}
          {world.totalLessons > 0 && (
            <p className="mt-1 text-[11px] font-semibold text-soft">
              {world.doneLessons}/{world.totalLessons} lessons
            </p>
          )}
        </div>
      </div>

      {/* Nodes on the spine */}
      {world.nodes.length === 0 ? (
        <div className="ml-[22px] border-l-2 border-dashed border-sand py-6 pl-8">
          <p className="inline-flex items-center gap-2 text-sm text-soft">
            <Sparkles className="h-4 w-4 text-[var(--accent-strong)]" />
            New lessons for this world are landing soon.
          </p>
        </div>
      ) : (
        <div className="relative ml-[22px] pl-8">
          {/* The spine */}
          <span
            className="absolute left-0 top-0 h-full w-[2px] rounded-full bg-gradient-to-b from-[color-mix(in_srgb,var(--accent-solid)_40%,transparent)] via-sand to-sand"
            aria-hidden
          />
          <div className={`flex flex-col ${skin.nodeGap}`}>
            {world.nodes.map((node, i) => (
              <PathNode
                key={node.key}
                node={node}
                register={register}
                index={i}
                offset={node.kind === "boss" ? "center" : offsetFor(i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Connector to the next chapter */}
      {!isLast && (
        <div className="my-2 ml-[22px] flex h-8 items-center">
          <span className="h-full w-[2px] rounded-full bg-sand" aria-hidden />
        </div>
      )}
    </section>
  );
}

export default function JourneyMap({
  journey,
  register,
}: {
  journey: Journey;
  register: Register;
}) {
  return (
    <div className="space-y-8">
      {journey.worlds.map((w, i) => (
        <WorldChapter
          key={w.world.id}
          world={w}
          register={register}
          isLast={i === journey.worlds.length - 1}
        />
      ))}
    </div>
  );
}
