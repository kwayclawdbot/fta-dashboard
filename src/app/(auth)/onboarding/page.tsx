"use client";

/**
 * The signup wizard (Lane 8R) — the profile questionnaire IS the new-account
 * process, for EVERY entry path (funnel, admin invite claim, Stripe-webhook
 * claim, family-member invite). A full-screen, gamified, one-question-per-page
 * flow: welcome splash → who's joining → experience → 3–4 true/false knowledge
 * checks → goals → focus → username → avatar → invite (parents) → celebration →
 * /dashboard (where App Tour v2 chains on first visit).
 *
 * The dashboard layout gates on profiles.onboarding_complete; funnel register
 * and onboard_create_family no longer set it (migrations 116 + free-class route
 * change), so a false value holds the member here until they finish. Existing
 * members (complete=true) never see this. Kid variant: age-appropriate, no
 * invite/business steps; auto-selected by role.
 *
 * Reuse: answer data + persistence + recommendations from onboarding-profile.ts,
 * AvatarPicker, the referral system (InviteStep), Celebrate register, the
 * onboard_create_family RPC. New here is only the full-screen gamified shell +
 * the knowledge checks + the cross-entry-path routing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "@/lib/motion";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AvatarPicker from "@/components/AvatarPicker";
import {
  WelcomeSplash,
  WhoIsJoiningStep,
  KidAgeStep,
  ExperienceStep,
  GoalsStep,
  FocusStep,
  KnowledgeCheckStep,
  UsernameStep,
  StepHeading,
} from "@/components/onboarding/WizardSteps";
import InviteStep from "@/components/onboarding/InviteStep";
import {
  emptyDraft,
  draftFromQuiz,
  saveFamilyProfile,
  fetchFamilyProfile,
  profileToDraft,
  deriveRecommendations,
  type ProfileDraft,
} from "@/lib/onboarding-profile";
import {
  checksForRegister,
  comprehensionFromScore,
  composeKaiSeed,
} from "@/lib/onboarding-knowledge";
import { deriveRegister, type Register } from "@/lib/register";

type Mode = "loading" | "parent" | "child";

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 120 : -120, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -120 : 120, opacity: 0 }),
};

export default function OnboardingWizard() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("loading");
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [familyId, setFamilyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft());
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nameWarning, setNameWarning] = useState("");
  const [ageBand, setAgeBand] = useState<"kids" | "teens" | "">("");
  const [kcAnswers, setKcAnswers] = useState<Record<string, boolean>>({});
  const nameSeq = useRef(0);

  // ── Detect entry path: family owner (parent) vs invited child ──────────────
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
        .select("family_id, role, display_name, avatar_url, age_group")
        .eq("id", user.id)
        .single();

      setDisplayName(profile?.display_name || user.user_metadata?.display_name || "");
      setAvatarUrl(profile?.avatar_url ?? null);

      if (profile?.family_id && profile.role === "child") {
        if (profile.age_group === "kids" || profile.age_group === "teens") {
          setAgeBand(profile.age_group);
        }
        setMode("child");
        return;
      }

      // Parent — prefill from the funnel quiz (never re-ask what we know) and,
      // if they already have a family (funnel path / resume), from their
      // saved family_profiles so a resumed wizard keeps prior answers.
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

      if (profile?.family_id) {
        setFamilyId(profile.family_id as string);
        const existing = await fetchFamilyProfile(supabase, profile.family_id as string);
        if (existing) setDraft(profileToDraft(existing));
      }

      setMode("parent");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Soft @mention uniqueness warning (never blocks — mirrors legacy behavior).
  async function checkUsername(name: string) {
    const stripped = name.replace(/\s+/g, "").toLowerCase();
    setNameWarning("");
    if (stripped.length < 2) return;
    const seq = ++nameSeq.current;
    const { data: userRes } = await supabase.auth.getUser();
    const { data } = await supabase.from("profiles").select("id, display_name").limit(1000);
    if (seq !== nameSeq.current) return;
    const clash = (data ?? []).some(
      (p) =>
        p.id !== userRes.user?.id &&
        (p.display_name as string | null)?.replace(/\s+/g, "").toLowerCase() === stripped
    );
    if (clash)
      setNameWarning("Someone already goes by that. Add a last name or number so @mentions find you.");
  }

  // Register drives knowledge-check content + copy. Parent = adult; child from age.
  const register: Register = useMemo(() => {
    if (mode === "child") return ageBand ? deriveRegister({ age_group: ageBand }) : "kid";
    return "adult";
  }, [mode, ageBand]);

  const checks = useMemo(() => checksForRegister(register), [register]);

  // ── Ordered step keys for this mode ────────────────────────────────────────
  const order = useMemo(() => {
    const kc = checks.map((_, i) => `kc-${i}`);
    if (mode === "child") return ["welcome", "age", ...kc, "username", "avatar", "celebrate"];
    return [
      "welcome",
      "household",
      "experience",
      ...kc,
      "goals",
      "focus",
      "username",
      "avatar",
      "invite",
      "celebrate",
    ];
  }, [mode, checks]);

  const key = order[step] ?? "welcome";
  const isFirst = step === 0;
  const isLast = key === "celebrate";

  function patch(p: Partial<ProfileDraft>) {
    setDraft((d) => ({ ...d, ...p }));
  }
  function goNext() {
    setDir(1);
    setStep((s) => Math.min(order.length - 1, s + 1));
  }
  function goBack() {
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  }

  // Create the family + claim any pending membership (fresh/claim path). Funnel
  // parents already have one — short-circuit. Returns the family id or null.
  async function ensureFamily(): Promise<string | null> {
    if (familyId) return familyId;
    const famName = `${displayName.trim() || "My"}'s Family`;
    const { data, error: rpcErr } = await supabase.rpc("onboard_create_family", {
      p_name: famName,
      p_display_name: displayName.trim() || "Parent",
      p_avatar_url: avatarUrl,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      return null;
    }
    setFamilyId(data as string);
    return data as string;
  }

  async function continueFromUsername() {
    if (mode === "parent") {
      setLoading(true);
      const fid = await ensureFamily();
      setLoading(false);
      if (!fid) return;
      // Best-effort persist of the answers gathered before this step.
      saveFamilyProfile(supabase, fid, draft, false);
    }
    goNext();
  }

  async function seedComprehension() {
    const correct = checks.reduce((n, c) => n + (kcAnswers[c.id] === c.answer ? 1 : 0), 0);
    const comprehension = comprehensionFromScore(correct, checks.length);
    const summary = composeKaiSeed({
      register,
      comprehension,
      correct,
      total: checks.length,
      experience: draft.experience,
      marketInterest: draft.market_interest,
    });
    await supabase.rpc("seed_onboarding_comprehension", {
      p_level: comprehension,
      p_summary: summary,
    });
  }

  // Final step — stamp the completion flags the rest of the app keys off (tour,
  // home state, CRM), seed Kai, and land on the dashboard so the tour chains.
  async function complete() {
    setError("");
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      if (mode === "parent") {
        const fid = familyId ?? (await ensureFamily());
        await supabase
          .from("profiles")
          .update({
            display_name: displayName.trim() || "Parent",
            avatar_url: avatarUrl,
            onboarding_complete: true,
          })
          .eq("id", user.id);
        if (fid) await saveFamilyProfile(supabase, fid, draft, true);
      } else {
        await supabase
          .from("profiles")
          .update({
            display_name: displayName.trim() || "Explorer",
            age_group: ageBand || "teens",
            track: ageBand || "teens",
            avatar_url: avatarUrl,
            onboarding_complete: true,
          })
          .eq("id", user.id);
      }

      await seedComprehension().catch(() => {});

      try {
        localStorage.setItem("fic-push-intent-pending", "1");
      } catch {}
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Something went wrong");
      setLoading(false);
    }
  }

  // ── Per-step gating ────────────────────────────────────────────────────────
  const kcIndex = key.startsWith("kc-") ? parseInt(key.slice(3), 10) : -1;
  const currentCheck = kcIndex >= 0 ? checks[kcIndex] : null;
  const canSkip =
    key === "household" ||
    key === "experience" ||
    key === "goals" ||
    key === "focus" ||
    key === "avatar" ||
    key === "invite" ||
    kcIndex >= 0;
  const canProceed =
    key === "age"
      ? ageBand !== ""
      : key === "username"
        ? displayName.trim().length > 0
        : kcIndex >= 0
          ? kcAnswers[currentCheck!.id] !== undefined
          : true;

  if (mode === "loading") {
    return (
      <div className="fixed inset-0 z-50 bg-paper flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-gold-400/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  const progress = order.length > 1 ? step / (order.length - 1) : 0;
  const showChrome = !isFirst && !isLast;

  return (
    <div className="fixed inset-0 z-50 bg-paper text-ink flex flex-col overflow-y-auto">
      {/* Top bar: wordmark + progress */}
      <div className="shrink-0 px-4 sm:px-6 pt-4 pb-3">
        <div className="max-w-lg mx-auto">
          <p className="font-display text-sm font-bold tracking-tight text-gold-700 text-center mb-3">
            Family Investing Club
          </p>
          {showChrome && (
            <div className="h-1.5 rounded-full bg-sand overflow-hidden">
              <m.div
                className="h-full bg-gold-500 rounded-full"
                initial={false}
                animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ type: "tween", duration: 0.3 }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Step body */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-4">
        <div className="w-full max-w-lg mx-auto">
          <div className="relative">
            <AnimatePresence mode="wait" custom={dir}>
              <m.div
                key={`${mode}-${key}`}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "tween", duration: 0.24 }}
              >
                {key === "welcome" && (
                  <WelcomeSplash
                    name={displayName.split(" ")[0]}
                    register={register}
                    onStart={goNext}
                  />
                )}

                {key === "household" && <WhoIsJoiningStep draft={draft} onChange={patch} />}
                {key === "age" && <KidAgeStep ageBand={ageBand} onChange={setAgeBand} />}
                {key === "experience" && <ExperienceStep draft={draft} onChange={patch} />}

                {currentCheck && (
                  <KnowledgeCheckStep
                    check={currentCheck}
                    index={kcIndex}
                    total={checks.length}
                    answer={kcAnswers[currentCheck.id]}
                    onAnswer={(v) =>
                      setKcAnswers((a) => ({ ...a, [currentCheck.id]: v }))
                    }
                    register={register}
                  />
                )}

                {key === "goals" && <GoalsStep draft={draft} onChange={patch} />}
                {key === "focus" && <FocusStep draft={draft} onChange={patch} />}

                {key === "username" && (
                  <UsernameStep
                    value={displayName}
                    onChange={(v) => {
                      setDisplayName(v);
                      checkUsername(v);
                    }}
                    warning={nameWarning}
                    register={register}
                  />
                )}

                {key === "avatar" && (
                  <div>
                    <StepHeading
                      eyebrow="Your look"
                      title="Pick your avatar"
                      sub="Choose a look for your profile — you can change it anytime in Settings."
                    />
                    <AvatarPicker
                      value={avatarUrl}
                      onChange={setAvatarUrl}
                      role={mode === "child" ? "child" : "parent"}
                      ageGroup={mode === "child" ? ageBand || "teens" : "adults"}
                    />
                  </div>
                )}

                {key === "invite" && <InviteStep />}

                {key === "celebrate" && (
                  <CelebrationStep
                    register={register}
                    name={displayName.split(" ")[0]}
                    recommendations={mode === "parent" ? deriveRecommendations(draft) : []}
                  />
                )}
              </m.div>
            </AnimatePresence>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      {key !== "welcome" && (
        <div className="shrink-0 px-4 sm:px-6 pb-6 pt-2">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            {!isFirst && !isLast ? (
              <button
                onClick={goBack}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-soft hover:text-ink transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-4">
              {canSkip && (
                <button
                  onClick={goNext}
                  className="text-sm text-soft hover:text-ink transition-colors font-medium"
                >
                  Skip
                </button>
              )}

              {isLast ? (
                <button
                  onClick={complete}
                  disabled={loading}
                  className="cta-button flex items-center gap-2 px-6 py-3 rounded-2xl text-sm disabled:opacity-50"
                >
                  {loading ? "Setting up…" : "Go to my dashboard"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              ) : key === "username" ? (
                <button
                  onClick={continueFromUsername}
                  disabled={!canProceed || loading}
                  className="cta-button flex items-center gap-2 px-6 py-3 rounded-2xl text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? "Setting up…" : "Continue"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              ) : (
                <button
                  onClick={goNext}
                  disabled={!canProceed}
                  className="cta-button flex items-center gap-2 px-6 py-3 rounded-2xl text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Celebration ────────────────────────────────────────────────────────────────

function CelebrationStep({
  register,
  name,
  recommendations,
}: {
  register: Register;
  name?: string;
  recommendations: { key: string; title: string; sub: string }[];
}) {
  const title =
    register === "kid"
      ? "You're in! 🎉"
      : name
        ? `You're all set, ${name}!`
        : "You're all set!";
  const sub =
    register === "kid"
      ? "Your clubhouse is ready. Let's go explore!"
      : "We've built the club around your answers. Here's where to start.";
  return (
    <div className="text-center">
      <m.div
        initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
        className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gold-400/15 border-2 border-gold-400/30 flex items-center justify-center"
      >
        <Sparkles className="w-10 h-10 text-gold-600" />
      </m.div>
      <h1 className="font-display text-3xl font-bold text-ink leading-tight">{title}</h1>
      <p className="text-soft mt-2 max-w-md mx-auto">{sub}</p>

      {recommendations.length > 0 && (
        <div className="mt-6 space-y-2.5 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wider text-soft text-center">
            Start here — built around your answers
          </p>
          {recommendations.map((r) => (
            <div
              key={r.key}
              className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-sand bg-card"
            >
              <span className="w-9 h-9 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 text-gold-700" />
              </span>
              <div className="min-w-0">
                <p className="font-display font-semibold text-sm text-ink">{r.title}</p>
                <p className="text-xs text-soft">{r.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
