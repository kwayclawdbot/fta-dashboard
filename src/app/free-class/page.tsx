"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  CalendarDays,
  Clock,
  Video,
  ShieldCheck,
  Users,
  Mail,
  Lock,
  Phone,
  Loader2,
  PartyPopper,
  CalendarPlus,
  GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  FIC_CHECKOUT_URL,
  formatClassWhen,
  downloadClassIcs,
  type FreeClassSession,
  type NextClassResponse,
} from "@/lib/free-class";

// ── Quiz definition ──────────────────────────────────────────────────────────
type QuizStep = {
  key: string;
  question: string;
  hint?: string;
  options: { value: string; label: string; sub?: string }[];
};

const QUIZ: QuizStep[] = [
  {
    key: "ages",
    question: "Who's learning with you?",
    hint: "We tailor the class to your family.",
    options: [
      { value: "young", label: "Younger kids", sub: "Ages 5–12" },
      { value: "teens", label: "Teens", sub: "Ages 13–17" },
      { value: "mixed", label: "A mix of ages", sub: "Little ones and teens" },
      { value: "adults", label: "Just us adults", sub: "No kids yet" },
    ],
  },
  {
    key: "goal",
    question: "What would make this worth it?",
    hint: "Pick what matters most right now.",
    options: [
      { value: "kids_money", label: "Raise money-smart kids", sub: "Investors, not spenders" },
      { value: "family_habit", label: "A weekly family money habit", sub: "Something we do together" },
      { value: "learn_myself", label: "Finally learn to invest myself", sub: "Start from the beginning" },
      { value: "all", label: "Honestly, all of it", sub: "The whole picture" },
    ],
  },
  {
    key: "experience",
    question: "Where's your family today?",
    hint: "There's a seat for every level.",
    options: [
      { value: "beginner", label: "Total beginners", sub: "We're starting fresh" },
      { value: "some", label: "We know a little", sub: "Heard the words, want the habit" },
      { value: "investing", label: "I already invest", sub: "Bringing the family in" },
    ],
  },
];

// Total funnel steps: hook(1) + quiz(3) + register(1) = 5 (confirmation is separate).
const REGISTER_STEP = 1 + QUIZ.length; // index of the register step

