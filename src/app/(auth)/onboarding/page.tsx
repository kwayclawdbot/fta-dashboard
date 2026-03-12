"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Users, UserCircle, GraduationCap, Calendar, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const STEPS = [
  { label: "Family", icon: Users },
  { label: "Role", icon: UserCircle },
  { label: "Track", icon: GraduationCap },
  { label: "Age", icon: Calendar },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create family record
      const { data: family, error: familyError } = await supabase
        .from("families")
        .insert({ name: familyName, owner_id: user.id })
        .select("id")
        .single();

      if (familyError) throw familyError;

      // Update user profile
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          family_id: family.id,
          role,
          track,
          age_group: ageGroup,
          onboarding_complete: true,
        });

      if (profileError) throw profileError;

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
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
          const Icon = s.icon;
          const isDone = i < step;
          const isCurrent = i === step;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <motion.div
                animate={{
                  scale: isCurrent ? 1.15 : 1,
                  borderColor: isCurrent
                    ? "rgba(251,191,36,0.6)"
                    : isDone
                      ? "rgba(251,191,36,0.4)"
                      : "rgba(71,87,125,0.3)",
                }}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isDone
                    ? "bg-gold-400/20"
                    : isCurrent
                      ? "bg-gold-400/10"
                      : "bg-midnight-800"
                }`}
              >
                {isDone ? (
                  <Check className="w-4 h-4 text-gold-400" />
                ) : (
                  <Icon
                    className={`w-4 h-4 ${
                      isCurrent ? "text-gold-400" : "text-midnight-500"
                    }`}
                  />
                )}
              </motion.div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 rounded-full ${
                    isDone ? "bg-gold-400/40" : "bg-midnight-700"
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
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="w-full"
          >
            {step === 0 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-2xl font-bold text-gold-400 mb-2">
                    What&apos;s your family name?
                  </h2>
                  <p className="text-midnight-300 text-sm font-body">
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
                      className="w-full pl-11 pr-4 py-4 rounded-xl bg-midnight-800 border border-midnight-600 text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/30 transition-colors text-base font-body"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-2xl font-bold text-gold-400 mb-2">
                    What&apos;s your role?
                  </h2>
                  <p className="text-midnight-300 text-sm font-body">
                    Are you a parent leading the family or a young trader?
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(["parent", "child"] as const).map((r) => (
                    <motion.button
                      key={r}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setRole(r)}
                      className={`p-6 rounded-xl border-2 text-center transition-all ${
                        role === r
                          ? "border-gold-400 bg-gold-400/10 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                          : "border-midnight-600 bg-midnight-800 hover:border-midnight-500"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 ${
                          role === r ? "bg-gold-400/20" : "bg-midnight-700"
                        }`}
                      >
                        <UserCircle
                          className={`w-6 h-6 ${
                            role === r ? "text-gold-400" : "text-midnight-400"
                          }`}
                        />
                      </div>
                      <p
                        className={`font-display font-semibold text-lg capitalize ${
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
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-2xl font-bold text-gold-400 mb-2">
                    Select your track
                  </h2>
                  <p className="text-midnight-300 text-sm font-body">
                    Content will be tailored to your learning level
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { value: "kids" as const, label: "Kids", desc: "Under 16, simplified lessons" },
                    { value: "adults" as const, label: "Adults", desc: "Full curriculum, advanced concepts" },
                  ]).map((t) => (
                    <motion.button
                      key={t.value}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setTrack(t.value)}
                      className={`p-6 rounded-xl border-2 text-center transition-all ${
                        track === t.value
                          ? "border-gold-400 bg-gold-400/10 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                          : "border-midnight-600 bg-midnight-800 hover:border-midnight-500"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 ${
                          track === t.value ? "bg-gold-400/20" : "bg-midnight-700"
                        }`}
                      >
                        <GraduationCap
                          className={`w-6 h-6 ${
                            track === t.value ? "text-gold-400" : "text-midnight-400"
                          }`}
                        />
                      </div>
                      <p
                        className={`font-display font-semibold text-lg ${
                          track === t.value ? "text-gold-400" : "text-midnight-200"
                        }`}
                      >
                        {t.label}
                      </p>
                      <p className="text-xs text-midnight-400 mt-1 font-body">
                        {t.desc}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-2xl font-bold text-gold-400 mb-2">
                    What&apos;s your age group?
                  </h2>
                  <p className="text-midnight-300 text-sm font-body">
                    We&apos;ll customize your experience even further
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: "kids" as const, label: "Kids", range: "8-12" },
                    { value: "teens" as const, label: "Teens", range: "13-17" },
                    { value: "adults" as const, label: "Adults", range: "18+" },
                  ]).map((a) => (
                    <motion.button
                      key={a.value}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setAgeGroup(a.value)}
                      className={`p-5 rounded-xl border-2 text-center transition-all ${
                        ageGroup === a.value
                          ? "border-gold-400 bg-gold-400/10 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                          : "border-midnight-600 bg-midnight-800 hover:border-midnight-500"
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
                    </motion.button>
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-500 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        {step > 0 ? (
          <button
            onClick={goBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-midnight-300 hover:text-midnight-100 hover:bg-midnight-800 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={goNext}
            disabled={!canProceed}
            className="cta-button flex items-center gap-2 px-6 py-3 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleComplete}
            disabled={!canProceed || loading}
            className="cta-button flex items-center gap-2 px-6 py-3 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? "Setting up..." : "Complete Setup"}
            {!loading && <Check className="w-4 h-4" />}
          </motion.button>
        )}
      </div>
    </div>
  );
}
