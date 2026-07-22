"use client";

/**
 * AppTour — first-login interactive walkthrough.
 *
 * Spotlights real UI (sidebar links on desktop, tab bar on phones) with a
 * dimmed overlay + positioned coach card. Role-aware steps (parent / teen /
 * kid). Runs once per user: completion is stored in localStorage AND
 * profiles.tour_completed_at (migration 041) so it never re-fires across
 * devices. Replayable via /dashboard?tour=1 (Settings has a link).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import Celebrate, { type CelebrateOptions } from "@/components/fic/Celebrate";

const LS_KEY = "fic-tour-done";

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
}

function buildSteps(u: TourUser): TourStep[] {
  const isKid = u.role === "child" && (u.age_group === "kids" || u.track === "kids");
  const isParent = u.role !== "child";
  const first = (u.display_name || "").split(" ")[0];

  const steps: TourStep[] = [
    {
      key: "welcome",
      emoji: "👋",
      title: first ? `Welcome to the club, ${first}!` : "Welcome to the club!",
      body: isKid
        ? "This is your family's money clubhouse. Let me show you around — it takes one minute, and there's a surprise at the end."
        : "This is your family's home for learning money together. A one-minute tour and you'll know exactly where everything lives.",
    },
    {
      key: "thisweek",
      targets: ['[data-tour="thisweek-tab"]'],
      emoji: "🗓️",
      title: "Everything starts with This Week",
      body: isKid
        ? "Every week there's one company to explore, one challenge for you, and one class. It all lives right here."
        : "One concept, one company, one mission — the club's weekly rhythm lives in this tab. Check it every Sunday.",
    },
    {
      key: "starthere",
      targets: ['[data-tour="start-here"]', '[data-tour="nav:/start-here"]'],
      emoji: "🧭",
      title: "Start Here is your setup trail",
      body: "A short checklist that gets your family fully set up — watch the orientation, add your first companies, join your first class. Finish all six and celebrate.",
    },
    {
      key: "community",
      targets: ['[data-tour="tab:/community"]', '[data-tour="nav:/community"]'],
      emoji: "💬",
      title: "The clubhouse feed",
      body: isKid
        ? "Post what you find, cheer for other families, and watch your wins show up in the feed automatically."
        : "The heart of the club — share wins, post your family's picks with live data attached, and jump into Live Rooms around class time.",
    },
    {
      key: "watchlist",
      targets: ['[data-tour="tab:/watchlist"]', '[data-tour="nav:/watchlist"]'],
      emoji: "🔎",
      title: "Your family's watchlist",
      body: isKid
        ? "Pick a company you love and become its champion! Study it with your family before deciding if it's a favorite."
        : "The family research board. Anyone adds a company, someone champions it, and verdicts unlock only after the research card is done.",
    },
    {
      key: "missions",
      targets: ['[data-tour="tab:/missions"]', '[data-tour="nav:/missions"]'],
      emoji: "🎯",
      title: isKid ? "Your missions" : "Kid missions",
      body: isKid
        ? "Brand Detective, Money Machine, Family CEO… complete missions, earn XP, and level up."
        : "Hands-on missions that turn each week's concept into something kids do — and parents get to watch the lightbulbs go on.",
    },
    {
      key: "practice",
      targets: ['[data-tour="nav:/chart"]', '[data-tour="tab:/games"]', '[data-tour="tab:more"]'],
      emoji: "📈",
      title: "The practice area",
      body: isKid
        ? "Games! Candle Battle, Trend or Trap, and a real chart to explore — all practice, zero real money."
        : "A full-screen practice chart with live data, the paper-money simulator, and the games arcade. Real reps, zero risk.",
    },
    {
      key: "flashcards",
      targets: ['[data-tour="nav:/flashcards"]', '[data-tour="tab:more"]'],
      emoji: "🃏",
      title: isKid ? "Your cards" : "Daily flashcards",
      body: "Five quick cards a day keeps the vocabulary sharp — streaks included.",
    },
  ];

  if (isParent) {
    steps.push({
      key: "family",
      targets: ['[data-tour="nav:/family"]', '[data-tour="nav:/parent-corner"]', '[data-tour="tab:more"]'],
      emoji: "👨‍👩‍👧‍👦",
      title: "Your family, your view",
      body: "Report cards for every kid, Parent Corner with this week's dinner-table questions, and invites to bring the rest of the family in.",
    });
  } else {
    steps.push({
      key: "progress",
      targets: ['[data-tour="nav:/progress"]', '[data-tour="tab:more"]'],
      emoji: "🏅",
      title: "Your progress",
      body: "XP, levels, and credentials you can earn — Scout, Analyst, Risk Manager. Real titles for real work.",
    });
  }

  steps.push({
    key: "bell",
    targets: ['[data-tour="bell"]'],
    emoji: "🔔",
    title: "Never miss a thing",
    body: "Replies, mentions and club news land here. Turn on push notifications in Settings to get them even when the app is closed.",
  });

  steps.push({
    key: "done",
    emoji: "🚀",
    title: isKid ? "You're in!" : "That's the tour.",
    body: isKid
      ? "Time to earn your first XP. Head to Start Here and let's go!"
      : "Head to Start Here to finish setting up your family — the checklist takes about ten minutes total.",
  });

  return steps;
}

interface Rect { top: number; left: number; width: number; height: number }

export default function AppTour({ user }: { user: TourUser }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [celebrate, setCelebrate] = useState<CelebrateOptions | null>(null);
  const stepsRef = useRef<TourStep[]>([]);

  // ── should we run? ──
  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const forced = searchParams.get("tour") === "1";
    if (forced) {
      try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
      stepsRef.current = buildSteps(user);
      setIdx(0);
      setActive(true);
      return;
    }
    try {
      if (localStorage.getItem(LS_KEY)) return;
    } catch { /* ignore */ }
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("tour_completed_at")
        .eq("id", session.user.id)
        .single();
      if (!mounted) return;
      if (data && !data.tour_completed_at) {
        stepsRef.current = buildSteps(user);
        setIdx(0);
        // Small delay so the page settles before we spotlight it.
        setTimeout(() => mounted && setActive(true), 1200);
      } else if (data?.tour_completed_at) {
        try { localStorage.setItem(LS_KEY, "1"); } catch { /* ignore */ }
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  const finish = useCallback(async (completed: boolean) => {
    setActive(false);
    setRect(null);
    try { localStorage.setItem(LS_KEY, "1"); } catch { /* ignore */ }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from("profiles")
        .update({ tour_completed_at: new Date().toISOString() })
        .eq("id", session.user.id);
    }
    if (completed) {
      const isKid = user.role === "child" && (user.age_group === "kids" || user.track === "kids");
      setCelebrate({
        variant: "setup",
        register: isKid ? "kid" : "parent",
        title: "Welcome to the club!",
        subtitle: "You know your way around now — go earn it.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── locate target for current step ──
  const locate = useCallback(() => {
    const step = stepsRef.current[idx];
    if (!step?.targets?.length) { setRect(null); return; }
    for (const sel of step.targets) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden";
      if (!visible) continue;
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const rr = el.getBoundingClientRect();
      setRect({ top: rr.top, left: rr.left, width: rr.width, height: rr.height });
      return;
    }
    setRect(null);
  }, [idx]);

  useEffect(() => {
    if (!active) return;
    locate();
    const onR = () => locate();
    addEventListener("resize", onR);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") back();
    };
    addEventListener("keydown", onKey);
    return () => { removeEventListener("resize", onR); removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, idx]);

  const steps = stepsRef.current;
  const step = steps[idx];
  const next = () => (idx >= steps.length - 1 ? finish(true) : setIdx((i) => i + 1));
  const back = () => idx > 0 && setIdx((i) => i - 1);

  // ── card placement ──
  const pad = 8;
  let cardStyle: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%,-50%)" };
  if (rect) {
    const below = rect.top + rect.height + pad + 210 < innerHeight;
    const top = below ? rect.top + rect.height + pad + 6 : undefined;
    const bottom = below ? undefined : innerHeight - rect.top + pad + 6;
    let left = rect.left + rect.width / 2;
    left = Math.max(180, Math.min(innerWidth - 180, left));
    cardStyle = { left, top, bottom, transform: "translateX(-50%)" };
  }

  return (
    <>
      <AnimatePresence>
        {active && step && (
          <motion.div
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
              <motion.div
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
              <div className="absolute inset-0 bg-ink/60" onClick={next} />
            )}

            {/* coach card */}
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 14, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute w-[min(340px,calc(100vw-2rem))] rounded-2xl bg-midnight-900 border border-gold-300/60 shadow-lift p-5"
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
                  <button onClick={() => finish(false)} className="text-[11px] font-medium text-midnight-500 hover:text-soft px-1">
                    Skip
                  </button>
                  {idx > 0 && (
                    <button onClick={back} className="text-xs font-semibold text-soft border border-sand rounded-lg px-2.5 py-1.5 hover:bg-paper">
                      Back
                    </button>
                  )}
                  <button onClick={next} className="cta-button text-xs rounded-lg px-3.5 py-1.5">
                    {idx >= steps.length - 1 ? "Let's go!" : "Next"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Celebrate opts={celebrate} onDone={() => setCelebrate(null)} />
    </>
  );
}
