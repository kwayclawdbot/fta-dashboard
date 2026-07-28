"use client";

/**
 * AppTour — first-login interactive walkthrough (v2, Lane 7B).
 *
 * Spotlights real UI (sidebar links on desktop, tab bar + belt chip on phones)
 * with a dimmed overlay + positioned coach card. Role-AND-tier-aware steps
 * (kid / teen / parent, plus an FTA-section step for FTA families). Kids never
 * see locked/upsell surfaces.
 *
 * Versioning: completion is stored in profiles.tour_completed_at (migration 041)
 * AND profiles.tour_version (migration 107). Brand-new members (no
 * tour_completed_at) get the tour with "welcome" framing; members who finished
 * the pre-redesign v1 tour (tour_completed_at set, tour_version < 2) get the
 * refreshed tour ONCE with "see what's new" framing, then it never re-imposes.
 * Replayable via /dashboard?tour=1 (Settings has a link). The measure-then-clamp
 * placement machinery (pixel-fixed at 1440 / 390 / 320) is unchanged.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, m } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import Celebrate, { type CelebrateOptions } from "@/components/fic/Celebrate";
import { deriveRegister, celebrateRegister, type Register } from "@/lib/register";
import type { FamilyTier } from "@/lib/tier";

// Bump this when the tour materially changes so existing members see it once
// more. Kept in sync with profiles.tour_version (migration 107).
//
// v3 (Cheat Code Club redesign, R2): the five-item nav. Club (individual)
// members get the refreshed tour ONCE with "what's new" framing — the nav is a
// real change for them (Discover, elevated Community, Kai moved to a floating
// button, Profile/More). FAMILY members' nav is essentially unchanged (a single
// Discover row was added), so re-touring them would be noise: they are silently
// advanced to v3 without re-firing (see the auto-run decision below).
const CURRENT_TOUR_VERSION = 3;

// The moment the v3 (Cheat Code Club) redesign shipped to production. It is the
// cutoff that separates a genuine RETURNING member (who used a pre-redesign app
// and for whom "here's what's new" is true) from a member who only ever knew the
// new app. Any account created on/after this date has no "old app" memory, so it
// must NEVER be shown the stale "we redesigned the club" what's-new overlay —
// even if it carries a stale tour_version (e.g. a v2-era completion, or a seeded
// test profile). Those accounts are silently advanced to CURRENT instead.
//
// This fixes the reported bug: brand-new / recently-created accounts firing the
// "what's new" tour on first login purely because their tour_version < 3.
const TOUR_V3_LAUNCH_AT = Date.parse("2026-07-24T00:00:00Z");
// Per-device fast-path cache of the highest tour version seen (skips the DB
// round trip once this device has seen the current tour).
const LSV_KEY = "fic-tour-v";
// Live-tour progress (step index + framing), persisted so a route change or a
// hard reload mid-tour resumes exactly where it left off.
const LS_PROGRESS = "fic-tour-progress";

// Each tour step SHOWS a real page: the tour navigates here before spotlighting.
// A step whose route is /dashboard stays put (welcome / done / belt chip).
const STEP_ROUTE: Record<string, string> = {
  welcome: "/dashboard",
  starthere: "/start-here",
  discover: "/discover",
  community: "/community",
  watchlist: "/watchlist/community",
  screener: "/screener",
  kai: "/kai",
  // The club "meet Kai" step spotlights the floating FAB, which is HIDDEN on
  // /kai — so it stays on /dashboard where the FAB is visible.
  kaifloat: "/dashboard",
  missions: "/missions",
  practice: "/chart",
  belts: "/leaderboard",
  family: "/family/overview",
  profile: "/dashboard",
  fta: "/fta/chat",
  done: "/dashboard",
  // ── Challenge walkthrough (Lane C9b) ──
  ch_welcome: "/dashboard",
  ch_sessions: "/courses",
  ch_progress: "/progress",
  vip_room: "/vip-room",
  ch_done: "/dashboard",
};

// The intro-post micro-commitment (mirrors the C7 thank-you). Completing the
// challenge tour lands the member on the community composer, pre-seeded.
const CHALLENGE_INTRO =
  "Hi everyone — just joined the 5-Day Investing Challenge! 👋 A bit about me (or my family / crew): \n\nOne money habit I want to build by Day 5: ";
const CHALLENGE_INTRO_HREF = `/community?compose=${encodeURIComponent(CHALLENGE_INTRO)}`;

type Framing = "welcome" | "whatsnew";

interface TourStep {
  key: string;
  /** Candidate targets, first visible wins. No match → centered card. */
  targets?: string[];
  title: string;
  body: string;
  emoji: string;
}

