"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { m } from "@/lib/motion";
import { ArrowLeft, Check } from "lucide-react";
import { getChallengeFlag, type QuizStep } from "@/lib/funnel";

/**
 * Warm-paper top bar — brand + log-in. Shared across every funnel page.
 *
 * Brand is variant-aware (Review P1 #2): the 5-Day Challenge funnel is a Cheat
 * Code Club offer, so the challenge variant renders the CHEAT CODE CLUB wordmark
 * end-to-end instead of FAMILY INVESTING CLUB (until cheatcode.com DNS lands and
 * the challenge lives on its own domain). Read client-side from the sticky
 * challenge flag so every step is coherent.
 */
export function TopBar() {
  const [challenge, setChallenge] = useState(false);
  useEffect(() => setChallenge(getChallengeFlag()), []);
  return (
    <div className="w-full border-b border-sand">
      <div className="max-w-lg mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/free-class" className="font-display text-sm font-bold tracking-wide text-ink">
          {challenge ? (
            <>
              CHEAT <span className="text-gold-700">CODE</span> CLUB
            </>
          ) : (
            <>
              FAMILY <span className="text-gold-700">INVESTING</span> CLUB
            </>
          )}
        </Link>
        <Link
          href="/login"
          className="text-xs font-display font-semibold text-soft hover:text-ink transition-colors"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}

/** Progress bar with optional back control. `current`/`total` are 1-based. */
export function ProgressBar({
  current,
  total,
  onBack,
}: {
  current: number;
  total: number;
  onBack?: () => void;
}) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full max-w-md mx-auto px-5 pt-4">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button
            onClick={onBack}
            className="text-soft hover:text-ink transition-colors shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}
        <div className="flex-1 h-1.5 rounded-full bg-sand overflow-hidden">
          <m.div
            className="h-full rounded-full bg-gold-500"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "tween", duration: 0.3 }}
          />
        </div>
        <span className="text-[11px] font-display font-bold text-soft tabular-nums shrink-0">
          {current}/{total}
        </span>
      </div>
    </div>
  );
}

/** Centered animated page shell — direction-aware slide. */
export function FunnelStage({
  children,
  stageKey,
  dir = 1,
}: {
  children: React.ReactNode;
  stageKey: string | number;
  dir?: number;
}) {
  return (
    <div className="flex-1 flex items-start sm:items-center justify-center px-5 py-8">
      <div className="w-full max-w-md">
        <m.div
          key={stageKey}
          initial={{ x: dir > 0 ? 60 : -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "tween", duration: 0.22 }}
        >
          {children}
        </m.div>
      </div>
    </div>
  );
}

/** Icon input field. */
export function Field({
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  autoFocus,
  readOnly,
}: {
  icon: React.ElementType;
  type?: string;
  placeholder: string;
  value: string;
  onChange?: (v: string) => void;
  autoFocus?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-soft" />
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full pl-11 pr-4 py-3.5 rounded-xl border border-sand text-ink placeholder:text-soft focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/20 transition-colors text-[15px] font-body ${
          readOnly ? "bg-sand/40 text-soft cursor-default" : "bg-card"
        }`}
      />
    </div>
  );
}

/** Radio-card quiz question. Auto-advance is the caller's job (onPick). */
export function QuizCard({
  stepDef,
  selected,
  onPick,
}: {
  stepDef: QuizStep;
  selected?: string;
  onPick: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="font-display text-2xl font-bold text-ink leading-snug">
          {stepDef.question}
        </h2>
        {stepDef.hint && <p className="text-soft text-sm mt-1.5">{stepDef.hint}</p>}
      </div>
      <div className="space-y-2.5">
        {stepDef.options.map((o) => {
          const active = selected === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onPick(o.value)}
              className={`w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-xl border transition-colors ${
                active
                  ? "border-gold-400 bg-gold-400/10"
                  : "border-sand bg-card hover:border-gold-300"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  active ? "border-gold-500 bg-gold-500" : "border-sand"
                }`}
              >
                {active && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className="min-w-0">
                <span className="block font-display font-semibold text-ink text-[15px]">
                  {o.label}
                </span>
                {o.sub && <span className="block text-xs text-soft mt-0.5">{o.sub}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
