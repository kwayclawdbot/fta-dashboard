"use client";

/**
 * Presentational step bodies for the full-screen signup wizard
 * (src/app/(auth)/onboarding/page.tsx). Warm-paper + gold register, token
 * palette so both themes work, 390px-first, big tappable choice cards.
 *
 * The ANSWER DATA is reused wholesale from the questionnaire's single source of
 * truth (onboarding-profile.ts EXPERIENCE_OPTIONS / GOAL_OPTIONS / … and the
 * knowledge bank in onboarding-knowledge.ts) — this file only changes the
 * PRESENTATION from the old dark auth-card steps to the gamified wizard cards.
 * The dark ProfileSteps.tsx stays untouched for the /onboarding/profile backfill.
 */

import { useState } from "react";
import { m } from "@/lib/motion";
import {
  Check,
  User,
  Users,
  GraduationCap,
  Minus,
  Plus,
  Sparkles,
  ArrowRight,
  TrendingUp,
  LineChart,
  Landmark,
  Compass,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  KID_AGE_OPTIONS,
  MARKET_INTEREST_OPTIONS,
  type ProfileDraft,
  type Experience,
  type Goal,
  type KidAgeRange,
  type MarketInterest,
} from "@/lib/onboarding-profile";
import type { KnowledgeCheck } from "@/lib/onboarding-knowledge";
import type { Register } from "@/lib/register";

// ── Shared chrome ─────────────────────────────────────────────────────────────

export function StepHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="text-center mb-6">
      {eyebrow && (
        <p className="text-[11px] font-bold uppercase tracking-wider text-gold-700 mb-2">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-tight">
        {title}
      </h2>
      {sub && <p className="text-soft text-sm sm:text-base mt-2 max-w-md mx-auto">{sub}</p>}
    </div>
  );
}