interface TourUser {
  display_name?: string;
  role?: string;
  age_group?: string;
  track?: string;
  tier?: FamilyTier;
  /** Solo (individual, non-parent) member — a family of one. De-parents copy. */
  isSolo?: boolean;
  /** 5-Day Challenge pass holder → the challenge-flavored walkthrough. */
  isChallenge?: boolean;
  /** VIP ticket holder → adds the VIP-room stop to the challenge tour. */
  isVip?: boolean;
}

/**
 * Register- AND tier-differentiated tour for the redesigned app. Every step
 * carries per-register copy (kid / teen / adult) and each persona walks an
 * ordered SUBSET of the current nav:
 *   • kid   → play/earn loop, no locked or upsell surfaces
 *   • teen  → research + rank framing
 *   • adult → full orientation incl. Start Here + Family
 * FTA families additionally get the gold FTA-section step. The `framing`
 * swaps only the first/last step copy (welcome vs. "what's new" for returning
 * members). Register comes from the shared register.ts derivation.
 */
/**
 * Challenge-flavored walkthrough (Lane C9b) for 5-Day Challenge pass holders.
 * Warm, zero-jargon, compliance floor. Frames the app around the cohort and
 * routes: Community → Watchlist (Day-1 quick-win seed) → Kai → sessions/materials
 * → progress/belts, plus a VIP-room stop for VIPs, ending on the intro-post
 * micro-commitment. Register-agnostic (challenge registrants are adults).
 */
function buildChallengeSteps(u: TourUser): TourStep[] {
  const first = (u.display_name || "").split(" ")[0];
  const S: Record<string, TourStep> = {
    ch_welcome: {
      key: "ch_welcome",
      emoji: "👋",
      title: first ? `Welcome to the Club, ${first}!` : "Welcome to the Club!",
      body: "You're in the 5-Day Investing Challenge — and your full access is already open. Your cohort kicks off Sept 1, with live sessions Wed–Sun at 7 PM ET. Let me show you the five places you'll actually use this week — takes about a minute.",
    },
    community: {
      key: "community",
      targets: ['[data-tour="nav:/community"]', '[data-tour="tab:/community"]'],
      emoji: "💬",
      title: "This is where your cohort lives",
      body: "The Community is home base all week — say hi, share what you're finding, and cheer each other on. At the end of this tour we'll help you post a quick intro so the room knows you're here.",
    },
    watchlist: {
      key: "watchlist",
      targets: ['[data-tour="nav:/watchlist/community"]', '[data-tour="tab:/watchlist/community"]', '[data-tour="tab:more"]'],
      emoji: "🔎",
      title: "Add your first company",
      body: "The Watchlist is the club's shared board of companies we're following. Adding one company you already know — a store you shop at, a phone you use — is the perfect way to walk into Day 1 ready. It's for learning, never a buy list.",
    },
    kai: {
      key: "kai",
      targets: ['[data-tour="nav:/kai"]', '[data-tour="kai-float"]', '[data-tour="tab:more"]'],
      emoji: "🤖",
      title: "Meet Kai — ask your first question",
      body: "Kai is your friendly research helper. Ask what a company does, and Kai explains it in plain English. Try one question about the company you just watched. Kai teaches and researches — it never gives buy/sell advice.",
    },
    ch_sessions: {
      key: "ch_sessions",
      targets: ['[data-tour="nav:/courses"]', '[data-tour="tab:more"]'],
      emoji: "🎓",
      title: "Where your sessions & materials live",
      body: "Your live sessions run Wed–Sun at 7 PM ET, and the recordings plus each day's materials show up right here. Miss one? It'll be waiting for you — nothing to lose.",
    },
    ch_progress: {
      key: "ch_progress",
      targets: ['[data-tour="nav:/progress"]', '[data-tour="belt"]', '[data-tour="tab:more"]'],
      emoji: "🥋",
      title: "How your progress works",
      body: "Everything you do earns XP, which fills your belt — White on up. It's a simple, no-pressure way to see how far you've come through the week. Show up, do the small daily thing, watch it climb.",
    },
    vip_room: {
      key: "vip_room",
      targets: ['[data-tour="nav:/vip-room"]', '[data-tour="tab:more"]'],
      emoji: "🎟️",
      title: "Your VIP room & replays",
      body: "As a VIP, you've got a private room and replays of every live session right here. It's a quieter space to ask questions and share what you're working on. Your printed textbook is on its way too.",
    },
    ch_done: {
      key: "ch_done",
      emoji: "🚀",
      title: first ? `You're all set, ${first}.` : "You're all set!",
      body: "That's the whole map. One last thing that really helps — let's post a quick intro so your cohort can say hi back. It takes 20 seconds, and people who introduce themselves on day one are far more likely to finish strong.",
    },
  };

  const order = [
    "ch_welcome",
    "community",
    "watchlist",
    "kai",
    "ch_sessions",
    ...(u.isVip ? ["vip_room"] : []),
    "ch_progress",
    "ch_done",
  ];
  return order.map((k) => S[k]);
}

