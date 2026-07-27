"use client";

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

/** Big question / prompt headline for a step. */
export function StepPrompt({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="max-w-[34ch] font-display text-display-3 font-extrabold text-ink">
        {children}
      </h2>
      {sub && <p className="mt-2.5 text-[14px] leading-snug text-soft">{sub}</p>}
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
}: {
  label: string;
  letter?: string;
  state: OptionState;
  onClick: () => void;
  disabled?: boolean;
}) {
  const styles: Record<OptionState, string> = {
    idle: "border-sand bg-card text-ink hover:border-gold-500",
    selected: "border-gold-500 bg-gold-400/10 text-ink",
    correct: "border-ink bg-ink/[0.06] text-ink",
    wrong: "border-sand bg-transparent text-soft",
    reveal: "border-ink bg-ink/[0.06] text-ink ring-1 ring-ink/20",
  };
  const quiet = state === "idle" || state === "selected";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] transition-[transform,border-color,background-color] duration-150 ease-out active:scale-[0.99] disabled:cursor-default ${styles[state]}`}
    >
      {letter && (
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-md font-display text-xs font-bold ${
            quiet ? "bg-sand text-soft" : "bg-ink/10 text-ink"
          }`}
        >
          {letter}
        </span>
      )}
      <span className="min-w-0 flex-1">{label}</span>
      {state === "correct" || state === "reveal" ? (
        <Check className="h-4 w-4 shrink-0 text-ink" />
      ) : state === "wrong" ? (
        <X className="h-4 w-4 shrink-0 text-soft" />
      ) : null}
    </button>
  );
}
