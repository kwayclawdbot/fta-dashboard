/**
 * ENTITLEMENTS — contextual paywall copy (binding, VERBATIM from
 * MONETIZATION-GATES.md "PAYWALL UX"). Every gate names exactly what's missing —
 * never a generic "Upgrade to Pro". Compliance framing (attention/intelligence,
 * never advice) rides along everywhere.
 *
 * The four canonical walls are reproduced word-for-word. Other club features get
 * specific-but-derived copy in the same voice. `{TICKER}` in the Club
 * Intelligence line is substituted at render time.
 */
import type { Feature } from "@/lib/entitlements/features";

export interface WallCopy {
  /** Eyebrow / kicker. */
  eyebrow: string;
  title: string;
  body: string;
  /** Primary CTA label. */
  cta: string;
}

/** The Cheat Code Club price point, reused in CTAs. */
export const CLUB_PRICE = "$99/mo";

/**
 * The four CANONICAL walls, verbatim. These strings must not be edited without
 * an owner sign-off — they are the ratified conversion copy.
 */
export const KAI_WATCH_WALL =
  "Let Kai watch this for you — Club members ask Kai to monitor stocks 24/7 and get alerted when something important changes. Unlock Kai Watch — $99/mo";

export const FAMILY_WALL =
  "Bring your family into the Club — add your kids and spouse, create family watchlists and track everyone's progress, included with your membership. Unlock Family Mode";

/** {TICKER} is replaced at render time. */
export const CLUB_INTELLIGENCE_WALL =
  "See why {TICKER} is moving up the Club — unlock attention history, sentiment changes and the signals driving today's score. Unlock Club Intelligence";

export const RESEARCH_METER_WALL =
  "You've used your weekly research passes. Upgrade to unlock unlimited Club Research.";

/** Per-feature wall content. */
export const FEATURE_WALL: Record<Feature, WallCopy> = {
  kai_watch: {
    eyebrow: "Kai Watch",
    title: "Let Kai watch this for you",
    body: "Club members ask Kai to monitor stocks 24/7 and get alerted when something important changes.",
    cta: "Unlock Kai Watch — $99/mo",
  },
  club_intel: {
    eyebrow: "Club Intelligence",
    title: "See why it's moving up the Club",
    body: "Unlock attention history, sentiment changes and the signals driving today's score.",
    cta: "Unlock Club Intelligence",
  },
  trending_full: {
    eyebrow: "Trending in the Club",
    title: "See the full attention rankings",
    body: "Free members see the top 5. Club members get the full rankings plus 14-day history — which names the Club is watching, and how that's shifting.",
    cta: "Unlock full rankings",
  },
  sentiment_detailed: {
    eyebrow: "Community sentiment",
    title: "See how the mood is shifting",
    body: "Club members see detailed sentiment trends with 24-hour and 7-day change — not just today's split.",
    cta: "Unlock sentiment trends",
  },
  kai_brief: {
    eyebrow: "Kai Brief",
    title: "What changed since you left",
    body: "Kai catches you up every visit — the moves, news and Club shifts that matter to your stocks. A Club member feature.",
    cta: "Unlock Kai Brief",
  },
  foryou_deep: {
    eyebrow: "For You",
    title: "A Home built around you",
    body: "Club members get a deeply personalized Home — your stocks, your Club, your Kai — instead of the general view.",
    cta: "Unlock personalization",
  },
  research_unlimited: {
    eyebrow: "Club Research",
    title: "You've used your weekly research passes",
    body: "Upgrade to unlock unlimited Club Research — every premium piece, every week.",
    cta: "Unlock unlimited research",
  },
  publish_thesis: {
    eyebrow: "Publish research",
    title: "Publish a structured thesis",
    body: "Club members publish a full Research Object — catalysts, risks, valuation and time horizon — with thesis tracking and performance over time.",
    cta: "Unlock thesis publishing",
  },
  watchlist_unlimited: {
    eyebrow: "Intelligent Watchlist",
    title: "An unlimited, watched watchlist",
    body: "Club members track unlimited tickers with Kai Watch, community deltas, news summaries and sentiment shifts on every one.",
    cta: "Unlock the Intelligent Watchlist",
  },
  kai_chat_full: {
    eyebrow: "Ask Kai",
    title: "Ask Kai as much as you like",
    body: "Free members get a few questions a day. Club members get much higher limits — Kai as your everyday analyst.",
    cta: "Unlock more Kai",
  },
  kai_research_full: {
    eyebrow: "Kai deep research",
    title: "Full deep-stock research",
    body: "Club members get Kai's full company deep-dives — fundamentals, the story, and what the Club is seeing.",
    cta: "Unlock deep research",
  },
  screener_full: {
    eyebrow: "Stock Finder",
    title: "Scan the whole market",
    body: "Club members get the full screener plus AI search — every filter, sort and saved scan. Free members get the basic filters.",
    cta: "Unlock the full screener",
  },
  news_personalized: {
    eyebrow: "Your news",
    title: "News tuned to your stocks",
    body: "Club members get news personalized to their watchlist and holdings — not just the general feed.",
    cta: "Unlock personalized news",
  },
  simulator_advanced: {
    eyebrow: "Simulator",
    title: "Go beyond the starter portfolio",
    body: "Club members get advanced stats, unlimited portfolios, family portfolios and challenges — the free $10K portfolio is just the start.",
    cta: "Unlock the full simulator",
  },
  learning_full: {
    eyebrow: "The full library",
    title: "Every lesson, live classes & recordings",
    body: "Club members unlock the complete course library plus weekly live classes and the recording archive.",
    cta: "Unlock every lesson",
  },
  live_sessions_full: {
    eyebrow: "Live Club sessions",
    title: "Join live — and the full archive",
    body: "Club members join the weekly live sessions and get the full recording archive. Free members get preview clips.",
    cta: "Join the live sessions",
  },
  weekly_picks_full: {
    eyebrow: "Weekly Club research",
    title: "See the full weekly research",
    body: "Club members get the full weekly Club research and picks. Free members get a delayed preview.",
    cta: "Unlock weekly research",
  },
  family_activation: {
    eyebrow: "Family Mode",
    title: "Bring your family into the Club",
    body: "Add your kids and spouse, create family watchlists and track everyone's progress — included with your membership.",
    cta: "Unlock Family Mode",
  },
  fta_section: {
    eyebrow: "Family Trading Academy",
    title: "Go all the way to trade-ready",
    body: "FTA is the advanced 6-week live trading academy — a separate upgrade on top of your Club membership.",
    cta: "Explore FTA",
  },
};

/** Resolve the wall copy for a feature, substituting {TICKER} where present. */
export function wallFor(feature: Feature, ticker?: string): WallCopy {
  const base = FEATURE_WALL[feature];
  if (ticker && feature === "club_intel") {
    return { ...base, title: `See why ${ticker} is moving up the Club` };
  }
  return base;
}
