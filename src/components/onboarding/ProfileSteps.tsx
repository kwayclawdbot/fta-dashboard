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
import { BoardSection } from "@/components/clubhome/board";

/**
 * Reusable profile-building step screens — shared by the main onboarding flow
 * (src/app/(auth)/onboarding/page.tsx) and the standalone backfill route
 * (src/app/(auth)/onboarding/profile/page.tsx). Presentational + controlled:
 * each takes the current draft and an onChange.
 *
 * REGISTER: warm paper + board cards, same as its neighbours WizardSteps.tsx
 * and the /onboarding/profile page shell. This file used to be the last raw
 * dark-ramp survivor on that route, which made the backfill flow read as a
 * different application from the shell hosting it. Every ground is now
 * `.club-b-card` (the board's neutral card), the one branded object per step is
 * `.club-b-warm`, and every colour goes through a semantic token so both themes
 * render without a `dark:` variant.
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
 * The one branded object on a profile step: a warm board tile carrying the
 * step's emblem. It replaces the old gold halo motif — the board draws warmth
 * as a tinted CARD, not as a glow, and a tinted card is the only thing that
 * survives the theme flip without hardcoded hexes.
 */
function StepMotif({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div
      className="club-b-warm mx-auto mb-4 grid h-14 w-14 place-items-center"
      aria-hidden="true"
    >
      <Icon className="h-6 w-6 text-accent" />
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
      <h2 className="font-display text-xl font-bold text-ink mb-2">{title}</h2>
      <p className="text-soft text-sm font-body max-w-sm mx-auto">{sub}</p>
    </div>
  );
}

/* The shared answer row. One geometry for every single- and multi-select step
   so the five screens read as one questionnaire: board card, mark on the left,
   label + sub in the middle.
 *
 * SELECTED = `.club-b-card-lead`, the board's own "this is the one" edge
 * (accent border + soft bloom), NOT a Tailwind `border-*`/`bg-*` override.
 * globals.css is unlayered, so `.club-b-card`'s `border` shorthand outranks
 * every Tailwind border utility no matter the specificity — a `border-gold-400`
 * on a `.club-b-card` is silently dead. Composing the two board classes is the
 * only override that actually paints. Selection is an ACTION, so its colour is
 * the accent, never a market green/red.
 */
function ChoiceRow({
  active,
  onClick,
  title,
  sub,
  multi,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
  multi?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`club-b-card f0-focus f0-press flex w-full items-start gap-3 text-left transition-colors ${
        compact ? "p-3.5" : "p-4"
      } ${active ? "club-b-card-lead" : ""}`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${
          multi ? "rounded-md" : "rounded-full"
        } ${active ? "border-gold-500 bg-gold-500" : "border-sand"}`}
      >
        {active && (
          <Check className="h-3 w-3 text-[color:var(--accent-on)]" />
        )}
      </span>
      <span className="min-w-0">
        <span
          className={`block font-display text-sm font-semibold ${
            active ? "text-gold-800" : "text-ink"
          }`}
        >
          {title}
        </span>
        {sub && (
          <span className="mt-0.5 block text-xs text-soft font-body">{sub}</span>
        )}
      </span>
    </button>
  );
}

/* Fields: hairline board card, ink text, soft placeholder. `f0-focus` sits on
   the focusable element itself, never on a wrapper — it draws the accent ring
   in the page colour, which is why the field needs no focus border of its own
   (and could not have one: see the unlayered-CSS note above). */
const FIELD =
  "club-b-card f0-focus w-full px-4 py-3 text-ink placeholder:text-soft/70 text-sm font-body";

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
    <div className="club-b-card flex items-center justify-between px-4 py-3">
      <span className="flex items-center gap-2.5 text-ink font-body">
        <Icon className="w-5 h-5 text-gold-700" />
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="f0-focus f0-press w-8 h-8 rounded-full border border-sand flex items-center justify-center text-soft hover:border-gold-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-7 text-center font-mono text-base font-bold text-ink tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
          className="f0-focus f0-press w-8 h-8 rounded-full border border-sand flex items-center justify-center text-soft hover:border-gold-300 transition-colors"
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
          <p className="text-sm font-semibold text-ink mb-2">
            How old are they? <span className="text-soft font-normal">Pick all that apply</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {KID_AGE_OPTIONS.map((o) => {
              const on = h.kid_age_ranges.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggleRange(o.value)}
                  aria-pressed={on}
                  className={`f0-focus f0-press px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
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
        {EXPERIENCE_OPTIONS.map((o) => (
          <ChoiceRow
            key={o.value}
            active={draft.experience === o.value}
            onClick={() => onChange({ experience: o.value as Experience })}
            title={o.label}
            sub={o.sub}
          />
        ))}
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
        {MARKET_INTEREST_OPTIONS.map((o) => (
          <ChoiceRow
            key={o.value}
            active={draft.market_interest === o.value}
            onClick={() => onChange({ market_interest: o.value as MarketInterest })}
            title={o.label}
            sub={o.sub}
          />
        ))}
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
        {GOAL_OPTIONS.map((o) => (
          <ChoiceRow
            key={o.value}
            multi
            compact
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
          aria-label="What else are you hoping for?"
          className={FIELD}
        />
      )}
      <div>
        <label
          htmlFor="profile-motivation"
          className="block text-sm font-semibold text-ink mb-1.5"
        >
          What would make this a win for your family?{" "}
          <span className="text-soft font-normal">Optional</span>
        </label>
        <textarea
          id="profile-motivation"
          value={draft.motivation}
          onChange={(e) => onChange({ motivation: e.target.value })}
          rows={2}
          placeholder="In your own words…"
          className={`${FIELD} resize-none`}
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
              aria-pressed={on}
              className={`club-b-card f0-focus f0-press w-full px-4 py-3 text-left text-sm font-semibold transition-colors ${
                on ? "club-b-card-lead text-gold-800" : "text-soft"
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
        <div className="club-b-warm w-14 h-14 mx-auto grid place-items-center">
          <Sparkles className="w-7 h-7 text-accent" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-ink mb-3">{title}</h2>
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li
                key={i}
                className="text-soft text-sm font-body flex items-center justify-center gap-2"
              >
                <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <BoardSection
        id="profile-start-here"
        label="Start here —"
        mark="built around your answers"
      >
        <div className="mt-3 space-y-2.5">
          {recommendations.map((r) => {
            const Icon = ICONS[r.icon] ?? BookOpen;
            return (
              <div
                key={r.key}
                className="club-b-card flex items-center gap-3 p-3.5"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/12 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-gold-700" />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm text-ink">{r.title}</p>
                  <p className="text-xs text-soft font-body">{r.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </BoardSection>
    </div>
  );
}
