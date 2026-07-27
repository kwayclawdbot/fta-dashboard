"use client";

/**
 * OnboardingCarousel — the cinematic brand-story carousel that plays AFTER
 * signup and BEFORE the app tour, for EVERY signup path (challenge / invite /
 * organic / kid / family), owned by the FirstRun orchestrator.
 *
 * DIRECTION (owner-ratified 2026-07-26 — COLLECTIVE-FIRST + wry STORY voice):
 * the splash tells a story — collective investing IS the cheat code; a network
 * made sharper by AI lets us beat the market together. Voice = blunt,
 * conversational, wry, anti-pretense (the "Subtle Art" register) — ZERO
 * vulgarity. NOT a mascot pitch, NOT a homework/contribution pitch. The arc:
 *   1. Nobody beats the market alone — a living member constellation whose
 *      signals converge into one pulse. No character hero.
 *   2. Together is the cheat code — a thousand eyes see more than one; when they
 *      share, everyone gets smarter. It's math, not magic.
 *   3. The market is too big for two eyes — the Club's shared watching /
 *      research / argument becomes one signal you can use (Club Score / Trending).
 *   4. Kai reads the room so you don't have to — a FEATURE card (Kai Watch
 *      states). Kai appears only small, as product UI, never a mascot hero.
 *   5. Come see what we're building — the final card just INVITES entry (no
 *      pick-a-ticker task); per-path variants (challenge/invite/organic/kid/
 *      family). CTA: Enter the Club.
 *
 * Design lineage: 5-card structure + real-product vignettes + one-orange-action
 * per screen from the canvas (B); warmth + headline SCALE from the mocks (A) —
 * minus the mascot centerpiece.
 *
 * Register-aware: kid + family SOFTEN the wry tone (playful-honest, never
 * sardonic). Honesty rules (CINEMATIC-LAYER-PLAN §2, §6): any big number is
 * MISSION-framed, never a live count. Vignette stats are EXAMPLE content (tagged
 * as such). Kai Watch progress is measured %-to-trigger, never invented
 * "confidence". Skippable, swipe + dots + Continue, reduced-motion safe, light
 * default + dark variant (drives off the app's --paper/--ink/--sand tokens and
 * volt / teal / kai-blue scales).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, m, useReducedMotion } from "@/lib/motion";
import {
  ArrowRight,
  Eye,
  TrendingUp,
  Radio,
  MessageSquare,
  Gauge,
  Sparkles,
} from "lucide-react";
import { ClubWordmark } from "@/components/brand/ClubMark";

export type OnboardingPath = "organic" | "invite" | "challenge" | "kid" | "family";
export type OnboardingRegister = "kid" | "teen" | "adult";

export interface OnboardingCarouselProps {
  path: OnboardingPath;
  register: OnboardingRegister;
  firstName?: string;
  invitedBy?: string;
  householdName?: string;
  onFinish: () => void;
}

/** Small illustrative-content marker so example vignettes never read as live data. */
function ExampleTag() {
  return (
    <span className="absolute right-2.5 top-2.5 z-10 rounded-full bg-[var(--ink)]/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--ink)]/45">
      Example
    </span>
  );
}

const AVATARS = [
  { i: "AR", c: "var(--color-volt-500)" },
  { i: "JP", c: "var(--color-teal-500)" },
  { i: "MC", c: "var(--kai-blue)" },
  { i: "LB", c: "var(--color-volt-400)" },
  { i: "KD", c: "var(--color-teal-600)" },
  { i: "TS", c: "var(--color-gold-500, #F59E0B)" },
];

/**
 * The Collective — the opening set-piece. Member avatars ring a central pulse;
 * signal lines converge INWARD into one shared pulse. This is the whole promise
 * in one image: many people → one collective signal.
 */
