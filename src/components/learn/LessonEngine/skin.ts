import type { CSSProperties } from "react";
import type { Register } from "@/lib/register";

/**
 * Lesson-engine register skins (Track A / A4). ONE engine, three visibly
 * different worlds — driven entirely by CSS custom properties consumed by
 * skin.module.css, plus a small motion + type-scale config.
 *
 *   • kid   → illustrated-bright, warm-gold, big targets, exuberant motion
 *   • teen  → game-energy modern, volt + Kai-blue charge, medium motion
 *   • adult → editorial-cinematic, confident volt/teal, restrained motion
 *
 * The register accent is NOT the shell's data-mode accent — a lesson keeps its
 * own world regardless of which mode the shell is in, so the four-register
 * derivation (FIC-LEARNING-WORLD §4) is realised inside lessons, not copy-only.
 */

// Strong ease-out (easing.dev) — the built-in CSS easings are too weak.
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_POP = [0.34, 1.56, 0.64, 1] as const;

export interface LessonMotion {
  /** step enter/exit duration (ms). */
  stepDurMs: number;
  /** scale-pop on a correct answer (1 = none). */
  pop: number;
  popDurMs: number;
  /** win-burst particle count / power. */
  burst: number;
  burstPower: number;
  /** idle bob on the guide mascot. */
  guideFloat: boolean;
  /** navigator.vibrate pattern on correct (null = never). */
  haptic: number[] | null;
  /** per-correct XP tick shown as a floating chip. */
  xpTick: number;
}

export interface LessonType {
  headline: string;
  lead: string;
  body: string;
  figureStat: string;
  eyebrow: string;
}

export interface LessonSkin {
  mode: Register;
  /** custom props for the canvas root (drives skin.module.css). */
  vars: CSSProperties;
  motion: LessonMotion;
  type: LessonType;
  mascot: { guide: number; completion: number };
  /** register-flavoured guide labels. */
  reask: { choice: string; tf: string; match: string };
}

/* Shared success (teal-green) + warm mastery (amber, never red-shame) ramps. */
const OK = "#0FA678";
const OK_INK = "#065F46";
const WARM = "#E08A1E";
const WARM_INK = "#8A4B0B";

function baseVars(): CSSProperties {
  return {
    "--l-ok": OK,
    "--l-ok-ink": OK_INK,
    "--l-ok-soft": "color-mix(in srgb, " + OK + " 15%, var(--card))",
    "--l-ok-ring": "color-mix(in srgb, " + OK + " 30%, transparent)",
    "--l-warm": WARM,
    "--l-warm-ink": WARM_INK,
    "--l-warm-soft": "color-mix(in srgb, " + WARM + " 16%, var(--card))",
    "--l-rail-bg": "color-mix(in srgb, var(--ink) 10%, transparent)",
    "--l-opt-bg": "color-mix(in srgb, var(--card) 82%, transparent)",
    "--l-opt-bg-hover": "var(--card)",
    "--l-opt-border": "color-mix(in srgb, var(--ink) 12%, transparent)",
    "--l-kai-medallion":
      "radial-gradient(120% 120% at 30% 20%, color-mix(in srgb, var(--kai-blue) 78%, white) 0%, var(--kai-blue) 55%, color-mix(in srgb, var(--kai-blue) 60%, black) 100%)",
  } as CSSProperties;
}