function buildSteps(u: TourUser, framing: Framing): TourStep[] {
  // Challenge pass holders get the dedicated challenge walkthrough (Lane C9b).
  if (u.isChallenge) return buildChallengeSteps(u);
  const register = deriveRegister(u);
  const first = (u.display_name || "").split(" ")[0];
  const isFta = u.tier === "fta";
  const whatsnew = framing === "whatsnew";
  // Solo only applies to adult owners; kids/teens always belong to a family.
  const solo = !!u.isSolo && register === "adult";
  const pick = <T,>(k: T, t: T, a: T): T =>
    register === "kid" ? k : register === "teen" ? t : a;

  const S: Record<string, TourStep> = {
    welcome: {
      key: "welcome",
      emoji: whatsnew ? "✨" : "👋",
      title: whatsnew
        ? pick(
            "We gave the clubhouse a glow-up!",
            first ? `Welcome back, ${first} — big changes.` : "Welcome back — big changes.",
            first ? `We've redesigned the club, ${first}.` : "We've redesigned the club."
          )
        : pick(
            first ? `Hey ${first}! Ready to explore?` : "Hey! Ready to explore?",
            first ? `Welcome, ${first}.` : "Welcome.",
            first ? `Welcome to the club, ${first}!` : "Welcome to the club!"
          ),
      body: whatsnew
        ? pick(
            "Lots of new things to explore. Let me show you what changed — it's quick, promise.",
            "New home, new tools. Here's a 30-second tour of what changed.",
            "A new Community feed, a shared Watchlist, a Screener, Ask Kai, belts and leaderboards. Here's a quick look at what's new."
          )
        : pick(
            "This is your family's money clubhouse. Let me show you around — it's quick, and there's a surprise at the end!",
            "Your family's home base for learning to invest. A quick tour so you know where everything lives.",
            solo
              ? "Your home for learning to invest. One minute and you'll know exactly where everything lives."
              : "Your family's home for learning money together. One minute and you'll know exactly where everything lives."
          ),
    },
    starthere: {
      key: "starthere",
      targets: ['[data-tour="start-here"]', '[data-tour="nav:/start-here"]', '[data-tour="tab:more"]'],
      emoji: "🧭",
      title: "Start Here is your setup trail",
      body: solo
        ? "A short checklist that gets you fully set up — watch the quick orientation, add your first companies, join your first class. Finish it and celebrate."
        : "A short checklist that gets your family fully set up — watch the quick orientation, add your first companies, join your first class. Finish it and celebrate.",
    },
    discover: {
      key: "discover",
      targets: ['[data-tour="nav:/discover"]', '[data-tour="tab:/discover"]', '[data-tour="tab:more"]'],
      emoji: "🧭",
      title: "Discover",
      body: "Your window into the whole Club — what's trending, the top research, the most-discussed ideas, and the day's news. The AI Stock Finder lives here too.",
    },
    community: {
      key: "community",
      targets: ['[data-tour="nav:/community"]', '[data-tour="tab:/community"]'],
      emoji: "💬",
      title: pick("The clubhouse", "The Community feed", "The Community feed"),
      body: pick(
        "Share what you find and cheer for other families. That big button in the middle is always here.",
        "Where the club talks all week — post picks with live data attached, cheer other families, and open Main Circle around class time.",
        "The heart of the club — a full-width feed for wins and picks, plus a Main Circle chat drawer that slides in around class time."
      ),
    },
    watchlist: {
      key: "watchlist",
      targets: ['[data-tour="nav:/watchlist/community"]', '[data-tour="tab:/watchlist/community"]', '[data-tour="tab:more"]'],
      emoji: "🔎",
      title: "Community Watchlist",
      body: pick(
        "The club's shared list of companies we're all watching. See who's up and who's down.",
        "The club's shared research board — add a company, champion it, and track how every pick does under Performance.",
        "The club's shared research board. Add a company, someone champions it, and the Performance tab tracks how the club's calls play out over time."
      ),
    },
    screener: {
      key: "screener",
      targets: ['[data-tour="nav:/screener"]', '[data-tour="tab:more"]'],
      emoji: "📡",
      title: "The Screener",
      body: pick(
        "",
        "Search all 11,000+ stocks and filter for the ones worth a look — near a high, surging volume, oversold. A tool to find companies to research, never a buy list.",
        "Search the full market — 11,000+ stocks — and filter to a short list worth researching. Preset screens do the work; it's for finding candidates, never a buy list."
      ),
    },
    kai: {
      key: "kai",
      targets: ['[data-tour="nav:/kai"]', '[data-tour="tab:more"]'],
      emoji: "🤖",
      title: pick("Meet Kai", "Ask Kai", "Ask Kai"),
      body: pick(
        "Kai is your friendly research helper. Ask what a company makes and Kai explains it simply.",
        "Your AI research analyst. Ask about any company — Kai explains the business, walks the numbers, and pulls headlines. Research and teaching, not buy/sell calls.",
        "Your AI research analyst. Ask about any company and Kai explains the business, charts the numbers, and surfaces news — educational, never advice."
      ),
    },
    kaifloat: {
      key: "kaifloat",
      targets: ['[data-tour="kai-float"]'],
      emoji: "🤖",
      title: "Meet Kai",
      body: "Your AI research co-pilot now lives on this floating button — tap it from anywhere to ask about a company, walk the numbers, or make sense of the news. Research and teaching, never buy/sell calls.",
    },
    profile: {
      key: "profile",
      targets: ['[data-tour="tab:more"]', '[data-tour="nav:/progress"]', '[data-tour="belt"]'],
      emoji: "👤",
      title: "Profile & everything else",
      body: "Your belt and progress, the leaderboard, Learn, Practice, News, Alerts, referrals and settings all live one tap away here. The essentials are on the bar; everything else is tucked in neatly.",
    },
    missions: {
      key: "missions",
      targets: ['[data-tour="nav:/missions"]', '[data-tour="tab:/missions"]', '[data-tour="tab:more"]'],
      emoji: "🎯",
      title: "Your missions",
      body: pick(
        "Brand Detective, Money Machine, Family CEO… finish missions, earn XP, and move up your belt.",
        "Guided missions that turn concepts into reps — finish them to earn XP toward your next belt.",
        "Guided missions that turn concepts into reps — kids earn XP toward their next belt."
      ),
    },
    practice: {
      key: "practice",
      targets: ['[data-tour="nav:/chart"]', '[data-tour="tab:more"]'],
      emoji: "📈",
      title: pick("The practice zone", "Practice", "Practice"),
      body: pick(
        "Games and a real chart to explore — plus Simbot, a pretend trading room. All practice, zero real money.",
        "A practice chart with live data, the games arcade, and Simbot — a full price-action simulator. Real reps, zero risk.",
        "A practice chart with live data, the games arcade, and Simbot — a hands-on trading simulator on delayed market data. Real reps, zero risk."
      ),
    },
    belts: {
      key: "belts",
      targets: ['[data-tour="belt"]', '[data-tour="nav:/leaderboard"]', '[data-tour="tab:more"]'],
      emoji: "🥋",
      title: pick("Your belt & rank", "Belts & leaderboards", "Belts & leaderboards"),
      body: pick(
        "Earn XP to climb your belt — White, Yellow, Blue, Purple, Black. See how you rank on the Leaderboard!",
        "This chip is your belt — White through Black, filled by XP. The Leaderboard ranks members and families over 7 days, 30 days, and all-time.",
        "That belt chip up top tracks your rank — White to Black — filling as you earn XP. The Leaderboard ranks members and families across 7-day, 30-day, and all-time windows."
      ),
    },
    family: {
      key: "family",
      targets: ['[data-tour="nav:/family"]', '[data-tour="tab:more"]'],
      emoji: "👨‍👩‍👧‍👦",
      title: "Your family, your view",
      body: "Report cards for every child, Parent Corner with this week's dinner-table questions, and invites to bring the rest of the family in — all in one place.",
    },
    account: {
      key: "account",
      targets: ['[data-tour="nav:/progress"]', '[data-tour="tab:more"]'],
      emoji: "👤",
      title: "Your account, your view",
      body: "Your progress and badges live here, plus a link to refer a friend and earn XP. Want to add family later? You can do that from Settings anytime.",
    },
    fta: {
      key: "fta",
      targets: ['[data-tour="nav:/fta/chat"]', '[data-tour="tab:more"]'],
      emoji: "🏆",
      title: "FTA — Trading Academy",
      body: pick(
        "",
        "Your Family Trading Academy hub — the traders chat, the course library, and every live-class recording, all in the gold section.",
        "Your Family Trading Academy hub — the traders chat, the full course library, and every live-class recording, all under the gold section."
      ),
    },
    done: {
      key: "done",
      emoji: "🚀",
      title: whatsnew
        ? pick("You're all caught up!", "All caught up.", "All caught up.")
        : pick("You're in!", "That's the tour.", "That's the tour."),
      body: whatsnew
        ? pick(
            "That's what's new. Everything you already knew is still here — just easier to find.",
            "That's what changed. Everything you knew is still here, just easier to find. Go stack some XP.",
            "That's what's new. Everything you relied on is still here, just easier to find."
          )
        : pick(
            "Time to earn your first XP. Head to This Week and start your first adventure!",
            "Jump in and start stacking XP toward your first belt.",
            solo
              ? "Head to Start Here to finish setting up your account — it takes about ten minutes."
              : "Head to Start Here to finish setting up your family — it takes about ten minutes."
          ),
    },
  };

  // Ordered subsets. FTA families (teens + parents) get the FTA step before the
  // close; kids never see it (no locked/upsell surfaces in the kid tour).
  const order: Record<Register, string[]> = {
    kid: ["welcome", "community", "missions", "kai", "practice", "belts", "done"],
    teen: [
      "welcome",
      "community",
      "watchlist",
      "screener",
      "kai",
      "practice",
      "belts",
      ...(isFta ? ["fta"] : []),
      "done",
    ],
    // Solo (individual/club) adults walk the five-item scheme in nav order:
    // Home → Discover → Community → Watchlist → Kai (floating) → Profile. Family
    // adults keep the pre-redesign flow (their nav is unchanged).
    adult: solo
      ? [
          "welcome",
          "discover",
          "community",
          "watchlist",
          "kaifloat",
          ...(isFta ? ["fta"] : []),
          "profile",
          "done",
        ]
      : [
          "welcome",
          "starthere",
          "community",
          "watchlist",
          "screener",
          "kai",
          "practice",
          "family",
          "belts",
          ...(isFta ? ["fta"] : []),
          "done",
        ],
  };

  return order[register].map((k) => S[k]);
}

