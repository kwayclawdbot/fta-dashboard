"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  ArrowRight,
  Video,
  CalendarPlus,
  MessageCircle,
  Lock,
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
import { Meter } from "@/components/f0/parts";

/**
 * FREE-tier dashboard home. Leads with the "Your first week, free" checklist
 * (steps auto-detected server-side), the free-class card, a read-only nudge into
 * the community, a peek at everything membership unlocks, and the Join-FIC CTA.
 * After the member's class date passes, a "How was the class?" band leads.
 *
 * CANVAS V2 (M1). Rebuilt on the canvas language without touching a single
 * commercial string or a single journey write:
 *
 *   · the five paper-cards are gone. The post-class pitch is the surface's ONE
 *     hero field (.f0-hero-field — obsidian on cream, so the offer is the
 *     strongest object on the page); everything else is a hairline ledger or a
 *     ruled section, which is what the register asks for instead of a stack of
 *     bordered boxes.
 *   · the "everything the club unlocks" 2-column grid of outlined pills was an
 *     equal-column CONTENT grid — banned — and is now a ledger of locked rows.
 *     A locked feature reading as a ROW rather than a tile also stops it looking
 *     like six things you already have.
 *   · the ProgressRing is deleted. Plan §1.5: the club-sentiment arc is the only
 *     gauge in the app, and a 5-step checklist is a bar and two numerals.
 *
 * EVERY commercial and journey string below is byte-identical to what shipped.
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

const UNLOCKS: { icon: LucideIcon; label: string }[] = [
  { icon: BookOpen, label: "Full course library" },
  { icon: Video, label: "Weekly live classes" },
  { icon: Eye, label: "Family watchlist" },
  { icon: Target, label: "Kid missions" },
  { icon: Gamepad2, label: "Games & simulator" },
  { icon: Sparkles, label: "Badges & progress" },
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
    <div className="mx-auto max-w-3xl space-y-8 pb-14">
      {/* ── Masthead ──────────────────────────────────────────────────────── */}
      <header className="f0-stagger">
        <p
          className="font-display text-eyebrow font-bold uppercase text-gold-700"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          Free member
        </p>
        <h1
          className="mt-3 font-display text-display-1 font-black text-ink"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Welcome{firstName ? `, ${firstName}` : ""}
        </h1>
        <p
          className="mt-3 max-w-lg text-[15px] leading-relaxed text-soft"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          {classPassed
            ? "Hope the class was a good one. Here's how to keep the momentum going."
            : "Your free seat is saved. Here's your first week — and a look at what the club unlocks."}
        </p>
      </header>

      {/* ── Post-class band — the surface's ONE hero field, and only once the
             member's class date has passed. ─────────────────────────────────── */}
      {classPassed && (
        <section className="f0-hero-field f0-grain px-6 py-7">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
            After the class
          </p>
          <h2 className="mt-2.5 font-display text-display-2 font-extrabold text-white">
            How was the class?
          </h2>
          <p className="mt-2 text-[14px] text-white/80">
            Members pick up right where the class left off — every week.
          </p>
          <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-white/70">
            The free class is the first step. Inside the club, your family gets the
            full course library, a weekly live class, the family watchlist, the
            simulator, and every game — one membership for everyone under your
            roof.
          </p>
          <a
            href={FIC_CHECKOUT_URL}
            className="cta-button mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px]"
          >
            Join FIC — $99/mo <ArrowRight className="h-4 w-4" />
          </a>
        </section>
      )}

      {/* ── Your first week checklist ─────────────────────────────────────── */}
      {journey && <JourneyLedger journey={journey} onGo={markWatched} />}

      {/* ── Your free class ───────────────────────────────────────────────── */}
      <section aria-labelledby="free-class">
        <h2 id="free-class" className="f0-section-rule">
          <span className="font-display text-eyebrow font-bold uppercase text-ink">
            Your free class
          </span>
        </h2>
        <p className="mt-3 font-display text-display-3 font-extrabold leading-snug text-ink">
          {session?.title || "Cheat Code Club — Free Class"}
        </p>
        <p className="mt-2 flex items-center gap-2 text-[14px] text-soft">
          <Clock className="h-4 w-4 shrink-0 text-gold-700" aria-hidden />
          {loaded
            ? session?.scheduled_at
              ? formatClassWhen(session.scheduled_at)
              : "A class is being scheduled — we'll email you the time."
            : "Loading…"}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="/free-class"
            onClick={markWatched}
            className="cta-button f0-focus inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm"
          >
            <Video className="h-4 w-4" /> Class info & video
          </Link>
          {session && (
            <button
              onClick={() => downloadClassIcs(session)}
              className="f0-frame f0-focus f0-press inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 font-display text-sm font-semibold text-ink transition-colors hover:text-gold-700"
            >
              <CalendarPlus className="h-4 w-4 text-gold-700" /> Add to
              calendar
            </button>
          )}
        </div>
      </section>

      {/* ── Community (read-only) ─────────────────────────────────────────── */}
      <section className="f0-rule-top pt-5">
        <Link
          href="/community"
          className="f0-ledger-row f0-focus group"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent-solid)_12%,transparent)] text-gold-700">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] font-extrabold text-ink">
              Look inside the club community
            </span>
            <span className="mt-1 block text-[13px] leading-snug text-soft">
              Say hi in the Free Lounge and see what real families are learning.
              Join the Club to post in the members&apos; room.
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-gold-700 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
        </Link>
      </section>

      {/* ── What membership unlocks ───────────────────────────────────────── */}
      <section aria-labelledby="free-unlocks">
        <h2 id="free-unlocks" className="f0-section-rule">
          <span className="font-display text-eyebrow font-bold uppercase text-ink">
            Everything the club unlocks
          </span>
        </h2>
        <p className="mt-2.5 text-[14px] text-soft">
          One membership. The whole family.
        </p>

        <div className="f0-ledger mt-3">
          {UNLOCKS.map((f) => (
            <div key={f.label} className="f0-ledger-row">
              <f.icon className="h-4 w-4 shrink-0 text-gold-700" />
              <span className="min-w-0 flex-1 font-display text-[15px] font-bold text-ink">
                {f.label}
              </span>
              <Lock className="h-3.5 w-3.5 shrink-0 text-soft" aria-hidden />
              <span className="sr-only">Members only</span>
            </div>
          ))}
        </div>

        {/* One compare link here — the single primary Join CTA lives in the
            first-week checklist above, so the free home isn't a wall of
            identical buttons (UX audit #18). */}
        <Link
          href="/upgrade"
          className="f0-frame f0-focus f0-press mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-6 py-3 font-display text-sm font-semibold text-ink transition-colors hover:text-gold-700"
        >
          See what $99/mo unlocks <ArrowRight className="h-4 w-4 text-gold-700" />
        </Link>
      </section>
    </div>
  );
}

