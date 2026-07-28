"use client";

import Link from "next/link";
import LockedState from "./LockedState";
import {
  ArrowRight,
  Sparkles,
  BookOpen,
  Eye,
  Target,
  Layers,
  Video,
  Gem,
  LineChart,
  Trophy,
  Gamepad2,
  MessageCircle,
  Telescope,
  Gift,
  Compass,
  Users,
  type LucideIcon,
} from "lucide-react";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";

/**
 * The ONE upsell surface for the free tier. Every locked door in the app renders
 * this with a `context` — never a bespoke copy-pasted div. Copy is adult-first
 * and education-first: confident, warm, no fake urgency, no countdowns. It always
 * names exactly what's behind the door, then offers the forward path (join the Club).
 *
 * Variants:
 *   "full"  — the shared `LockedState` (the board's tinted accent card) that
 *             replaces a locked page (the default).
 *   "band"  — a compact NEUTRAL `.club-b-card` row for inline locks (a locked
 *             room, a member-only action, the journey's final step). Neutral by
 *             design: only ONE object per screen may carry the warm tint, and on
 *             a page that still has its own content, that object is not the band.
 *
 * CANVAS v2: the band was the pre-canvas paper card with a gold ring and a gradient
 * `.cta-button`. It is now the board's white card — hairline `--sand` border,
 * 14px radius — with a round orange `.club-b-orb` glyph and a solid orange
 * button. Every word of every context below is untouched.
 */

export type UpsellContext =
  | "generic"
  | "simulator"
  | "screener"
  | "watchlist"
  | "missions"
  | "flashcards"
  | "live"
  | "progress"
  | "trend-or-trap"
  | "courses"
  | "lesson"
  | "pick"
  | "pick-engage"
  | "fic-club"
  | "community"
  | "leaderboard"
  | "referrals"
  | "start-here"
  | "parent-corner"
  | "journey-final";

interface ContextCopy {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
}

const CONTEXT: Record<UpsellContext, ContextCopy> = {
  generic: {
    icon: Sparkles,
    eyebrow: "Cheat Code Club",
    title: "This room is for Club members",
    body: "Cheat Code Club membership opens every room in here — the library, the tools, the weekly live classes and the members' side of the community. One membership covers everyone under your roof.",
    cta: "Join the Club — $99/mo",
  },
  simulator: {
    icon: LineChart,
    eyebrow: "Members practice here",
    title: "The trading simulator",
    body: "Practice with pretend money on a live-feeling market — place orders, manage a portfolio, and learn how a trade actually plays out before any real money is involved. It opens the moment you join.",
    cta: "Unlock the simulator — join the Club",
  },
  screener: {
    icon: Telescope,
    eyebrow: "Members research here",
    title: "The stock screener",
    body: "Scan the whole market the way members do — filter by the fundamentals and momentum that matter, sort the results, and find the companies worth studying. It opens the moment you join.",
    cta: "Unlock the screener — join the Club",
  },
  watchlist: {
    icon: Eye,
    eyebrow: "Members research here",
    title: "The family watchlist",
    body: "Build a shared watchlist your whole family studies together — track the companies you use every day, write down why you're watching, and share your thinking in the club.",
    cta: "Unlock the watchlist — join the Club",
  },
  missions: {
    icon: Target,
    eyebrow: "For the kids in the club",
    title: "Kid missions",
    body: "Guided, hands-on missions turn each week's concept into something your kids actually do — earning progress and badges as the whole family learns together.",
    cta: "Unlock missions — join the Club",
  },
  flashcards: {
    icon: Layers,
    eyebrow: "Members review here",
    title: "Daily flashcards",
    body: "A daily set of five cards keeps every concept fresh with spaced repetition — the quiet habit that makes the lessons stick.",
    cta: "Unlock flashcards — join the Club",
  },
  live: {
    icon: Video,
    eyebrow: "Members meet here weekly",
    title: "Live member classes",
    body: "Join the weekly live class where the team teaches one concept, studies one company, and takes your questions in real time — plus the full library of past recordings.",
    cta: "Join the live classes — join the Club",
  },
  progress: {
    icon: Trophy,
    eyebrow: "Members track this",
    title: "Progress & badges",
    body: "Follow your streaks, XP, and the professional-title badges your family earns as you learn — a clear map of how far you've come.",
    cta: "Unlock your progress — join the Club",
  },
  "trend-or-trap": {
    icon: Gamepad2,
    eyebrow: "A members' game",
    title: "Trend or Trap",
    body: "Read the pattern and call it — is price really trending, or is it a trap? A fast, addictive way to train your eye. Club members play the full set of practice games; Candle Battle is yours to play free right now.",
    cta: "Play the full set — join the Club",
  },
  courses: {
    icon: BookOpen,
    eyebrow: "The full library",
    title: "The rest of the course library",
    body: "Your free sampler is just the start. Members get every lesson across the adult, teen, and kids tracks — the complete path from first principles to your first trade.",
    cta: "Unlock every lesson — join the Club",
  },
  lesson: {
    icon: BookOpen,
    eyebrow: "A member lesson",
    title: "This lesson is part of the club",
    body: "You've got three lessons free to try. This one is part of the full library — members unlock every lesson across all three tracks.",
    cta: "Unlock every lesson — join the Club",
  },
  pick: {
    icon: Gem,
    eyebrow: "Why we picked it",
    title: "Read the full thesis",
    body: "See exactly how the team thinks about this company — the full write-up, the video breakdown, and the research links. It's how members learn to study a company for themselves.",
    cta: "Unlock the thesis — join the Club",
  },
  "pick-engage": {
    icon: MessageCircle,
    eyebrow: "Members discuss here",
    title: "Join the conversation",
    body: "Members like and discuss every pick together — share what you noticed, ask questions, and learn from other families.",
    cta: "Join the Club to comment",
  },
  "fic-club": {
    icon: MessageCircle,
    eyebrow: "The members' room",
    title: "Club chat",
    body: "The members' room is where families talk shop all week. You're welcome in the Free Lounge anytime — join to jump into the club.",
    cta: "Join the club",
  },
  community: {
    icon: MessageCircle,
    eyebrow: "You're viewing as a free member",
    title: "Post, like, and comment",
    body: "Join the Club to share wins, ask questions, and talk with the community — not just read along.",
    cta: "Join the Club",
  },
  leaderboard: {
    icon: Trophy,
    eyebrow: "Where the club stands",
    title: "The member leaderboard",
    body: "Every member's XP, belts and streaks, ranked this week, this month and all time — the standings that tell you who's actually doing the work, and where your family sits among them.",
    cta: "See the standings — join the Club",
  },
  referrals: {
    icon: Gift,
    eyebrow: "Members bring members",
    title: "The referral program",
    body: "Members get a personal invite link, credit for every family who joins through it, and a running view of who accepted — the club grows by word of mouth, and members are paid for the mouth.",
    cta: "Unlock referrals — join the Club",
  },
  "start-here": {
    icon: Compass,
    eyebrow: "Your first week",
    title: "The guided orientation",
    body: "A short, ordered path through the club — what to read first, which lesson to start, how to set up your watchlist, and what to do each week so nobody has to guess where to begin.",
    cta: "Start the orientation — join the Club",
  },
  "parent-corner": {
    icon: Users,
    eyebrow: "For the parent running the household",
    title: "The parent's corner",
    body: "See what each of your kids has actually learned — lessons finished, research done, verdicts reached — plus the conversation prompts and guardrails you set for them.",
    cta: "Unlock the parent's corner — join the Club",
  },
  "journey-final": {
    icon: Sparkles,
    eyebrow: "You've seen what's inside",
    title: "Unlock everything — join the Club",
    body: "One membership opens the full library, the family watchlist, the simulator, the weekly live classes, and every game — for everyone under your roof.",
    cta: "Join the Club — $99/mo",
  },
};

