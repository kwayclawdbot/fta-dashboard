"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "@/lib/motion";
import { ArrowRight, CalendarDays } from "lucide-react";
import { formatClassWhen, type NextClassResponse } from "@/lib/free-class";
import {
  FunnelPage,
  FunnelSkeleton,
  TopBar,
  ProgressBar,
  FunnelStage,
  Mast,
  Card,
  CheckLine,
  Action,
  Terms,
} from "@/components/free-class/ui";
import {
  FUNNEL_STEPS,
  getStoredFunnelId,
  fetchSession,
  logEvent,
  personalizedResult,
  classDayName,
  getChallengeFlag,
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
  const [challenge, setChallenge] = useState(false);

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
      const isChallenge = getChallengeFlag();
      const day = classDayName(nextRes?.session?.scheduled_at ?? null);
      setChallenge(isChallenge);
      setResult(personalizedResult(state.answers || {}, day, { challenge: isChallenge }));
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

  if (!ready || !result) return <FunnelSkeleton bar />;

  const current = FUNNEL_STEPS.indexOf("result") + 1;

  return (
    <FunnelPage>
      <TopBar />
      <ProgressBar current={current} total={FUNNEL_STEPS.length} onBack={back} />

      <AnimatePresence mode="wait">
        <FunnelStage stageKey="result">
          <Mast
            size="md"
            eyebrow="Your result"
            title={result.headline}
            lede={result.subhead}
          />

          {/* The personalized read — the screen's one branded object. */}
          <div className="club-b-warm f0-grain mt-6 space-y-3 px-5 py-5">
            {result.bullets.map((b, i) => (
              <m.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <CheckLine>{b}</CheckLine>
              </m.div>
            ))}
          </div>

          {/* Weekly-class date — SUPPRESSED for the challenge variant (fixed
              Sept 1 cohort; no weekly date leak — Review P1 #1). */}
          {!challenge && session?.scheduled_at && (
            <Card className="mt-4 flex items-center gap-2 px-4 py-3 text-[14px]">
              <CalendarDays className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span className="font-display font-bold text-ink">Your class:</span>
              <span className="text-soft">{formatClassWhen(session.scheduled_at)}</span>
            </Card>
          )}
          {challenge && (
            <Card className="mt-4 flex items-start gap-2 px-4 py-3 text-[14px]">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span className="font-display font-bold text-ink">The challenge:</span>
              <span className="text-soft">Five live sessions, Sept 1&ndash;5 at 9:30 AM ET · your Club access opens the moment you join</span>
            </Card>
          )}

          <div className="mt-6">
            <Action onClick={() => router.push("/free-class/register")}>
              Save my seat <ArrowRight className="h-4 w-4" />
            </Action>
          </div>
          <div className="mt-3">
            <Terms>One last step — create your free account to lock it in.</Terms>
          </div>
        </FunnelStage>
      </AnimatePresence>
    </FunnelPage>
  );
}