interface Rect { top: number; left: number; width: number; height: number }

export default function AppTour({ user }: { user: TourUser }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [celebrate, setCelebrate] = useState<CelebrateOptions | null>(null);
  const stepsRef = useRef<TourStep[]>([]);
  const framingRef = useRef<Framing>("welcome");

  // Persist live progress so a route change or reload mid-tour resumes here.
  const saveProgress = useCallback((i: number, on: boolean) => {
    try {
      if (on) {
        localStorage.setItem(
          LS_PROGRESS,
          JSON.stringify({ v: CURRENT_TOUR_VERSION, idx: i, framing: framingRef.current })
        );
      } else {
        localStorage.removeItem(LS_PROGRESS);
      }
    } catch {
      /* ignore */
    }
  }, []);
  // The auto-run (non-forced) decision must happen at most once per mount, so a
  // benign re-render or query-param change can never restart the tour after the
  // user has seen/finished it. Forced replay (?tour=1) bypasses this guard.
  const autoDecidedRef = useRef(false);

  // ── resume an in-progress tour after a route change / reload ──
  // The tour navigates between pages; on any page it may need to pick up where
  // it left off. Runs once on mount, before the auto-run decision.
  useEffect(() => {
    if (autoDecidedRef.current) return;
    try {
      const raw = localStorage.getItem(LS_PROGRESS);
      if (!raw) return;
      const p = JSON.parse(raw) as { v?: number; idx?: number; framing?: Framing };
      if (p.v !== CURRENT_TOUR_VERSION || typeof p.idx !== "number") return;
      autoDecidedRef.current = true; // we own the decision now
      framingRef.current = p.framing === "whatsnew" ? "whatsnew" : "welcome";
      stepsRef.current = buildSteps(user, framingRef.current);
      const i = Math.max(0, Math.min(p.idx, stepsRef.current.length - 1));
      setIdx(i);
      setActive(true);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── should we run? ──
  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const forced = searchParams.get("tour") === "1";
    if (forced) {
      try { localStorage.removeItem(LSV_KEY); } catch { /* ignore */ }
      autoDecidedRef.current = true; // a manual replay counts as decided
      framingRef.current = "welcome";
      stepsRef.current = buildSteps(user, "welcome");
      setIdx(0);
      setActive(true);
      return;
    }
    // Auto-run is a one-shot per mount: once we've decided (fired or suppressed),
    // never re-evaluate — this is what stops the "re-fires every load" bug.
    if (autoDecidedRef.current) return;
    // NOTE: the old per-DEVICE fast-path (localStorage LSV_KEY) was REMOVED — it
    // suppressed the tour for a second account on a device that had already seen
    // it, which is exactly the invite case (an invitee signing up on a family
    // member's phone got no walkthrough). First-run is now keyed per-PROFILE via
    // profiles.tour_completed_at (checked below), so the tour fires on any device
    // for anyone who has never actually seen it. Toured users have the marker set
    // and are never re-toured.
    autoDecidedRef.current = true;
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("tour_completed_at, tour_version, created_at")
        .eq("id", session.user.id)
        .single();
      if (!mounted || !data) return;
      const seen = data.tour_version ?? 0;
      // A member counts as a genuine "returning" member — one for whom the
      // redesign is actually NEW — only if their account predates the v3 launch.
      // An account created on/after launch never knew the old app, so it must not
      // get the "what's new" overlay no matter what tour_version it carries.
      const createdAt = data.created_at ? Date.parse(data.created_at as string) : Date.now();
      const predatesRedesign = Number.isFinite(createdAt) && createdAt < TOUR_V3_LAUNCH_AT;

      // Brand-new members get the welcome tour; genuinely-returning members who
      // finished an older tour version get the refreshed tour ONCE with "what's
      // new" framing. Everyone at the current version is left alone.
      //
      // v3 gating (per-mode): the redesign's "what's new" pass is a real change
      // only for CLUB (individual) members. FAMILY members' nav is essentially
      // unchanged, so we advance their version silently (no re-tour) — a stored
      // version bump instead of another walkthrough.
      let framing: Framing | null = null;
      if (!data.tour_completed_at) framing = "welcome";
      else if (seen < CURRENT_TOUR_VERSION) {
        if (user.isSolo && predatesRedesign) {
          framing = "whatsnew";
        } else {
          // Not a genuine pre-redesign veteran (a recent/never-saw-old-app
          // account, or a family whose nav is unchanged): silently mark them
          // current so the stale "what's new" tour never imposes.
          try { localStorage.setItem(LSV_KEY, String(CURRENT_TOUR_VERSION)); } catch { /* ignore */ }
          await supabase
            .from("profiles")
            .update({ tour_version: CURRENT_TOUR_VERSION })
            .eq("id", session.user.id);
          return;
        }
      }
      if (framing) {
        framingRef.current = framing;
        stepsRef.current = buildSteps(user, framing);
        setIdx(0);
        // Small delay so the page settles before we spotlight it.
        setTimeout(() => mounted && setActive(true), 1200);
      } else {
        try { localStorage.setItem(LSV_KEY, String(CURRENT_TOUR_VERSION)); } catch { /* ignore */ }
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  const finish = useCallback(async (completed: boolean) => {
    setActive(false);
    setRect(null);
    try {
      localStorage.setItem(LSV_KEY, String(CURRENT_TOUR_VERSION));
      localStorage.removeItem(LS_PROGRESS);
    } catch { /* ignore */ }
    // Signal the FirstRun orchestrator that the walkthrough is done so it can
    // advance to the install + push steps (which come AFTER the tour).
    try {
      window.dispatchEvent(new CustomEvent("fic:tour-finished", { detail: { completed } }));
    } catch { /* ignore */ }
    // Where the tour ends: a completed CHALLENGE tour lands on the community
    // composer, pre-seeded with the intro-post (the micro-commitment). Everyone
    // else returns to the home base.
    const destination =
      completed && user.isChallenge ? CHALLENGE_INTRO_HREF : "/dashboard";
    if (destination !== "/dashboard" || pathname !== "/dashboard") {
      router.push(destination);
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      // Stamp the version so the tour never re-imposes; keep tour_completed_at
      // set (first completion or refreshed) as the human-readable marker.
      await supabase
        .from("profiles")
        .update({
          tour_completed_at: new Date().toISOString(),
          tour_version: CURRENT_TOUR_VERSION,
        })
        .eq("id", session.user.id);
    }
    // Challenge tours skip the celebration — the intro composer IS the reward.
    if (completed && !user.isChallenge) {
      const whatsnew = framingRef.current === "whatsnew";
      setCelebrate({
        variant: "setup",
        register: celebrateRegister(deriveRegister(user)),
        title: whatsnew ? "All caught up!" : "Welcome to the club!",
        subtitle: whatsnew
          ? "You've seen what's new — go earn it."
          : "You know your way around now — go earn it.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pathname, router]);

  // ── locate target for current step (single attempt) ──
  const locate = useCallback((): boolean => {
    const step = stepsRef.current[idx];
    if (!step?.targets?.length) { setRect(null); return true; }
    for (const sel of step.targets) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden";
      if (!visible) continue;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const rr = el.getBoundingClientRect();
      setRect({ top: rr.top, left: rr.left, width: rr.width, height: rr.height });
      return true;
    }
    return false; // not found yet
  }, [idx]);

  // ── per-step: navigate to the step's page, persist progress, then spotlight ──
  // The step declares a route; we push there (if not already there), poll for
  // the anchor while the page renders, and spotlight it. If no anchor ever
  // appears the coach card centers over the real (now-visible) page.
  useEffect(() => {
    if (!active) return;
    const step = stepsRef.current[idx];
    if (!step) return;
    saveProgress(idx, true);

    const route = STEP_ROUTE[step.key] ?? "/dashboard";
    if (pathname !== route) {
      setRect(null);
      router.push(route);
    }

    // Poll for the anchor for a short window while the target page renders.
    let tries = 0;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (locate()) return; // spotlighted
      tries += 1;
      if (tries > 20) { setRect(null); return; } // ~3s → center over the page
      timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, 150);
    };
    raf = requestAnimationFrame(tick);

    const onR = () => locate();
    addEventListener("resize", onR);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") back();
    };
    addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      removeEventListener("resize", onR);
      removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, idx, pathname]);

  const steps = stepsRef.current;
  const step = steps[idx];
  const next = () => (idx >= steps.length - 1 ? finish(true) : setIdx((i) => i + 1));
  const back = () => idx > 0 && setIdx((i) => i - 1);

  // ── card placement: measure the real card, then clamp fully on-screen ──
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardPos, setCardPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!active) return;
    setCardPos(null); // re-measure for the new step
    const id = requestAnimationFrame(() => {
      const el = cardRef.current;
      if (!el) return;
      const M = 12; // viewport margin
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = innerWidth;
      const vh = innerHeight;
      let left: number, top: number;
      if (rect) {
        left = rect.left + rect.width / 2 - w / 2;
        const fitsBelow = rect.top + rect.height + 14 + h <= vh - M;
        const fitsAbove = rect.top - 14 - h >= M;
        if (fitsBelow) top = rect.top + rect.height + 14;
        else if (fitsAbove) top = rect.top - 14 - h;
        else top = Math.max(M, Math.min(vh - h - M, rect.top + rect.height + 14));
      } else {
        left = vw / 2 - w / 2;
        top = vh / 2 - h / 2;
      }
      left = Math.max(M, Math.min(vw - w - M, left));
      top = Math.max(M, Math.min(vh - h - M, top));
      setCardPos({ left, top });
    });
    return () => cancelAnimationFrame(id);
  }, [active, idx, rect]);
  const cardStyle: React.CSSProperties = cardPos
    ? { left: cardPos.left, top: cardPos.top }
    : { left: "50%", top: "50%", transform: "translate(-50%,-50%)", visibility: "hidden" };

  return (
    <>
      <AnimatePresence>
        {active && step && (
          <m.div
            key="tour"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
            aria-modal="true"
            role="dialog"
          >
            {/* spotlight: hole punched via giant box-shadow */}
            {rect ? (
              <m.div
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute rounded-xl pointer-events-none"
                style={{
                  top: rect.top - 6,
                  left: rect.left - 6,
                  width: rect.width + 12,
                  height: rect.height + 12,
                  boxShadow: "0 0 0 9999px rgba(16,24,40,.62), 0 0 0 3px rgba(251,191,36,.9), 0 0 24px rgba(251,191,36,.5)",
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-scrim" onClick={next} />
            )}

            {/* coach card */}
            <m.div
              key={step.key}
              initial={{ opacity: 0, y: 14, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              ref={cardRef}
              className="club-b-card absolute max-h-[min(70vh,420px)] w-[min(340px,calc(100vw-1.5rem))] overflow-y-auto p-5 shadow-lift"
              style={cardStyle}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">{step.emoji}</span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-ink">{step.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-soft font-body">{step.body}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {steps.map((s, i) => (
                    <button
                      key={s.key}
                      onClick={() => setIdx(i)}
                      aria-label={`Step ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-gold-500" : "w-1.5 bg-sand hover:bg-gold-300"}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => finish(false)} className="f0-focus rounded px-1 text-[11px] font-medium text-soft transition-colors hover:text-ink">
                    Skip
                  </button>
                  {idx > 0 && (
                    <button onClick={back} className="text-xs font-semibold text-soft border border-sand rounded-lg px-2.5 py-1.5 hover:bg-paper">
                      Back
                    </button>
                  )}
                  <button onClick={next} className="f0-press f0-focus rounded-lg bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)] px-3.5 py-1.5 text-xs">
                    {idx >= steps.length - 1 ? "Let's go!" : "Next"}
                  </button>
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
      <Celebrate opts={celebrate} onDone={() => setCelebrate(null)} />
    </>
  );
}
