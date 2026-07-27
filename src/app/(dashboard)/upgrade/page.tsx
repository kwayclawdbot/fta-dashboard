"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m, useReducedMotion } from "@/lib/motion";
import {
  Check,
  X,
  ArrowRight,
  Users,
  GraduationCap,
  CalendarDays,
  Video,
  BadgeCheck,
  Rocket,
  ShieldCheck,
  MessagesSquare,
  LineChart,
  Layers,
  Target,
  Compass,
  BookOpen,
  Bot,
  Telescope,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTierState, TIER_CONFIG, type FamilyTier } from "@/lib/tier";
import { isSoloProfile } from "@/lib/register";
import { modeFromSolo } from "@/lib/mode";
import TierBadge from "@/components/TierBadge";
import { DisplayHead, SectionRule, TextAction } from "@/components/f0/parts";

/**
 * /upgrade — the commercial surface. Three viewers: an FTA family (status), a
 * free member (the $99/mo Club pitch) and a Club family (the $2,997 FTA pitch).
 *
 * REBUILD NOTE (canvas): this page carries commercial and regulated copy. EVERY
 * price, plan name, entitlement line, FAQ answer, billing note and disclaimer
 * below is byte-identical to the previous revision — nothing was reworded,
 * reordered, added or dropped. What changed is the surface only: the card grids
 * became hairline ledgers, the comparison became a real table, the second
 * night-island became a composed statement (one dark object per surface), and
 * white-on-gold fills became night-950 on gold.
 */

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
  // we return NO motion props so content renders fully visible immediately. When
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
      <div className="mx-auto flex max-w-4xl items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-500" />
      </div>
    );
  }

  // ── FTA families: premium status, not a sales pitch ──
  if (tier === "fta") {
    return (
      <div className="mx-auto max-w-2xl pb-14">
        {/* Lapsed Club window (migration 127) — academy stays for life; Club
            continues at $99/mo. Honest, non-nagging, above the premium panel. */}
        {clubLapsed && (
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 border-l-[3px] border-gold-500 pl-5"
          >
            <p className="flex items-center gap-2 text-eyebrow font-display font-bold uppercase text-gold-700">
              <ShieldCheck className="h-4 w-4" />
              Your Academy access is safe — forever
            </p>
            <h2 className="mt-3 font-display text-display-3 font-extrabold text-ink">
              Keep your Club membership
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-soft">
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
              className="cta-button f0-focus f0-press mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
            >
              Keep your Club membership — $99/mo
              <ArrowRight className="h-4 w-4" />
            </a>
          </m.div>
        )}

        <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <DisplayHead
            eyebrow="Your membership"
            title="You're an FTA family"
            lede={`${TIER_CONFIG.fta.name} — your whole family has full access to everything, including all of ${clubName}.`}
            aside={<TierBadge tier="fta" size="md" />}
          />
        </m.div>

        <section className="mt-9">
          <SectionRule>What you have</SectionRule>
          <div className="f0-ledger mt-1">
            {FTA_UPGRADE_BENEFITS.map((f) => (
              <div key={f} className="f0-ledger-row">
                <BadgeCheck className="h-4 w-4 shrink-0 text-gold-700" />
                <span className="text-[15px] text-ink">{f}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/courses"
            className="cta-button f0-focus f0-press inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
          >
            <CalendarDays className="h-4 w-4" />
            Continue the program
          </Link>
          <Link
            href="/live-sessions"
            className="f0-focus f0-press inline-flex items-center gap-2 rounded-xl border border-sand px-5 py-2.5 font-display text-sm font-semibold text-ink transition-colors hover:bg-card"
          >
            <Video className="h-4 w-4" />
            Live classes
          </Link>
        </div>

        {/* ── Next value: what to do next, not a dead-end ── */}
        <section className="mt-11">
          <SectionRule>Where to go next</SectionRule>
          <div className="f0-ledger mt-1">
            <div className="py-5">
              <p className="flex items-center gap-2 text-eyebrow font-display font-bold uppercase text-gold-700">
                <Video className="h-4 w-4" />
                Your next live class
              </p>
              {nextClass ? (
                <>
                  <p className="mt-2 font-display text-[17px] font-extrabold leading-snug text-ink">
                    {nextClass.title}
                  </p>
                  <p className="mt-1 font-mono text-[13px] text-soft">
                    {nextClass.when}
                  </p>
                </>
              ) : (
                <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-soft">
                  No class on the calendar yet — your coach posts the next session
                  in Live Classes. Recordings are always waiting there too.
                </p>
              )}
              <div className="mt-3">
                <TextAction href="/live-sessions">
                  Open Live Classes
                  <ArrowRight className="h-3.5 w-3.5" />
                </TextAction>
              </div>
            </div>

            <div className="py-5">
              <p className="flex items-center gap-2 text-eyebrow font-display font-bold uppercase text-gold-700">
                <GraduationCap className="h-4 w-4" />
                The six-week program
              </p>
              <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-soft">
                Pick up where {isSolo ? "you" : "your family"} left off — foundations
                to trade ready, at your own pace.
              </p>
              <div className="mt-3">
                <TextAction href="/courses">
                  Continue the program
                  <ArrowRight className="h-3.5 w-3.5" />
                </TextAction>
              </div>
            </div>
          </div>
        </section>

        <p className="f0-rule-top mt-10 pt-5 text-xs text-soft">
          Questions about your membership? Reach out to your coach in the
          community.
        </p>
      </div>
    );
  }

  // ── FREE members: FIC-first. Their next decision is $99/mo, not $2,997. ──
  if (tier === "free") {
    return (
      <div className="mx-auto max-w-4xl pb-14">
        {/* ── FIC HERO — the one dark object on this surface ─────────────── */}
        <m.section
          {...(reduce
            ? {}
            : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } })}
          className="f0-hero-field f0-grain px-6 py-12 sm:px-12 sm:py-16"
        >
          <p className="text-eyebrow font-display font-bold uppercase text-volt-300">
            {clubName}
          </p>
          <h1 className="mt-4 max-w-[16ch] font-display text-display-1 font-extrabold leading-[0.95] sm:text-[3.25rem]">
            Join {clubName} for{" "}
            <span className="text-gradient-gold">$99/mo</span>.
          </h1>
          <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed text-white/70 sm:text-base">
            You&apos;re exploring free. Joining opens Kai, your AI analyst,
            full research pages and the screener, the community room, live
            classes, every course &mdash; and Family Mode is included the
            moment you want it. One membership.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <a
              href={FIC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-button f0-focus f0-press inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-sm"
            >
              Join {clubName} — $99/mo
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#whats-included"
              className="f0-focus f0-press inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 font-display text-sm font-semibold text-white/90 transition-colors hover:bg-white/5"
            >
              See what&apos;s included
            </a>
          </div>
          <p className="mt-4 text-xs text-white/45">
            Monthly, cancel anytime · Your whole family included · Keep your
            free progress
          </p>
        </m.section>

        {/* ── FIC OUTCOME STRIP ────────────────────────────────────────── */}
        <div className="mt-8">
          <TermStrip
            items={[
              { k: "Kai AI", v: "Your built-in analyst" },
              { k: "Research", v: "Every ticker + screener" },
              { k: "Live classes", v: "Coached, every week" },
              { k: "Family Mode", v: "Included, no extra cost" },
            ]}
          />
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
          <div className="f0-ledger mt-2">
            {FIC_PILLARS.map((p, i) => (
              <m.div key={p.title} {...rise(i)} className="flex gap-4 py-5">
                <p.icon className="mt-0.5 h-5 w-5 shrink-0 text-gold-700" />
                <div className="min-w-0">
                  <h3 className="font-display text-[17px] font-extrabold text-ink">
                    {p.title}
                  </h3>
                  <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-soft">
                    {p.body}
                  </p>
                </div>
              </m.div>
            ))}
          </div>
        </section>

        {/* ── FINAL FIC CTA BAND ───────────────────────────────────────── */}
        <m.section {...rise()} className="mt-14 border-l-[3px] border-gold-500 pl-5 sm:pl-7">
          <p className="flex items-center gap-2 text-eyebrow font-display font-bold uppercase text-gold-700">
            <Users className="h-4 w-4" />
            Join today
          </p>
          <h2 className="mt-3 font-display text-display-2 font-extrabold text-ink">
            Join {clubName}
          </h2>
          <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-soft">
            One membership. Kai AI, research, live classes, the community room,
            every course — {mode === "individual"
              ? "and Family Mode the moment you want it."
              : "for your whole family."}
          </p>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-display text-display-1 font-extrabold text-ink">
              $99
            </span>
            <span className="text-sm text-soft">/mo · cancel anytime</span>
          </div>
          <a
            href={FIC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-button f0-focus f0-press mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-sm"
          >
            Join the club
            <ArrowRight className="h-4 w-4" />
          </a>
          <p className="mt-5 max-w-md text-xs text-soft">
            Checkout opens securely with Stripe in a new tab.
          </p>
        </m.section>

        {/* ── COMPARISON ───────────────────────────────────────────────── */}
        <section className="mt-14">
          <SectionHead
            eyebrow={`${clubChip} vs FTA`}
            title="Where the Club can take you"
            sub="Start with the Club at $99/mo. When you're ready to go all the way to trade ready, FTA is the advanced add-on."
          />
          <CompareTable clubChip={clubChip} highlight="fic" />
        </section>

        {/* ── SECONDARY: FTA "go deeper" tier ──────────────────────────── */}
        <section className="f0-rule-top mt-10 flex flex-col gap-5 pt-8 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[17px] font-extrabold text-ink">
                Ready to go all the way?
              </h3>
              <TierBadge tier="fta" size="sm" />
            </div>
            <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-soft">
              Family Trading Academy is the live, 6-week trade-ready program —
              the advanced add-on for {mode === "individual" ? "members" : "families"} who
              want to go beyond the Club. Start with the Club and add it later.
            </p>
          </div>
          <a
            href={FTA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="f0-focus f0-press inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-sand px-5 py-3 font-display text-sm font-semibold text-ink transition-colors hover:bg-card"
          >
            Explore FTA — $2,997
            <ArrowRight className="h-4 w-4" />
          </a>
        </section>

        {/* ── DISCLAIMER ───────────────────────────────────────────────── */}
        <p className="f0-rule-top mt-12 flex max-w-[64ch] items-start gap-2 pt-5 text-xs leading-relaxed text-soft">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
    <div className="mx-auto max-w-4xl pb-14">
      {/* ── HERO — the one dark object on this surface ──────────────────── */}
      <m.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="f0-hero-field f0-grain px-6 py-12 sm:px-12 sm:py-16"
      >
        <p className="text-eyebrow font-display font-bold uppercase text-volt-300">
          Family Trading Academy
        </p>
        <h1 className="mt-4 max-w-[18ch] font-display text-display-1 font-extrabold leading-[0.95] sm:text-[3.25rem]">
          Go from investing club to{" "}
          <span className="text-gradient-gold">trade ready</span> in six weeks.
        </h1>
        <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed text-white/70 sm:text-base">
          {isSolo ? "You already know" : "Your family already knows"} the
          foundations. FTA is the live, guided 6-week program that takes a real
          beginner all the way to a written plan and a trading routine
          {isSolo ? "" : " — together"}, with a coach.
        </p>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <a
            href={FTA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-button f0-focus f0-press inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-sm"
          >
            Upgrade to FTA — $2,997
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#whats-inside"
            className="f0-focus f0-press inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 font-display text-sm font-semibold text-white/90 transition-colors hover:bg-white/5"
          >
            See what&apos;s inside
          </a>
        </div>
        <p className="mt-4 text-xs text-white/45">
          One-time payment · Your $99/mo {clubName} keeps going ·
          Whole family included
        </p>
      </m.section>

      {/* ── OUTCOME STRIP ────────────────────────────────────────────────── */}
      <div className="mt-8">
        <TermStrip
          items={[
            { k: "6 weeks", v: "Beginner to trade ready" },
            { k: "Live", v: "Weekly Zoom classes" },
            { k: "Every seat", v: "The whole family" },
            { k: "Forever", v: "Recordings in-app" },
          ]}
        />
      </div>

      {/* ── WHAT'S INSIDE / PILLARS ──────────────────────────────────────── */}
      <section id="whats-inside" className="mt-14 scroll-mt-6">
        <SectionHead
          eyebrow="What you get"
          title="A real program, not another video dump"
          sub={`Everything below is on top of the ${clubName} you already have.`}
        />
        <div className="f0-ledger mt-2">
          {PILLARS.map((p, i) => (
            <m.div key={p.title} {...rise(i)} className="flex gap-4 py-5">
              <p.icon className="mt-0.5 h-5 w-5 shrink-0 text-gold-700" />
              <div className="min-w-0">
                <h3 className="font-display text-[17px] font-extrabold text-ink">
                  {p.title}
                </h3>
                <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-soft">
                  {p.body}
                </p>
              </div>
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
        <div className="f0-ledger mt-2">
          {CURRICULUM.map((w, i) => (
            <m.div key={w.week} {...rise(i % 3)} className="flex gap-4 py-5">
              <w.icon className="mt-1 h-5 w-5 shrink-0 text-gold-700" />
              <div className="min-w-0">
                <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
                  {w.week}
                </p>
                <h3 className="mt-1.5 font-display text-[17px] font-extrabold leading-snug text-ink">
                  {w.title}
                </h3>
                <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-soft">
                  {w.body}
                </p>
              </div>
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
        <CompareTable clubChip={clubChip} highlight="fta" />
      </section>

      {/* ── HONEST OUTCOME FRAMING ───────────────────────────────────────── */}
      {/* Was a second night-island; one dark object per surface, so the promise
          now lands as composed type on the paper. */}
      <section className="mt-16 border-l-[3px] border-gold-500 pl-5 sm:pl-7">
        <h2 className="max-w-[24ch] font-display text-display-2 font-extrabold leading-tight text-ink">
          You finish with a written plan, a routine, and reps on the simulator
          — not a promise.
        </h2>
        <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-soft">
          We don&apos;t sell outcomes or profits. We give {isSolo ? "you" : "your family"} the
          skills, the structure, and a coach who shows up live — the same
          foundation every serious trader has to build first.
        </p>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="mt-16">
        <SectionHead eyebrow="Questions" title="The things families ask first" />
        <div className="f0-ledger mt-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="f0-focus flex cursor-pointer list-none items-start gap-3 py-4">
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-soft transition-transform group-open:rotate-90 motion-reduce:transform-none" />
                <span className="flex-1 font-display text-[15px] font-extrabold text-ink">
                  {f.q}
                </span>
              </summary>
              <p className="max-w-[62ch] pb-4 pl-7 text-sm leading-relaxed text-soft">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA BAND ───────────────────────────────────────────────── */}
      <m.section {...rise()} className="mt-16 border-l-[3px] border-gold-500 pl-5 sm:pl-7">
        <p className="flex items-center gap-2 text-eyebrow font-display font-bold uppercase text-gold-700">
          <GraduationCap className="h-4 w-4" />
          The advanced upgrade
        </p>
        <h2 className="mt-3 font-display text-display-2 font-extrabold text-ink">
          Take the whole family trade ready
        </h2>
        <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-soft">
          One payment. Six weeks, live. Everyone under your roof — and your
          {" "}{clubName} keeps running right alongside it.
        </p>
        <div className="mt-5 flex items-baseline gap-2">
          <span className="font-display text-display-1 font-extrabold text-ink">
            $2,997
          </span>
          <span className="text-sm text-soft">one-time</span>
        </div>
        <a
          href={FTA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-button f0-focus f0-press mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-sm"
        >
          Upgrade to FTA
          <ArrowRight className="h-4 w-4" />
        </a>
        <p className="mt-5 max-w-[62ch] text-xs leading-relaxed text-soft">
          Checkout opens securely with Stripe in a new tab. During the beta,
          your upgrade is activated on your account manually right after
          checkout.{" "}
          <a
            href={FIC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gold-700 hover:text-gold-600"
          >
            Manage {clubChip} billing
          </a>
        </p>
      </m.section>

      {/* ── DISCLAIMER ───────────────────────────────────────────────────── */}
      <p className="f0-rule-top mt-12 flex max-w-[64ch] items-start gap-2 pt-5 text-xs leading-relaxed text-soft">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
    <div className="mb-6">
      <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
        {eyebrow}
      </p>
      <h2 className="mt-2.5 font-display text-display-2 font-extrabold text-ink">
        {title}
      </h2>
      {sub && (
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-soft">
          {sub}
        </p>
      )}
    </div>
  );
}

/** The outcome strip: four terms separated by hairlines, sitting directly on
 *  the paper. Deliberately NOT four bordered tiles. */
function TermStrip({ items }: { items: { k: string; v: string }[] }) {
  return (
    <div className="flex flex-col divide-y divide-sand sm:flex-row sm:divide-x sm:divide-y-0">
      {items.map((s, i) => (
        <div
          key={s.k}
          className={`min-w-0 flex-1 py-3 sm:py-0 ${i > 0 ? "sm:pl-5" : ""} ${
            i < items.length - 1 ? "sm:pr-5" : ""
          }`}
        >
          <p className="font-display text-[17px] font-extrabold leading-tight text-ink">
            {s.k}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-soft">{s.v}</p>
        </div>
      ))}
    </div>
  );
}

/** The binding comparison. A real <table> — aligned columns are the point, so
 *  this is a data table, not a card grid. The recommended column is carried by
 *  a brand-tinted header and gold marks, never by an extra box. */
function CompareTable({
  clubChip,
  highlight,
}: {
  clubChip: string;
  highlight: "fic" | "fta";
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-sand">
            <th className="py-3 pr-3 text-left text-eyebrow font-display font-bold uppercase text-soft">
              Included
            </th>
            <th
              className={`w-20 px-2 py-3 text-center font-display text-xs font-bold sm:w-28 ${
                highlight === "fic" ? "text-gold-700" : "text-soft"
              }`}
            >
              {clubChip}
            </th>
            <th
              className={`w-20 px-2 py-3 text-center font-display text-xs font-bold sm:w-28 ${
                highlight === "fta" ? "text-gold-700" : "text-soft"
              }`}
            >
              FTA
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARE.map((r, i) => (
            <tr
              key={r.label}
              className={i !== COMPARE.length - 1 ? "border-b border-sand/60" : ""}
            >
              <td className="py-3 pr-3 align-middle text-[14px] text-ink">
                {r.label}
              </td>
              <Cell value={r.fic} highlight={highlight === "fic"} />
              <Cell value={r.fta} highlight={highlight === "fta"} />
            </tr>
          ))}
        </tbody>
      </table>
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
      <td
        className={`px-2 py-3 text-center align-middle font-display text-xs font-bold sm:text-sm ${
          highlight ? "bg-gold-400/[0.08] text-gold-700" : "text-soft"
        }`}
      >
        {value}
      </td>
    );
  }
  return (
    <td
      className={`px-2 py-3 text-center align-middle ${
        highlight ? "bg-gold-400/[0.08]" : ""
      }`}
    >
      {value ? (
        <Check
          className={`mx-auto h-4 w-4 ${highlight ? "text-gold-700" : "text-ink"}`}
        />
      ) : (
        <X className="mx-auto h-4 w-4 text-soft/50" />
      )}
    </td>
  );
}
