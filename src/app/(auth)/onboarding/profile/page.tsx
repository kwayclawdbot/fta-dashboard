"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "@/lib/motion";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  HouseholdStep,
  ExperienceStep,
  MarketInterestStep,
  GoalsStep,
  HearAboutStep,
  PersonalizedWelcome,
} from "@/components/onboarding/ProfileSteps";
import {
  emptyDraft,
  draftFromQuiz,
  profileToDraft,
  fetchFamilyProfile,
  saveFamilyProfile,
  composeWelcome,
  deriveRecommendations,
  type ProfileDraft,
} from "@/lib/onboarding-profile";

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
};

// Standalone "Tell us about your family" flow — the backfill entry point for
// existing families that pre-date the profile-building onboarding. Same steps
// as the main onboarding, reusing the shared components. No family creation and
// no membership claim happen here — the family already exists.
const STEPS = ["Household", "Experience", "Focus", "Goals", "Found us", "Welcome"];
const S_HOUSEHOLD = 0;
const S_HEAR = 4;
const S_WELCOME = 5;

export default function ProfileOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft());
  const [step, setStep] = useState(S_HOUSEHOLD);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id, role")
        .eq("id", user.id)
        .single();

      // Guardrails: only a parent with a family belongs here.
      if (!profile?.family_id || profile.role === "child") {
        router.push("/dashboard");
        return;
      }
      const fid = profile.family_id as string;
      setFamilyId(fid);

      const [{ data: fam }, existing, { data: reg }] = await Promise.all([
        supabase.from("families").select("name").eq("id", fid).maybeSingle(),
        fetchFamilyProfile(supabase, fid),
        supabase
          .from("free_class_registrations")
          .select("quiz")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setFamilyName(fam?.name || "");

      // Prefill: existing profile row wins; otherwise seed from the funnel quiz.
      if (existing) {
        setDraft(profileToDraft(existing));
      } else if (reg?.quiz) {
        setDraft((d) => ({ ...d, ...draftFromQuiz(reg.quiz as Record<string, unknown>) }));
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patchDraft(patch: Partial<ProfileDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }
  function goBack() {
    setDirection(-1);
    setStep((s) => Math.max(S_HOUSEHOLD, s - 1));
  }
  async function advance(toWelcome: boolean) {
    if (familyId) saveFamilyProfile(supabase, familyId, draft, toWelcome);
    setDirection(1);
    setStep((s) => s + 1);
  }
  function finish() {
    router.push("/dashboard");
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  const isWelcome = step === S_WELCOME;
  const isProfileStep = step >= S_HOUSEHOLD && step <= S_HEAR;
  const welcome = isWelcome ? composeWelcome(draft, familyName) : null;
  const recommendations = isWelcome ? deriveRecommendations(draft) : [];

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-2 rounded-full transition-all ${
              i === step ? "w-6 bg-gold-500" : i < step ? "w-2 bg-gold-400/50" : "w-2 bg-sand"
            }`}
          />
        ))}
      </div>

      <div className="relative overflow-hidden min-h-[340px]">
        <AnimatePresence mode="wait" custom={direction}>
          <m.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "tween", duration: 0.25 }}
            className="w-full"
          >
            {step === S_HOUSEHOLD && <HouseholdStep draft={draft} onChange={patchDraft} />}
            {step === 1 && <ExperienceStep draft={draft} onChange={patchDraft} />}
            {step === 2 && <MarketInterestStep draft={draft} onChange={patchDraft} />}
            {step === 3 && <GoalsStep draft={draft} onChange={patchDraft} />}
            {step === S_HEAR && <HearAboutStep draft={draft} onChange={patchDraft} />}
            {isWelcome && welcome && (
              <PersonalizedWelcome
                title={welcome.title}
                lines={welcome.lines}
                recommendations={recommendations}
              />
            )}
          </m.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between mt-8">
        {step > S_HOUSEHOLD && !isWelcome ? (
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

        <div className="flex items-center gap-3">
          {isProfileStep && (
            <button
              onClick={() => advance(step === S_HEAR)}
              className="text-sm text-midnight-400 hover:text-midnight-200 transition-colors font-medium"
            >
              I&apos;ll do this later
            </button>
          )}
          {isWelcome ? (
            <button
              onClick={finish}
              className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm"
            >
              Go to my dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => advance(step === S_HEAR)}
              className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
