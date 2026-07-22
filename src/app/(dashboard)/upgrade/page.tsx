"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTier, TIER_CONFIG, type FamilyTier } from "@/lib/tier";
import TierBadge from "@/components/TierBadge";

const FIC_URL = "https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a";
const FTA_URL = "https://buy.stripe.com/9B6aEXdbt9pH2Sw8hlbEA0b";

// What moving up to FTA actually unlocks — mirrors the TIER_ACCESS matrix.
const FTA_UPGRADE_BENEFITS = [
  "Everything in Family Investing Club",
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
    body: "Unlock the private FTA room alongside your FIC club — a smaller room for families going all the way to trade ready.",
  },
  {
    icon: Users,
    title: "Your whole family, included",
    body: "One upgrade covers everyone. Kids and teens inherit FTA automatically — each on the track that fits their age.",
  },
];

type Row = { label: string; fic: boolean | string; fta: boolean | string };
const COMPARE: Row[] = [
  { label: "Foundations course library", fic: true, fta: true },
  { label: "Kids, teens & adult tracks", fic: true, fta: true },
  { label: "Weekly club rhythm, games & flashcards", fic: true, fta: true },
  { label: "Family progress, XP & badges", fic: true, fta: true },
  { label: "FIC community club room", fic: true, fta: true },
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
    q: "What happens to my FIC membership?",
    a: "It keeps going, right alongside FTA. Your Family Investing Club billing and everything in it stays exactly as it is — FTA simply adds the advanced program on top. You lose nothing.",
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

export default function UpgradePage() {
  const router = useRouter();
  const supabase = createClient();
  const [tier, setTier] = useState<FamilyTier | null>(null);

  // Billing is parent-only — children never see upgrade/billing.
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, family_id")
        .eq("id", user.id)
        .single();
      if (profile?.role === "child") {
        router.replace("/dashboard");
        return;
      }
      setTier(await getFamilyTier(supabase, profile?.family_id));
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <motion.div
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
            everything, including all of the Family Investing Club.
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
        </motion.div>

        <p className="text-center text-xs text-soft mt-6">
          Questions about your membership? Reach out to your coach in the
          community.
        </p>
      </div>
    );
  }

  // ── FIC families: the full marketing / sales page for FTA ──
  return (
    <div className="max-w-5xl mx-auto">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <motion.section
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
            Your family already knows the foundations. FTA is the live, guided
            6-week program that takes a real beginner all the way to a written
            plan and a trading routine — together, with a coach.
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
            One-time payment · Your $99/mo Family Investing Club keeps going ·
            Whole family included
          </p>
        </div>
      </motion.section>

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
          sub="Everything below is on top of the Family Investing Club you already have."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.05 }}
              className="paper-card p-6"
            >
              <div className="w-11 h-11 rounded-xl bg-chip-amber text-gold-800 flex items-center justify-center mb-4">
                <p.icon className="w-5 h-5" />
              </div>
              <h3 className="font-display text-base font-bold text-ink">
                {p.title}
              </h3>
              <p className="text-sm text-soft leading-relaxed mt-1.5">
                {p.body}
              </p>
            </motion.div>
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
            <motion.div
              key={w.week}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: (i % 3) * 0.05 }}
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
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── COMPARISON ───────────────────────────────────────────────────── */}
      <section className="mt-14">
        <SectionHead
          eyebrow="FIC vs FTA"
          title="What actually changes when you upgrade"
          sub="You keep everything in your club. FTA adds the advanced, live, trade-ready layer on top."
        />
        <div className="paper-card overflow-hidden">
          {/* header row */}
          <div className="grid grid-cols-[1fr_60px_60px] sm:grid-cols-[1fr_120px_120px] items-stretch border-b border-sand bg-paper">
            <div className="px-4 py-3 text-xs font-display font-bold uppercase tracking-wider text-soft flex items-center">
              Included
            </div>
            <div className="px-2 py-3 text-center text-xs font-display font-bold text-soft flex items-center justify-center">
              FIC
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
            We don&apos;t sell outcomes or profits. We give your family the
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
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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
            Family Investing Club keeps running right alongside it.
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
              Manage FIC billing
            </a>
          </p>
        </motion.div>
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
