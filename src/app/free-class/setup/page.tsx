"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "@/lib/motion";
import { Users, Lock, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TopBar, ProgressBar, FunnelStage, QuizCard, Field } from "@/components/free-class/ui";
import { QUIZ, setChallengeFlag } from "@/lib/funnel";

/**
 * Streamlined email-first setup (Lane C9b). The account already exists (created
 * at email capture); the email step is SKIPPED entirely. We keep the 3 quiz taps
 * (micro-commitment + Family-Mode signal), then collect name + password to
 * complete the account, then land on the existing C7 thank-you.
 *
 * The OLD full funnel (/free-class → q → save → result → register) is untouched
 * and still serves non-challenge free-class traffic and deep-linked visitors.
 */
export default function ChallengeSetupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");

  const [phase, setPhase] = useState<"quiz" | "account">("quiz");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChallengeFlag(true);
    let mounted = true;
    const t = new URLSearchParams(window.location.search).get("t");
    setToken(t);
    (async () => {
      if (!t) {
        if (mounted) setReady(true);
        return;
      }
      try {
        const r = await fetch(`/api/challenge/continuation?t=${encodeURIComponent(t)}`).then((x) => x.json());
        if (!mounted) return;
        setValid(!!r.valid);
        if (r.email) setEmail(String(r.email));
        if (r.name) setFirstName(String(r.name)); // pre-fill from the site form

      } catch {
        /* invalid */
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function pick(value: string) {
    const step = QUIZ[idx];
    setAnswers((a) => ({ ...a, [step.key]: value }));
    setTimeout(() => {
      if (idx < QUIZ.length - 1) setIdx((i) => i + 1);
      else setPhase("account");
    }, 160);
  }

  function backQuiz() {
    if (idx > 0) setIdx((i) => i - 1);
  }

  async function submit() {
    setError(null);
    if (!firstName.trim()) return setError("Please enter your first name.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (!token) return setError("Your setup link has expired. Please start again.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/challenge/complete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, firstName: firstName.trim(), password, quiz: answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitting(false);
        return setError(data?.error || "Something went wrong. Please try again.");
      }
      // Sign in with the password we just set, then to the C7 thank-you.
      await supabase.auth.signInWithPassword({ email: (data.email || email).toLowerCase(), password });
      router.push("/free-class/challenge");
    } catch {
      setSubmitting(false);
      setError("Network error. Please try again.");
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
      </div>
    );
  }

  if (token && !valid) {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center px-5 py-8">
          <div className="w-full max-w-md text-center">
            <h1 className="font-display text-2xl font-bold text-ink">This setup link has expired</h1>
            <p className="text-soft text-sm mt-2 max-w-xs mx-auto leading-relaxed">
              No worries — you can log in with the email you registered, or reach out to support and
              we&apos;ll get you set up.
            </p>
            <Link
              href="/login"
              className="cta-button mt-5 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[15px]"
            >
              Go to log in <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // total steps = 3 quiz + 1 account
  const total = QUIZ.length + 1;
  const current = phase === "quiz" ? idx + 1 : total;

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar />
      <ProgressBar current={current} total={total} onBack={phase === "quiz" ? backQuiz : () => setPhase("quiz")} />
      <AnimatePresence mode="wait">
        {phase === "quiz" ? (
          <FunnelStage stageKey={`q${idx}`}>
            <QuizCard stepDef={QUIZ[idx]} selected={answers[QUIZ[idx].key]} onPick={pick} />
          </FunnelStage>
        ) : (
          <FunnelStage stageKey="account">
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl font-bold text-ink">Finish your account</h2>
              <p className="text-soft text-sm mt-1.5 max-w-xs mx-auto">
                Last step — set your name and a password. Your full Club access unlocks the moment
                you&apos;re in.
              </p>
              {email && <p className="text-soft text-xs mt-2">Registering {email}</p>}
            </div>

            <div className="space-y-3">
              <Field icon={Users} placeholder="Your first name" value={firstName} onChange={setFirstName} autoFocus />
              <Field
                icon={Lock}
                type="password"
                placeholder="Create a password (8+ characters)"
                value={password}
                onChange={setPassword}
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-600 font-body">{error}</p>}

            <button
              onClick={submit}
              disabled={submitting}
              className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Setting up your access…
                </>
              ) : (
                <>
                  Enter the Club <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="mt-3 text-center text-xs text-soft flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Education only. No card required. Cancel anytime.
            </p>
          </FunnelStage>
        )}
      </AnimatePresence>
    </div>
  );
}