export default function UpsellCard({
  context = "generic",
  variant = "full",
  className = "",
}: {
  context?: UpsellContext;
  variant?: "full" | "band";
  className?: string;
}) {
  const c = CONTEXT[context] ?? CONTEXT.generic;
  const Icon = c.icon;

  if (variant === "band") {
    // Robust to narrow slots: the row wraps (icon+text stay together, the CTA
    // drops to full-width beneath) rather than squeezing the copy to one word
    // per line or overlapping the button when the container is constrained
    // below the card's natural width (UX audit #5).
    return (
      <div
        className={`club-b-card flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 ${className}`}
      >
        <span className="club-b-orb h-10 w-10 shrink-0">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-[8rem] flex-1">
          <p className="font-display text-[14px] font-extrabold uppercase leading-tight tracking-[-0.01em] text-ink">
            {c.title}
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-soft">{c.body}</p>
        </div>
        <a
          href={FIC_CHECKOUT_URL}
          className="f0-focus f0-press inline-flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-4 py-2.5 font-display text-[12px] font-extrabold uppercase tracking-[0.05em] text-[color:var(--accent-on)] sm:w-auto"
        >
          {c.cta} <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  // The free-tier door is now just the shared LockedState with free-tier copy,
  // the external FIC-checkout CTA, and the free-tier-only secondary links.
  return (
    <LockedState
      icon={Icon}
      eyebrow={c.eyebrow}
      title={c.title}
      body={c.body}
      cta={{ label: c.cta, href: FIC_CHECKOUT_URL, external: true }}
      className={className}
    >
      {/* Tertiary doors: the board's hairline white card button. */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Link
          href="/courses"
          className="club-b-card f0-focus f0-press inline-flex items-center justify-center gap-1.5 px-3 py-2.5 font-display text-[12.5px] font-bold text-ink"
        >
          <BookOpen className="h-4 w-4 text-accent" aria-hidden /> Free courses
        </Link>
        <Link
          href="/community"
          className="club-b-card f0-focus f0-press inline-flex items-center justify-center gap-1.5 px-3 py-2.5 font-display text-[12.5px] font-bold text-ink"
        >
          <MessageCircle className="h-4 w-4 text-accent" aria-hidden /> Community
        </Link>
      </div>

      <Link
        href="/upgrade"
        className="f0-focus mt-3.5 inline-flex items-center gap-1.5 rounded-md text-[12px] font-semibold text-accent"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> See everything membership includes
      </Link>
    </LockedState>
  );
}
