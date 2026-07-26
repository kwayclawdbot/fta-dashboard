"use client";

import { m, useReducedMotion } from "@/lib/motion";
import { Check, X, ArrowRight, Sparkles } from "lucide-react";
import type { Register } from "@/lib/register";

/**
 * Shared visual kit for LessonEngine steps. Warm-cream family register
 * (paper/ink/soft/sand/gold + chip accents) matching Celebrate + v3 Home.
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
      <h2 className="font-display text-[22px] leading-tight font-bold text-ink sm:text-2xl">
        {children}
      </h2>
      {sub && <p className="mt-2 text-sm text-soft font-body">{sub}</p>}
    </div>
  );
}

/** An in-world guide line (Kai as subtle companion — authored, no live LLM). */
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
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-400/20 text-gold-700"
      >
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <p
        className={`font-body text-[15px] leading-snug ${
          register === "adult" ? "text-soft" : "text-ink/80"
        }`}
      >
        {children}
      </p>
    </m.div>
  );
}

/** Primary action button — press feedback, single-line label. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  icon = "arrow",
  tone = "gold",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: "arrow" | "check" | "none";
  tone?: "gold" | "green";
}) {
  const base =
    tone === "green"
      ? "bg-green-500 text-white hover:bg-green-600"
      : "bg-gold-400 text-midnight-950 hover:bg-gold-300";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-display text-sm font-semibold transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:bg-sand disabled:text-soft ${base}`}
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
      className={`mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3 ${
        correct
          ? "bg-chip-green text-green-800"
          : "bg-chip-amber text-gold-800"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
          correct ? "bg-green-500 text-white" : "bg-gold-500 text-white"
        }`}
      >
        {correct ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <div className="font-body text-sm leading-snug">{children}</div>
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
    idle: "border-sand bg-white/60 text-ink hover:border-gold-300 hover:bg-white",
    selected: "border-gold-400 bg-gold-400/10 text-ink",
    correct: "border-green-500 bg-chip-green text-green-900",
    wrong: "border-red-400 bg-red-500/10 text-red-800",
    reveal: "border-green-500 bg-chip-green text-green-900 ring-1 ring-green-500",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left font-body text-[15px] transition-[transform,border-color,background-color] duration-150 ease-out active:scale-[0.99] disabled:cursor-default ${styles[state]}`}
    >
      {letter && (
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-md font-display text-xs font-bold ${
            state === "idle" || state === "selected"
              ? "bg-sand/70 text-soft"
              : "bg-white/70 text-ink"
          }`}
        >
          {letter}
        </span>
      )}
      <span className="min-w-0 flex-1">{label}</span>
      {state === "correct" || state === "reveal" ? (
        <Check className="h-4 w-4 shrink-0 text-green-600" />
      ) : state === "wrong" ? (
        <X className="h-4 w-4 shrink-0 text-red-500" />
      ) : null}
    </button>
  );
}
