"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { XP, awardXp, hasXpForRef } from "@/lib/xp";

/**
 * FTA lesson bridge — receives interaction events from an embedded interactive
 * HTML lesson (iframe) and writes them into the platform (quiz_attempts, XP, progress).
 *
 * Protocol (child lesson iframe -> this dashboard viewer), see ftaBridge.js in the lesson:
 *   { type:'fta', v:1, event, payload, ctx, ts }
 *
 *   event 'section'      payload { id, index, total, progress_pct }
 *                        -> lesson_progress upsert (status:'in_progress', progress_pct), monotonic
 *   event 'quiz_answer'  payload { score(0-100), passed, total, correct,
 *                                  answers:[{question, selected, correct_index, is_correct}] }
 *                        -> insert quiz_attempts (existing shape) + award quiz XP (guarded)
 *   event 'complete'     payload {}
 *                        -> lesson_progress upsert (status:'completed', progress_pct:100) + lesson XP (guarded)
 *   event 'ready'        payload {}   (no-op; lets the host know the lesson mounted)
 *
 * Security: the child posts with targetOrigin '*' (events carry no secrets); the HOST
 * validates event.origin against the allowlist below before doing anything.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

// Exact origins that may drive lesson interactions.
const EXACT_ALLOWED_ORIGINS = new Set<string>([
  "https://fta-university.vercel.app",
]);

/** True if `origin` is an approved lesson host (prod university or a here.now review publish). */
export function isAllowedLessonOrigin(origin: string): boolean {
  if (!origin || origin === "null") return false;
  if (EXACT_ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return false;
    // here.now review publishes: <slug>.here.now (and here.now itself).
    if (u.hostname === "here.now" || u.hostname.endsWith(".here.now")) return true;
  } catch {
    /* malformed origin -> reject */
  }
  return false;
}

type FtaEvent = "ready" | "section" | "quiz_answer" | "complete";

interface FtaMessage {
  type: "fta";
  v?: number;
  event: FtaEvent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx?: Record<string, any>;
  ts?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFtaMessage(d: any): d is FtaMessage {
  return (
    d &&
    typeof d === "object" &&
    d.type === "fta" &&
    typeof d.event === "string" &&
    ["ready", "section", "quiz_answer", "complete"].includes(d.event)
  );
}

function clampInt(v: unknown, lo: number, hi: number): number | null {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(lo, Math.min(hi, n));
}

interface QuizAnswerRow {
  question: string;
  selected: number | null;
  correct_index: number | null;
  is_correct: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAnswers(raw: any): QuizAnswerRow[] {
  if (!Array.isArray(raw)) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return raw.map((a: any) => ({
    question: String(a?.question ?? ""),
    selected: a?.selected == null ? null : clampInt(a.selected, 0, 99),
    correct_index: a?.correct_index == null ? null : clampInt(a.correct_index, 0, 99),
    is_correct: !!a?.is_correct,
  }));
}

export interface LessonBridgeOptions {
  supabase: DB;
  lessonId: string;
  quizId: string | null;
  /** Skip all DB writes for mock/demo lessons. */
  isMock: boolean;
  /** Only listen while an embedded HTML lesson is mounted. */
  enabled: boolean;
  onSection?: (pct: number) => void;
  onQuiz?: (score: number, passed: boolean) => void;
  onComplete?: () => void;
}

/**
 * Installs a window `message` listener that bridges an embedded lesson's
 * interactions into the platform. All writes are RLS-scoped to the current user.
 */
export function useLessonBridge(opts: LessonBridgeOptions): void {
  const { supabase, lessonId, quizId, isMock, enabled } = opts;
  const { onSection, onQuiz, onComplete } = opts;

  useEffect(() => {
    if (!enabled) return;

    async function handle(e: MessageEvent) {
      if (!isAllowedLessonOrigin(e.origin)) return;
      if (!isFtaMessage(e.data)) return;
      const msg = e.data as FtaMessage;
      if (isMock) return; // never write for mock lessons
      if (msg.event === "ready") return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      try {
        if (msg.event === "section") {
          const pct = clampInt(msg.payload?.progress_pct, 0, 100);
          if (pct == null) return;
          // Never downgrade a completed lesson; keep progress monotonic.
          const { data: existing } = await supabase
            .from("lesson_progress")
            .select("status, progress_pct")
            .eq("user_id", user.id)
            .eq("lesson_id", lessonId)
            .maybeSingle();
          if (existing?.status === "completed") return;
          if (existing && (existing.progress_pct ?? 0) >= pct) return;
          await supabase.from("lesson_progress").upsert(
            {
              user_id: user.id,
              lesson_id: lessonId,
              status: "in_progress",
              progress_pct: pct,
            },
            { onConflict: "user_id,lesson_id" }
          );
          onSection?.(pct);
        } else if (msg.event === "quiz_answer") {
          if (!quizId) return; // no quiz row for this lesson -> nothing to attach the attempt to
          const score = clampInt(msg.payload?.score, 0, 100) ?? 0;
          const passed = !!msg.payload?.passed;
          const answers = normalizeAnswers(msg.payload?.answers);
          // Reuse the exact quiz_attempts shape the video-lesson path writes.
          await supabase.from("quiz_attempts").insert({
            user_id: user.id,
            quiz_id: quizId,
            score,
            passed,
            answers,
          });
          // XP: +30 for a pass, +20 bonus at 100% (once per quiz).
          if (passed && !(await hasXpForRef(supabase, user.id, "quiz", quizId))) {
            await awardXp(supabase, user.id, "quiz", XP.QUIZ_PASS, quizId);
            if (score >= 100) {
              await awardXp(supabase, user.id, "bonus", XP.QUIZ_PERFECT_BONUS, `${quizId}-perfect`);
            }
          }
          onQuiz?.(score, passed);
        } else if (msg.event === "complete") {
          await supabase.from("lesson_progress").upsert(
            {
              user_id: user.id,
              lesson_id: lessonId,
              status: "completed",
              progress_pct: 100,
              completed_at: new Date().toISOString(),
            },
            { onConflict: "user_id,lesson_id" }
          );
          // +50 XP for completing a lesson (once per lesson).
          if (!(await hasXpForRef(supabase, user.id, "lesson", lessonId))) {
            await awardXp(supabase, user.id, "lesson", XP.LESSON, lessonId);
          }
          onComplete?.();
        }
      } catch (err) {
        console.warn("[ftaBridge] handler error:", err);
      }
    }

    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isMock, lessonId, quizId, supabase]);
}
