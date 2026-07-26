"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { X, ArrowRight, RotateCcw, Sparkle } from "lucide-react";
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
import { useSoundOptIn } from "@/components/fic/Celebrate";
import Celebrate, { type CelebrateOptions } from "@/components/fic/Celebrate";
import Burst from "@/components/games/Burst";
import { playCue } from "@/lib/learn/feedback";
import { STEP_REGISTRY } from "./registry";
import { EngineProvider } from "./EngineContext";
import { getLessonSkin, EASE_OUT } from "./skin";
import { GuideLine, PrimaryButton } from "./ui";
import KaiGuide from "./KaiGuide";
import styles from "./skin.module.css";

/**
 * <LessonEngine/> — the universal renderer (FIC-LEARNING-WORLD §1). Reads a
 * lesson's JSON step sequence and walks a step-progression state machine with
 * resume, mastery-loop, per-interaction mastery, and byte-compatible completion
 * writes. Track A rebuilt the PRESENTATION only: full-canvas register color
 * fields, feature typography, a Kai mascot guide, satisfying reward moments, and
 * a cinematic completion — the machinery below is untouched.
 */

const SCORED = new Set(["multiple_choice", "true_false", "match_pairs"]);

/** Small honest count-up for the completion XP tally. */
function CountUp({ to, durationMs = 900 }: { to: number; durationMs?: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) {
      setN(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs, reduce]);
  return <>{n}</>;
}

