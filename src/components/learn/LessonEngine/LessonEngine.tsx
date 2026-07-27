"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { X, ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Register } from "@/lib/register";
import { celebrateRegister } from "@/lib/register";
import {
  type LessonJSON,
  type StepResult,
  type StepSpec,
  isGradedStep,
} from "@/lib/learn/schema";
import {
  saveStepProgress,
  loadStepProgress,
  bumpMastery,
  completeLesson,
  recordQuizAttempt,
} from "@/lib/learn/engine-io";
import { hasXpForRef } from "@/lib/xp";
import { useSoundOptIn } from "@/components/fic/Celebrate";
import Celebrate, { type CelebrateOptions } from "@/components/fic/Celebrate";
import Burst from "@/components/games/Burst";
import { playCue, feedbackScale } from "@/lib/learn/feedback";
import { STEP_REGISTRY } from "./registry";
import { EngineProvider } from "./EngineContext";
import { EASE_OUT, GuideLine, PrimaryButton } from "./ui";

/**
 * <LessonEngine/> — the universal renderer (FIC-LEARNING-WORLD §1). Reads a
 * lesson's JSON step sequence and walks a step-progression state machine with:
 *   • resume (lesson_step_progress), monotonic-forward
 *   • mastery-loop mistake handling (owned by each step; see ChoiceCore)
 *   • per-interaction skill_mastery updates (deterministic RPC, zero LLM)
 *   • byte-compatible completion writes (lesson_progress + quiz_attempts + XP)
 *     so belts / leaderboards / home-state / report cards keep working
 *   • register-scaled feedback + prefers-reduced-motion + mobile-first + a11y
 */

// Scored graded types (prediction is a reveal, not a score — excluded).
const SCORED = new Set(["multiple_choice", "true_false", "match_pairs"]);

