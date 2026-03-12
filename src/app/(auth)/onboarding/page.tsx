"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Users, UserCircle, GraduationCap, Calendar, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";

const STEPS = [
  { label: "Family", icon: Users },
  { label: "Role", icon: UserCircle },
  { label: "Track", icon: GraduationCap },
  { label: "Age", icon: Calendar },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [familyName, setFamilyName] = useState("");
  const [role, setRole] = useState<"parent" | "child" | "">("");
  const [track, setTrack] = useState<"kids" | "adults" | "">("");
  const [ageGroup, setAgeGroup] = useState<"kids" | "teens" | "adults" | "">("");

  function goNext() {
    setDirection(1);
    setStep((s) => s + 1);
  }

  function goBack() {
    setDirection(-1);
    setStep((s) => s - 1);
  }

  async function handleComplete() {
    setError("");
    setLoading(true);

    try {
      // Create family via backend API (bypasses RLS)
      await apiFetch("/api/v1/families", {
        method: "POST",
        body: JSON.stringify({ name: familyName }),
      });

      // Update profile fields via backend API
      await apiFetch("/api/v1/onboarding/profile", {
        method: "PUT",
        body: JSON.stringify({ role, track, age_group: ageGroup }),
      });

      // Mark onboarding complete
      await apiFetch("/api/v1/onboarding/complete", {
        method: "PUT",
      });

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      console.error("Onboarding error:", err);
      const e = err as { message?: string };
      const message = e?.message || "Something went wrong";
      setError(message);
      setLoading(false);
    }
  }

  const canProceed =
    (step === 0 && familyName.trim().length > 0) ||
    (step === 1 && role !== "") ||
    (step === 2 && track !== "") ||
    (step === 3 && ageGroup !== "");

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-3 mb-8">
        {STEPS.map((s, i) => {
          const isDone = i < step;
          const isCurrent = i === step;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                  isDone
                    ? "bg-gold-400/15 border-gold-400/30"
                    : isCurrent
                      ? "bg-gold-400/10 border-gold-400/40"
                      : "bg-midnight-800 border-midnight-700"
                }`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-gold-400" />
                ) : (
                  <span className={`text-xs font-display font-bold ${
                    isCurrent ? "text-gold-400" : "text-midnight-500"
                  }`}>
                    {i + 1}
                  </span>
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-6 h-px ${
                    isDone ? "bg-gold-400/30" : "bg-midnight-700"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden min-h-[280px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "tween", duration: 0.25 }}
            className="w-full"
          >
            {step === 0 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">
                    What&apos;s your family name?
                  </h2>
                  <p className="text-midnight-400 text-sm font-body">
                    This is how your family will appear in the academy
                  </p>
                </div>
                <div>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                    <input
                      type="text"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder="e.g. The Johnson Family"
                      autoFocus
                      className="w-full pl-11 pr-4 py-3.5 rounded-lg bg-midnight-800 border border-midnight-700 text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-base font-body"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">
                    What&apos;s your role?
                  </h2>
                  <p className="text-midnight-400 text-sm font-body">
                    Are you a parent leading the family or a young trader?
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(["parent", "child"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={`p-5 rounded-lg border text-center transition-colors ${
                        role === r
                          ? "border-gold-400/40 bg-gold-400/5"
                          : "border-midnight-700 bg-midnight-800 hover:border-midnight-600"
                      }`}
                    >
                      <UserCircle
                        className={`w-6 h-6 mx-auto mb-2 ${
                          role === r ? "text-gold-400" : "text-midnight-400"
                        }`}
                      />
                      <p
                        className={`font-display font-semibold text-base capitalize ${
                          role === r ? "text-gold-400" : "text-midnight-200"
                        }`}
                      >
                        {r}
                      </p>
                      <p className="text-xs text-midnight-400 mt-1 font-body">
                        {r === "parent"
                          ? "Manage family & track progress"
                          : "Learn to trade with your family"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">
                    Select your track
                  </h2>
                  <p className="text-midnight-400 text-sm font-body">
                    Content will be tailored to your learning level
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: "kids" as const, label: "Kids", desc: "Under 16, simplified lessons" },
                    { value: "adults" as const, label: "Adults", desc: "Full curriculum, advanced concepts" },
                  ]).map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTrack(t.value)}
                      className={`p-5 rounded-lg border text-center transition-colors ${
                        track === t.value
                          ? "border-gold-400/40 bg-gold-400/5"
                          : "border-midnight-700 bg-midnight-800 hover:border-midnight-600"
                      }`}
                    >
                      <GraduationCap
                        className={`w-6 h-6 mx-auto mb-2 ${
                          track === t.value ? "text-gold-400" : "text-midnight-400"
                        }`}
                      />
                      <p
                        className={`font-display font-semibold text-base ${
                          track === t.value ? "text-gold-400" : "text-midnight-200"
                        }`}
                      >
                        {t.label}
                      </p>
                      <p className="text-xs text-midnight-400 mt-1 font-body">
                        {t.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">
                    What&apos;s your age group?
                  </h2>
                  <p className="text-midnight-400 text-sm font-body">
                    We&apos;ll customize your experience even further
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: "kids" as const, label: "Kids", range: "8-12" },
                    { value: "teens" as const, label: "Teens", range: "13-17" },
                    { value: "adults" as const, label: "Adults", range: "18+" },
                  ]).map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setAgeGroup(a.value)}
                      className={`p-4 rounded-lg border text-center transition-colors ${
                        ageGroup === a.value
                          ? "border-gold-400/40 bg-gold-400/5"
                          : "border-midnight-700 bg-midnight-800 hover:border-midnight-600"
                      }`}
                    >
                      <p
                        className={`font-display font-semibold text-base ${
                          ageGroup === a.value ? "text-gold-400" : "text-midnight-200"
                        }`}
                      >
                        {a.label}
                      </p>
                      <p className="text-xs text-midnight-500 mt-1 font-body">
                        {a.range}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Error */}
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
          <button
            onClick={goBack}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-midnight-400 hover:text-midnight-200 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
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
            onClick={handleComplete}
            disabled={!canProceed || loading}
            className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Setting up..." : "Complete Setup"}
            {!loading && <Check className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
