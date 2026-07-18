"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Users, GraduationCap, ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
};

type Mode = "loading" | "parent" | "child";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("loading");
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Parent flow state
  const [familyName, setFamilyName] = useState("");

  // Child flow state
  const [displayName, setDisplayName] = useState("");
  const [ageBand, setAgeBand] = useState<"kids" | "teens" | "">("");

  // Detect whether this is a family owner (parent) or an invited child.
  useEffect(() => {
    async function detect() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id, role, display_name")
        .eq("id", user.id)
        .single();

      if (profile?.family_id && profile.role === "child") {
        setDisplayName(profile.display_name || "");
        setMode("child");
      } else {
        setMode("parent");
      }
    }
    detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goNext() {
    setDirection(1);
    setStep((s) => s + 1);
  }
  function goBack() {
    setDirection(-1);
    setStep((s) => s - 1);
  }

  // ── Parent: create the family, become owner ──
  async function completeParent() {
    setError("");
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: fam, error: famErr } = await supabase
        .from("families")
        .insert({ name: familyName.trim() })
        .select("id")
        .single();
      if (famErr) throw famErr;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          family_id: fam.id,
          role: "parent",
          age_group: "adults",
          track: "adults",
          onboarding_complete: true,
        })
        .eq("id", user.id);
      if (profErr) throw profErr;

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || "Something went wrong");
      setLoading(false);
    }
  }

  // ── Child: short join — confirm name + age band ──
  async function completeChild() {
    setError("");
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || "Explorer",
          age_group: ageBand, // kids | teens
          track: ageBand, // matches age band
          onboarding_complete: true,
        })
        .eq("id", user.id);
      if (profErr) throw profErr;

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || "Something went wrong");
      setLoading(false);
    }
  }

  if (mode === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  const steps = mode === "parent" ? ["Family", "All set"] : ["Your name", "Your age"];
  const canProceed =
    mode === "parent"
      ? step === 0
        ? familyName.trim().length > 0
        : true
      : step === 0
        ? displayName.trim().length > 0
        : ageBand !== "";
  const isLast = step === steps.length - 1;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-3 mb-8">
        {steps.map((s, i) => {
          const isDone = i < step;
          const isCurrent = i === step;
          return (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                  isDone
                    ? "bg-gold-400/15 border-gold-400/30"
                    : isCurrent
                      ? "bg-gold-400/10 border-gold-400/40"
                      : "bg-midnight-800 border-sand"
                }`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-gold-400" />
                ) : (
                  <span className={`text-xs font-display font-bold ${isCurrent ? "text-gold-600" : "text-midnight-500"}`}>
                    {i + 1}
                  </span>
                )}
              </div>
              {i < steps.length - 1 && <div className={`w-6 h-px ${isDone ? "bg-gold-400/30" : "bg-sand"}`} />}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden min-h-[280px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${mode}-${step}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "tween", duration: 0.25 }}
            className="w-full"
          >
            {/* PARENT — step 0: family name */}
            {mode === "parent" && step === 0 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">What&apos;s your family name?</h2>
                  <p className="text-midnight-400 text-sm font-body">
                    You&apos;re the family owner — this is how your family appears in the academy.
                  </p>
                </div>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                  <input
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="e.g. The Johnson Family"
                    autoFocus
                    className="w-full pl-11 pr-4 py-3.5 rounded-lg bg-midnight-900 border border-sand text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-base font-body"
                  />
                </div>
              </div>
            )}

            {/* PARENT — step 1: confirm */}
            {mode === "parent" && step === 1 && (
              <div className="space-y-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-gold-400/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-gold-500" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">
                    You&apos;re all set, {familyName.trim() || "friend"}
                  </h2>
                  <p className="text-midnight-400 text-sm font-body max-w-sm mx-auto">
                    We&apos;ll create your family and set you up as the owner. You can invite your kids anytime from the
                    Family page — they join with a link, no signup hassle.
                  </p>
                </div>
              </div>
            )}

            {/* CHILD — step 0: confirm name */}
            {mode === "child" && step === 0 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">Welcome! What should we call you?</h2>
                  <p className="text-midnight-400 text-sm font-body">You&apos;ve joined your family — let&apos;s set up your corner.</p>
                </div>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    autoFocus
                    className="w-full pl-11 pr-4 py-3.5 rounded-lg bg-midnight-900 border border-sand text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-base font-body"
                  />
                </div>
              </div>
            )}

            {/* CHILD — step 1: age band */}
            {mode === "child" && step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">How old are you?</h2>
                  <p className="text-midnight-400 text-sm font-body">We&apos;ll pick the right lessons and adventures for you.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: "kids" as const, label: "Kid", range: "8 – 12" },
                    { value: "teens" as const, label: "Teen", range: "13 – 17" },
                  ]).map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setAgeBand(a.value)}
                      className={`p-5 rounded-lg border text-center transition-colors ${
                        ageBand === a.value ? "border-gold-400/40 bg-gold-400/5" : "border-sand bg-midnight-900 hover:border-gold-300"
                      }`}
                    >
                      <GraduationCap className={`w-6 h-6 mx-auto mb-2 ${ageBand === a.value ? "text-gold-600" : "text-midnight-400"}`} />
                      <p className={`font-display font-semibold text-base ${ageBand === a.value ? "text-gold-700" : "text-midnight-200"}`}>
                        {a.label}
                      </p>
                      <p className="text-xs text-midnight-500 mt-1 font-body">{a.range}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-500 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        {step > 0 ? (
          <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-midnight-400 hover:text-midnight-200 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <div />
        )}

        {!isLast ? (
          <button
            onClick={goNext}
            disabled={!canProceed}
            className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={mode === "parent" ? completeParent : completeChild}
            disabled={!canProceed || loading}
            className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Setting up..." : mode === "parent" ? "Create my family" : "Start learning"}
            {!loading && <Check className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
