"use client";

import { useCallback, useEffect, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { ExternalLink, Loader2, Star, Search } from "lucide-react";
import type {
  RealWorldStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { playCue } from "@/lib/learn/feedback";
import { checkWatchlistHas } from "@/lib/learn/engine-io";
import { useEngineRuntime } from "../EngineContext";
import { FeedbackNote, GuideLine, PrimaryButton, StepPrompt, EASE_OUT } from "../ui";

/**
 * The differentiator vs Duolingo — the lesson ESCAPES the lesson screen into the
 * live product and returns with a REAL result (spec §2 real-world actions).
 *
 * save_watchlist: deep-links to the real family watchlist; on return the engine
 * genuinely queries family_watchlist for the target ticker. No stub — the "done"
 * state only lights up when the row actually exists. A quiet "I'll do this later"
 * keeps a member from being trapped, but the check itself is real.
 */
export default function RealWorldStep({
  spec,
  register,
  soundOn,
  onResolve,
}: StepComponentProps<Spec>) {
  const reduce = useReducedMotion();
  const rt = useEngineRuntime();
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const href =
    spec.action === "save_watchlist"
      ? "/watchlist"
      : `/research/${spec.ticker.toUpperCase()}`;
  const Icon = spec.action === "save_watchlist" ? Star : Search;

  const runCheck = useCallback(
    async (soft = false) => {
      if (!rt) return false;
      if (spec.action !== "save_watchlist") {
        // research_ticker: opening the page is the action; treat a return click
        // as done (no persistent artifact to verify).
        return true;
      }
      setChecking(true);
      const has = await checkWatchlistHas(rt.supabase, rt.familyId, spec.ticker);
      setChecking(false);
      if (has) {
        setConfirmed(true);
        setNotYet(false);
        playCue("win", register, soundOn);
        window.setTimeout(() => onResolve({}), 900);
        return true;
      }
      if (!soft) setNotYet(true);
      return false;
    },
    [rt, spec.action, spec.ticker, register, soundOn, onResolve]
  );

  // Re-check when the member returns to this tab after doing the action.
  useEffect(() => {
    if (confirmed) return;
    const onFocus = () => void runCheck(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [confirmed, runCheck]);

  return (
    <div>
      <StepPrompt sub="This one leaves the lesson — go do it for real.">
        {spec.prompt}
      </StepPrompt>

      {/* The mission card — a designed object, not a generic container: a
          ticket-style band with the ticker and a real deep-link. */}
      <div className="overflow-hidden rounded-2xl border border-gold-300/60 bg-white/70">
        <div className="flex items-center gap-3 border-b border-dashed border-sand px-5 py-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-400/20 text-gold-700">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="font-display text-base font-bold text-ink">
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
            className="inline-flex items-center gap-2 rounded-xl border border-gold-400 bg-gold-400/10 px-4 py-2.5 font-display text-sm font-semibold text-gold-800 transition-[transform,background-color] duration-150 ease-out hover:bg-gold-400/20 active:scale-[0.97]"
          >
            {spec.cta}
            <ExternalLink className="h-4 w-4" />
          </a>
          <PrimaryButton
            onClick={() => void runCheck(false)}
            disabled={checking || confirmed}
            icon="none"
            tone="green"
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
            transition={{ duration: 0.22, ease: EASE_OUT }}
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
              We don&apos;t see {spec.ticker.toUpperCase()} on your watchlist
              yet. Add it on the page that opened, then tap “I did it — check”.
            </FeedbackNote>
          </m.div>
        )}
      </AnimatePresence>

      {!confirmed && (
        <div className="mt-4 flex items-center justify-between">
          <GuideLine register={register}>
            Doing beats watching — this is how a lesson becomes a habit.
          </GuideLine>
          <button
            onClick={() => onResolve({})}
            className="shrink-0 font-body text-xs text-soft underline underline-offset-2 transition-colors hover:text-ink"
          >
            I&apos;ll do this later
          </button>
        </div>
      )}
    </div>
  );
}
