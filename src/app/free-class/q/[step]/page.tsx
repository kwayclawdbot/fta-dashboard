"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
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

  const [sid, setSid] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | undefined>();
  const [dir] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = getStoredFunnelId();
      if (!stored) {
        router.replace("/free-class");
        return;
      }
      const state = await fetchSession(stored);
      if (!mounted) return;
      if (!state) {
        router.replace("/free-class");
        return;
      }
      setSid(stored);
      setSelected(state.answers?.[stepDef.key]);
      logEvent(stored, stepDef.step, "view");
      setReady(true);
    })();
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

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
      </div>
    );
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