export default function LessonEngine({
  lesson,
  lessonId,
  quizId,
  register,
  supabase,
  userId,
  familyId,
  courseTitle,
  moduleTitle,
  backHref,
  nextHref,
}: {
  lesson: LessonJSON;
  lessonId: string;
  quizId: string | null;
  register: Register;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>;
  userId: string | null;
  familyId: string | null;
  courseTitle: string;
  moduleTitle: string;
  backHref: string;
  nextHref: string | null;
}) {
  const reduce = useReducedMotion();
  const [soundOn] = useSoundOptIn();
  const steps = lesson.steps;
  const total = steps.length;

  const [hydrated, setHydrated] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState<{ xp: number; score: number | null }>({
    xp: lesson.xp,
    score: null,
  });
  const [celebrateQueue, setCelebrateQueue] = useState<CelebrateOptions[]>([]);
  const [winBurst, setWinBurst] = useState(0);
  // Has this lesson's XP already been banked? READ ONLY — it decides whether we
  // are allowed to print "+N XP", nothing else. The award itself is still
  // de-duped inside completeLesson(); this never gates a write.
  const [xpBanked, setXpBanked] = useState(false);

  // Score accumulator across scored steps (first-try correctness).
  const scored = useRef<{ total: number; correct: number }>({
    total: 0,
    correct: 0,
  });
  const resolving = useRef(false);

  const enqueue = useCallback(
    (o: CelebrateOptions) => setCelebrateQueue((q) => [...q, o]),
    []
  );

  // Hydrate resume position once.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (userId) {
        const { stepIndex: saved } = await loadStepProgress(
          supabase,
          userId,
          lessonId
        );
        // A finished row (>= total) means a prior completion — replay from 0.
        if (alive) setStepIndex(saved >= total ? 0 : Math.max(0, saved));
        const banked = await hasXpForRef(supabase, userId, "lesson", lessonId);
        if (alive) setXpBanked(banked);
      }
      if (alive) setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, userId, lessonId, total]);

  const finishLesson = useCallback(async () => {
    const s = scored.current;
    const score = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 100;
    const passed = score >= 70;

    playCue("win", register, soundOn);
    setWinBurst((n) => n + 1);

    // Mission-complete moment (register-scaled by Celebrate).
    enqueue({
      variant: "mission",
      register: celebrateRegister(register),
      title: register === "kid" ? "Lesson done!" : "Lesson complete",
      subtitle: lesson.title,
      xp: lesson.xp,
      sound: soundOn && register !== "adult",
    });

    if (userId) {
      // Graded result → quiz_attempts + quiz XP (legacy-identical intents).
      if (quizId && s.total > 0) {
        await recordQuizAttempt(supabase, userId, quizId, score, passed, [
          { engine: true, score, correct: s.correct, total: s.total },
        ]);
      }
      // Completion → lesson_progress + one-time lesson XP + belt ceremony.
      const belt = await completeLesson(
        supabase,
        userId,
        lessonId,
        register,
        lesson.xp
      );
      if (belt) enqueue(belt);
      await saveStepProgress(supabase, userId, lessonId, total, { done: true });
    }

    setSummary({ xp: lesson.xp, score: s.total > 0 ? score : null });
    setFinished(true);
  }, [
    supabase,
    userId,
    lessonId,
    quizId,
    total,
    register,
    soundOn,
    lesson.title,
    lesson.xp,
    enqueue,
  ]);

  const handleResolve = useCallback(
    (result: StepResult) => {
      if (resolving.current) return;
      resolving.current = true;
      const spec = steps[stepIndex];

      // Mastery update (deterministic). Prediction is positive-only (a reveal is
      // never punished); other graded steps use honest first-try correctness.
      const skill = result.skill ?? spec.skill;
      if (skill && isGradedStep(spec.type)) {
        if (spec.type === "prediction") {
          if (result.correct) void bumpMastery(supabase, skill, true);
        } else {
          void bumpMastery(supabase, skill, result.firstTry === true);
        }
      }

      // Score accumulation (scored types only).
      if (SCORED.has(spec.type)) {
        scored.current.total += 1;
        if (result.firstTry) scored.current.correct += 1;
      }

      const next = stepIndex + 1;
      if (next >= total) {
        void finishLesson();
        return;
      }
      // Advance + persist resume, then release the resolve lock.
      setStepIndex(next);
      if (userId) void saveStepProgress(supabase, userId, lessonId, next, {});
      window.setTimeout(() => {
        resolving.current = false;
      }, 120);
    },
    [steps, stepIndex, total, supabase, userId, lessonId, finishLesson]
  );

  function replay() {
    scored.current = { total: 0, correct: 0 };
    resolving.current = false;
    setFinished(false);
    setStepIndex(0);
    if (userId) void saveStepProgress(supabase, userId, lessonId, 0, {});
  }

  if (!hydrated) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-24 text-center">
        <div className="relative h-11 w-11">
          <div className="absolute inset-0 rounded-full border-2 border-sand" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-volt-500" />
        </div>
        <p className="mt-3 font-display text-sm font-bold text-soft">
          Picking up where you left off…
        </p>
      </div>
    );
  }

  const scale = feedbackScale(register);

  /* ── Completion screen ─────────────────────────────────────────────── */
  if (finished) {
    return (
      <div className="mx-auto max-w-2xl">
        <Celebrate
          opts={celebrateQueue[0] ?? null}
          onDone={() => setCelebrateQueue((q) => q.slice(1))}
        />
        <m.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="f0-hero-field f0-grain px-6 py-10 text-center sm:px-10"
        >
          {scale.burst > 0 && !reduce && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <Burst key={winBurst} count={scale.burst} power={scale.burstPower} />
            </div>
          )}
          {/* Inside the obsidian field the type is theme-invariant cream — the
              same rule the Learn hero follows. Volt is the only accent. */}
          <div className="relative">
            <div className="text-eyebrow font-display font-bold uppercase text-volt-400">
              {moduleTitle}
            </div>
            <h1 className="mt-3 font-display text-display-2 font-extrabold text-[#F7F3EA]">
              {register === "kid" ? "You did it!" : "Lesson complete"}
            </h1>
            <p className="mx-auto mt-3 max-w-[46ch] text-[15px] leading-relaxed text-[#F7F3EA]/70">
              {lesson.guide?.outro ??
                "That concept is yours now. Take it into the market."}
            </p>

            <div className="mt-7 flex items-center justify-center gap-6">
              <div>
                <p className="font-display text-display-3 font-extrabold tabular-nums text-[#F7F3EA]">
                  +{summary.xp}
                </p>
                <p className="mt-1 text-eyebrow font-display font-bold uppercase text-[#F7F3EA]/55">
                  XP earned
                </p>
              </div>
              {summary.score != null && (
                <div className="border-l border-white/15 pl-6">
                  <p className="font-display text-display-3 font-extrabold tabular-nums text-[#F7F3EA]">
                    {summary.score}%
                  </p>
                  <p className="mt-1 text-eyebrow font-display font-bold uppercase text-[#F7F3EA]/55">
                    Right first try
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={nextHref ?? backHref}
                className="inline-flex items-center gap-2 rounded-full bg-volt-500 px-5 py-2.5 font-display text-[14px] font-bold text-white transition-transform active:scale-[0.98]"
              >
                {nextHref ? "Next lesson" : "Back to course"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={replay}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2.5 font-display text-[14px] font-bold text-[#F7F3EA]/80 transition-colors hover:text-[#F7F3EA]"
              >
                <RotateCcw className="h-4 w-4" />
                Replay
              </button>
            </div>
          </div>
        </m.div>
      </div>
    );
  }

  /* ── Step flow ─────────────────────────────────────────────────────── */
  const spec: StepSpec = steps[stepIndex];
  const StepComp = STEP_REGISTRY[spec.type];
  const pct = Math.round(((stepIndex + 1) / total) * 100);

  // The canvas prints "+10 XP" beside Check on every micro-lesson question. Our
  // XP is per-lesson and de-duped by ref, so it is shown ONCE — on the step that
  // actually banks it — and never on a replay of a lesson already paid out.
  const xpNote =
    !xpBanked && userId && stepIndex === total - 1 && lesson.xp > 0
      ? `+${lesson.xp} XP`
      : undefined;

  return (
    <EngineProvider value={{ supabase, userId, familyId }}>
      <div className="mx-auto max-w-2xl">
        <Celebrate
          opts={celebrateQueue[0] ?? null}
          onDone={() => setCelebrateQueue((q) => q.slice(1))}
        />

        {/* Header: breadcrumb-lite + progress + exit */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={backHref}
            aria-label="Exit lesson"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sand text-soft transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-sand">
              <m.div
                className="h-full rounded-full bg-volt-500"
                initial={false}
                animate={{ transform: `scaleX(${pct / 100})` }}
                style={{ transformOrigin: "left", width: "100%" }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
              />
            </div>
          </div>
          <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-soft">
            {stepIndex + 1}/{total}
          </span>
        </div>

        {/* Lesson title (small) + guide intro on the first step */}
        {stepIndex === 0 && (
          <div className="mb-6">
            <p className="text-eyebrow font-display font-bold uppercase text-soft">
              {moduleTitle}
            </p>
            <h1 className="mt-2 max-w-[28ch] font-display text-display-3 font-extrabold text-ink">
              {lesson.title}
            </h1>
            {lesson.guide?.intro && (
              <div className="mt-3">
                <GuideLine register={register}>{lesson.guide.intro}</GuideLine>
              </div>
            )}
          </div>
        )}

        {/* The step — no container. A hairline separates it from the header and
            the type carries the hierarchy (the register bans card boxes). */}
        <div className="f0-rule-top pt-7">
          <AnimatePresence mode="wait">
            <m.div
              key={`${stepIndex}-${spec.id}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: 0.26, ease: EASE_OUT }}
            >
              {StepComp ? (
                <StepComp
                  spec={spec}
                  register={register}
                  soundOn={soundOn}
                  xpNote={xpNote}
                  onResolve={handleResolve}
                />
              ) : (
                // Unknown step type — skip gracefully (forward-compat).
                <div className="text-center">
                  <p className="text-sm text-soft">
                    This step isn&apos;t available in your app version.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <PrimaryButton onClick={() => handleResolve({})} icon="arrow">
                      Skip
                    </PrimaryButton>
                  </div>
                </div>
              )}
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </EngineProvider>
  );
}
