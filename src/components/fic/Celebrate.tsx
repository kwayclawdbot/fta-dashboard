"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import Burst from "@/components/games/Burst";
import { LEVELS, levelForXp, type Level } from "@/lib/xp";

/**
 * Register-correct celebration system for the FIC club surfaces.
 *
 * One <Celebrate/> full-screen moment + a useCelebrate() controller, built on
 * the existing Burst confetti primitive. Rewards the SPECIFIC effort at a weight
 * that fits the audience (kids get confetti energy + optional sound; teens/
 * parents/credentials get an embossed wax-seal moment, no childish confetti).
 *
 * Universal prefers-reduced-motion: reduced → a calm opacity-only banner, no
 * particles, no springs. Sound is kid-register + opt-in only (default silent).
 */

export type Register = "kid" | "teen" | "parent";
export type CelebrateVariant =
  | "mission" // mission complete — emblem stamp + confetti + XP
  | "levelup" // XP threshold crossed
  | "setup" // Start Here 6/6
  | "verdict" // research card complete → verdict unlocked
  | "credential"; // pro-title earned — wax seal, never confetti

export interface CelebrateOptions {
  variant: CelebrateVariant;
  register?: Register;
  title: string;
  subtitle?: string;
  xp?: number;
  emblemSrc?: string; // mission emblem to "stamp" in
  sound?: boolean; // kid + opt-in only
  durationMs?: number;
}

/* ---------- opt-in kid sound (default silent) ---------- */

const SOUND_KEY = "fic-celebrate-sound";

export function useSoundOptIn(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(localStorage.getItem(SOUND_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = useCallback(() => {
    setOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(SOUND_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return [on, toggle];
}

function playChime() {
  if (typeof window === "undefined") return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.11);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.11);
      g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + i * 0.11 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.11 + 0.28);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.11);
      osc.stop(ctx.currentTime + i * 0.11 + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    /* ignore */
  }
}

/* ---------- controller hook ---------- */

export function useCelebrate() {
  const [opts, setOpts] = useState<CelebrateOptions | null>(null);
  const celebrate = useCallback((o: CelebrateOptions) => setOpts(o), []);
  const clear = useCallback(() => setOpts(null), []);
  return { opts, celebrate, clear };
}

/** Level a given XP total sits at, and whether newXp crossed into a new level. */
export function crossedLevel(prevXp: number, newXp: number): Level | null {
  const before = levelForXp(prevXp);
  const after = levelForXp(newXp);
  if (after.level > before.level) {
    // Report the highest new level crossed.
    return LEVELS.find((l) => l.level === after.level) ?? after;
  }
  return null;
}

/* ---------- wax seal (credentials) ---------- */

export function CredentialSeal({
  size = 84,
  label,
}: {
  size?: number;
  label?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label={label || "credential seal"}>
      <defs>
        <radialGradient id="seal-g" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="55%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </radialGradient>
      </defs>
      {/* scalloped seal edge */}
      <g fill="url(#seal-g)">
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return (
            <circle key={i} cx={50 + Math.cos(a) * 40} cy={50 + Math.sin(a) * 40} r="8" />
          );
        })}
        <circle cx="50" cy="50" r="40" />
      </g>
      <circle cx="50" cy="50" r="33" fill="none" stroke="#92400E" strokeWidth="1.5" opacity="0.5" />
      {/* embossed star */}
      <path
        d="M50 30l5.3 12.4L69 43.6l-9.5 9.2 2.4 13.3L50 59.8 38.1 66.1l2.4-13.3L31 43.6l13.7-1.2z"
        fill="#FDE68A"
        opacity="0.9"
      />
    </svg>
  );
}

/* ---------- the full-screen moment ---------- */

export default function Celebrate({
  opts,
  onDone,
}: {
  opts: CelebrateOptions | null;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const firedSound = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!opts) {
      firedSound.current = false;
      return;
    }
    if (opts.sound && !firedSound.current) {
      firedSound.current = true;
      playChime();
    }
    const dur = opts.durationMs ?? (opts.variant === "credential" ? 2600 : 2400);
    const t = setTimeout(onDone, dur);
    return () => clearTimeout(t);
  }, [opts, onDone]);

  if (!mounted) return null;

  const register = opts?.register ?? "kid";
  const useConfetti =
    !reduce &&
    opts != null &&
    opts.variant !== "credential" &&
    !(opts.variant === "levelup" && register === "parent") &&
    !(opts.variant === "setup" && register === "parent");
  const isSeal = opts?.variant === "credential";

  return createPortal(
    <AnimatePresence>
      {opts && (
        <m.div
          key="celebrate"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDone}
        >
          <m.div
            className="relative mx-4 flex max-w-sm flex-col items-center gap-3 rounded-3xl border border-gold-300/60 bg-paper px-8 py-8 text-center shadow-lift"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 12 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 240, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {useConfetti && (
              <div className="pointer-events-none absolute inset-0">
                <Burst
                  count={register === "kid" ? 22 : 14}
                  power={register === "kid" ? 140 : 100}
                />
              </div>
            )}

            {/* Hero mark */}
            {opts.emblemSrc ? (
              <m.img
                src={opts.emblemSrc}
                alt=""
                className="h-24 w-24 rounded-full object-cover ring-4 ring-gold-400/50"
                initial={reduce ? undefined : { scale: 0, rotate: -12 }}
                animate={reduce ? undefined : { scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.05 }}
              />
            ) : isSeal ? (
              <m.div
                initial={reduce ? undefined : { scale: 0, rotate: -18, opacity: 0 }}
                animate={reduce ? undefined : { scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <CredentialSeal size={92} label={opts.title} />
              </m.div>
            ) : opts.variant === "levelup" ? (
              <m.div
                className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 font-display text-3xl font-black text-white shadow-lift"
                initial={reduce ? undefined : { scale: 0 }}
                animate={reduce ? undefined : { scale: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 14 }}
              >
                ↑
              </m.div>
            ) : (
              <m.div
                className="flex h-20 w-20 items-center justify-center rounded-full bg-chip-green text-4xl"
                initial={reduce ? undefined : { scale: 0 }}
                animate={reduce ? undefined : { scale: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 14 }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </m.div>
            )}

            <h3 className="font-display text-xl font-bold text-ink">{opts.title}</h3>
            {opts.subtitle && <p className="text-sm text-soft">{opts.subtitle}</p>}
            {opts.xp != null && opts.xp > 0 && (
              <m.span
                className="inline-flex items-center gap-1 rounded-full bg-chip-amber px-3 py-1 font-display text-sm font-bold text-gold-700"
                initial={reduce ? undefined : { scale: 0, y: 8 }}
                animate={reduce ? undefined : { scale: 1, y: 0 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 260 }}
              >
                +{opts.xp} XP
              </m.span>
            )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