/* ── The first-week checklist ────────────────────────────────────────────────
   A ruled ledger with a bar, not a card with a ring. Done steps keep the green
   tick — that is a COMPLETION mark, not a price, and it is the one place the
   colour reads unambiguously because nothing on this surface carries a quote. */
function JourneyLedger({
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
    <section aria-labelledby="free-journey">
      <div className="flex items-end justify-between gap-3">
        <h2 id="free-journey" className="f0-section-rule min-w-0 flex-1">
          <span className="font-display text-eyebrow font-bold uppercase text-ink">
            Your first week, free
          </span>
        </h2>
        <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-soft">
          {done}/{total}
        </span>
      </div>

      <h3 className="mt-3 font-display text-display-2 font-extrabold leading-tight text-ink">
        {complete ? "You did the whole tour" : "A few steps to get the most out of it"}
      </h3>
      <p className="mt-2 text-[14px] text-soft">
        {complete
          ? "You've seen what's inside. Ready for the full club?"
          : "Try the tools, meet the club, then decide."}
      </p>

      <Meter pct={pct} className="mt-4 max-w-sm" />

      <div className="f0-ledger mt-4">
        {STEPS.map((s) => {
          const isDone = !!journey[s.key];
          const Icon = s.icon;
          return (
            <Link
              key={s.key}
              href={s.href}
              onClick={s.markOnGo ? onGo : undefined}
              className="f0-ledger-row f0-focus group"
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                  /* COLOUR LAW: green is PRICE. A completed setup step is an
                     ACTION finished, so the done disc is the mode-correct
                     accent fill (the same `bg-accent text-night-950` pairing
                     settings and the learn path use), not a green tick. */
                  isDone
                    ? "bg-accent text-night-950"
                    : "bg-[color-mix(in_srgb,var(--accent-solid)_14%,transparent)] text-gold-700"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span
                className={`min-w-0 flex-1 font-display text-[15px] font-bold ${
                  isDone ? "text-soft line-through" : "text-ink"
                }`}
              >
                {s.label}
              </span>
              {!isDone && (
                <ArrowRight className="h-4 w-4 shrink-0 text-gold-700 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Next step / final CTA */}
      {complete ? (
        <a
          href={FIC_CHECKOUT_URL}
          className="cta-button f0-focus mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px]"
        >
          Unlock everything — join FIC <ArrowRight className="h-4 w-4" />
        </a>
      ) : (
        nextStep && (
          <Link
            href={nextStep.href}
            onClick={nextStep.markOnGo ? onGo : undefined}
            className="cta-button f0-focus mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm"
          >
            Next: {nextStep.label} <ArrowRight className="h-4 w-4" />
          </Link>
        )
      )}
    </section>
  );
}