function skillLabel(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LessonEngine({
  lesson,
  lessonId,
  quizId,
  register,
  supabase,
  userId,
  familyId,
  moduleTitle,
  backHref,
  nextHref,
  nextTitle,
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
  nextTitle?: string | null;
}) {
  const reduce = useReducedMotion();
  const [soundOn] = useSoundOptIn();
  const skin = useMemo(() => getLessonSkin(register), [register]);
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

  const scored = useRef<{ total: number; correct: number }>({ total: 0, correct: 0 });
  const resolving = useRef(false);

  const enqueue = useCallback(
    (o: CelebrateOptions) => setCelebrateQueue((q) => [...q, o]),
    []
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      if (userId) {
        const { stepIndex: saved } = await loadStepProgress(supabase, userId, lessonId);
        if (alive) setStepIndex(saved >= total ? 0 : Math.max(0, saved));
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

    enqueue({
      variant: "mission",
      register: celebrateRegister(register),
      title: register === "kid" ? "Lesson done!" : "Lesson complete",
      subtitle: lesson.title,
      xp: lesson.xp,
      sound: soundOn && register !== "adult",
    });

    if (userId) {
      if (quizId && s.total > 0) {
        await recordQuizAttempt(supabase, userId, quizId, score, passed, [
          { engine: true, score, correct: s.correct, total: s.total },
        ]);
      }
      const belt = await completeLesson(supabase, userId, lessonId, register, lesson.xp);
      if (belt) enqueue(belt);
      await saveStepProgress(supabase, userId, lessonId, total, { done: true });
    }

    setSummary({ xp: lesson.xp, score: s.total > 0 ? score : null });
    setFinished(true);
  }, [supabase, userId, lessonId, quizId, total, register, soundOn, lesson.title, lesson.xp, enqueue]);

  const handleResolve = useCallback(
    (result: StepResult) => {
      if (resolving.current) return;
      resolving.current = true;
      const spec = steps[stepIndex];

      const skill = result.skill ?? spec.skill;
      if (skill && isGradedStep(spec.type)) {
        if (spec.type === "prediction") {
          if (result.correct) void bumpMastery(supabase, skill, true);
        } else {
          void bumpMastery(supabase, skill, result.firstTry === true);
        }
      }

      if (SCORED.has(spec.type)) {
        scored.current.total += 1;
        if (result.firstTry) scored.current.correct += 1;
      }

      const next = stepIndex + 1;
      if (next >= total) {
        void finishLesson();
        return;
      }
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
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center py-24 text-center">
        <div className="relative h-11 w-11">
          <div className="absolute inset-0 rounded-full border-2 border-gold-400/25" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold-500" />
        </div>
        <p className="mt-3 font-display text-sm font-semibold text-soft">
          Picking up where you left off…
        </p>
      </div>
    );
  }

  /* ── Completion cinematic ─────────────────────────────────────────────── */
  if (finished) {
    const shownSkills = (lesson.skills ?? []).slice(0, 3);
    return (
      <div className="mx-auto max-w-3xl" style={skin.vars}>
        <Celebrate
          opts={celebrateQueue[0] ?? null}
          onDone={() => setCelebrateQueue((q) => q.slice(1))}
        />
        <m.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className={`${styles.canvas} text-center`}
        >
          {skin.motion.burst > 0 && !reduce && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <Burst key={winBurst} count={skin.motion.burst} power={skin.motion.burstPower} />
            </div>
          )}

          {/* Celebrating Kai + node-unlock ring */}
          <div className="relative mx-auto mb-5 grid place-items-center" style={{ width: skin.mascot.completion, height: skin.mascot.completion }}>
            {!reduce && <span className={styles.unlockRing} style={{ width: "100%", height: "100%" }} />}
            <KaiGuide pose="celebrating" size={skin.mascot.completion} />
          </div>

          <div className={`${skin.type.eyebrow}`} style={{ color: "var(--l-accent)" }}>
            {moduleTitle}
          </div>
          <h1 className={`mt-2 ${skin.type.headline} text-ink`}>
            {register === "kid" ? "You did it!" : "Lesson complete"}
          </h1>
          <p className={`mx-auto mt-3 max-w-md text-soft ${skin.type.body}`}>
            {lesson.guide?.outro ?? "That concept is yours now. Take it into the market."}
          </p>

          {/* XP tally + score */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 font-display text-[15px] font-black"
              style={{ background: "var(--l-accent)", color: "var(--l-accent-on)" }}
            >
              <Sparkle className="h-4 w-4" />
              +<CountUp to={summary.xp} /> XP
            </span>
            {summary.score != null && (
              <span
                className="inline-flex items-center rounded-full px-5 py-2.5 font-display text-[15px] font-bold"
                style={{ background: "var(--l-ok-soft)", color: "var(--l-ok-ink)" }}
              >
                {summary.score}% first try
              </span>
            )}
          </div>

          {/* Skills strengthened */}
          {shownSkills.length > 0 && (
            <div className="mx-auto mt-8 max-w-sm space-y-3 text-left">
              <div className="text-center text-[12px] font-bold uppercase tracking-[0.16em] text-soft">
                Skills you strengthened
              </div>
              {shownSkills.map((sk, i) => (
                <div key={sk}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-body text-[14px] font-semibold text-ink">
                      {skillLabel(sk)}
                    </span>
                  </div>
                  <div className={styles.skillTrack}>
                    <span
                      className={styles.skillFill}
                      style={{ animationDelay: `${120 + i * 120}ms` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Next-node tease */}
          {nextHref && nextTitle && (
            <div className="mx-auto mt-8 max-w-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-soft">
                Up next
              </div>
              <div className="mt-1 font-display text-[17px] font-bold text-ink">
                {nextTitle}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={nextHref ?? backHref}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-display text-[15px] font-bold transition-transform duration-150 ease-out active:scale-[0.97]"
              style={{ background: "var(--l-accent)", color: "var(--l-accent-on)" }}
            >
              {nextHref ? "Next lesson" : "Back to course"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={replay}
              className="inline-flex items-center gap-2 rounded-full border border-sand bg-white/50 px-5 py-3 font-body text-[14px] text-soft transition-colors hover:text-ink"
            >
              <RotateCcw className="h-4 w-4" />
              Replay
            </button>
          </div>
        </m.div>
      </div>
    );
  }

  /* ── Step flow ─────────────────────────────────────────────────────────── */
  const spec: StepSpec = steps[stepIndex];
  const StepComp = STEP_REGISTRY[spec.type];
  const pct = Math.round(((stepIndex + 1) / total) * 100);

  return (
    <EngineProvider value={{ supabase, userId, familyId }}>
      <div className="mx-auto max-w-3xl" style={skin.vars} data-reg={register}>
        <Celebrate
          opts={celebrateQueue[0] ?? null}
          onDone={() => setCelebrateQueue((q) => q.slice(1))}
        />

        {/* Header: exit + progress rail + counter */}
        <div className="mb-5 flex items-center gap-3">
          <Link
            href={backHref}
            aria-label="Exit lesson"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sand bg-white/60 text-soft transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className={styles.rail}>
              <m.div
                className={styles.railFill}
                initial={false}
                animate={{ transform: `scaleX(${pct / 100})` }}
                style={{ width: "100%" }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              />
            </div>
          </div>
          <span className="shrink-0 font-display text-xs font-bold text-soft">
            {stepIndex + 1}/{total}
          </span>
        </div>

        {/* The full-canvas step field */}
        <div className={styles.canvas}>
          {/* Step-0 intro: lesson title + Kai welcome */}
          {stepIndex === 0 && (
            <div className="mb-6">
              <div className={skin.type.eyebrow} style={{ color: "var(--l-accent)" }}>
                {moduleTitle}
              </div>
              <h1 className="mt-1.5 font-display text-[20px] font-black text-ink sm:text-[22px]">
                {lesson.title}
              </h1>
              {lesson.guide?.intro && (
                <div className="mt-4">
                  <GuideLine skin={skin} pose="watchful">
                    {lesson.guide.intro}
                  </GuideLine>
                </div>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            <m.div
              key={`${stepIndex}-${spec.id}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: skin.motion.stepDurMs / 1000, ease: EASE_OUT }}
            >
              {StepComp ? (
                <StepComp
                  spec={spec}
                  register={register}
                  soundOn={soundOn}
                  onResolve={handleResolve}
                />
              ) : (
                <div className="text-center">
                  <p className="font-body text-sm text-soft">
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
