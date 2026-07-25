"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m, useReducedMotion } from "@/lib/motion";
import {
  Check,
  X,
  ArrowRight,
  Sparkles,
  Users,
  GraduationCap,
  CalendarDays,
  Video,
  BadgeCheck,
  Rocket,
  ShieldCheck,
  MessagesSquare,
  Trophy,
  LineChart,
  Layers,
  Target,
  Compass,
  HelpCircle,
  BookOpen,
  Bot,
  Telescope,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTierState, TIER_CONFIG, type FamilyTier } from "@/lib/tier";
import { isSoloProfile } from "@/lib/register";
import { modeFromSolo } from "@/lib/mode";
import TierBadge from "@/components/TierBadge";

const FIC_URL = "https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a";
const FTA_URL = "https://buy.stripe.com/9B6aEXdbt9pH2Sw8hlbEA0b";

// What moving up to FTA actually unlocks — mirrors the TIER_ACCESS matrix.
const FTA_UPGRADE_BENEFITS = [
  "Everything in the Club",
  "All tracks for the whole family",
  "Advanced 6-week live trading curriculum",
  "Priority live classes, Q&A, and recordings",
  "Premium FTA badge in the community",
  "Trading simulator, drills, and coach feedback",
];

// ── FIC marketing content ────────────────────────────────────────────────────

const CURRICULUM = [
  {
    week: "Week 1",
    title: "The language of the markets",
    body: "Start from zero. What a share really is, how a market moves, and the words every trader uses — taught properly, not skimmed.",
    icon: Compass,
  },
  {
    week: "Week 2",
    title: "Reading charts & price action",
    body: "Candles, trend, support and resistance. Learn to look at a chart and actually see the story it's telling.",
    icon: LineChart,
  },
  {
    week: "Week 3",
    title: "Risk & protecting capital",
    body: "The habit that keeps beginners in the game: position sizing, stops, and never risking what you can't afford to learn with.",
    icon: ShieldCheck,
  },
  {
    week: "Week 4",
    title: "Building a repeatable strategy",
    body: "Turn scattered ideas into one written plan with rules — entries, exits, and the setups you'll actually take.",
    icon: Layers,
  },
  {
    week: "Week 5",
    title: "Execution & the trading routine",
    body: "Practice the daily rhythm on the simulator: prep, execute, journal, review. Reps in a safe environment.",
    icon: Target,
  },
  {
    week: "Week 6",
    title: "Trade ready",
    body: "Put it all together in live practice with coach feedback. You finish with a plan, a routine, and the confidence to keep going.",
    icon: Rocket,
  },
];

const PILLARS = [
  {
    icon: Video,
    title: "Live classes, every week",
    body: "Real Zoom sessions with a coach — questions answered live. Miss one? Every class is recorded and waiting in the app.",
  },
  {
    icon: GraduationCap,
    title: "Structured, university-grade lessons",
    body: "The adult 12-lesson track and the teen curriculum are already live in your dashboard, ready the moment you upgrade.",
  },
  {
    icon: MessagesSquare,
    title: "The FTA community room",
    body: "Unlock the private FTA room alongside your Club — a smaller room for families going all the way to trade ready.",
  },
  {
    icon: Users,
    title: "Your whole family, included",
    body: "One upgrade covers everyone. Kids and teens inherit FTA automatically — each on the track that fits their age.",
  },
];

// ── Cheat Code Club ($99/mo) value — what a FREE member unlocks by joining ────
// The full umbrella membership: community + AI + research + live sessions +
// Family Mode included. Copy stays umbrella-neutral so it reads right at either
// door (Cheat Code Club / Family Investing Club).
const FIC_PILLARS = [
  {
    icon: Bot,
    title: "Kai, your AI analyst",
    body: "The investing intelligence built into the app — ask Kai anything, get plain-English research on any company, and learn as you go.",
  },
  {
    icon: Telescope,
    title: "Research & the screener",
    body: "Full research pages on every ticker plus the stock screener — scan the market and study companies the way members do.",
  },
  {
    icon: MessagesSquare,
    title: "The community room",
    body: "The private club room where members share picks, wins and questions. You're reading it free right now — joining lets you post.",
  },
  {
    icon: Video,
    title: "Live classes every week",
    body: "Real coached sessions you can join live, with every class recorded in-app so you're never locked out if life gets busy.",
  },
  {
    icon: BookOpen,
    title: "Every course, every track",
    body: "The full foundations library plus the kids, teens and adult tracks — one membership covers everyone you bring in.",
  },
  {
    icon: Users,
    title: "Family Mode included",
    body: "Add your kids or partner any time and the family features switch on — report cards, kid missions, and a weekly rhythm. No extra cost.",
  },
];

