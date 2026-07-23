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
import { AnimatePresence, m } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import Celebrate, { type CelebrateOptions } from "@/components/fic/Celebrate";
import { deriveRegister, celebrateRegister, type Register } from "@/lib/register";

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

/**
 * A trimmed, register-differentiated tour (audit #16). The old tour was 11
 * identical steps for parent, teen and kid alike — long for a "one-minute
 * tour" and voice-wrong for the youngest. Now every step carries per-register
 * copy and each persona walks an ordered SUBSET:
 *   • kid   → 5 steps, "adventure" voice
 *   • teen  → 5 steps, rank/level framing, no baby-talk
 *   • adult → 7 steps, calm orientation ("here's your home")
 * Register comes from the shared register.ts derivation — no ad-hoc role/track
 * checks. The measure-then-clamp placement machinery below is untouched.
 */
function buildSteps(u: TourUser): TourStep[] {
  const register = deriveRegister(u);
  const first = (u.display_name || "").split(" ")[0];
  const pick = <T,>(k: T, t: T, a: T): T =>
    register === "kid" ? k : register === "teen" ? t : a;

  const S: Record<string, TourStep> = {
    welcome: {
      key: "welcome",
      emoji: "👋",
      title: pick(
        first ? `Hey ${first}! Ready to explore?` : "Hey! Ready to explore?",
        first ? `Welcome, ${first}.` : "Welcome.",
        first ? `Welcome to the club, ${first}!` : "Welcome to the club!"
      ),
      body: pick(
        "This is your family's money clubhouse. Let me show you around — it's quick, and there's a surprise at the end!",
        "This is your family's home base for learning to invest. Quick tour so you know where everything lives.",
        "This is your family's home for learning money together. A one-minute tour and you'll know exactly where everything lives."
      ),
    },
    thisweek: {
      key: "thisweek",
      targets: ['[data-tour="thisweek-tab"]'],
      emoji: "🗓️",
      title: pick("Everything starts here", "Start with This Week", "Everything starts with This Week"),
      body: pick(
        "Every week there's one company to explore, one challenge for you, and one class — all right here.",
        "One concept, one company, one mission each week. This is the tab you check first.",
        "One concept, one company, one mission — the club's weekly rhythm lives in this tab. Check it every Sunday."
      ),
    },
    starthere: {
      key: "starthere",
      targets: ['[data-tour="start-here"]', '[data-tour="nav:/start-here"]'],
      emoji: "🧭",
      title: "Start Here is your setup trail",
      body: "A short checklist that gets your family fully set up — watch the orientation, add your first companies, join your first class. Finish all six and celebrate.",
    },
    community: {
      key: "community",
      targets: ['[data-tour="tab:/community"]', '[data-tour="nav:/community"]'],
      emoji: "💬",
      title: pick("The clubhouse feed", "The clubhouse feed", "The clubhouse feed"),
      body: pick(
        "Post what you find, cheer for other families, and watch your wins show up in the feed automatically.",
        "Where the club talks all week — share your picks with live data attached, cheer other families, and drop into Live Rooms at class time.",
        "The heart of the club — share wins, post your family's picks with live data attached, and jump into Live Rooms around class time."
      ),
    },
    watchlist: {
      key: "watchlist",
      targets: ['[data-tour="tab:/watchlist"]', '[data-tour="nav:/watchlist"]'],
      emoji: "🔎",
      title: "Your family's watchlist",
      body: "The family research board. Anyone adds a company, someone champions it, and verdicts unlock only after the research card is done.",
    },
    missions: {
      key: "missions",
      targets: ['[data-tour="tab:/missions"]', '[data-tour="nav:/missions"]'],
      emoji: "🎯",
      title: "Your missions",
      body: "Brand Detective, Money Machine, Family CEO… complete missions, earn XP, and level up.",
    },
    practice: {
      key: "practice",
      targets: ['[data-tour="nav:/chart"]', '[data-tour="tab:/games"]', '[data-tour="tab:more"]'],
      emoji: pick("🎮", "📈", "📈"),
      title: pick("The play zone", "Practice & games", "The practice area"),
      body: pick(
        "Games! Candle Battle, Trend or Trap, and a real chart to explore — all practice, zero real money.",
        "A full-screen chart with live data, the paper-money simulator, and the games arcade. Real reps, zero risk.",
        "A full-screen practice chart with live data, the paper-money simulator, and the games arcade. Real reps, zero risk."
      ),
    },
    progress: {
      key: "progress",
      targets: ['[data-tour="nav:/progress"]', '[data-tour="tab:more"]'],
      emoji: "🏅",
      title: "Your rank & progress",
      body: "XP, levels, and credentials you earn — Scout, Analyst, Risk Manager. Real titles for real work.",
    },
    family: {
      key: "family",
      targets: ['[data-tour="nav:/family"]', '[data-tour="nav:/parent-corner"]', '[data-tour="tab:more"]'],
      emoji: "👨‍👩‍👧‍👦",
      title: "Your family, your view",
      body: "Report cards for every kid, Parent Corner with this week's dinner-table questions, and invites to bring the rest of the family in.",
    },
    done: {
      key: "done",
      emoji: "🚀",
      title: pick("You're in!", "That's the tour.", "That's the tour."),
      body: pick(
        "Time to earn your first XP. Head to This Week and start your first adventure!",
        "Jump into This Week and start stacking XP.",
        "Head to Start Here to finish setting up your family — the checklist takes about ten minutes total."
      ),
    },
  };

  const order: Record<Register, string[]> = {
    kid: ["welcome", "thisweek", "missions", "practice", "done"],
    teen: ["welcome", "thisweek", "community", "progress", "done"],
    adult: ["welcome", "thisweek", "starthere", "community", "watchlist", "family", "done"],
  };

  return order[register].map((k) => S[k]);
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
  // The auto-run (non-forced) decision must happen at most once per mount, so a
  // benign re-render or query-param change can never restart the tour after the
  // user has seen/finished it. Forced replay (?tour=1) bypasses this guard.
  const autoDecidedRef = useRef(false);

  // ── should we run? ──
  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const forced = searchParams.get("tour") === "1";
    if (forced) {
      try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
      autoDecidedRef.current = true; // a manual replay counts as decided
      stepsRef.current = buildSteps(user);
      setIdx(0);
      setActive(true);
      return;
    }
    // Auto-run is a one-shot per mount: once we've decided (fired or suppressed),
    // never re-evaluate — this is what stops the "re-fires every load" bug.
    if (autoDecidedRef.current) return;
    try {
      if (localStorage.getItem(LS_KEY)) { autoDecidedRef.current = true; return; }
    } catch { /* ignore */ }
    autoDecidedRef.current = true;
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
      // The DB flag is the source of truth: only a null tour_completed_at runs
      // the tour. Anything else (completed on any device) suppresses it and
      // caches that locally so we skip the round trip next time.
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
      setCelebrate({
        variant: "setup",
        register: celebrateRegister(deriveRegister(user)),
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
      el.scrollIntoView({ block: "center", behavior: "smooth" });
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
              <div className="absolute inset-0 bg-ink/60" onClick={next} />
            )}

            {/* coach card */}
            <m.div
              key={step.key}
              initial={{ opacity: 0, y: 14, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              ref={cardRef}
              className="absolute w-[min(340px,calc(100vw-1.5rem))] max-h-[min(70vh,420px)] overflow-y-auto rounded-2xl bg-midnight-900 border border-gold-300/60 shadow-lift p-5"
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
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
      <Celebrate opts={celebrate} onDone={() => setCelebrate(null)} />
    </>
  );
}
