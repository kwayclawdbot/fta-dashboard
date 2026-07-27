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
 *   "full"  — a centered paper-card that replaces a locked page (the default).
 *   "band"  — a compact horizontal card for inline locks (a locked room, a
 *             member-only action, the journey's final step).
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
    eyebrow: "A member feature",
    title: "This is part of the club",
    body: "Join the Cheat Code Club to unlock the full experience — the whole family, one membership.",
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
        className={`paper-card p-5 flex flex-wrap items-center gap-x-4 gap-y-3 ring-1 ring-gold-300 ${className}`}
      >
        <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-gold-700" />
        </div>
        <div className="flex-1 min-w-[8rem]">
          <p className="font-display font-semibold text-ink">{c.title}</p>
          <p className="text-sm text-soft leading-snug">{c.body}</p>
        </div>
        <a
          href={FIC_CHECKOUT_URL}
          className="cta-button inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs shrink-0 whitespace-nowrap w-full sm:w-auto"
        >
          {c.cta} <ArrowRight className="w-3.5 h-3.5" />
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
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <Link
          href="/courses"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-display font-semibold text-ink border border-sand hover:bg-card transition-colors"
        >
          <BookOpen className="w-4 h-4 text-gold-600" /> Free courses
        </Link>
        <Link
          href="/community"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-display font-semibold text-ink border border-sand hover:bg-card transition-colors"
        >
          <MessageCircle className="w-4 h-4 text-gold-600" /> Community
        </Link>
      </div>

      <Link
        href="/upgrade"
        className="mt-4 inline-flex items-center justify-center gap-1.5 text-xs text-gold-700 font-semibold"
      >
        <Sparkles className="w-3.5 h-3.5" /> See everything membership includes
      </Link>
    </LockedState>
  );
}
