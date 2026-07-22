"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Users, GraduationCap, ArrowRight, ArrowLeft, Check, AtSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AvatarPicker from "@/components/AvatarPicker";
import {
  HouseholdStep,
  ExperienceStep,
  GoalsStep,
  HearAboutStep,
  PersonalizedWelcome,
} from "@/components/onboarding/ProfileSteps";
import {
  emptyDraft,
  draftFromQuiz,
  composeWelcome,
  deriveRecommendations,
  saveFamilyProfile,
  type ProfileDraft,
} from "@/lib/onboarding-profile";

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
};

type Mode = "loading" | "parent" | "child";

// Parent step indices — family creation + membership claim happen on leaving
// PROFILE_START-1 (the "You" step), so the paid membership is NEVER blocked by
// the optional profile-building steps that follow.
const P_FAMILY = 0;
const P_YOU = 1;
const P_HOUSEHOLD = 2;
const P_EXPERIENCE = 3;
const P_GOALS = 4;
const P_HEAR = 5;
const P_WELCOME = 6;
const PARENT_STEPS = ["Family", "You", "Household", "Experience", "Goals", "Found us", "Welcome"];

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
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft());

  // Shared: username (= display_name; @mentions match it spaces-stripped) + avatar
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nameWarning, setNameWarning] = useState("");
  const nameCheckSeq = useRef(0);

  // Child flow state
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
        .select("family_id, role, display_name, avatar_url")
        .eq("id", user.id)
        .single();

      setDisplayName(profile?.display_name || user.user_metadata?.display_name || "");
      setAvatarUrl(profile?.avatar_url ?? null);

      if (profile?.family_id && profile.role === "child") {
        setMode("child");
        return;
      }

      // Prefill the profile draft from the free-class funnel quiz if this user
      // came through the funnel — never re-ask what we already know.
      const { data: reg } = await supabase
        .from("free_class_registrations")
        .select("quiz")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (reg?.quiz) {
        setDraft((d) => ({ ...d, ...draftFromQuiz(reg.quiz as Record<string, unknown>) }));
      }

      setMode("parent");

      // A parent who already has a family (resume / accidental re-entry) skips
      // straight to the profile-building steps — never creates a second family.
      if (profile?.family_id) {
        setFamilyId(profile.family_id as string);
        setStep(P_HOUSEHOLD);
      }
    }
    detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Soft uniqueness check — @mentions resolve on display_name spaces-stripped
  // (migration 028), so a collision just makes mentions ambiguous. We warn,
  // never block (there is no global unique constraint on display_name).
  async function checkUsername(name: string) {
    const stripped = name.replace(/\s+/g, "").toLowerCase();
    setNameWarning("");
    if (stripped.length < 2) return;
    const seq = ++nameCheckSeq.current;
    const { data: user } = await supabase.auth.getUser();
    const { data } = await supabase.from("profiles").select("id, display_name").limit(1000);
    if (seq !== nameCheckSeq.current) return;
    const clash = (data ?? []).some(
      (p) =>
        p.id !== user.user?.id &&
        (p.display_name as string | null)?.replace(/\s+/g, "").toLowerCase() === stripped
    );
    if (clash) {
      setNameWarning("Someone already goes by that. Add a last name or number so @mentions find you.");
    }
  }

  const parentEstablished = mode === "parent" && familyId !== null;
  const minStep = parentEstablished ? P_HOUSEHOLD : 0;

  function goNext() {
    setDirection(1);
    setStep((s) => s + 1);
  }
  function goBack() {
    setDirection(-1);
    setStep((s) => Math.max(minStep, s - 1));
  }

  // ── Parent: create the family, become owner, CLAIM MEMBERSHIP ──
  // Runs when leaving the "You" step so a paid/invited membership activates
  // immediately, before (and independent of) the optional profile questions.
  async function establishFamily(): Promise<boolean> {
    if (familyId) return true; // already created (resume / back-and-forth)
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
          display_name: displayName.trim() || "Parent",
          avatar_url: avatarUrl,
          onboarding_complete: true,
        })
        .eq("id", user.id);
      if (profErr) throw profErr;

      // Paid/invited members: auto-activate their program (no-op otherwise).
      try {
        await supabase.rpc("claim_pending_membership", { p_family_id: fam.id });
      } catch {
        // best-effort; non-members simply have no pending row to claim
      }

      setFamilyId(fam.id);
      setLoading(false);
      return true;
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || "Something went wrong");
      setLoading(false);
      return false;
    }
  }

  // Persist the running profile draft (best-effort; never blocks navigation).
  async function savePartial(complete: boolean) {
    if (!familyId) return;
    await saveFamilyProfile(supabase, familyId, draft, complete);
  }

  // Advance out of the "You" step: establish the family first, then continue.
  async function continueFromYou() {
    const ok = await establishFamily();
    if (ok) goNext();
  }

  // Advance out of an optional profile step (Continue or "I'll do this later").
  async function advanceProfileStep(toWelcome: boolean) {
    savePartial(toWelcome); // fire-and-forget; welcome save marks completed_at
    goNext();
  }

  // ── Child: confirm name + age band + avatar ──
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
          avatar_url: avatarUrl,
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

  function finishToDashboard() {
    router.push("/dashboard");
    router.refresh();
  }

  function patchDraft(patch: Partial<ProfileDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  if (mode === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  const steps = mode === "parent" ? PARENT_STEPS : ["Your name", "Your age", "Your look"];
  const canProceed =
    mode === "parent"
      ? step === P_FAMILY
        ? familyName.trim().length > 0
        : step === P_YOU
          ? displayName.trim().length > 0
          : true // profile steps are all optional
      : step === 0
        ? displayName.trim().length > 0
        : step === 1
          ? ageBand !== ""
          : true;

  const isChildLast = mode === "child" && step === steps.length - 1;
  const isProfileStep =
    mode === "parent" && step >= P_HOUSEHOLD && step <= P_HEAR;
  const isWelcome = mode === "parent" && step === P_WELCOME;

  const welcome = isWelcome ? composeWelcome(draft, familyName) : null;
  const recommendations = isWelcome ? deriveRecommendations(draft) : [];

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress dots — compact so 7 parent steps stay clean at 390px */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => {
          const isDone = i < step;
          const isCurrent = i === step;
          return (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                isCurrent
                  ? "w-6 bg-gold-500"
                  : isDone
                    ? "w-2 bg-gold-400/50"
                    : "w-2 bg-sand"
              }`}
            />
          );
        })}
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden min-h-[340px]">
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
            {mode === "parent" && step === P_FAMILY && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">
                    What&apos;s your family name?
                  </h2>
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

            {/* PARENT — step 1: username + avatar */}
            {mode === "parent" && step === P_YOU && (
              <UsernameAvatarStep
                heading="Set up your profile"
                sub="Pick a display name and a look. Your name is how family members @mention you."
                displayName={displayName}
                onNameChange={(v) => {
                  setDisplayName(v);
                  checkUsername(v);
                }}
                nameWarning={nameWarning}
                avatarUrl={avatarUrl}
                onAvatar={setAvatarUrl}
                role="parent"
                ageGroup="adults"
              />
            )}

            {/* PARENT — profile-building steps */}
            {mode === "parent" && step === P_HOUSEHOLD && (
              <HouseholdStep draft={draft} onChange={patchDraft} />
            )}
            {mode === "parent" && step === P_EXPERIENCE && (
              <ExperienceStep draft={draft} onChange={patchDraft} />
            )}
            {mode === "parent" && step === P_GOALS && (
              <GoalsStep draft={draft} onChange={patchDraft} />
            )}
            {mode === "parent" && step === P_HEAR && (
              <HearAboutStep draft={draft} onChange={patchDraft} />
            )}

            {/* PARENT — final: personalized welcome */}
            {isWelcome && welcome && (
              <PersonalizedWelcome
                title={welcome.title}
                lines={welcome.lines}
                recommendations={recommendations}
              />
            )}

            {/* CHILD — step 0: confirm name */}
            {mode === "child" && step === 0 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">
                    Welcome! What should we call you?
                  </h2>
                  <p className="text-midnight-400 text-sm font-body">
                    You&apos;ve joined your family — let&apos;s set up your corner.
                  </p>
                </div>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      checkUsername(e.target.value);
                    }}
                    placeholder="Your name"
                    autoFocus
                    className="w-full pl-11 pr-4 py-3.5 rounded-lg bg-midnight-900 border border-sand text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-base font-body"
                  />
                </div>
                {nameWarning && (
                  <p className="flex items-start gap-1.5 text-xs text-gold-700 font-body">
                    <AtSign className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {nameWarning}
                  </p>
                )}
              </div>
            )}

            {/* CHILD — step 1: age band */}
            {mode === "child" && step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">How old are you?</h2>
                  <p className="text-midnight-400 text-sm font-body">
                    We&apos;ll pick the right lessons and adventures for you.
                  </p>
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

            {/* CHILD — step 2: pick avatar */}
            {mode === "child" && step === 2 && (
              <div className="space-y-5">
                <div className="text-center">
                  <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">Pick your look</h2>
                  <p className="text-midnight-400 text-sm font-body">Choose an avatar — you can change it anytime in Settings.</p>
                </div>
                <AvatarPicker value={avatarUrl} onChange={setAvatarUrl} role="child" ageGroup={ageBand || "teens"} />
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
        {step > minStep && !isWelcome ? (
          <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-midnight-400 hover:text-midnight-200 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          {/* Skip affordance on optional profile steps */}
          {isProfileStep && (
            <button
              onClick={() => advanceProfileStep(step === P_HEAR)}
              className="text-sm text-midnight-400 hover:text-midnight-200 transition-colors font-medium"
            >
              I&apos;ll do this later
            </button>
          )}

          {isWelcome ? (
            <button
              onClick={finishToDashboard}
              className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm"
            >
              Go to my dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : isChildLast ? (
            <button
              onClick={completeChild}
              disabled={!canProceed || loading}
              className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Setting up..." : "Start learning"}
              {!loading && <Check className="w-4 h-4" />}
            </button>
          ) : mode === "parent" && step === P_YOU ? (
            <button
              onClick={continueFromYou}
              disabled={!canProceed || loading}
              className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Setting up..." : "Continue"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          ) : isProfileStep ? (
            <button
              onClick={() => advanceProfileStep(step === P_HEAR)}
              className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canProceed}
              className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
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

function UsernameAvatarStep({
  heading,
  sub,
  displayName,
  onNameChange,
  nameWarning,
  avatarUrl,
  onAvatar,
  role,
  ageGroup,
}: {
  heading: string;
  sub: string;
  displayName: string;
  onNameChange: (v: string) => void;
  nameWarning: string;
  avatarUrl: string | null;
  onAvatar: (v: string) => void;
  role: string;
  ageGroup: string;
}) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">{heading}</h2>
        <p className="text-midnight-400 text-sm font-body">{sub}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-midnight-200 mb-1.5">Display name</label>
        <div className="relative">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
          <input
            type="text"
            value={displayName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Marcus J"
            className="w-full pl-11 pr-4 py-3 rounded-lg bg-midnight-900 border border-sand text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-base font-body"
          />
        </div>
        {nameWarning && (
          <p className="flex items-start gap-1.5 text-xs text-gold-700 font-body mt-1.5">
            <AtSign className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {nameWarning}
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-midnight-200 mb-2">Pick an avatar</label>
        <AvatarPicker value={avatarUrl} onChange={onAvatar} role={role} ageGroup={ageGroup} />
      </div>
    </div>
  );
}
