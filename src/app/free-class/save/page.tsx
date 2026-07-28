"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "@/lib/motion";
import { Mail, Phone, ArrowRight, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  FunnelPage,
  FunnelSkeleton,
  TopBar,
  ProgressBar,
  FunnelStage,
  Field,
  Mast,
  Action,
  Terms,
  FormError,
  Spinner,
} from "@/components/free-class/ui";
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

  if (!ready) return <FunnelSkeleton bar />;

  const current = FUNNEL_STEPS.indexOf("save") + 1;

  return (
    <FunnelPage>
      <TopBar />
      <ProgressBar current={current} total={FUNNEL_STEPS.length} onBack={back} />

      <AnimatePresence mode="wait">
        <FunnelStage stageKey="save">
          <Mast
            size="md"
            eyebrow={
              <>
                <Sparkles className="h-3 w-3" /> Almost there
              </>
            }
            title={
              challenge
                ? "See your challenge plan"
                : solo
                  ? "See your result"
                  : "See your family's result"
            }
            lede={
              challenge
                ? "Enter your email to unlock your personalized challenge plan and lock in your spot for Sept 1."
                : "Enter your email to unlock your personalized result and hold your seat for this week's class."
            }
          />

          <div className="mt-6 space-y-3">
            <Field icon={Mail} type="email" placeholder="Email address" value={email} onChange={setEmail} autoFocus />
            <Field
              icon={Phone}
              type="tel"
              placeholder="Phone (optional)"
              value={phone}
              onChange={setPhone}
            />
            <label className="club-b-card flex cursor-pointer select-none items-start gap-3 px-4 py-3.5">
              <input
                type="checkbox"
                checked={smsOptin}
                onChange={(e) => setSmsOptin(e.target.checked)}
                className="f0-focus mt-0.5 h-4 w-4 rounded border-sand accent-[color:var(--accent-solid)]"
              />
              <span className="text-[14px] leading-snug text-soft">
                {challenge
                  ? "Text me challenge reminders so I don't miss a day."
                  : "Text me a reminder before class starts."}
              </span>
            </label>
          </div>

          {error && <FormError>{error}</FormError>}

          <div className="mt-5">
            <Action onClick={submit} disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : (
                <>
                  See my result <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Action>
          </div>
          <div className="mt-3">
            <Terms icon={ShieldCheck}>
              Education only. No spam, no card. Unsubscribe anytime.
            </Terms>
          </div>
        </FunnelStage>
      </AnimatePresence>

      {/* Exit-intent — tasteful, once per session */}
      <AnimatePresence>
        {showExit && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-scrim px-5"
            onClick={() => setShowExit(false)}
          >
            <m.div
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Your result is one step away"
              className="club-b-card relative w-full max-w-sm p-6 text-center shadow-lift"
            >
              <button
                onClick={() => setShowExit(false)}
                className="f0-focus absolute right-3 top-3 rounded text-soft transition-colors hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <h3 className="font-display text-[1.25rem] font-extrabold tracking-[-0.02em] text-ink">
                Your result is one step away
              </h3>
              <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-soft">
                You&apos;ve already answered the questions — add your email and we&apos;ll show you
                {challenge
                  ? " the plan built for how you're starting (and lock in your spot)."
                  : solo
                    ? " the plan built for how you're starting (and save your seat)."
                    : " the class built for your family (and save your seat)."}
              </p>
              <div className="mt-5">
                <Action onClick={() => setShowExit(false)}>Show me my result</Action>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </FunnelPage>
  );
}
