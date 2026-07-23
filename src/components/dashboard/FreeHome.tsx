"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import {
  CalendarDays,
  Clock,
  ArrowRight,
  Video,
  CalendarPlus,
  MessageCircle,
  Lock,
  GraduationCap,
  Sparkles,
  BookOpen,
  Eye,
  Target,
  Gamepad2,
  Check,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  FIC_CHECKOUT_URL,
  formatClassWhen,
  downloadClassIcs,
  type FreeClassSession,
  type NextClassResponse,
} from "@/lib/free-class";
import {
  fetchJourneyState,
  markJourneyStep,
  journeyDoneCount,
  journeyComplete,
  JOURNEY_STEP_KEYS,
  type JourneyState,
  type JourneyStepKey,
} from "@/lib/free-journey";

/**
 * FREE-tier dashboard home. Leads with the "Your first week, free" checklist
 * (steps auto-detected server-side), the free-class card, a read-only nudge into
 * the community, a peek at everything membership unlocks, and the Join-FIC CTA.
 * After the member's class date passes, a "How was the class?" band leads.
 */

interface StepMeta {
  key: JourneyStepKey;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Mark this client step when the CTA is followed (today: watched_video). */
  markOnGo?: JourneyStepKey;
}

const STEPS: StepMeta[] = [
  { key: "class_rsvped", label: "Save your free class seat", href: "/free-class", icon: CalendarDays },
  { key: "watched_video", label: "Watch the welcome video", href: "/free-class", icon: Video, markOnGo: "watched_video" },
  { key: "first_lesson", label: "Play your first free lesson", href: "/courses", icon: BookOpen },
  { key: "said_hi", label: "Say hi in the Free Lounge", href: "/community", icon: MessageCircle },
  { key: "first_game", label: "Play Candle Battle", href: "/games/candle-battle", icon: Gamepad2 },
];

export default function FreeHome({ firstName }: { firstName: string }) {
  const supabase = createClient();
  const [session, setSession] = useState<FreeClassSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [journey, setJourney] = useState<JourneyState | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/free-class/next")
      .then((r) => (r.ok ? (r.json() as Promise<NextClassResponse>) : null))
      .then((d) => {
        if (!mounted) return;
        setSession(d?.session ?? null);
        setLoaded(true);
      })
      .catch(() => mounted && setLoaded(true));
    fetchJourneyState(supabase).then((s) => mounted && setJourney(s));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markWatched() {
    if (journey?.watched_video) return;
    markJourneyStep(supabase, "watched_video");
    setJourney((j) => (j ? { ...j, watched_video: true } : j));
  }

  const classPassed = !!journey?.class_passed;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Greeting */}
      <div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-[11px] font-display font-bold uppercase tracking-[0.14em]">
          <Sparkles className="w-3 h-3" /> Free member
        </span>
        <h1 className="font-display text-2xl font-bold text-ink mt-3">
          Welcome{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-soft mt-1">
          {classPassed
            ? "Hope the class was a good one. Here's how to keep the momentum going."
            : "Your free seat is saved. Here's your first week — and a look at what the club unlocks."}
        </p>
      </div>

      {/* Post-class band — leads once the member's class date has passed. */}
      {classPassed && (
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="paper-card ring-2 ring-gold-400 p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center shrink-0 shadow-soft">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-ink">
                How was the class?
              </h3>
              <p className="text-sm text-soft">
                Members pick up right where the class left off — every week.
              </p>
            </div>
          </div>
          <p className="text-sm text-midnight-100 leading-relaxed">
            The free class is the first step. Inside the club, your family gets the
            full course library, a weekly live class, the family watchlist, the
            simulator, and every game — one membership for everyone under your
            roof.
          </p>
          <a
            href={FIC_CHECKOUT_URL}
            className="cta-button mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px]"
          >
            Join FIC — $99/mo <ArrowRight className="w-4 h-4" />
          </a>
        </m.div>
      )}

      {/* Your first week checklist */}
      {journey && <JourneyCard journey={journey} onGo={markWatched} />}

      {/* Your free class */}
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="paper-card p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
            <CalendarDays className="w-6 h-6 text-gold-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
              Your free class
            </p>
            <h2 className="font-display text-lg font-bold text-ink leading-snug mt-0.5">
              {session?.title || "Family Investing Club — Free Class"}
            </h2>
            <div className="flex items-center gap-2 text-sm text-soft mt-1.5">
              <Clock className="w-4 h-4 text-gold-600 shrink-0" />
              {loaded
                ? session?.scheduled_at
                  ? formatClassWhen(session.scheduled_at)
                  : "A class is being scheduled — we'll email you the time."
                : "Loading…"}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Link
                href="/free-class"
                onClick={markWatched}
                className="cta-button inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm"
              >
                <Video className="w-4 h-4" /> Class info & video
              </Link>
              {session && (
                <button
                  onClick={() => downloadClassIcs(session)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-sand text-ink text-sm font-display font-semibold hover:bg-white/50 transition-colors"
                >
                  <CalendarPlus className="w-4 h-4 text-gold-600" /> Add to
                  calendar
                </button>
              )}
            </div>
          </div>
        </div>
      </m.div>

      {/* Community (read-only) */}
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Link
          href="/community"
          className="paper-card p-5 flex items-center gap-4 hover:border-gold-300 transition-colors"
        >
          <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
            <MessageCircle className="w-6 h-6 text-gold-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-ink">
              Look inside the club community
            </p>
            <p className="text-sm text-soft">
              Say hi in the Free Lounge and see what real families are learning.
              Join FIC to post in the members&apos; room.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-gold-700 shrink-0" />
        </Link>
      </m.div>

      {/* What membership unlocks */}
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="paper-card ring-2 ring-gold-400 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center shrink-0 shadow-soft">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-ink">
              Everything the club unlocks
            </h3>
            <p className="text-sm text-soft">
              One membership. The whole family.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: BookOpen, label: "Full course library" },
            { icon: Video, label: "Weekly live classes" },
            { icon: Eye, label: "Family watchlist" },
            { icon: Target, label: "Kid missions" },
            { icon: Gamepad2, label: "Games & simulator" },
            { icon: Sparkles, label: "Badges & progress" },
          ].map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-2.5 rounded-xl border border-sand bg-white/40 px-3 py-2.5"
            >
              <f.icon className="w-4 h-4 text-gold-600 shrink-0" />
              <span className="text-sm text-ink font-medium leading-tight flex-1 min-w-0">
                {f.label}
              </span>
              <Lock className="w-3.5 h-3.5 text-soft shrink-0" />
            </div>
          ))}
        </div>
        {/* One compare link here — the single primary Join CTA lives in the
            first-week checklist above, so the free home isn't a wall of
            identical buttons (UX audit #18). */}
        <Link
          href="/upgrade"
          className="mt-5 w-full inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl text-sm font-display font-semibold text-ink border border-sand hover:bg-white/50 transition-colors"
        >
          See what $99/mo unlocks <ArrowRight className="w-4 h-4 text-gold-700" />
        </Link>
      </m.div>
    </div>
  );
}