function CollectiveHero({ still }: { still: boolean }) {
  const R = 120;
  const nodes = [-90, -30, 30, 90, 150, 210].map((a, k) => {
    const rad = (a * Math.PI) / 180;
    return { x: Math.cos(rad) * R, y: Math.sin(rad) * R, ...AVATARS[k % AVATARS.length] };
  });
  return (
    <div className="relative grid h-[260px] w-[260px] place-items-center">
      {/* rings */}
      {[70, 120].map((r) => (
        <span
          key={r}
          className="absolute rounded-full border border-[var(--ink)]/10"
          style={{ width: r * 2, height: r * 2 }}
        />
      ))}

      {/* converging signal lines */}
      <svg className="absolute inset-0 h-full w-full" viewBox="-130 -130 260 260" aria-hidden="true">
        <defs>
          <linearGradient id="sig" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--color-teal-500)" stopOpacity="0.05" />
            <stop offset="1" stopColor="var(--color-volt-500)" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {nodes.map((n, k) => (
          <m.line
            key={k}
            x1={n.x}
            y1={n.y}
            x2="0"
            y2="0"
            stroke="url(#sig)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={still ? undefined : { pathLength: 0, opacity: 0 }}
            animate={still ? { opacity: 0.6 } : { pathLength: 1, opacity: [0, 0.9, 0.5] }}
            transition={
              still
                ? undefined
                : { duration: 1.6, delay: 0.15 * k, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }
            }
          />
        ))}
      </svg>

      {/* central collective pulse */}
      <m.span
        className="absolute rounded-full"
        style={{
          width: 116,
          height: 116,
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-volt-500) 30%, transparent), transparent 70%)",
        }}
        animate={still ? undefined : { scale: [0.85, 1.12, 0.85], opacity: [0.5, 0.85, 0.5] }}
        transition={still ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <span
        className="absolute grid place-items-center rounded-full font-display text-white shadow-lift"
        style={{
          width: 72,
          height: 72,
          background: "linear-gradient(135deg, var(--color-volt-500), var(--color-volt-600))",
        }}
      >
        <Radio className="h-7 w-7" />
      </span>

      {/* member nodes */}
      {nodes.map((n, k) => (
        <m.span
          key={k}
          className="absolute grid place-items-center rounded-full font-display text-[11px] font-bold text-white shadow-md"
          style={{
            width: 34,
            height: 34,
            left: `calc(50% + ${n.x}px - 17px)`,
            top: `calc(50% + ${n.y}px - 17px)`,
            background: n.c,
            border: "2px solid var(--paper)",
          }}
          animate={still ? undefined : { y: [0, k % 2 ? -5 : 5, 0] }}
          transition={still ? undefined : { duration: 3.5 + k * 0.3, repeat: Infinity, ease: "easeInOut" }}
        >
          {n.i}
        </m.span>
      ))}
    </div>
  );
}

/* ── Real-product vignettes (illustrative example content) ─────────────────── */

/** Card 2 — the collective, third-person: many eyes → one shared, smarter view. */
function CollectiveVignette() {
  const rows = [
    { icon: Eye, tone: "var(--color-volt-500)", label: "1,240 watching NVDA" },
    { icon: MessageSquare, tone: "var(--kai-blue)", label: "312 shared their thesis" },
    { icon: Gauge, tone: "var(--color-teal-500)", label: "Club Sentiment 78% bullish" },
  ];
  return (
    <div className="relative w-full max-w-[300px] rounded-2xl border border-[var(--sand)] bg-[var(--paper)] px-3.5 pb-3.5 pt-7 shadow-lift">
      <ExampleTag />
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2.5">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"
              style={{ background: r.tone }}
            >
              <r.icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-[12px] font-semibold text-[var(--ink)]/80">{r.label}</span>
          </div>
        ))}
      </div>
      <div
        className="mt-3 flex items-center gap-1.5 rounded-xl px-2.5 py-2"
        style={{ background: "color-mix(in srgb, var(--color-teal-500) 12%, transparent)" }}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-teal-600" />
        <span className="text-[11px] font-bold text-teal-700">One view no single member could build.</span>
      </div>
    </div>
  );
}

