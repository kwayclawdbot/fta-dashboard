"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { ExternalLink, Loader2 } from "lucide-react";
import type {
  RealWorldStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { playCue } from "@/lib/learn/feedback";
import { checkWatchlistHas } from "@/lib/learn/engine-io";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { useEngineRuntime } from "../EngineContext";
import { getLessonSkin, lessonHaptic, EASE_OUT } from "../skin";
import { FeedbackNote, GuideLine, PrimaryButton, StepPrompt } from "../ui";

/**
 * The differentiator vs Duolingo — the lesson ESCAPES into the live product and
 * returns with a REAL result. save_watchlist genuinely queries family_watchlist;
 * the "done" state only lights up when the row actually exists. The mission is a
 * designed OBJECT (a ticket band with the real company logo), never a plain card.
 */
export default function RealWorldStep({
  spec,
  register,
  soundOn,
  onResolve,
}: StepComponentProps<Spec>) {
  const reduce = useReducedMotion();
  const skin = useMemo(() => getLessonSkin(register), [register]);
  const rt = useEngineRuntime();
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const href =
    spec.action === "save_watchlist"
      ? "/watchlist"
      : `/research/${spec.ticker.toUpperCase()}`;

  const runCheck = useCallback(
    async (soft = false) => {
      if (!rt) return false;
      if (spec.action !== "save_watchlist") return true;
      setChecking(true);
      const has = await checkWatchlistHas(rt.supabase, rt.familyId, spec.ticker);
      setChecking(false);
      if (has) {
        setConfirmed(true);
        setNotYet(false);
        playCue("win", register, soundOn);
        lessonHaptic(skin, !!reduce);
        window.setTimeout(() => onResolve({}), 900);
        return true;
      }
      if (!soft) setNotYet(true);
      return false;
    },
    [rt, spec.action, spec.ticker, register, soundOn, onResolve, skin, reduce]
  );

  useEffect(() => {
    if (confirmed) return;
    const onFocus = () => void runCheck(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [confirmed, runCheck]);

  return (
    <div>
      <StepPrompt
        skin={skin}
        eyebrow="Real-world move"
        sub="This one leaves the lesson — go do it for real."
      >
        {spec.prompt}
      </StepPrompt>

      {/* The mission ticket — a designed object with the real company logo. */}
      <div
        className="overflow-hidden rounded-3xl"
        style={{
          background: "var(--l-opt-bg)",
          border: "1.5px solid var(--l-field-border)",
        }}
      >
        <div
          className="flex items-center gap-4 border-b border-dashed px-5 py-4"
          style={{ borderColor: "var(--l-field-border)" }}
        >
          <CompanyLogo symbol={spec.ticker} name={spec.company} size={48} />
          <div className="min-w-0">
            <div className="font-display text-[19px] font-black leading-tight text-ink">
              {spec.company}
            </div>
            <div className="font-mono text-xs tracking-wide text-soft">
              {spec.ticker.toUpperCase()}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-display text-[14px] font-bold transition-transform duration-150 ease-out active:scale-[0.97]"
            style={{ background: "var(--l-accent-soft)", color: "var(--l-accent)" }}
          >
            {spec.cta}
            <ExternalLink className="h-4 w-4" />
          </a>
          <PrimaryButton
            onClick={() => void runCheck(false)}
            disabled={checking || confirmed}
            icon="none"
            tone="ok"
          >
            {checking ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking…
              </span>
            ) : (
              "I did it — check"
            )}
          </PrimaryButton>
        </div>
      </div>

      <AnimatePresence>
        {confirmed && (
          <m.div
            key="ok"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
          >
            <FeedbackNote kind="correct">{spec.successText}</FeedbackNote>
          </m.div>
        )}
        {notYet && !confirmed && (
          <m.div
            key="notyet"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <FeedbackNote kind="explain">
              We don&apos;t see {spec.ticker.toUpperCase()} on your watchlist yet.
              Add it on the page that opened, then tap &ldquo;I did it — check&rdquo;.
            </FeedbackNote>
          </m.div>
        )}
      </AnimatePresence>

      {!confirmed && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <GuideLine skin={skin} pose="presenting">
              Doing beats watching — this is how a lesson becomes a habit.
            </GuideLine>
          </div>
          <button
            onClick={() => onResolve({})}
            className="shrink-0 font-body text-[13px] text-soft underline underline-offset-2 transition-colors hover:text-ink"
          >
            I&apos;ll do this later
          </button>
        </div>
      )}
    </div>
  );
}