type Row = { label: string; fic: boolean | string; fta: boolean | string };
const COMPARE: Row[] = [
  { label: "Foundations course library", fic: true, fta: true },
  { label: "Kids, teens & adult tracks", fic: true, fta: true },
  { label: "Weekly club rhythm, games & flashcards", fic: true, fta: true },
  { label: "Family progress, XP & badges", fic: true, fta: true },
  { label: "Club community room", fic: true, fta: true },
  { label: "6-week live trading curriculum", fic: false, fta: true },
  { label: "Priority live classes, Q&A & recordings", fic: false, fta: true },
  { label: "Trading simulator drills + coach feedback", fic: false, fta: true },
  { label: "Private FTA community room", fic: false, fta: true },
  { label: "Premium FTA family badge", fic: false, fta: true },
  { label: "Billing", fic: "$99/mo", fta: "$2,997 once" },
];

const FAQ = [
  {
    q: "How much time does it take?",
    a: "It's a focused 6-week cohort. Plan on one live class each week plus practice on your own schedule. Every class is recorded in the app, so you're never locked out if life gets busy — you move at your family's pace.",
  },
  {
    q: "Who is this for?",
    a: "Complete beginners who want real structure, and returning learners who want to go from foundations to actually trade ready. It's built adult-first, with the whole family coming along.",
  },
  {
    q: "Are my kids included?",
    a: "Yes. FTA is family-wide — one upgrade covers every member. Kids and teens inherit FTA automatically and each stays on the track built for their age. Nothing extra to buy per child.",
  },
  {
    q: "What happens to my Club membership?",
    a: "It keeps going, right alongside FTA. Your Club billing and everything in it stays exactly as it is — FTA simply adds the advanced program on top. You lose nothing.",
  },
  {
    q: "Is it really live, or just videos?",
    a: "Both. Classes are taught live on Zoom so you can ask questions in the moment, and every session is recorded and stored in-app so you can rewatch any lesson whenever you need it.",
  },
  {
    q: "What if I need a refund?",
    a: "Reach out through the community or reply to your onboarding email and we'll take care of you. We'd rather make it right than keep a family that isn't a fit.",
  },
];

type NextClass = { title: string; when: string } | null;

