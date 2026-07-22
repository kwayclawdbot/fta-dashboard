"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Check, CalendarDays } from "lucide-react";
import { formatClassWhen, type NextClassResponse } from "@/lib/free-class";
import { TopBar, ProgressBar, FunnelStage } from "@/components/free-class/ui";
import {
  FUNNEL_STEPS,
  getStoredFunnelId,
  fetchSession,
  logEvent,
  personalizedResult,
  classDayName,
  type PersonalizedResult,
} from "@/lib/funnel";

/**
 * Personalized result — computed from the accumulated answers. Reflects the
 * family's answers back as a tailored "this class was built for you" moment, the
 * conversion beat between email capture and account creation.
 */
export default function ResultPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<PersonalizedResult | null>(null);
  const [session, setSession] = useState<NextClassResponse["session"] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = getStoredFunnelId();
      if (!stored) {
        router.replace("/free-class");
        return;
      }
      const [state, nextRes] = await Promise.all([
        fetchSession(stored),
        fetch("/api/free-class/next")
          .then((r) => (r.ok ? (r.json() as Promise<NextClassResponse>) : null))
          .catch(() => null),
      ]);
      if (!mounted) return;
      if (!state) {
        router.replace("/free-class");
        return;
      }
      // Email must be captured to reach the result.
      if (!state.email) {
        router.replace("/free-class/save");
        return;
      }
      const day = classDayName(nextRes?.session?.scheduled_at ?? null);
      setResult(personalizedResult(state.answers || {}, day));
      setSession(nextRes?.session ?? null);
      logEvent(stored, "result", "view");
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function back() {
    router.push("/free-class/save");
  }

  if (!ready || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
      </div>
    );
  }

  const current = FUNNEL_STEPS.indexOf("result") + 1;

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar />
      <ProgressBar current={current} total={FUNNEL_STEPS.length} onBack={back} />

      <AnimatePresence mode="wait">
        <FunnelStage stageKey="result">
          <div className="text-center mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-green text-green-700 text-[11px] font-display font-bold uppercase tracking-[0.14em] mb-4">
              Your result
            </span>
            <h1 className="font-display text-2xl font-bold text-ink leading-tight">
              {result.headline}
            </h1>
            <p className="text-soft text-sm mt-2 max-w-sm mx-auto">{result.subhead}</p>
          </div>

          <div className="paper-card p-5 space-y-3">
            {result.bullets.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-start gap-3"
              >
                <span className="w-5 h-5 rounded-full bg-gold-400/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-gold-700" />
                </span>
                <span className="text-[15px] text-ink leading-snug">{b}</span>
              </motion.div>
            ))}
          </div>

          {session?.scheduled_at && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-sand bg-white/40 px-4 py-2.5 text-sm text-ink">
              <CalendarDays className="w-4 h-4 text-gold-600 shrink-0" />
              <span className="font-semibold">Your class:</span>
              <span className="text-soft">{formatClassWhen(session.scheduled_at)}</span>
            </div>
          )}

          <button
            onClick={() => router.push("/free-class/register")}
            className="cta-button mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px]"
          >
            Save my seat <ArrowRight className="w-4 h-4" />
          </button>
          <p className="mt-3 text-center text-xs text-soft">
            One last step — create your free account to lock it in.
          </p>
        </FunnelStage>
      </AnimatePresence>
    </div>
  );
}
