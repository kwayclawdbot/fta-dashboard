"use client";

/**
 * LevelObject — the canonical XP-progress object.
 *
 * The Family surface graded A− on one component and only one: the level block
 * that reads
 *
 *     FAMILY LEVEL 2 · MONEY MAPPER                    ⚡ +180 XP THIS WEEK
 *     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░
 *     265 / 400 XP                          135 XP to Level 3 🎁
 *
 * It works because it answers three questions in one glance — where am I, how
 * far along, what does the next step cost — and because the "to next" figure is
 * the loudest thing in the block. Every other XP readout in the app answered
 * one of the three and dropped the others: /belts led with a share-of-club
 * percentage nobody asked for, /progress led with a dial, and the You drawer
 * rendered a bar with nothing in it.
 *
 * So the pattern is extracted here, ONE component, and adopted everywhere.
 * This file is a COPY of the family pattern, not an import of it — family/**
 * belongs to the family lane and must not be edited or depended on. The visual
 * result is deliberately identical.
 *
 * Two ways in:
 *   <LevelObject … />        fully controlled — pass your own numbers
 *   <XpLevelObject xp={n} />  derives everything from lib/xp or lib/belts
 *
 * Both take a `leading` slot, which is how /belts hangs a drawn <Belt/> off the
 * left of the same object without a second component existing.
 */
import type { ReactNode } from "react";
import { m, useReducedMotion } from "@/lib/motion";
import { beltProgress } from "@/lib/belts";
import { levelProgress } from "@/lib/xp";

export type LevelObjectTone = "accent" | "kai" | "neutral";

export interface LevelObjectProps {
  /** The eyebrow, e.g. "Level 2 · Money Mapper" or "Blue Belt II". */
  label: ReactNode;
  /** 0–100. */
  pct: number;
  /** Absolute XP earned so far (the left figure). */
  value: number;
  /** Absolute XP the next rung sits at. Omit / null when maxed. */
  target?: number | null;
  /** XP remaining. Omit to derive from target − value. */
  toNext?: number;
  /** What the member is climbing toward, e.g. "Level 3" or "Yellow". */
  nextLabel?: ReactNode;
  /** Right-hand item on the eyebrow row (an XP tag, a count, a chip). */
  aside?: ReactNode;
  /** Drawn object hung off the left — the belt, on /belts. */
  leading?: ReactNode;
  /** Unit written after the figures. */
  unit?: string;
  /** The 🎁 that ends the family line. Off by default outside Family Mode. */
  reward?: boolean;
  /** Line shown in place of the "to next" figure at the top of the ladder. */
  maxedLabel?: string;
  tone?: LevelObjectTone;
  /** Track height in px. */
  height?: number;
  /** Animate the fill in on mount. */
  animate?: boolean;
  className?: string;
}

const TONE_TEXT: Record<LevelObjectTone, string> = {
  accent: "text-gold-700",
  kai: "text-kai-blue",
  neutral: "text-ink",
};

const TONE_FILL: Record<LevelObjectTone, string> = {
  accent: "bg-gold-600",
  kai: "bg-kai-blue",
  neutral: "bg-ink",
};

export function LevelObject({
  label,
  pct,
  value,
  target,
  toNext,
  nextLabel,
  aside,
  leading,
  unit = "XP",
  reward = false,
  maxedLabel = "Top of the ladder",
  tone = "accent",
  height = 7,
  animate = true,
  className = "",
}: LevelObjectProps) {
  const reduce = useReducedMotion();
  const w = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const remaining = toNext ?? (target != null ? Math.max(0, target - value) : 0);
  const maxed = target == null;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] ${TONE_TEXT[tone]}`}
        >
          {label}
        </p>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>

      <div className={leading ? "mt-3 flex items-center gap-3" : "mt-3"}>
        {leading ? <span className="shrink-0">{leading}</span> : null}
        <div className="min-w-0 flex-1">
          <div
            className="w-full overflow-hidden rounded-full bg-[var(--off-bg)]"
            style={{ height }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(w)}
          >
            <m.div
              className={`h-full rounded-full ${TONE_FILL[tone]}`}
              initial={animate && !reduce ? { width: 0 } : false}
              animate={{ width: `${w}%` }}
              transition={
                reduce
                  ? { duration: 0.12 }
                  : { type: "spring", stiffness: 180, damping: 26 }
              }
              style={animate ? undefined : { width: `${w}%` }}
            />
          </div>

          <div className="mt-2 flex items-baseline justify-between gap-3 text-[11px] text-soft">
            <span className="font-mono tabular-nums">
              {value.toLocaleString()}
              {target != null ? ` / ${target.toLocaleString()}` : ""} {unit}
            </span>
            {maxed ? (
              <span className="font-mono tabular-nums">{maxedLabel}</span>
            ) : (
              <span className={`font-mono font-bold tabular-nums ${TONE_TEXT[tone]}`}>
                {remaining.toLocaleString()} {unit} to {nextLabel}
                {reward ? " 🎁" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface XpLevelObjectProps
  extends Omit<LevelObjectProps, "label" | "pct" | "value" | "target" | "toNext" | "nextLabel"> {
  /** Lifetime XP. */
  xp: number;
  /**
   * `level` writes the level ladder ("Level 2 · Money Mapper" → "Level 3").
   * `belt`  writes the belt ladder ("Blue Belt II" → "Purple").
   */
  ladder?: "level" | "belt";
  /** Override the eyebrow while keeping the derived figures. */
  label?: ReactNode;
}

/**
 * The same object, wired to the real ladders. This is what /belts, /progress,
 * the You drawer and Home all render — one component, one set of thresholds,
 * so the "N XP to …" line can never drift between two surfaces again.
 */
export function XpLevelObject({ xp, ladder = "level", label, ...rest }: XpLevelObjectProps) {
  if (ladder === "belt") {
    const bp = beltProgress(xp);
    const lp = levelProgress(xp);
    return (
      <LevelObject
        {...rest}
        label={label ?? bp.current.label}
        pct={bp.pct}
        value={xp}
        target={lp.next ? lp.next.min : null}
        toNext={bp.toNext}
        nextLabel={bp.next ? (bp.nextIsNewBelt ? bp.next.belt.name : bp.next.short) : null}
      />
    );
  }
  const lp = levelProgress(xp);
  return (
    <LevelObject
      {...rest}
      label={label ?? `Level ${lp.current.level} · ${lp.current.name}`}
      pct={lp.pct}
      value={xp}
      target={lp.next ? lp.next.min : null}
      toNext={lp.toNext}
      nextLabel={lp.next ? `Level ${lp.next.level}` : null}
    />
  );
}

export default LevelObject;