export default function UpgradePage() {
  const router = useRouter();
  const supabase = createClient();
  const reduce = useReducedMotion();
  const [tier, setTier] = useState<FamilyTier | null>(null);
  // FTA Club clock (migration 127): a lapsed FTA family keeps academy access for
  // life but its Club membership has ended — the fta panel shows a $99/mo renewal.
  const [clubLapsed, setClubLapsed] = useState(false);
  const [nextClass, setNextClass] = useState<NextClass>(null);
  // Solo (individual, non-parent) member — a family of one. Softens the
  // family-assuming pitch copy without touching the data model.
  const [isSolo, setIsSolo] = useState(false);

  // Reduced-motion / no-JS-safe reveal: when the viewer prefers reduced motion
  // we return NO motion props so cards render fully visible immediately. When
  // motion is fine we animate on MOUNT (not whileInView) so content is never
  // stuck invisible below the fold or in a static/full-page capture.
  const rise = (i = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: i * 0.05 },
        };

  // Billing is parent-only — children never see upgrade/billing.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // getSession reads the local session (no network round-trip) — far
      // faster than getUser() on the first paint of this conversion screen.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        // No session shouldn't happen behind the dashboard guard, but never
        // hang on grey — show the FIC-first join page.
        if (!cancelled) setTier("free");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, family_id")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      if (profile?.role === "child") {
        router.replace("/dashboard");
        return;
      }
      if (profile?.family_id) {
        const { data: fp } = await supabase
          .from("family_profiles")
          .select("household, completed_at")
          .eq("family_id", profile.family_id)
          .maybeSingle();
        if (!cancelled) setIsSolo(isSoloProfile(fp));
      }
      const { tier: t, clubLapsed: lapsed } = await getFamilyTierState(
        supabase,
        profile?.family_id
      );
      if (cancelled) return;
      setClubLapsed(lapsed);
      // FTA families get a "next live class" pointer beneath their panel —
      // one cheap query, only for the tier that shows it.
      if (t === "fta") {
        const { data: s } = await supabase
          .from("live_sessions")
          .select("title, scheduled_at")
          .eq("status", "scheduled")
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!cancelled && s?.scheduled_at) {
          setNextClass({
            title: s.title,
            when: new Date(s.scheduled_at).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }),
          });
        }
      }
      if (!cancelled) setTier(t);
    }
    load();
    // Never let the page hang on grey — fall back to the FIC-first join view
    // (the most common + most conversion-important viewer) after 5s.
    const fallback = setTimeout(() => {
      if (!cancelled) setTier((prev) => prev ?? "free");
    }, 5000);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Umbrella brand door (Cheat Code Club). A solo/individual member joins "Cheat
  // Code Club"; a family joins the "Family Investing Club" door of the SAME $99
  // membership. The Stripe link is unchanged either way.
  const mode = modeFromSolo(isSolo);
  const clubName = mode === "individual" ? "Cheat Code Club" : "Family Investing Club";
  const clubChip = mode === "individual" ? "Club" : "FIC";

  if (tier === null) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  // ── FTA families: premium status, not a sales pitch ──
  if (tier === "fta") {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Lapsed Club window (migration 127) — academy stays for life; Club
            continues at $99/mo. Honest, non-nagging, above the premium panel. */}
        {clubLapsed && (
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="paper-card p-6 sm:p-7 mb-4 border-l-4 border-gold-400"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-gold-600" />
              <span className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-gold-700">
                Your Academy access is safe — forever
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-ink">
              Keep your Club membership
            </h2>
            <p className="text-sm text-soft leading-relaxed mt-2">
              Your 12 months of Cheat Code Club that came with the Academy have
              wrapped. Family Trading Academy — every course, recording and the
              FTA room — stays yours for life. Keep the Club layer (Kai, the
              community, the watchlist, alerts and the screener) going for
              $99/mo whenever you&apos;re ready.
            </p>
            <a
              href={FIC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-button mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
            >
              Keep your Club membership — $99/mo
              <ArrowRight className="w-4 h-4" />
            </a>
          </m.div>
        )}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="paper-card p-8 ring-2 ring-gold-400 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center mx-auto mb-4 shadow-soft">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="font-display text-2xl font-bold text-ink">
              You&apos;re an FTA family
            </h1>
            <TierBadge tier="fta" size="md" />
          </div>
          <p className="text-soft text-sm max-w-md mx-auto">
            {TIER_CONFIG.fta.name} — your whole family has full access to
            everything, including all of {clubName}.
          </p>

          <div className="grid sm:grid-cols-2 gap-2.5 text-left mt-6 mb-8">
            {FTA_UPGRADE_BENEFITS.map((f) => (
              <div key={f} className="flex items-start gap-2 text-sm">
                <BadgeCheck className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
                <span className="text-midnight-200">{f}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/courses"
              className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
            >
              <CalendarDays className="w-4 h-4" />
              Continue the program
            </Link>
            <Link
              href="/live-sessions"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm border border-sand text-ink hover:bg-paper transition-colors font-display font-semibold"
            >
              <Video className="w-4 h-4" />
              Live classes
            </Link>
          </div>
        </m.div>

        {/* ── Next value: what to do next, not a dead-end ── */}
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="paper-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Video className="w-4 h-4 text-gold-600" />
              <span className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
                Your next live class
              </span>
            </div>
            {nextClass ? (
              <>
                <p className="font-display font-bold text-ink text-sm leading-snug">
                  {nextClass.title}
                </p>
                <p className="text-xs text-soft mt-1">{nextClass.when}</p>
              </>
            ) : (
              <p className="text-sm text-soft leading-relaxed">
                No class on the calendar yet — your coach posts the next session
                in Live Classes. Recordings are always waiting there too.
              </p>
            )}
            <Link
              href="/live-sessions"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-display font-semibold text-gold-700 hover:text-gold-800"
            >
              Open Live Classes
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="paper-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-4 h-4 text-gold-600" />
              <span className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
                The six-week program
              </span>
            </div>
            <p className="text-sm text-soft leading-relaxed">
              Pick up where {isSolo ? "you" : "your family"} left off — foundations
              to trade ready, at your own pace.
            </p>
            <Link
              href="/courses"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-display font-semibold text-gold-700 hover:text-gold-800"
            >
              Continue the program
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-soft mt-6">
          Questions about your membership? Reach out to your coach in the
          community.
        </p>
      </div>
    );
  }

  // ── FREE members: FIC-first. Their next decision is $99/mo, not $2,997. ──
  if (tier === "free") {
    return (
      <div className="max-w-5xl mx-auto">
        {/* ── FIC HERO ─────────────────────────────────────────────────── */}
        <m.section
          {...(reduce
            ? {}
            : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } })}
          className="night-island relative overflow-hidden px-6 py-12 sm:px-12 sm:py-16 text-center"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(60% 50% at 50% 0%, rgba(251,191,36,0.18), transparent 70%)",
            }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/15 text-gold-300 text-[11px] font-display font-bold uppercase tracking-[0.14em]">
              <Sparkles className="w-3 h-3" />
              {clubName}
            </span>
            <h1 className="mt-5 font-display text-3xl sm:text-5xl font-bold text-white leading-[1.05]">
              Join {clubName}
              <br className="hidden sm:block" /> for{" "}
              <span className="text-gradient-gold">$99/mo</span>.
            </h1>
            <p className="mt-5 text-white/70 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              You&apos;re exploring free. Joining opens Kai, your AI analyst,
              full research pages and the screener, the community room, live
              classes, every course &mdash; and Family Mode is included the
              moment you want it. One membership.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={FIC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-button w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm"
              >
                Join {clubName} — $99/mo
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#whats-included"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-display font-semibold text-white/90 border border-white/15 hover:bg-white/5 transition-colors"
              >
                See what&apos;s included
              </a>
            </div>
            <p className="mt-4 text-xs text-white/45">
              Monthly, cancel anytime · Your whole family included · Keep your
              free progress
            </p>
          </div>
        </m.section>

        {/* ── FIC OUTCOME STRIP ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { k: "Kai AI", v: "Your built-in analyst" },
            { k: "Research", v: "Every ticker + screener" },
            { k: "Live classes", v: "Coached, every week" },
            { k: "Family Mode", v: "Included, no extra cost" },
          ].map((s) => (
            <div key={s.k} className="paper-card p-4 text-center">
              <div className="font-display text-base font-bold text-ink leading-snug">
                {s.k}
              </div>
              <div className="text-xs text-soft mt-0.5 leading-snug">{s.v}</div>
            </div>
          ))}
        </div>

        {/* ── WHAT $99 UNLOCKS ─────────────────────────────────────────── */}
        <section id="whats-included" className="mt-14 scroll-mt-6">
          <SectionHead
            eyebrow="What you unlock"
            title="Everything the Club opens up"
            sub={
              mode === "individual"
                ? "You keep the free sampler either way — joining unlocks the full membership, and Family Mode is there the moment you want it."
                : "You keep the free sampler either way — joining unlocks the full experience for the whole family."
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIC_PILLARS.map((p, i) => (
              <m.div key={p.title} {...rise(i)} className="paper-card p-6">
                <div className="w-11 h-11 rounded-xl bg-chip-amber text-gold-800 flex items-center justify-center mb-4">
                  <p.icon className="w-5 h-5" />
                </div>
                <h3 className="font-display text-base font-bold text-ink">
                  {p.title}
                </h3>
                <p className="text-sm text-soft leading-relaxed mt-1.5">
                  {p.body}
                </p>
              </m.div>
            ))}
          </div>
        </section>

        {/* ── FINAL FIC CTA BAND ───────────────────────────────────────── */}
        <section className="mt-14">
          <m.div
            {...rise()}
            className="paper-card ring-2 ring-gold-400 p-8 sm:p-10 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center mx-auto mb-5 shadow-soft">
              <Users className="w-7 h-7" />
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
              Join {clubName}
            </h2>
            <p className="text-soft text-sm mt-3 max-w-md mx-auto leading-relaxed">
              One membership. Kai AI, research, live classes, the community room,
              every course — {mode === "individual"
                ? "and Family Mode the moment you want it."
                : "for your whole family."}
            </p>
            <div className="mt-4 flex items-baseline justify-center gap-2">
              <span className="font-display text-4xl font-bold text-ink">
                $99
              </span>
              <span className="text-sm text-soft">/mo · cancel anytime</span>
            </div>
            <a
              href={FIC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-button mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm"
            >
              Join the club
              <ArrowRight className="w-4 h-4" />
            </a>
            <p className="mt-5 text-xs text-soft max-w-md mx-auto">
              Checkout opens securely with Stripe in a new tab.
            </p>
          </m.div>
        </section>

        {/* ── COMPARISON ───────────────────────────────────────────────── */}
        <section className="mt-14">
          <SectionHead
            eyebrow={`${clubChip} vs FTA`}
            title="Where the Club can take you"
            sub="Start with the Club at $99/mo. When you're ready to go all the way to trade ready, FTA is the advanced add-on."
          />
          <div className="paper-card overflow-hidden">
            <div className="grid grid-cols-[1fr_60px_60px] sm:grid-cols-[1fr_120px_120px] items-stretch border-b border-sand bg-paper">
              <div className="px-4 py-3 text-xs font-display font-bold uppercase tracking-wider text-soft flex items-center">
                Included
              </div>
              <div className="px-2 py-3 text-center text-xs font-display font-bold text-gold-800 bg-chip-amber flex items-center justify-center">
                {clubChip}
              </div>
              <div className="px-2 py-3 text-center text-xs font-display font-bold text-soft flex items-center justify-center">
                FTA
              </div>
            </div>
            {COMPARE.map((r, i) => (
              <div
                key={r.label}
                className={`grid grid-cols-[1fr_60px_60px] sm:grid-cols-[1fr_120px_120px] items-stretch ${
                  i !== COMPARE.length - 1 ? "border-b border-sand" : ""
                }`}
              >
                <div className="px-4 py-3 text-sm text-midnight-200 flex items-center">
                  {r.label}
                </div>
                <Cell value={r.fic} highlight />
                <Cell value={r.fta} />
              </div>
            ))}
          </div>
        </section>

        {/* ── SECONDARY: FTA "go deeper" tier ──────────────────────────── */}
        <section className="mt-8">
          <div className="paper-card p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center shrink-0 shadow-soft">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-ink">
                  Ready to go all the way?
                </h3>
                <TierBadge tier="fta" size="sm" />
              </div>
              <p className="text-sm text-soft leading-relaxed mt-1">
                Family Trading Academy is the live, 6-week trade-ready program —
                the advanced add-on for {mode === "individual" ? "members" : "families"} who
                want to go beyond the Club. Start with the Club and add it later.
              </p>
            </div>
            <a
              href={FTA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm border border-sand text-ink hover:bg-paper transition-colors font-display font-semibold shrink-0 whitespace-nowrap"
            >
              Explore FTA — $2,997
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>

        {/* ── DISCLAIMER ───────────────────────────────────────────────── */}
        <p className="mt-10 mb-2 text-center text-xs text-soft max-w-2xl mx-auto leading-relaxed flex items-start justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {clubName} is an education platform. Nothing in the app or
            community is financial advice or a promise of results. All in-app
            portfolio activity uses practice money — no live trading, ever.
          </span>
        </p>
      </div>
    );
  }

  // ── FIC families: the full marketing / sales page for FTA ──
  return (
    <div className="max-w-5xl mx-auto">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <m.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="night-island relative overflow-hidden px-6 py-12 sm:px-12 sm:py-16 text-center"
      >
        {/* soft gold glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(251,191,36,0.18), transparent 70%)",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/15 text-gold-300 text-[11px] font-display font-bold uppercase tracking-[0.14em]">
            <Sparkles className="w-3 h-3" />
            Family Trading Academy
          </span>
          <h1 className="mt-5 font-display text-3xl sm:text-5xl font-bold text-white leading-[1.05]">
            Go from investing club
            <br className="hidden sm:block" /> to{" "}
            <span className="text-gradient-gold">trade ready</span> in six weeks.
          </h1>
          <p className="mt-5 text-white/70 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            {isSolo ? "You already know" : "Your family already knows"} the
            foundations. FTA is the live, guided 6-week program that takes a real
            beginner all the way to a written plan and a trading routine
            {isSolo ? "" : " — together"}, with a coach.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={FTA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-button w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm"
            >
              Upgrade to FTA — $2,997
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#whats-inside"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-display font-semibold text-white/90 border border-white/15 hover:bg-white/5 transition-colors"
            >
              See what&apos;s inside
            </a>
          </div>
          <p className="mt-4 text-xs text-white/45">
            One-time payment · Your $99/mo {clubName} keeps going ·
            Whole family included
          </p>
        </div>
      </m.section>

      {/* ── OUTCOME STRIP ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        {[
          { k: "6 weeks", v: "Beginner to trade ready" },
          { k: "Live", v: "Weekly Zoom classes" },
          { k: "Every seat", v: "The whole family" },
          { k: "Forever", v: "Recordings in-app" },
        ].map((s) => (
          <div key={s.k} className="paper-card p-4 text-center">
            <div className="font-display text-lg font-bold text-ink">{s.k}</div>
            <div className="text-xs text-soft mt-0.5 leading-snug">{s.v}</div>
          </div>
        ))}
      </div>

      {/* ── WHAT'S INSIDE / PILLARS ──────────────────────────────────────── */}
      <section id="whats-inside" className="mt-14 scroll-mt-6">
        <SectionHead
          eyebrow="What you get"
          title="A real program, not another video dump"
          sub={`Everything below is on top of the ${clubName} you already have.`}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PILLARS.map((p, i) => (
            <m.div key={p.title} {...rise(i)} className="paper-card p-6">
              <div className="w-11 h-11 rounded-xl bg-chip-amber text-gold-800 flex items-center justify-center mb-4">
                <p.icon className="w-5 h-5" />
              </div>
              <h3 className="font-display text-base font-bold text-ink">
                {p.title}
              </h3>
              <p className="text-sm text-soft leading-relaxed mt-1.5">
                {p.body}
              </p>
            </m.div>
          ))}
        </div>
      </section>

      {/* ── CURRICULUM / SIX WEEKS ───────────────────────────────────────── */}
      <section className="mt-14">
        <SectionHead
          eyebrow="The six weeks"
          title="A clear path from zero"
          sub="Each week builds on the last — foundations, then charts, then risk, then a plan you actually trade."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CURRICULUM.map((w, i) => (
            <m.div
              key={w.week}
              {...rise(i % 3)}
              className="paper-card p-5 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
                  {w.week}
                </span>
                <div className="w-9 h-9 rounded-lg bg-paper border border-sand text-gold-700 flex items-center justify-center">
                  <w.icon className="w-4 h-4" />
                </div>
              </div>
              <h3 className="font-display text-base font-bold text-ink leading-snug">
                {w.title}
              </h3>
              <p className="text-sm text-soft leading-relaxed mt-1.5">
                {w.body}
              </p>
            </m.div>
          ))}
        </div>
      </section>

      {/* ── COMPARISON ───────────────────────────────────────────────────── */}
      <section className="mt-14">
        <SectionHead
          eyebrow={`${clubChip} vs FTA`}
          title="What actually changes when you add FTA"
          sub="You keep everything in your Club membership. FTA adds the advanced, live, trade-ready layer on top."
        />
        <div className="paper-card overflow-hidden">
          {/* header row */}
          <div className="grid grid-cols-[1fr_60px_60px] sm:grid-cols-[1fr_120px_120px] items-stretch border-b border-sand bg-paper">
            <div className="px-4 py-3 text-xs font-display font-bold uppercase tracking-wider text-soft flex items-center">
              Included
            </div>
            <div className="px-2 py-3 text-center text-xs font-display font-bold text-soft flex items-center justify-center">
              {clubChip}
            </div>
            <div className="px-2 py-3 text-center text-xs font-display font-bold text-gold-800 bg-chip-amber flex items-center justify-center">
              FTA
            </div>
          </div>
          {COMPARE.map((r, i) => (
            <div
              key={r.label}
              className={`grid grid-cols-[1fr_60px_60px] sm:grid-cols-[1fr_120px_120px] items-stretch ${
                i !== COMPARE.length - 1 ? "border-b border-sand" : ""
              }`}
            >
              <div className="px-4 py-3 text-sm text-midnight-200 flex items-center">
                {r.label}
              </div>
              <Cell value={r.fic} />
              <Cell value={r.fta} highlight />
            </div>
          ))}
        </div>
      </section>

      {/* ── HONEST OUTCOME FRAMING ───────────────────────────────────────── */}
      <section className="mt-14">
        <div className="night-island px-6 py-10 sm:px-12 text-center">
          <Trophy className="w-8 h-8 text-gold-400 mx-auto mb-4" />
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white max-w-2xl mx-auto leading-tight">
            You finish with a written plan, a routine, and reps on the simulator
            — not a promise.
          </h2>
          <p className="text-white/60 text-sm mt-4 max-w-xl mx-auto leading-relaxed">
            We don&apos;t sell outcomes or profits. We give {isSolo ? "you" : "your family"} the
            skills, the structure, and a coach who shows up live — the same
            foundation every serious trader has to build first.
          </p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="mt-14">
        <SectionHead
          eyebrow="Questions"
          title="The things families ask first"
        />
        <div className="grid grid-cols-1 gap-3 max-w-3xl mx-auto">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="paper-card p-5 group [&_svg.chev]:open:rotate-90"
            >
              <summary className="flex items-start gap-3 cursor-pointer list-none">
                <HelpCircle className="w-4 h-4 text-gold-600 shrink-0 mt-1" />
                <span className="font-display font-semibold text-ink text-sm flex-1">
                  {f.q}
                </span>
                <ArrowRight className="chev w-4 h-4 text-soft shrink-0 mt-0.5 transition-transform" />
              </summary>
              <p className="text-sm text-soft leading-relaxed mt-3 pl-7">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA BAND ───────────────────────────────────────────────── */}
      <section className="mt-14">
        <m.div
          {...rise()}
          className="paper-card ring-2 ring-gold-400 p-8 sm:p-10 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center mx-auto mb-5 shadow-soft">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            Take the whole family trade ready
          </h2>
          <p className="text-soft text-sm mt-3 max-w-md mx-auto leading-relaxed">
            One payment. Six weeks, live. Everyone under your roof — and your
            {" "}{clubName} keeps running right alongside it.
          </p>
          <div className="mt-4 flex items-baseline justify-center gap-2">
            <span className="font-display text-4xl font-bold text-ink">
              $2,997
            </span>
            <span className="text-sm text-soft">one-time</span>
          </div>
          <a
            href={FTA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-button mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm"
          >
            Upgrade to FTA
            <ArrowRight className="w-4 h-4" />
          </a>
          <p className="mt-5 text-xs text-soft max-w-md mx-auto">
            Checkout opens securely with Stripe in a new tab. During the beta,
            your upgrade is activated on your account manually right after
            checkout.{" "}
            <a
              href={FIC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-700 hover:text-gold-800 font-semibold"
            >
              Manage {clubChip} billing
            </a>
          </p>
        </m.div>
      </section>

      {/* ── DISCLAIMER ───────────────────────────────────────────────────── */}
      <p className="mt-10 mb-2 text-center text-xs text-soft max-w-2xl mx-auto leading-relaxed flex items-start justify-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Family Trading Academy is an education program. Nothing in the
          program, app, or community is financial advice or a promise of
          results. All in-app portfolio activity uses practice money — no live
          trading, ever.
        </span>
      </p>
    </div>
  );
}

// ── small helpers ─────────────────────────────────────────────────────────────

function SectionHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="text-center mb-6">
      <span className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-gold-700">
        {eyebrow}
      </span>
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink mt-1.5">
        {title}
      </h2>
      {sub && (
        <p className="text-soft text-sm mt-2.5 max-w-xl mx-auto leading-relaxed">
          {sub}
        </p>
      )}
    </div>
  );
}

function Cell({
  value,
  highlight,
}: {
  value: boolean | string;
  highlight?: boolean;
}) {
  if (typeof value === "string") {
    return (
      <div
        className={`px-2 py-3 flex items-center justify-center text-center text-xs sm:text-sm font-display font-bold ${
          highlight ? "bg-chip-amber/40 text-gold-800" : "text-soft"
        }`}
      >
        {value}
      </div>
    );
  }
  return (
    <div
      className={`px-2 py-3 flex items-center justify-center ${
        highlight ? "bg-chip-amber/40" : ""
      }`}
    >
      {value ? (
        <Check
          className={`w-4 h-4 ${highlight ? "text-gold-700" : "text-green-600"}`}
        />
      ) : (
        <X className="w-4 h-4 text-midnight-600/50" />
      )}
    </div>
  );
}