/** Card 3 — collective benefit: Club Score / Trending born from member actions. */
function CollectiveBenefitVignette() {
  return (
    <div className="relative w-full max-w-[300px] overflow-hidden rounded-2xl border border-[var(--sand)] bg-[var(--paper)] shadow-lift">
      <ExampleTag />
      <div className="relative h-24 bg-gradient-to-br from-midnight-900 to-midnight-700">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 140% at 85% 8%, color-mix(in srgb, var(--color-volt-500) 45%, transparent), transparent 55%)",
          }}
        />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          <TrendingUp className="h-3 w-3 text-volt-400" /> Trending in the Club
        </div>
        <div className="absolute bottom-2 left-3 text-white">
          <div className="font-display text-lg font-extrabold leading-none">NVDA</div>
          <div className="text-[10px] text-white/70">Nvidia Corp.</div>
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-[var(--ink)]/45">Club Score</div>
          <div className="font-display text-base font-bold text-teal-600">92</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wide text-[var(--ink)]/45">from</div>
          <div className="text-[11px] font-bold text-[var(--ink)]/70">312 members watching</div>
        </div>
      </div>
    </div>
  );
}

/** Card 4 — Kai Watch feature. Kai appears small, as product UI (byline avatar). */
function KaiWatchVignette() {
  const states = [
    { label: "Watching", pct: 0, tone: "var(--sand)" },
    { label: "Building", pct: 54, tone: "var(--color-teal-500)" },
    { label: "Near Trigger", pct: 89, tone: "var(--color-volt-500)" },
  ];
  return (
    <div className="relative w-full max-w-[300px] rounded-2xl border border-[var(--sand)] bg-[var(--paper)] px-3.5 pb-3.5 pt-7 shadow-lift">
      <ExampleTag />
      <div
        className="flex items-center gap-2 rounded-xl px-2.5 py-2"
        style={{ background: "var(--kai-blue-soft)" }}
      >
        <Image src="/assets/kai/avatar.webp" alt="Kai" width={20} height={20} className="shrink-0 rounded-full" />
        <span className="text-[11px] font-medium text-[var(--ink)]/75">
          &ldquo;Watch NVDA for momentum after earnings&rdquo;
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {states.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-[74px] shrink-0 text-[10px] font-semibold text-[var(--ink)]/65">
              {s.label}
            </span>
            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--sand)]">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${Math.max(s.pct, 6)}%`, background: s.tone }}
              />
            </span>
            <span className="w-9 shrink-0 text-right text-[9px] font-bold text-[var(--ink)]/55">
              {s.pct > 0 ? `${s.pct}%` : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px] text-[var(--ink)]/40">% measures distance to your trigger — never a prediction.</p>
    </div>
  );
}

