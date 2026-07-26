"use client";

import { m, useReducedMotion } from "@/lib/motion";
import { Check, ArrowRight } from "lucide-react";
import type { LessonSkin } from "./skin";
import { EASE_OUT } from "./skin";
import KaiGuide, { type KaiPose } from "./KaiGuide";
import styles from "./skin.module.css";

/**
 * Shared visual kit for LessonEngine steps (Track A rebuild). Every primitive is
 * register-driven through the LessonSkin: feature typography (GRAMMAR §2), a real
 * Kai mascot guide (A3), register-accent actions, and warm mastery-loop feedback
 * (wrong is a coaching moment, never red shame). Motion follows the emil-design
 * framework: transform/opacity only, strong ease-out, scale-on-press, reduced-
 * motion honored.
 */

/** Feature-scale step prompt (32–40 tier) with optional eyebrow + lead sub. */
export function StepPrompt({
  children,
  skin,
  sub,
  eyebrow,
}: {
  children: React.ReactNode;
  skin: LessonSkin;
  sub?: string;
  eyebrow?: string;
}) {
  return (
    <div className="mb-7">
      {eyebrow && (
        <div
          className={`mb-2.5 ${skin.type.eyebrow}`}
          style={{ color: "var(--l-accent)" }}
        >
          {eyebrow}
        </div>
      )}
      <h2 className={`${skin.type.headline} text-ink text-balance`}>{children}</h2>
      {sub && <p className={`mt-3 text-soft ${skin.type.body}`}>{sub}</p>}
    </div>
  );
}

/** Kai speaks — mascot + authored in-world line (no live LLM). */
export function GuideLine({
  children,
  skin,
  pose = "teaching",
}: {
  children: React.ReactNode;
  skin: LessonSkin;
  pose?: KaiPose;
}) {
  const reduce = useReducedMotion();
  return (
    <m.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
      className="flex items-start gap-3"
    >
      <KaiGuide pose={pose} size={skin.mascot.guide} float={skin.motion.guideFloat} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div
          className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: "var(--kai-blue)" }}
        >
          Kai
        </div>
        <p className={`text-ink/85 ${skin.type.body}`}>{children}</p>
      </div>
    </m.div>
  );
}

/** Primary action — register accent, press feedback, single-line label. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  icon = "arrow",
  tone = "accent",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: "arrow" | "check" | "none";
  tone?: "accent" | "ok";
}) {
  const bg = tone === "ok" ? "var(--l-ok)" : "var(--l-accent)";
  const fg = tone === "ok" ? "#fff" : "var(--l-accent-on)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={disabled ? undefined : { background: bg, color: fg }}
      className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-display text-[15px] font-bold transition-transform duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:bg-sand disabled:text-soft"
    >
      {icon === "check" && <Check className="h-4 w-4" />}
      <span className="whitespace-nowrap">{children}</span>
      {icon === "arrow" && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}

/**
 * The mastery-loop feedback note. Correct = a warm reinforcement; "explain" (a
 * wrong answer) is the guide teaching ahead of the re-ask — an amber coaching
 * tone, never a red retry.
 */
export function FeedbackNote({
  kind,
  children,
}: {
  kind: "correct" | "explain";
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const correct = kind === "correct";
  return (
    <m.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: EASE_OUT }}
      role="status"
      className="mt-5 flex items-start gap-3 rounded-2xl px-4 py-3.5"
      style={{
        background: correct ? "var(--l-ok-soft)" : "var(--l-warm-soft)",
        color: correct ? "var(--l-ok-ink)" : "var(--l-warm-ink)",
      }}
    >
      <span
        aria-hidden
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white"
        style={{ background: correct ? "var(--l-ok)" : "var(--l-warm)" }}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
      <div className="font-body text-[15px] leading-snug">{children}</div>
    </m.div>
  );
}

/** Option button used by choice-style steps. */
export type OptionState = "idle" | "selected" | "correct" | "wrong" | "reveal";

const STATE_CLASS: Record<OptionState, string> = {
  idle: styles.optIdle,
  selected: styles.optSelected,
  correct: styles.optCorrect,
  wrong: styles.optWrong,
  reveal: styles.optReveal,
};

export function OptionButton({
  label,
  letter,
  state,
  onClick,
  disabled,
  pop = false,
  xpTick = null,
}: {
  label: string;
  letter?: string;
  state: OptionState;
  onClick: () => void;
  disabled?: boolean;
  /** trigger the satisfying scale-pop (correct moment). */
  pop?: boolean;
  /** floating "+N" reward chip value (correct moment). */
  xpTick?: number | null;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      className={`${styles.option} ${STATE_CLASS[state]} ${pop ? styles.pop : ""}`}
    >
      {letter && <span className={styles.letter}>{letter}</span>}
      <span className="min-w-0 flex-1">{label}</span>
      {(state === "correct" || state === "reveal") && (
        <Check className="h-5 w-5 shrink-0" style={{ color: "var(--l-ok)" }} />
      )}
      {xpTick != null && <span className={styles.xpFloat}>+{xpTick}</span>}
    </button>
  );
}
