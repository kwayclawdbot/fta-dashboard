"use client";

import {
  Users,
  GraduationCap,
  Minus,
  Plus,
  Check,
  Target,
  Compass,
  Star,
  LineChart,
  CalendarDays,
  BookOpen,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  KID_AGE_OPTIONS,
  HEAR_ABOUT_OPTIONS,
  MARKET_INTEREST_OPTIONS,
  type ProfileDraft,
  type Experience,
  type Goal,
  type KidAgeRange,
  type HearAbout,
  type MarketInterest,
  type Recommendation,
} from "@/lib/onboarding-profile";
import { SunCircle, Sparkle } from "@/components/fic/glyphs/motifs";

/**
 * Reusable profile-building step screens — shared by the main onboarding flow
 * (src/app/(auth)/onboarding/page.tsx) and the standalone backfill route
 * (src/app/(auth)/onboarding/profile/page.tsx). Presentational + controlled:
 * each takes the current draft and an onChange. Auth register (midnight/gold).
 */

const ICONS: Record<string, LucideIcon> = {
  Target,
  Compass,
  Star,
  LineChart,
  CalendarDays,
  BookOpen,
  Users,
};

/**
 * A light per-step motif (audit #20) — a gold sun-circle halo behind a small
 * emblem'd icon with a sparkle accent. It warms the "built-for-you" moment so
 * each profile step reads as a crafted screen, not a plain centered card.
 * Reuses the shared FIC glyph kit (no new/paid art). Gold tokens sit correctly
 * on the midnight auth backdrop and hold up in either theme.
 */
function StepMotif({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="relative mx-auto mb-4 h-16 w-16" aria-hidden="true">
      <SunCircle className="absolute inset-0 h-full w-full" opacity={0.16} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold-400/25 bg-gold-400/10">
          <Icon className="h-6 w-6 text-gold-500" />
        </div>
      </div>
      <Sparkle className="absolute -right-0.5 -top-0.5 h-4 w-4" />
    </div>
  );
}

function StepHead({
  title,
  sub,
  icon,
}: {
  title: string;
  sub: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="text-center">
      {icon && <StepMotif icon={icon} />}
      <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">{title}</h2>
      <p className="text-midnight-400 text-sm font-body max-w-sm mx-auto">{sub}</p>
    </div>
  );
}

// ── Household ────────────────────────────────────────────────────────────────