/** Card 5 — a warm "what's inside" welcome. No task; just an invitation. */
function WelcomeVignette({ kid }: { kid: boolean }) {
  const rows = [
    {
      icon: TrendingUp,
      tone: "var(--color-volt-500)",
      label: kid ? "What the Club's watching" : "Trending",
      sub: kid ? "the companies everyone's into" : "what the Club's watching now",
    },
    {
      icon: MessageSquare,
      tone: "var(--color-teal-500)",
      label: kid ? "Why people are in" : "Best Thinking",
      sub: kid ? "members share what they found" : "the theses members stand behind",
    },
    {
      icon: Eye,
      tone: "var(--kai-blue)",
      label: kid ? "Kai, watching for you" : "Kai Watch",
      sub: kid ? "taps you when it matters" : "your AI, keeping an eye out",
    },
  ];
  return (
    <div className="relative w-full max-w-[300px] rounded-2xl border border-[var(--sand)] bg-[var(--paper)] p-3 shadow-lift">
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-2.5 rounded-xl border border-[var(--sand)] px-3 py-2.5"
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"
              style={{ background: r.tone }}
            >
              <r.icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-bold text-[var(--ink)]/85">{r.label}</span>
              <span className="block truncate text-[10px] text-[var(--ink)]/50">{r.sub}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Card model ─────────────────────────────────────────────────────────────── */

interface Card {
  id: string;
  kicker: string;
  title: React.ReactNode;
  body: string;
  visual: React.ReactNode;
  /** When true the visual is the hero, rendered ABOVE the headline (card 1). */
  heroAbove?: boolean;
  cta: string;
}

function buildCards(
  path: OnboardingPath,
  register: OnboardingRegister,
  firstName: string,
  invitedBy?: string,
  householdName?: string,
  still = false
): Card[] {
  const kid = register === "kid";
  const soft = kid || path === "family"; // soften the wry tone for kids & families

  // ── Card 5 (the invitation) is per-path. No task — just "come in". ───────────
  const enter: Card = (() => {
    const base = { id: "enter", visual: <WelcomeVignette kid={kid} />, cta: "Enter the Club" };
    const title = (
      <>
        Come see what we&rsquo;re{" "}
        <span style={{ color: "var(--color-volt-500)" }}>building</span>.
      </>
    );
    const wryBody =
      "No experience needed. No hours a day. Show up, look around — the Club does the heavy lifting.";
    if (path === "kid") {
      return {
        ...base,
        kicker: "You're in!",
        title: (
          <>
            Come see what we&rsquo;re{" "}
            <span style={{ color: "var(--color-volt-500)" }}>building</span>.
          </>
        ),
        body: "No homework, no pressure. Just look around and explore — the Club's got your back.",
      };
    }
    if (path === "challenge") {
      return {
        ...base,
        kicker: "Your cohort is forming",
        title,
        body: "Your 5-Day Challenge kicks off Sept 1. For now, just come in and look around — no experience needed, the Club does the heavy lifting.",
      };
    }
    if (path === "invite") {
      return {
        ...base,
        kicker: invitedBy ? `${invitedBy} saved you a seat` : "A seat was saved for you",
        title,
        body: invitedBy
          ? `${invitedBy} is already in here. No experience needed, no hours a day — show up, look around, the Club does the heavy lifting.`
          : wryBody,
      };
    }
    if (path === "family") {
      return {
        ...base,
        kicker: householdName ? `Welcome, the ${householdName}s` : "Welcome, your household",
        title,
        body: "Come explore together — no experience needed, no daily grind. The Club does the heavy lifting; you just show up and learn as a family.",
      };
    }
    return { ...base, kicker: "You're in!", title, body: wryBody };
  })();

  return [
    {
      id: "collective",
      kicker: "The Collective",
      title: (
        <>
          Nobody beats the market{" "}
          <span style={{ color: "var(--color-volt-500)" }}>alone</span>.
        </>
      ),
      body: soft
        ? kid
          ? "Not even grown-ups. The trick nobody tells you? People who figure out the market do it together — and that's way more fun."
          : "Not the experts, not the loud voices online. The smart move is doing this together — as a family, and as a whole Club."
        : "Not you. Not us. Not the guy on YouTube with the rented Lambo. Alone, everybody's guessing.",
      visual: <CollectiveHero still={still} />,
      heroAbove: true,
      cta: "See how it works",
    },
    {
      id: "cheatcode",
      kicker: "The cheat code",
      title: (
        <>
          Together is the{" "}
          <span style={{ color: "var(--color-volt-500)" }}>cheat code</span>.
        </>
      ),
      body: kid
        ? "A thousand people watching see way more than one. When everyone shares what they spot, everyone gets smarter. It's just math — the good kind."
        : "A thousand people watching the market will always see more than one. When they share what they see, everyone gets smarter. That's not magic — it's math.",
      visual: <CollectiveVignette />,
      cta: "Continue",
    },
    {
      id: "payoff",
      kicker: "The payoff",
      title: (
        <>
          The market&rsquo;s too big for{" "}
          <span style={{ color: "var(--color-volt-500)" }}>two eyes</span>.
        </>
      ),
      body: kid
        ? "So we brought thousands. Everything the Club watches, digs into, and argues about turns into one clear picture you can actually use."
        : "So we brought thousands. What the Club watches, researches, and argues about becomes one signal you can actually use.",
      visual: <CollectiveBenefitVignette />,
      cta: "Continue",
    },
    {
      id: "kai",
      kicker: "Your shared analyst",
      title: (
        <>
          <span style={{ color: "var(--kai-blue)" }}>Kai</span> reads the room so you don&rsquo;t have to.
        </>
      ),
      body: kid
        ? "Kai is the Club's AI helper. It watches everything the Club watches, so you never miss the good stuff — and taps you when something actually matters."
        : "Our AI watches everything the Club watches — every shift, every setup — and taps you when something actually matters. No noise. No FOMO. Just the stuff worth your time.",
      visual: <KaiWatchVignette />,
      cta: "Continue",
    },
    enter,
  ];
}

/* ── Component ──────────────────────────────────────────────────────────────── */

export default function OnboardingCarousel({
  path,
  register,
  firstName = "",
  invitedBy,
  householdName,
  onFinish,
}: OnboardingCarouselProps) {
  const reduce = useReducedMotion();
  const cards = useMemo(
    () => buildCards(path, register, firstName, invitedBy, householdName, !!reduce),
    [path, register, firstName, invitedBy, householdName, reduce]
  );
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onFinish();
  }, [onFinish]);

  const go = useCallback(
    (n: number) => {
      if (n < 0) return;
      if (n >= cards.length) return finish();
      setDir(n > i ? 1 : -1);
      setI(n);
    },
    [cards.length, finish, i]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
      else if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, i, finish]);

  const card = cards[i];
  const last = i === cards.length - 1;

  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: dir * 48 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: dir * -48 },
      };

  return (
    <m.div
      className="fixed inset-0 z-[96] overflow-hidden"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Cheat Code Club"
    >
      {/* Cinematic warm glows */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 60% at 50% -8%, color-mix(in srgb, var(--color-volt-500) 16%, transparent), transparent 60%), radial-gradient(70% 50% at 92% 108%, color-mix(in srgb, var(--color-teal-500) 12%, transparent), transparent 60%)",
        }}
      />

      {/* Header: infinity + wordmark lockup + Skip */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <ClubWordmark size={22} />
        {!last && (
          <button
            onClick={finish}
            className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--ink)]/50 transition-colors hover:text-[var(--ink)]/80"
          >
            Skip
          </button>
        )}
      </div>

      {/* Stage */}
      <div className="relative mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 pb-32 pt-16 text-center sm:max-w-lg">
        <AnimatePresence mode="wait" custom={dir}>
          <m.div
            key={card.id}
            {...slide}
            transition={{ duration: reduce ? 0.2 : 0.42, ease: [0.22, 1, 0.36, 1] }}
            drag={reduce ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={(_e, info) => {
              if (info.offset.x < -70) go(i + 1);
              else if (info.offset.x > 70) go(i - 1);
            }}
            className="flex w-full cursor-grab flex-col items-center active:cursor-grabbing"
          >
            {card.heroAbove && card.visual && (
              <div className="mb-6 flex justify-center">{card.visual}</div>
            )}

            <span
              className="mb-2.5 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: "color-mix(in srgb, var(--color-volt-500) 12%, transparent)",
                color: "var(--color-volt-600)",
              }}
            >
              {card.kicker}
            </span>

            <h1
              className="font-display font-extrabold leading-[1.02] tracking-tight"
              style={{ fontSize: "clamp(2rem, 8vw, 2.9rem)" }}
            >
              {card.title}
            </h1>

            <p className="mx-auto mt-4 max-w-[32ch] text-[15px] leading-relaxed text-[var(--ink)]/65 sm:text-base">
              {card.body}
            </p>

            {!card.heroAbove && card.visual && (
              <div className="mt-7 flex justify-center">{card.visual}</div>
            )}
          </m.div>
        </AnimatePresence>
      </div>

      {/* Footer: dots · one orange action · "better together" */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4">
          <div className="flex items-center gap-1.5">
            {cards.map((c, k) => (
              <button
                key={c.id}
                onClick={() => go(k)}
                aria-label={`Go to card ${k + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: k === i ? 22 : 6,
                  background: k === i ? "var(--color-volt-500)" : "var(--sand)",
                }}
              />
            ))}
          </div>

          <button
            onClick={() => go(i + 1)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-[15px] font-bold text-white shadow-lift transition-transform active:scale-[0.98]"
            style={{ background: "var(--color-volt-500)" }}
          >
            {card.cta}
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="text-[12px] font-medium text-[var(--ink)]/40">We&rsquo;re smarter together.</p>
        </div>
      </div>
    </m.div>
  );
}