/** Big single-select card driven by a shared option array. */
function SelectCard({
  active,
  onClick,
  title,
  sub,
  icon: Icon,
  multi,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
  icon?: LucideIcon;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-3.5 ${
        active
          ? "border-gold-400 bg-gold-400/10 shadow-sm"
          : "border-sand bg-card hover:border-gold-300 hover:bg-gold-400/[0.04]"
      }`}
    >
      {Icon && (
        <span
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            active ? "bg-gold-400/20" : "bg-sand/70"
          }`}
        >
          <Icon className={`w-5 h-5 ${active ? "text-gold-700" : "text-soft"}`} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block font-display font-semibold text-[15px] ${active ? "text-gold-800" : "text-ink"}`}>
          {title}
        </span>
        {sub && <span className="block text-xs text-soft mt-0.5 leading-snug">{sub}</span>}
      </span>
      <span
        className={`shrink-0 w-6 h-6 flex items-center justify-center border-2 transition-colors ${
          multi ? "rounded-md" : "rounded-full"
        } ${active ? "border-gold-500 bg-gold-500" : "border-sand"}`}
      >
        {active && <Check className="w-3.5 h-3.5 text-white" />}
      </span>
    </button>
  );
}

// ── Who's joining (parent household) ─────────────────────────────────────────

function CountStepper({
  label,
  value,
  min,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card border-2 border-sand px-4 py-3.5">
      <span className="flex items-center gap-2.5 text-ink font-display font-semibold">
        <Icon className="w-5 h-5 text-gold-700" />
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Fewer ${label}`}
          className="w-9 h-9 rounded-full border-2 border-sand flex items-center justify-center text-soft hover:border-gold-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-7 text-center font-display font-bold text-xl text-ink tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`More ${label}`}
          className="w-9 h-9 rounded-full border-2 border-sand flex items-center justify-center text-soft hover:border-gold-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function WhoIsJoiningStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  const h = draft.household;
  // "Just me" is a first-class path: a solo adult is stored as a family of one
  // ({adults:1, kids:0}) — the data model never changes — but we surface no
  // "family" wording to them and skip the kid/ages sub-questions entirely.
  // Family-shaped if there are kids or more than one adult; otherwise solo.
  const isFamily = h.kids > 0 || h.adults > 1 || h.kid_age_ranges.length > 0;
  const [mode, setMode] = useState<"solo" | "family">(isFamily ? "family" : "solo");

  function chooseSolo() {
    setMode("solo");
    onChange({ household: { adults: 1, kids: 0, kid_age_ranges: [] } });
  }
  function chooseFamily() {
    setMode("family");
    // Guarantee a non-solo shape so recommendations + copy read as a family:
    // bump to two adults if we're coming from the solo default.
    onChange({ household: { ...h, adults: h.adults > 1 ? h.adults : 2 } });
  }

  function toggleRange(r: KidAgeRange) {
    const has = h.kid_age_ranges.includes(r);
    onChange({
      household: {
        ...h,
        kid_age_ranges: has ? h.kid_age_ranges.filter((x) => x !== r) : [...h.kid_age_ranges, r],
      },
    });
  }
  return (
    <div>
      <StepHeading
        eyebrow="Getting started"
        title="Who's joining?"
        sub="This shapes the lessons, pace, and how the club talks with you."
      />

      {/* First-class choice: solo vs family. */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={chooseSolo}
          aria-pressed={mode === "solo"}
          className={`p-5 rounded-2xl border-2 text-center transition-all ${
            mode === "solo"
              ? "border-gold-400 bg-gold-400/10 shadow-sm"
              : "border-sand bg-card hover:border-gold-300"
          }`}
        >
          <User className={`w-8 h-8 mx-auto mb-2.5 ${mode === "solo" ? "text-gold-700" : "text-soft"}`} />
          <p className={`font-display font-bold ${mode === "solo" ? "text-gold-800" : "text-ink"}`}>Just me</p>
          <p className="text-xs text-soft mt-1">Learning on my own</p>
        </button>
        <button
          type="button"
          onClick={chooseFamily}
          aria-pressed={mode === "family"}
          className={`p-5 rounded-2xl border-2 text-center transition-all ${
            mode === "family"
              ? "border-gold-400 bg-gold-400/10 shadow-sm"
              : "border-sand bg-card hover:border-gold-300"
          }`}
        >
          <Users className={`w-8 h-8 mx-auto mb-2.5 ${mode === "family" ? "text-gold-700" : "text-soft"}`} />
          <p className={`font-display font-bold ${mode === "family" ? "text-gold-800" : "text-ink"}`}>My family</p>
          <p className="text-xs text-soft mt-1">Us and our kids</p>
        </button>
      </div>

      {/* Family details — only when "My family" is chosen. */}
      {mode === "family" && (
        <div className="mt-5 space-y-3">
          <CountStepper
            label="Grown-ups"
            value={h.adults}
            min={1}
            icon={Users}
            onChange={(n) => onChange({ household: { ...h, adults: n } })}
          />
          <CountStepper
            label="Kids"
            value={h.kids}
            min={0}
            icon={GraduationCap}
            onChange={(n) =>
              onChange({
                household: { ...h, kids: n, kid_age_ranges: n === 0 ? [] : h.kid_age_ranges },
              })
            }
          />
          {h.kids > 0 && (
            <div className="pt-1">
              <p className="text-sm font-semibold text-ink mb-2.5">
                How old are they?{" "}
                <span className="text-soft font-normal">Pick all that apply</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {KID_AGE_OPTIONS.map((o) => {
                  const on = h.kid_age_ranges.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggleRange(o.value)}
                      className={`px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                        on
                          ? "bg-gold-400/15 border-gold-400 text-gold-800"
                          : "bg-card border-sand text-soft hover:border-gold-300"
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
      )}

      {mode === "solo" && (
        <p className="mt-4 text-center text-sm text-soft">
          Perfect — we&apos;ll set up your own investing home. You can always add
          family later from Settings.
        </p>
      )}
    </div>
  );
}

// ── Kid age (kid variant of "who's joining") ─────────────────────────────────

export function KidAgeStep({
  ageBand,
  onChange,
}: {
  ageBand: "kids" | "teens" | "";
  onChange: (v: "kids" | "teens") => void;
}) {
  const opts = [
    { value: "kids" as const, label: "I'm a Kid", range: "8 – 12", icon: Sparkles },
    { value: "teens" as const, label: "I'm a Teen", range: "13 – 17", icon: GraduationCap },
  ];
  return (
    <div>
      <StepHeading title="How old are you?" sub="We'll pick the right lessons and adventures for you." />
      <div className="grid grid-cols-2 gap-3">
        {opts.map((a) => {
          const on = ageBand === a.value;
          const Icon = a.icon;
          return (
            <button
              key={a.value}
              type="button"
              onClick={() => onChange(a.value)}
              className={`p-6 rounded-2xl border-2 text-center transition-all ${
                on ? "border-gold-400 bg-gold-400/10 shadow-sm" : "border-sand bg-card hover:border-gold-300"
              }`}
            >
              <Icon className={`w-8 h-8 mx-auto mb-3 ${on ? "text-gold-700" : "text-soft"}`} />
              <p className={`font-display font-bold text-lg ${on ? "text-gold-800" : "text-ink"}`}>{a.label}</p>
              <p className="text-xs text-soft mt-1">{a.range}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Experience ────────────────────────────────────────────────────────────────

export function ExperienceStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Where you're starting"
        title="Where are you starting from?"
        sub="Every level has a seat here. There's no wrong answer."
      />
      <div className="space-y-2.5">
        {EXPERIENCE_OPTIONS.map((o) => (
          <SelectCard
            key={o.value}
            active={draft.experience === o.value}
            onClick={() => onChange({ experience: o.value as Experience })}
            title={o.label}
            sub={o.sub}
            icon={Compass}
          />
        ))}
      </div>
    </div>
  );
}

// ── Goals (multi-select) ──────────────────────────────────────────────────────

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
    <div>
      <StepHeading
        eyebrow="Your goals"
        title="What would make this worth it?"
        sub="Pick everything that matters — we'll point you at the right things first."
      />
      <div className="space-y-2.5">
        {GOAL_OPTIONS.map((o) => (
          <SelectCard
            key={o.value}
            multi
            active={draft.goals.includes(o.value)}
            onClick={() => toggle(o.value)}
            title={o.label}
            sub={o.sub}
          />
        ))}
      </div>
      {draft.goals.includes("other") && (
        <input
          type="text"
          value={draft.goals_other}
          onChange={(e) => onChange({ goals_other: e.target.value })}
          placeholder="What else are you hoping for?"
          className="mt-3 w-full px-4 py-3 rounded-xl bg-card border-2 border-sand text-ink placeholder:text-soft/70 focus:outline-none focus:border-gold-400 transition-colors text-sm"
        />
      )}
    </div>
  );
}

// ── Focus (trading / investing / both) ───────────────────────────────────────

const INTEREST_ICON: Record<MarketInterest, LucideIcon> = {
  investing: Landmark,
  trading: TrendingUp,
  both: LineChart,
  unsure: Compass,
};

export function FocusStep({
  draft,
  onChange,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Your focus"
        title="Investing, trading, or both?"
        sub="This tunes what we teach first — and how Kai talks with your family."
      />
      <div className="space-y-2.5">
        {MARKET_INTEREST_OPTIONS.map((o) => (
          <SelectCard
            key={o.value}
            active={draft.market_interest === o.value}
            onClick={() => onChange({ market_interest: o.value as MarketInterest })}
            title={o.label}
            sub={o.sub}
            icon={INTEREST_ICON[o.value]}
          />
        ))}
      </div>
    </div>
  );
}

// ── Knowledge check (one true/false per page, with instant feedback) ─────────

export function KnowledgeCheckStep({
  check,
  index,
  total,
  answer,
  onAnswer,
  register,
}: {
  check: KnowledgeCheck;
  index: number;
  total: number;
  answer: boolean | undefined;
  onAnswer: (v: boolean) => void;
  register: Register;
}) {
  const answered = answer !== undefined;
  const correct = answered && answer === check.answer;
  const eyebrow =
    register === "kid" ? `Brain teaser ${index + 1} of ${total}` : `Quick check ${index + 1} of ${total}`;
  return (
    <div>
      <StepHeading eyebrow={eyebrow} title="True or false?" />
      <div className="rounded-2xl border-2 border-sand bg-card p-5 sm:p-6 mb-5">
        <p className="font-display text-lg sm:text-xl font-semibold text-ink text-center leading-snug">
          {check.statement}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { v: true, label: "True" },
          { v: false, label: "False" },
        ].map((opt) => {
          const chosen = answer === opt.v;
          const isRightChoice = check.answer === opt.v;
          // After answering, gently color the correct choice green + the wrong
          // pick amber — never a harsh red "fail" (every answer is celebrated).
          let tone = "border-sand bg-card hover:border-gold-300 text-ink";
          if (answered) {
            if (isRightChoice) tone = "border-green-500 bg-green-500/10 text-green-700";
            else if (chosen) tone = "border-gold-400 bg-gold-400/10 text-gold-800";
            else tone = "border-sand bg-card text-soft opacity-60";
          } else if (chosen) {
            tone = "border-gold-400 bg-gold-400/10 text-gold-800";
          }
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => !answered && onAnswer(opt.v)}
              disabled={answered}
              className={`py-5 rounded-2xl border-2 font-display font-bold text-lg transition-all ${tone}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {answered && (
        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${
            correct ? "bg-green-500/10 text-green-700" : "bg-gold-400/10 text-gold-800"
          }`}
        >
          <span className="mt-0.5 shrink-0">
            {correct ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          </span>
          <span className="leading-snug">
            {correct ? "" : "Good guess — "}
            {check.teach}
          </span>
        </m.div>
      )}
    </div>
  );
}

// ── Username ──────────────────────────────────────────────────────────────────

export function UsernameStep({
  value,
  onChange,
  warning,
  register,
}: {
  value: string;
  onChange: (v: string) => void;
  warning?: string;
  register: Register;
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Your profile"
        title={register === "kid" ? "What should we call you?" : "Pick your display name"}
        sub="This is how you'll show up in the club — friends and family @mention you by it."
      />
      <div className="relative max-w-sm mx-auto">
        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-soft" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={register === "kid" ? "Your name" : "e.g. Marcus J"}
          autoFocus
          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-card border-2 border-sand text-ink text-lg font-display font-semibold text-center placeholder:font-normal placeholder:text-soft/70 focus:outline-none focus:border-gold-400 transition-colors"
        />
      </div>
      {warning && (
        <p className="mt-3 text-xs text-gold-800 text-center max-w-sm mx-auto">{warning}</p>
      )}
    </div>
  );
}

// ── Set password (invited-user preamble) ─────────────────────────────────────

export const MIN_PASSWORD_LEN = 8;

/**
 * Shown only to admin-invited users (who arrive with no password) as the first
 * interactive step of the wizard. Sets the credential they'll use to sign in
 * from /login afterwards. Warm-paper / gold register, token palette (both
 * themes), 390px-first.
 */
export function PasswordStep({
  value,
  confirm,
  onChange,
  onConfirmChange,
  show,
  onToggleShow,
  error,
  register,
  email,
}: {
  value: string;
  confirm: string;
  onChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  error?: string;
  register: Register;
  email?: string;
}) {
  const tooShort = value.length > 0 && value.length < MIN_PASSWORD_LEN;
  const mismatch = confirm.length > 0 && confirm !== value;
  return (
    <div>
      <StepHeading
        eyebrow="Secure your account"
        title={register === "kid" ? "Create a password" : "Set your password"}
        sub={
          register === "kid"
            ? "Pick a secret password so only you can get into your clubhouse."
            : "You were invited in — create a password so you can sign back in anytime."
        }
      />

      {email && (
        <div className="mb-4 flex items-center justify-center gap-2 text-sm text-soft">
          <ShieldCheck className="w-4 h-4 text-gold-700" />
          <span className="text-ink font-medium">{email}</span>
        </div>
      )}

      <div className="space-y-3 max-w-sm mx-auto">
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-soft" />
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="New password"
            autoFocus
            autoComplete="new-password"
            className="w-full pl-12 pr-12 py-4 rounded-2xl bg-card border-2 border-sand text-ink text-base focus:outline-none focus:border-gold-400 transition-colors"
          />
          <button
            type="button"
            onClick={onToggleShow}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-soft hover:text-ink transition-colors"
          >
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-soft" />
          <input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => onConfirmChange(e.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-card border-2 border-sand text-ink text-base focus:outline-none focus:border-gold-400 transition-colors"
          />
        </div>

        {tooShort && (
          <p className="text-xs text-soft text-center">
            Use at least {MIN_PASSWORD_LEN} characters.
          </p>
        )}
        {mismatch && (
          <p className="text-xs text-gold-800 text-center">
            Those don&apos;t match yet.
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}

// ── Welcome splash ────────────────────────────────────────────────────────────

export function WelcomeSplash({
  name,
  register,
  onStart,
}: {
  name?: string;
  register: Register;
  onStart: () => void;
}) {
  const hi = name ? `${name}` : "there";
  const title =
    register === "kid"
      ? `Hi ${hi}! Ready to start?`
      : register === "teen"
        ? `Welcome, ${hi}.`
        : `Welcome${name ? `, ${hi}` : ""}!`;
  const sub =
    register === "kid"
      ? "Let's set up your corner of the clubhouse. A few quick questions and you're in!"
      : "Let's set up your investing home. It takes about two minutes — a few quick questions so we can build the club around you.";
  return (
    <div className="text-center">
      <m.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 16 }}
        className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gold-400/15 border-2 border-gold-400/30 flex items-center justify-center"
      >
        <Sparkles className="w-10 h-10 text-gold-600" />
      </m.div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-tight break-words px-2">
        {title}
      </h1>
      <p className="text-soft text-base mt-3 max-w-md mx-auto leading-relaxed">{sub}</p>
      <button
        onClick={onStart}
        className="cta-button inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base mt-8"
      >
        Let&apos;s go
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