function Stepper({
  label,
  value,
  onChange,
  min,
  icon: Icon,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-midnight-900 border border-sand px-4 py-3">
      <span className="flex items-center gap-2.5 text-midnight-100 font-body">
        <Icon className="w-5 h-5 text-gold-500" />
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="w-8 h-8 rounded-full border border-sand flex items-center justify-center text-midnight-200 hover:border-gold-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-6 text-center font-display font-bold text-lg text-midnight-50 tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
          className="w-8 h-8 rounded-full border border-sand flex items-center justify-center text-midnight-200 hover:border-gold-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function HouseholdStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  const h = draft.household;
  function toggleRange(r: KidAgeRange) {
    const has = h.kid_age_ranges.includes(r);
    onChange({
      household: {
        ...h,
        kid_age_ranges: has
          ? h.kid_age_ranges.filter((x) => x !== r)
          : [...h.kid_age_ranges, r],
      },
    });
  }
  return (
    <div className="space-y-6">
      <StepHead
        icon={Users}
        title="Who's in your family?"
        sub="This shapes the lessons, missions, and pace we put in front of you."
      />
      <div className="space-y-3">
        <Stepper
          label="Adults"
          value={h.adults}
          min={1}
          icon={Users}
          onChange={(n) => onChange({ household: { ...h, adults: n } })}
        />
        <Stepper
          label="Kids"
          value={h.kids}
          min={0}
          icon={GraduationCap}
          onChange={(n) =>
            onChange({
              household: {
                ...h,
                kids: n,
                kid_age_ranges: n === 0 ? [] : h.kid_age_ranges,
              },
            })
          }
        />
      </div>
      {h.kids > 0 && (
        <div>
          <p className="text-sm font-medium text-midnight-200 mb-2">
            How old are they? <span className="text-midnight-500 font-normal">Pick all that apply</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {KID_AGE_OPTIONS.map((o) => {
              const on = h.kid_age_ranges.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggleRange(o.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    on
                      ? "bg-gold-400/10 border-gold-400/40 text-gold-600"
                      : "bg-midnight-900 border-sand text-midnight-300 hover:border-gold-300"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Experience ───────────────────────────────────────────────────────────────

export function ExperienceStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  return (
    <div className="space-y-6">
      <StepHead
        icon={Compass}
        title="Where are you starting from?"
        sub="Every level has a seat here. There's no wrong answer."
      />
      <div className="space-y-2.5">
        {EXPERIENCE_OPTIONS.map((o) => {
          const on = draft.experience === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange({ experience: o.value as Experience })}
              className={`w-full text-left p-4 rounded-lg border transition-colors flex items-start gap-3 ${
                on
                  ? "bg-gold-400/5 border-gold-400/40"
                  : "bg-midnight-900 border-sand hover:border-gold-300"
              }`}
            >
              <span
                className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  on ? "border-gold-500 bg-gold-500" : "border-midnight-500"
                }`}
              >
                {on && <Check className="w-3 h-3 text-night-950" />}
              </span>
              <span className="min-w-0">
                <span
                  className={`block font-display font-semibold text-sm ${
                    on ? "text-gold-600" : "text-midnight-100"
                  }`}
                >
                  {o.label}
                </span>
                <span className="block text-xs text-midnight-400 mt-0.5 font-body">{o.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Market interest (trading vs investing) ───────────────────────────────────

export function MarketInterestStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  return (
    <div className="space-y-6">
      <StepHead
        icon={TrendingUp}
        title="Investing, trading, or both?"
        sub="This tunes what we teach first — and how Kai talks with your family."
      />
      <div className="space-y-2.5">
        {MARKET_INTEREST_OPTIONS.map((o) => {
          const on = draft.market_interest === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange({ market_interest: o.value as MarketInterest })}
              className={`w-full text-left p-4 rounded-lg border transition-colors flex items-start gap-3 ${
                on
                  ? "bg-gold-400/5 border-gold-400/40"
                  : "bg-midnight-900 border-sand hover:border-gold-300"
              }`}
            >
              <span
                className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  on ? "border-gold-500 bg-gold-500" : "border-midnight-500"
                }`}
              >
                {on && <Check className="w-3 h-3 text-night-950" />}
              </span>
              <span className="min-w-0">
                <span
                  className={`block font-display font-semibold text-sm ${
                    on ? "text-gold-600" : "text-midnight-100"
                  }`}
                >
                  {o.label}
                </span>
                <span className="block text-xs text-midnight-400 mt-0.5 font-body">{o.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Goals ────────────────────────────────────────────────────────────────────

export function GoalsStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  function toggle(g: Goal) {
    const has = draft.goals.includes(g);
    onChange({ goals: has ? draft.goals.filter((x) => x !== g) : [...draft.goals, g] });
  }
  return (
    <div className="space-y-6">
      <StepHead
        icon={Target}
        title="What would make this worth it?"
        sub="Pick everything that matters — we'll point you at the right things first."
      />
      <div className="grid grid-cols-1 gap-2.5">
        {GOAL_OPTIONS.map((o) => {
          const on = draft.goals.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-center gap-3 ${
                on
                  ? "bg-gold-400/5 border-gold-400/40"
                  : "bg-midnight-900 border-sand hover:border-gold-300"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                  on ? "border-gold-500 bg-gold-500" : "border-midnight-500"
                }`}
              >
                {on && <Check className="w-3 h-3 text-night-950" />}
              </span>
              <span className="min-w-0">
                <span
                  className={`block font-display font-semibold text-sm ${
                    on ? "text-gold-600" : "text-midnight-100"
                  }`}
                >
                  {o.label}
                </span>
                <span className="block text-xs text-midnight-400 mt-0.5 font-body">{o.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
      {draft.goals.includes("other") && (
        <input
          type="text"
          value={draft.goals_other}
          onChange={(e) => onChange({ goals_other: e.target.value })}
          placeholder="What else are you hoping for?"
          className="w-full px-4 py-3 rounded-lg bg-midnight-900 border border-sand text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-sm font-body"
        />
      )}
      <div>
        <label className="block text-sm font-medium text-midnight-200 mb-1.5">
          What would make this a win for your family?{" "}
          <span className="text-midnight-500 font-normal">Optional</span>
        </label>
        <textarea
          value={draft.motivation}
          onChange={(e) => onChange({ motivation: e.target.value })}
          rows={2}
          placeholder="In your own words…"
          className="w-full px-4 py-3 rounded-lg bg-midnight-900 border border-sand text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-sm font-body resize-none"
        />
      </div>
    </div>
  );
}

// ── Hear about ───────────────────────────────────────────────────────────────

export function HearAboutStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  return (
    <div className="space-y-6">
      <StepHead icon={Star} title="How did you find us?" sub="Totally optional — it just helps us reach more families like yours." />
      <div className="grid grid-cols-1 gap-2.5">
        {HEAR_ABOUT_OPTIONS.map((o) => {
          const on = draft.hear_about === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange({ hear_about: o.value as HearAbout })}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                on
                  ? "bg-gold-400/5 border-gold-400/40 text-gold-600"
                  : "bg-midnight-900 border-sand text-midnight-200 hover:border-gold-300"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Personalized welcome (final screen) ──────────────────────────────────────

export function PersonalizedWelcome({
  title,
  lines,
  recommendations,
}: {
  title: string;
  lines: string[];
  recommendations: Recommendation[];
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-gold-400/10 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-gold-500" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-midnight-100 mb-3">{title}</h2>
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li
                key={i}
                className="text-midnight-300 text-sm font-body flex items-center justify-center gap-2"
              >
                <span className="w-1 h-1 rounded-full bg-gold-500 shrink-0" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-midnight-500 text-center mb-3">
          Start here — built around your answers
        </p>
        <div className="space-y-2.5">
          {recommendations.map((r) => {
            const Icon = ICONS[r.icon] ?? BookOpen;
            return (
              <div
                key={r.key}
                className="flex items-center gap-3 p-3.5 rounded-lg bg-midnight-900 border border-sand"
              >
                <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-gold-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm text-midnight-100">{r.title}</p>
                  <p className="text-xs text-midnight-400 font-body">{r.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