// ── The first-week checklist card ────────────────────────────────────────────
function JourneyCard({
  journey,
  onGo,
}: {
  journey: JourneyState;
  onGo: () => void;
}) {
  const done = journeyDoneCount(journey);
  const total = JOURNEY_STEP_KEYS.length;
  const complete = journeyComplete(journey);
  const nextStep = STEPS.find((s) => !journey[s.key]);
  const pct = Math.round((done / total) * 100);

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="paper-card p-6"
    >
      <div className="flex items-center gap-4">
        <ProgressRing pct={pct} label={`${done}/${total}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
            Your first week, free
          </p>
          <h2 className="font-display text-lg font-bold text-ink leading-snug">
            {complete ? "You did the whole tour" : "A few steps to get the most out of it"}
          </h2>
          <p className="text-sm text-soft mt-0.5">
            {complete
              ? "You've seen what's inside. Ready for the full club?"
              : "Try the tools, meet the club, then decide."}
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-1.5">
        {STEPS.map((s) => {
          const isDone = !!journey[s.key];
          const Icon = s.icon;
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                onClick={s.markOnGo ? onGo : undefined}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  isDone
                    ? "border-green-500/30 bg-chip-green/40"
                    : "border-sand bg-white/40 hover:border-gold-300"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    isDone ? "bg-green-500 text-white" : "bg-gold-400/15 text-gold-700"
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </span>
                <span
                  className={`text-sm font-medium flex-1 min-w-0 ${
                    isDone ? "text-soft line-through" : "text-ink"
                  }`}
                >
                  {s.label}
                </span>
                {!isDone && <ArrowRight className="w-4 h-4 text-gold-700 shrink-0" />}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Next step / final CTA */}
      {complete ? (
        <a
          href={FIC_CHECKOUT_URL}
          className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px]"
        >
          Unlock everything — join FIC <ArrowRight className="w-4 h-4" />
        </a>
      ) : (
        nextStep && (
          <Link
            href={nextStep.href}
            onClick={nextStep.markOnGo ? onGo : undefined}
            className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm"
          >
            Next: {nextStep.label} <ArrowRight className="w-4 h-4" />
          </Link>
        )
      )}
    </m.div>
  );
}

function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          className="stroke-sand"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="stroke-gold-500 transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-ink">
        {label}
      </span>
    </div>
  );
}
