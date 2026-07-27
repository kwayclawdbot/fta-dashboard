"use client";

import { useRef } from "react";
import { m, useReducedMotion } from "@/lib/motion";
import { Check, X, ArrowRight, Sparkles } from "lucide-react";
import type { Register } from "@/lib/register";

/**
 * Shared visual kit for LessonEngine steps.
 *
 * COLOUR LAW (hard, and the reason this file no longer paints answers green or
 * red): green/red are PRICE colours. A quiz result is not a price move, so
 * correctness is carried by INK + a mark (the settled, "locked-in" register)
 * and a wrong answer steps back into `soft` while the explanation does the
 * teaching — which is exactly the mastery-loop pedagogy ChoiceCore already
 * describes ("a wrong answer is NEVER just red + retry"). Volt orange is the
 * ACTION colour, so it marks the primary button and the live selection only.
 * Kai blue is the AI voice, so the guide line wears it.
 *
 * SURFACES are semantic tokens (paper/ink/soft/sand/card) — never bg-white,
 * which renders a white slab on the dark theme.
 *
 * Motion follows the emil-design framework: transform+opacity only, strong
 * ease-out under 300ms, scale-on-press feedback, prefers-reduced-motion honored.
 */

// Strong ease-out (easing.dev) — the built-in CSS easings are too weak.
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Big question / prompt headline for a step.
 *
 *  `mark` annotates ONE word or phrase inside a string headline with the drawn
 *  circle (f0-circle-mark) — the canvas's handwritten lasso, done with the
 *  system's own marker instead of a script font we do not load. It is ignored
 *  unless the headline is a plain string containing that exact phrase. */
export function StepPrompt({
  children,
  sub,
  mark,
}: {
  children: React.ReactNode;
  sub?: string;
  mark?: string;
}) {
  let head: React.ReactNode = children;
  if (mark && typeof children === "string") {
    const at = children.indexOf(mark);
    if (at >= 0) {
      head = (
        <>
          {children.slice(0, at)}
          <span className="f0-circle-mark">{mark}</span>
          {children.slice(at + mark.length)}
        </>
      );
    }
  }
  return (
    <div className="mb-6">
      <h2 className="max-w-[34ch] font-display text-display-3 font-extrabold text-ink">
        {head}
      </h2>
      {sub && <p className="mt-2.5 text-[14px] leading-snug text-soft">{sub}</p>}
    </div>
  );
}

/**
 * The answer group. A "pick one of N" form control, so it carries the same
 * semantics the canvas-v2 foundation settled on for SegmentedRail:
 * role=radiogroup, ONE tab stop, arrows move within it. The rail itself is the
 * wrong shape for four sentence-length answers, but the keyboard model must not
 * fork — a member who learns arrows on the stance control should not meet a
 * different model on a lesson.
 *
 * `onSelect` receives the POSITION in the rendered order, which is not the
 * option index once the mastery loop reshuffles for a re-ask; the caller maps.
 */