export function getLessonSkin(register: Register): LessonSkin {
  const base = baseVars();

  if (register === "kid") {
    return {
      mode: "kid",
      vars: {
        ...base,
        // Warm-gold, bright + playful field.
        "--l-field-a": "color-mix(in srgb, var(--color-gold-300) 42%, var(--card))",
        "--l-field-b": "color-mix(in srgb, var(--color-gold-200) 30%, var(--card))",
        "--l-field-c": "var(--card)",
        "--l-field-border": "color-mix(in srgb, var(--color-gold-400) 42%, var(--sand))",
        "--l-field-hi": "color-mix(in srgb, white 55%, transparent)",
        "--l-field-shadow": "color-mix(in srgb, var(--color-gold-700) 40%, transparent)",
        "--l-glow-a": "color-mix(in srgb, var(--color-gold-400) 40%, transparent)",
        "--l-glow-b": "color-mix(in srgb, #7DD3FC 34%, transparent)",
        "--l-drift": "color-mix(in srgb, var(--color-gold-300) 55%, transparent)",
        "--l-accent": "var(--color-gold-500)",
        "--l-accent-b": "var(--color-gold-400)",
        "--l-accent-soft": "color-mix(in srgb, var(--color-gold-400) 20%, var(--card))",
        "--l-accent-ring": "color-mix(in srgb, var(--color-gold-400) 34%, transparent)",
        "--l-accent-glow": "color-mix(in srgb, var(--color-gold-500) 60%, transparent)",
        "--l-accent-on": "#3A2A05",
        "--l-letter-bg": "color-mix(in srgb, var(--color-gold-400) 30%, var(--card))",
        "--l-letter-ink": "var(--color-gold-800)",
        "--l-radius": "20px",
        "--l-opt-pad": "18px 20px",
        "--l-opt-size": "17px",
        "--l-letter": "34px",
        "--l-pop": "1.16",
        "--l-pop-dur": "520ms",
        "--l-xp-size": "17px",
        "--l-canvas-min": "440px",
      } as CSSProperties,
      motion: { stepDurMs: 300, pop: 1.16, popDurMs: 520, burst: 22, burstPower: 130, guideFloat: true, haptic: [18], xpTick: 3 },
      type: {
        eyebrow: "text-[11px] font-black uppercase tracking-[0.16em]",
        headline: "font-display text-[27px] leading-[1.08] font-black tracking-tight sm:text-[34px]",
        lead: "font-display text-[19px] leading-snug font-bold sm:text-[22px]",
        body: "font-body text-[16px] leading-relaxed sm:text-[17px]",
        figureStat: "font-display text-[52px] leading-none font-black tracking-tight sm:text-[68px]",
      },
      mascot: { guide: 56, completion: 104 },
      reask: {
        choice: "Almost! Let's try that one more time.",
        tf: "Take another look, then pick.",
        match: "Not a match — keep going, you've got this!",
      },
    };
  }

  if (register === "teen") {
    return {
      mode: "teen",
      vars: {
        ...base,
        // Game-energy: volt charge crossing into Kai-blue + teal.
        "--l-field-a": "color-mix(in srgb, var(--color-volt-500) 20%, var(--card))",
        "--l-field-b": "color-mix(in srgb, var(--kai-blue) 12%, var(--card))",
        "--l-field-c": "var(--card)",
        "--l-field-border": "color-mix(in srgb, var(--color-volt-500) 40%, var(--sand))",
        "--l-field-hi": "color-mix(in srgb, white 40%, transparent)",
        "--l-field-shadow": "color-mix(in srgb, var(--color-volt-700) 44%, transparent)",
        "--l-glow-a": "color-mix(in srgb, var(--color-volt-500) 34%, transparent)",
        "--l-glow-b": "color-mix(in srgb, var(--kai-blue) 30%, transparent)",
        "--l-drift": "color-mix(in srgb, var(--color-teal-400) 40%, transparent)",
        "--l-accent": "var(--color-volt-500)",
        "--l-accent-b": "var(--color-volt-400)",
        "--l-accent-soft": "color-mix(in srgb, var(--color-volt-500) 16%, var(--card))",
        "--l-accent-ring": "color-mix(in srgb, var(--color-volt-500) 30%, transparent)",
        "--l-accent-glow": "color-mix(in srgb, var(--color-volt-500) 60%, transparent)",
        "--l-accent-on": "#ffffff",
        "--l-letter-bg": "color-mix(in srgb, var(--color-volt-500) 22%, var(--card))",
        "--l-letter-ink": "var(--color-volt-700)",
        "--l-radius": "16px",
        "--l-opt-pad": "16px 18px",
        "--l-opt-size": "16px",
        "--l-letter": "30px",
        "--l-pop": "1.10",
        "--l-pop-dur": "460ms",
        "--l-xp-size": "15px",
        "--l-canvas-min": "420px",
      } as CSSProperties,
      motion: { stepDurMs: 280, pop: 1.1, popDurMs: 460, burst: 12, burstPower: 100, guideFloat: true, haptic: [12], xpTick: 3 },
      type: {
        eyebrow: "text-[11px] font-black uppercase tracking-[0.18em]",
        headline: "font-display text-[28px] leading-[1.06] font-black tracking-tight sm:text-[36px]",
        lead: "font-display text-[19px] leading-snug font-bold sm:text-[22px]",
        body: "font-body text-[16px] leading-relaxed sm:text-[17px]",
        figureStat: "font-display text-[54px] leading-none font-black tracking-tight sm:text-[72px]",
      },
      mascot: { guide: 46, completion: 88 },
      reask: {
        choice: "Not quite — run it back.",
        tf: "Read it once more, then call it.",
        match: "Miss — keep linking, you've got the rest.",
      },
    };
  }

  // adult — editorial-cinematic, confident colour, restrained motion.
  return {
    mode: "adult",
    vars: {
      ...base,
      "--l-field-a": "color-mix(in srgb, var(--color-teal-500) 15%, var(--card))",
      "--l-field-b": "color-mix(in srgb, var(--color-volt-500) 11%, var(--card))",
      "--l-field-c": "var(--card)",
      "--l-field-border": "color-mix(in srgb, var(--color-volt-500) 30%, var(--sand))",
      "--l-field-hi": "color-mix(in srgb, white 34%, transparent)",
      "--l-field-shadow": "color-mix(in srgb, var(--ink) 40%, transparent)",
      "--l-glow-a": "color-mix(in srgb, var(--color-volt-500) 24%, transparent)",
      "--l-glow-b": "color-mix(in srgb, var(--color-teal-500) 24%, transparent)",
      "--l-drift": "color-mix(in srgb, var(--color-teal-500) 30%, transparent)",
      "--l-accent": "var(--color-volt-500)",
      "--l-accent-b": "var(--color-volt-600)",
      "--l-accent-soft": "color-mix(in srgb, var(--color-volt-500) 12%, var(--card))",
      "--l-accent-ring": "color-mix(in srgb, var(--color-volt-500) 24%, transparent)",
      "--l-accent-glow": "color-mix(in srgb, var(--color-volt-500) 50%, transparent)",
      "--l-accent-on": "#ffffff",
      "--l-letter-bg": "color-mix(in srgb, var(--ink) 8%, transparent)",
      "--l-letter-ink": "var(--soft)",
      "--l-radius": "14px",
      "--l-opt-pad": "15px 18px",
      "--l-opt-size": "16px",
      "--l-letter": "28px",
      "--l-pop": "1.05",
      "--l-pop-dur": "380ms",
      "--l-xp-size": "14px",
      "--l-canvas-min": "400px",
    } as CSSProperties,
    motion: { stepDurMs: 260, pop: 1.05, popDurMs: 380, burst: 4, burstPower: 60, guideFloat: false, haptic: [8], xpTick: 3 },
    type: {
      eyebrow: "text-[11px] font-bold uppercase tracking-[0.2em]",
      headline: "font-display text-[29px] leading-[1.05] font-black tracking-tight sm:text-[38px]",
      lead: "font-display text-[20px] leading-snug font-semibold sm:text-[23px]",
      body: "font-body text-[16px] leading-relaxed sm:text-[17px]",
      figureStat: "font-display text-[56px] leading-none font-black tracking-tight sm:text-[76px]",
    },
    mascot: { guide: 40, completion: 76 },
    reask: {
      choice: "Not the one — here's why, then try again.",
      tf: "Read it once more, then decide.",
      match: "Not a match — the rest are within reach.",
    },
  };
}

/** Fire a register-safe haptic on correct (reduced-motion / no-support safe). */
export function lessonHaptic(skin: LessonSkin, reduce: boolean): void {
  if (reduce || !skin.motion.haptic) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(skin.motion.haptic);
  } catch {
    /* ignore */
  }
}
