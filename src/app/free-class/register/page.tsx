"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Users, Mail, Lock, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TopBar, ProgressBar, FunnelStage, Field } from "@/components/free-class/ui";
import {
  FUNNEL_STEPS,
  getStoredFunnelId,
  fetchSession,
  logEvent,
  clearStoredFunnelId,
} from "@/lib/funnel";

/**
 * Final step — name + password. Email was already captured at /save, so this is
 * the lowest-friction close: create the free account, flip the funnel session +
 * partial lead to registered (server), sign in, and route to the confirmation.
 */
export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [sid, setSid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);

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
      if (!state.email) {
        router.replace("/free-class/save");
        return;
      }
      setSid(stored);
      setEmail(state.email);
      setAnswers(state.answers || {});
      logEvent(stored, "register", "view");
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    setError(null);
    setExists(false);
    if (!firstName.trim()) return setError("Please enter your first name.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (!sid) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/free-class/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          firstName: firstName.trim(),
          email: email.trim().toLowerCase(),
          password,
          quiz: answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitting(false);
        if (data?.code === "exists") setExists(true);
        return setError(data?.error || "Something went wrong. Please try again.");
      }
      // Sign in (email pre-confirmed server-side), then to confirmation.
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      clearStoredFunnelId();
      router.push("/free-class/confirmed?welcome=1");
    } catch {
      setSubmitting(false);
      setError("Network error. Please try again.");
    }
  }

  function back() {
    if (sid) logEvent(sid, "register", "back");
    router.push("/free-class/result");
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
      </div>
    );
  }

  const current = FUNNEL_STEPS.indexOf("register") + 1;

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar />
      <ProgressBar current={current} total={FUNNEL_STEPS.length} onBack={back} />

      <AnimatePresence mode="wait">
        <FunnelStage stageKey="register">
          <div className="text-center mb-6">
            <h2 className="font-display text-2xl font-bold text-ink">Save your seat</h2>
            <p className="text-soft text-sm mt-1.5 max-w-xs mx-auto">
              Create your free account to lock in your spot. No card, ever.
            </p>
          </div>

          <div className="space-y-3">
            <Field icon={Users} placeholder="Your first name" value={firstName} onChange={setFirstName} autoFocus />
            <Field icon={Mail} type="email" placeholder="Email address" value={email} readOnly />
            <Field
              icon={Lock}
              type="password"
              placeholder="Create a password (8+ characters)"
              value={password}
              onChange={setPassword}
            />
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 font-body">
              {error}
              {exists && (
                <>
                  {" "}
                  <Link href="/login" className="text-gold-700 font-semibold underline">
                    Log in
                  </Link>
                </>
              )}
            </p>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px] disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving your seat…
              </>
            ) : (
              <>
                Get my free seat <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="mt-3 text-center text-xs text-soft flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Education only. No spam, no card. Cancel anytime.
          </p>
          <p className="mt-2 text-center text-xs text-soft">
            Already have an account?{" "}
            <Link href="/login" className="text-gold-700 font-semibold">
              Log in
            </Link>
          </p>
        </FunnelStage>
      </AnimatePresence>
    </div>
  );
}