export default function FreeClassPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"checking" | "funnel" | "hub">("checking");
  const [step, setStep] = useState(0); // 0 = hook, 1..QUIZ.length = quiz, REGISTER_STEP = register
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Registration form
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Class + video
  const [session, setSession] = useState<FreeClassSession | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // On mount: fetch the class + detect an existing session (hub mode).
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [nextRes, { data: auth }] = await Promise.all([
        fetch("/api/free-class/next")
          .then((r) => (r.ok ? (r.json() as Promise<NextClassResponse>) : null))
          .catch(() => null),
        supabase.auth.getUser(),
      ]);
      if (!mounted) return;
      if (nextRes) {
        setSession(nextRes.session);
        setVideoUrl(nextRes.video_url);
      }
      setMode(auth?.user ? "hub" : "funnel");
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goNext() {
    setDir(1);
    setStep((s) => s + 1);
  }
  function goBack() {
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  }
  function pick(key: string, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
    // brief beat so the selection registers visually, then advance
    setTimeout(goNext, 160);
  }

  async function submit() {
    setError(null);
    if (!firstName.trim()) return setError("Please enter your first name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError("Please enter a valid email.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/free-class/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim(),
          quiz: answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitting(false);
        return setError(data?.error || "Something went wrong. Please try again.");
      }
      if (data.session) setSession(data.session);
      // Sign in immediately (email was pre-confirmed server-side).
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      setDone(true);
      setSubmitting(false);
    } catch {
      setSubmitting(false);
      setError("Network error. Please try again.");
    }
  }

  if (mode === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
      </div>
    );
  }

  // ── Confirmation / hub view (post-register, or an already-signed-in visitor) ──
  if (done || mode === "hub") {
    return (
      <ConfirmationView
        session={session}
        videoUrl={videoUrl}
        firstName={firstName}
        signedInHub={mode === "hub" && !done}
        onExplore={() => router.push("/dashboard")}
      />
    );
  }

  // ── Funnel ──
  const progressPct = Math.round((step / REGISTER_STEP) * 100);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar />

      {/* Progress */}
      <div className="w-full max-w-md mx-auto px-5 pt-4">
        {step > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="text-soft hover:text-ink transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 h-1.5 rounded-full bg-sand overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gold-500"
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ type: "tween", duration: 0.3 }}
              />
            </div>
            <span className="text-[11px] font-display font-bold text-soft tabular-nums shrink-0">
              {step}/{REGISTER_STEP}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-start sm:items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ x: dir > 0 ? 60 : -60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: dir > 0 ? -60 : 60, opacity: 0 }}
              transition={{ type: "tween", duration: 0.22 }}
            >
              {/* HOOK */}
              {step === 0 && (
                <div className="text-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-[11px] font-display font-bold uppercase tracking-[0.14em] mb-5">
                    <Sparkles className="w-3 h-3" /> Free weekly class
                  </span>
                  <h1 className="font-display text-[1.75rem] leading-[1.12] sm:text-4xl font-bold text-ink">
                    Is your family raising{" "}
                    <span className="text-gradient-gold">investors</span> — or
                    spenders?
                  </h1>
                  <p className="text-soft mt-4 text-[15px] leading-relaxed max-w-sm mx-auto">
                    Join a free live class with the Family Investing Club. In one
                    session your family learns how the market actually works —
                    and how to start the habit together. Reserve your seat in 30
                    seconds.
                  </p>
                  {session?.scheduled_at && (
                    <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-sand bg-white/40 px-4 py-2 text-sm text-ink">
                      <CalendarDays className="w-4 h-4 text-gold-600" />
                      <span className="font-semibold">This week:</span>
                      <span className="text-soft">
                        {formatClassWhen(session.scheduled_at)}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={goNext}
                    className="cta-button mt-7 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px]"
                  >
                    Reserve my seat <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="mt-3 text-xs text-soft">
                    Free · No card required · The whole family welcome
                  </p>
                </div>
              )}

              {/* QUIZ */}
              {step >= 1 && step <= QUIZ.length && (
                <QuizCard
                  stepDef={QUIZ[step - 1]}
                  selected={answers[QUIZ[step - 1].key]}
                  onPick={(v) => pick(QUIZ[step - 1].key, v)}
                />
              )}

              {/* REGISTER */}
              {step === REGISTER_STEP && (
                <div>
                  <div className="text-center mb-6">
                    <h2 className="font-display text-2xl font-bold text-ink">
                      Save your seat
                    </h2>
                    <p className="text-soft text-sm mt-1.5 max-w-xs mx-auto">
                      We&apos;ll set up your free account and hold your spot for
                      {session?.scheduled_at
                        ? ` ${formatClassWhen(session.scheduled_at)}`
                        : " the next class"}
                      .
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Field
                      icon={Users}
                      placeholder="Your first name"
                      value={firstName}
                      onChange={setFirstName}
                      autoFocus
                    />
                    <Field
                      icon={Mail}
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={setEmail}
                    />
                    <Field
                      icon={Lock}
                      type="password"
                      placeholder="Create a password (8+ characters)"
                      value={password}
                      onChange={setPassword}
                    />
                    <Field
                      icon={Phone}
                      type="tel"
                      placeholder="Phone (optional — for a class reminder)"
                      value={phone}
                      onChange={setPhone}
                    />
                  </div>

                  {error && (
                    <p className="mt-3 text-sm text-red-600 font-body">{error}</p>
                  )}

                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px] disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving your
                        seat…
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
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Confirmation / hub ───────────────────────────────────────────────────────
function ConfirmationView({
  session,
  videoUrl,
  firstName,
  signedInHub,
  onExplore,
}: {
  session: FreeClassSession | null;
  videoUrl: string | null;
  firstName: string;
  signedInHub: boolean;
  onExplore: () => void;
}) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <TopBar />
      <div className="max-w-lg mx-auto px-5 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-chip-green flex items-center justify-center mb-4">
            <PartyPopper className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            {signedInHub
              ? "Your free class"
              : `You're in${firstName ? `, ${firstName}` : ""}!`}
          </h1>
          <p className="text-soft text-sm mt-2 max-w-sm mx-auto">
            {signedInHub
              ? "Here's everything for the upcoming class, plus a quick look at what's inside."
              : "Here's what happens next. Your free account is ready and your seat is saved."}
          </p>
        </motion.div>

        {/* Class card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="paper-card p-5 mt-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
              <CalendarDays className="w-6 h-6 text-gold-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
                {session ? "Your class" : "Next class"}
              </p>
              <h2 className="font-display text-lg font-bold text-ink leading-snug mt-0.5">
                {session?.title || "Family Investing Club — Free Class"}
              </h2>
              <div className="flex items-center gap-2 text-sm text-soft mt-1.5">
                <Clock className="w-4 h-4 text-gold-600 shrink-0" />
                {session?.scheduled_at
                  ? formatClassWhen(session.scheduled_at)
                  : "We'll email you the time — a class is being scheduled."}
              </div>
              {session?.description && (
                <p className="text-sm text-soft mt-2 leading-relaxed">
                  {session.description}
                </p>
              )}
              {session && (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <button
                    onClick={() => downloadClassIcs(session)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sand text-ink text-xs font-display font-semibold hover:bg-white/50 transition-colors"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" /> Add to calendar
                  </button>
                  {session.zoom_join_url && (
                    <a
                      href={session.zoom_join_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sand text-ink text-xs font-display font-semibold hover:bg-white/50 transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" /> Join link
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Video */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-6"
        >
          <p className="text-center text-[11px] font-display font-bold uppercase tracking-[0.14em] text-gold-700 mb-2">
            Watch first · 2 minutes
          </p>
          <div className="paper-card overflow-hidden">
            {videoUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full aspect-video bg-night-950"
              />
            ) : (
              <div className="w-full aspect-video bg-night-950 flex items-center justify-center text-night-300 text-sm">
                Video coming soon
              </div>
            )}
          </div>
          <p className="text-center text-sm text-soft mt-3 max-w-sm mx-auto">
            A quick look at your upcoming class, the app your family just joined,
            and why families go all-in as members.
          </p>
        </motion.div>

        {/* Join FIC — under the video */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="paper-card ring-2 ring-gold-400 p-6 mt-6 text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center mx-auto mb-3 shadow-soft">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl font-bold text-ink">
            Make it a family habit
          </h3>
          <p className="text-soft text-sm mt-2 max-w-xs mx-auto leading-relaxed">
            Weekly classes, the full course library, kid missions, and the club
            community — everyone under your roof, one membership.
          </p>
          <a
            href={FIC_CHECKOUT_URL}
            className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px]"
          >
            Join FIC — $99/mo <ArrowRight className="w-4 h-4" />
          </a>
          <button
            onClick={onExplore}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-display font-semibold text-ink border border-sand hover:bg-white/50 transition-colors"
          >
            Explore the app free
          </button>
        </motion.div>

        <p className="mt-8 text-center text-xs text-soft max-w-sm mx-auto leading-relaxed flex items-start justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Education only — nothing here is financial advice. Practice money only,
          always.
        </p>
      </div>
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <div className="w-full border-b border-sand">
      <div className="max-w-lg mx-auto px-5 h-14 flex items-center justify-between">
        <span className="font-display text-sm font-bold tracking-wide text-ink">
          FAMILY <span className="text-gold-700">INVESTING</span> CLUB
        </span>
        <Link
          href="/login"
          className="text-xs font-display font-semibold text-soft hover:text-ink transition-colors"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}

function QuizCard({
  stepDef,
  selected,
  onPick,
}: {
  stepDef: QuizStep;
  selected?: string;
  onPick: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="font-display text-2xl font-bold text-ink leading-snug">
          {stepDef.question}
        </h2>
        {stepDef.hint && (
          <p className="text-soft text-sm mt-1.5">{stepDef.hint}</p>
        )}
      </div>
      <div className="space-y-2.5">
        {stepDef.options.map((o) => {
          const active = selected === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onPick(o.value)}
              className={`w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-xl border transition-colors ${
                active
                  ? "border-gold-400 bg-gold-400/10"
                  : "border-sand bg-white/40 hover:border-gold-300"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  active ? "border-gold-500 bg-gold-500" : "border-sand"
                }`}
              >
                {active && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className="min-w-0">
                <span className="block font-display font-semibold text-ink text-[15px]">
                  {o.label}
                </span>
                {o.sub && (
                  <span className="block text-xs text-soft mt-0.5">{o.sub}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  autoFocus,
}: {
  icon: React.ElementType;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-soft" />
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/50 border border-sand text-ink placeholder:text-soft focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/20 transition-colors text-[15px] font-body"
      />
    </div>
  );
}