export function ChoiceGroup({
  ariaLabel,
  count,
  onSelect,
  disabled = false,
  layout = "list",
  className = "",
  children,
}: {
  ariaLabel: string;
  count: number;
  onSelect: (position: number) => void;
  disabled?: boolean;
  layout?: "list" | "split";
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function move(delta: number) {
    if (disabled || count === 0) return;
    const btns = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>("[data-choice]") ?? []
    );
    const active = btns.findIndex((b) => b === document.activeElement);
    const next = ((active >= 0 ? active : 0) + delta + count) % count;
    onSelect(next);
    btns[next]?.focus();
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        }
      }}
      className={`${
        layout === "split"
          ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
          : "flex flex-col gap-2.5"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** An in-world guide line (Kai as subtle companion — authored, no live LLM).
 *  Kai blue by law: this is the AI voice, and nothing else on the step is. */
export function GuideLine({
  children,
  register,
}: {
  children: React.ReactNode;
  register: Register;
}) {
  const reduce = useReducedMotion();
  return (
    <m.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="mb-5 flex items-start gap-2.5"
    >
      <span
        aria-hidden
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-kai-blue-soft text-kai-blue"
      >
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <p
        className={`max-w-[58ch] text-[15px] leading-snug ${
          register === "adult" ? "text-soft" : "text-ink"
        }`}
      >
        {children}
      </p>
    </m.div>
  );
}

/** Primary action button — press feedback, single-line label.
 *  `action` = volt (do the thing) · `confirm` = ink (seal the thing). */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  icon = "arrow",
  tone = "action",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: "arrow" | "check" | "none";
  tone?: "action" | "confirm";
}) {
  const base =
    tone === "confirm"
      ? "bg-ink text-paper hover:opacity-90"
      : "bg-volt-500 text-white hover:bg-volt-600";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-3 font-display text-sm font-bold transition-[transform,background-color,opacity] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:bg-sand disabled:text-soft ${base}`}
    >
      {icon === "check" && <Check className="h-4 w-4" />}
      <span className="whitespace-nowrap">{children}</span>
      {icon === "arrow" && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}

/**
 * The mastery-loop feedback note. On a wrong answer this is NOT a red "retry" —
 * it is the guide explaining, ahead of an immediate re-ask. On correct it is a
 * short reinforcement.
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
      transition={{ duration: 0.22, ease: EASE_OUT }}
      role="status"
      className={`mt-4 flex items-start gap-2.5 border-l-2 py-2 pl-3.5 ${
        correct ? "border-ink" : "border-gold-500"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
          correct ? "bg-ink text-paper" : "bg-gold-500 text-night-950"
        }`}
      >
        {correct ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <div className="max-w-[58ch] text-[14px] leading-relaxed text-ink">
        {children}
      </div>
    </m.div>
  );
}

/** Option button used by choice-style steps. States: idle / selected / correct
 *  / wrong / reveal (the answer, highlighted after the loop). */
export type OptionState = "idle" | "selected" | "correct" | "wrong" | "reveal";

export function OptionButton({
  label,
  letter,
  state,
  onClick,
  disabled,
  tabIndex,
}: {
  label: string;
  letter?: string;
  state: OptionState;
  onClick: () => void;
  disabled?: boolean;
  /** Roving tab stop when inside a <ChoiceGroup/>. */
  tabIndex?: number;
}) {
  // f0-chip carries the structure (hairline, radius, transition) and f0-chip-on
  // is the selected field — the foundation's own selection chip, so a lesson
  // answer and a stance chip are the SAME object at different sizes. Choosing
  // and being right are told apart by the mark and by weight, never by the
  // price ramp: green on a right answer would put price colour on a quiz.
  const styles: Record<OptionState, string> = {
    idle: "text-ink",
    selected: "f0-chip-on",
    correct: "f0-chip-on",
    wrong: "text-soft opacity-70",
    reveal: "f0-chip-on",
  };
  const on = state === "selected" || state === "correct" || state === "reveal";
  return (
    <button
      data-choice
      type="button"
      role="radio"
      aria-checked={on}
      tabIndex={tabIndex}
      onClick={onClick}
      disabled={disabled}
      className={`f0-chip f0-press f0-focus w-full gap-3 px-4 py-3.5 text-left text-[15px] disabled:cursor-default ${styles[state]}`}
    >
      {letter && (
        <span
          className={`w-4 shrink-0 self-start pt-0.5 text-center font-mono text-[11px] font-semibold ${
            on ? "" : "text-soft"
          }`}
        >
          {letter}
        </span>
      )}
      <span className={`min-w-0 flex-1 ${on ? "font-semibold" : ""}`}>{label}</span>
      {state === "correct" || state === "reveal" ? (
        <Check className="h-4 w-4 shrink-0 self-center" strokeWidth={2.5} />
      ) : state === "wrong" ? (
        <X className="h-4 w-4 shrink-0 self-center" />
      ) : null}
    </button>
  );
}
