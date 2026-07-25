"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "@/lib/motion";
import { Mail, Phone, ArrowRight, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { TopBar, ProgressBar, FunnelStage, Field } from "@/components/free-class/ui";
import {
  QUIZ,
  FUNNEL_STEPS,
  getStoredFunnelId,
  fetchSession,
  logEvent,
  getChallengeFlag,
} from "@/lib/funnel";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Mid-funnel EMAIL CAPTURE — the partial-lead gate, placed BEFORE the password
 * step. Records email + optional phone + SMS opt-in, sweeps the lead into the
 * CRM (server), then routes to the personalized result. Tasteful one-time
 * exit-intent modal on desktop mouse-leave.
 */
export default function SavePage() {
  const router = useRouter();

  const [sid, setSid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsOptin, setSmsOptin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExit, setShowExit] = useState(false);
  const [challenge, setChallenge] = useState(false);
  const [solo, setSolo] = useState(false);
  const exitFired = useRef(false);

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
      if (state.email) setEmail(state.email);
      if (state.phone) setPhone(state.phone);
      setSmsOptin(state.sms_optin);
      setChallenge(getChallengeFlag());
      setSolo(state.answers?.ages === "adults");
      logEvent(stored, "save", "view");
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exit-intent: fire once, on desktop, when the cursor leaves toward the top.
  useEffect(() => {
    if (!ready) return;
    function onLeave(e: MouseEvent) {
      if (exitFired.current) return;
      if (e.clientY <= 0) {
        exitFired.current = true;
        setShowExit(true);
        if (sid) logEvent(sid, "save", "exit_intent");
      }
    }
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, [ready, sid]);

  async function submit() {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError("Please enter a valid email.");
    if (!sid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/free-class/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sid,
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          smsOptin,
          challenge,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitting(false);
        return setError(data?.error || "Something went wrong. Please try again.");
      }
      router.push("/free-class/result");
    } catch {
      setSubmitting(false);
      setError("Network error. Please try again.");
    }
  }

  function back() {
    if (sid) logEvent(sid, "save", "back");
    router.push(`/free-class/q/${QUIZ.length}`);
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
      </div>
    );
  }

  const current = FUNNEL_STEPS.indexOf("save") + 1;

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar />
      <ProgressBar current={current} total={FUNNEL_STEPS.length} onBack={back} />

      <AnimatePresence mode="wait">
        <FunnelStage stageKey="save">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-[11px] font-display font-bold uppercase tracking-[0.14em] mb-4">
              <Sparkles className="w-3 h-3" /> Almost there
            </span>
            <h2 className="font-display text-2xl font-bold text-ink leading-snug">
              {challenge
                ? "See your challenge plan"
                : solo
                  ? "See your result"
                  : "See your family's result"}
            </h2>
            <p className="text-soft text-sm mt-1.5 max-w-xs mx-auto">
              {challenge
                ? "Enter your email to unlock your personalized challenge plan and lock in your spot for Sept 1."
                : "Enter your email to unlock your personalized result and hold your seat for this week's class."}
            </p>
          </div>

          <div className="space-y-3">
            <Field icon={Mail} type="email" placeholder="Email address" value={email} onChange={setEmail} autoFocus />
            <Field
              icon={Phone}
              type="tel"
              placeholder="Phone (optional)"
              value={phone}
              onChange={setPhone}
            />
            <label className="flex items-start gap-2.5 px-1 py-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={smsOptin}
                onChange={(e) => setSmsOptin(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-sand text-gold-500 focus:ring-gold-400/30"
              />
              <span className="text-sm text-soft leading-snug">
                {challenge
                  ? "Text me challenge reminders so I don't miss a day."
                  : "Text me a reminder before class starts."}
              </span>
            </label>
          </div>

          {error && <p className="mt-3 text-sm text-red-600 font-body">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting}
            className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px] disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                See my result <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="mt-3 text-center text-xs text-soft flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Education only. No spam, no card. Unsubscribe anytime.
          </p>
        </FunnelStage>
      </AnimatePresence>

      {/* Exit-intent — tasteful, once per session */}
      <AnimatePresence>
        {showExit && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-5"
            onClick={() => setShowExit(false)}
          >
            <m.div
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="paper-card relative w-full max-w-sm p-6 text-center"
            >
              <button
                onClick={() => setShowExit(false)}
                className="absolute right-3 top-3 text-soft hover:text-ink transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="font-display text-xl font-bold text-ink">
                Your result is one step away
              </h3>
              <p className="text-soft text-sm mt-2 max-w-xs mx-auto leading-relaxed">
                You&apos;ve already answered the questions — add your email and we&apos;ll show you
                {challenge
                  ? " the plan built for how you're starting (and lock in your spot)."
                  : solo
                    ? " the plan built for how you're starting (and save your seat)."
                    : " the class built for your family (and save your seat)."}
              </p>
              <button
                onClick={() => setShowExit(false)}
                className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[15px]"
              >
                Show me my result
              </button>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
