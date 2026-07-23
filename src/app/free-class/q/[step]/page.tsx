"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { TopBar, ProgressBar, FunnelStage, QuizCard } from "@/components/free-class/ui";
import {
  QUIZ,
  FUNNEL_STEPS,
  getStoredFunnelId,
  fetchSession,
  logEvent,
} from "@/lib/funnel";

/**
 * One quiz question per page (/free-class/q/1..N). Radio-card auto-advance,
 * progress bar, back support. Rehydrates the answer from the server session so a
 * refresh or a deep-link keeps state. After the last question → /save.
 */
export default function QuestionPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = use(params);
  const router = useRouter();

  const idx = Math.max(1, Math.min(QUIZ.length, parseInt(step, 10) || 1));
  const stepDef = QUIZ[idx - 1];

  // The funnel id lives in localStorage (synchronous). We read it during render
  // so the question paints instantly from the local QUIZ definition — no
  // full-screen spinner between steps. The server session is only fetched in the
  // background to rehydrate a previously-chosen answer.
  const [sid, setSid] = useState<string | null>(() => getStoredFunnelId());
  const [selected, setSelected] = useState<string | undefined>();
  const [dir] = useState(1);
  const loggedView = useRef<string | null>(null);

  useEffect(() => {
    const stored = getStoredFunnelId();
    // No funnel started → send them to the landing to create one.
    if (!stored) {
      router.replace("/free-class");
      return;
    }
    if (stored !== sid) setSid(stored);

    // Log the view once per step (fire-and-forget, no render gate).
    if (loggedView.current !== stepDef.step) {
      loggedView.current = stepDef.step;
      logEvent(stored, stepDef.step, "view");
    }

    // Background hydrate: fill in a prior answer if one exists. Never blocks
    // paint; if the session is gone we quietly leave the question unanswered.
    let mounted = true;
    fetchSession(stored).then((state) => {
      if (mounted && state) setSelected(state.answers?.[stepDef.key]);
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function pick(value: string) {
    setSelected(value);
    if (sid) logEvent(sid, stepDef.step, "answer", { answer: { key: stepDef.key, value } });
    // brief beat so the selection registers, then advance
    setTimeout(() => {
      if (idx < QUIZ.length) router.push(`/free-class/q/${idx + 1}`);
      else router.push("/free-class/save");
    }, 170);
  }

  function back() {
    if (sid) logEvent(sid, stepDef.step, "back");
    if (idx > 1) router.push(`/free-class/q/${idx - 1}`);
    else router.push("/free-class");
  }

  const current = (FUNNEL_STEPS as readonly string[]).indexOf(stepDef.step) + 1;

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar />
      <ProgressBar current={current} total={FUNNEL_STEPS.length} onBack={back} />
      <AnimatePresence mode="wait" custom={dir}>
        <FunnelStage stageKey={idx} dir={dir}>
          <QuizCard stepDef={stepDef} selected={selected} onPick={pick} />
        </FunnelStage>
      </AnimatePresence>
    </div>
  );
}
