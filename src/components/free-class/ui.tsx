"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { m } from "@/lib/motion";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { getChallengeFlag, type QuizStep } from "@/lib/funnel";

/* ══════════════════════════════════════════════════════════════════════════
   FREE-CLASS FUNNEL — the lane's shared surface kit, rebuilt on the board.

   Reference: `.planning/design-project-v2/boards/light-r1-c1.png` (the pricing
   screen) and `light-r0-c0.png` board 01. The funnel is now drawn from the same
   five objects the rest of the app is:

     · warm paper ground, nothing painted on the page itself
     · white 14px hairline CARDS (.club-b-card) for every neutral object
     · ONE brand-tinted card per screen (.club-b-warm) for the offer object,
       with the board's badge pill hung on its top edge
     · a solid ACCENT pill for the primary action, an INK pill for the
       secondary, a hairline card pill for the tertiary
     · tracked mono caps for eyebrows / section marks, Sora display for the
       masthead, tabular numerals everywhere a number appears

   WHAT DIED: `cta-button`, `paper-card`, `stack-row`, `testimonial-card`,
   `glow-border`, `section-divider`, `urgency-bar`, `text-gradient-gold`, the
   `night-*` raw ramp and every ring-gold-400 gradient bar. Nothing here paints
   a raw hex or a raw ramp step: every colour is paper / ink / soft / sand /
   card / accent, so the whole funnel inverts correctly in dark.

   COLOUR LAW: green/red is PRICE, lime is community sentiment, orange is brand
   + action. There is no price and no sentiment on this funnel, so the only
   chromatic thing on any of these screens is the accent — which is why the
   old chip-green "registered" / chip-amber "seats" pills are gone: success and
   scarcity are not price, so they read in ink on a hairline card instead.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Page ground ──────────────────────────────────────────────────────── */

export function FunnelPage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-paper text-ink">{children}</div>;
}

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
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
        <Link
          href="/free-class"
          className="f0-focus rounded font-display text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink"
        >
          {challenge ? (
            <>
              CHEAT <span className="text-accent">CODE</span> CLUB
            </>
          ) : (
            <>
              FAMILY <span className="text-accent">INVESTING</span> CLUB
            </>
          )}
        </Link>
        <Link
          href="/login"
          className="f0-focus rounded font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-soft transition-colors hover:text-ink"
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
    <div className="mx-auto w-full max-w-md px-5 pt-4">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button
            onClick={onBack}
            className="f0-focus f0-press shrink-0 rounded text-soft transition-colors hover:text-ink"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-sand"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <m.div
            className="h-full rounded-full bg-accent"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "tween", duration: 0.3 }}
          />
        </div>
        <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums tracking-[0.14em] text-soft">
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
    <div className="flex flex-1 items-start justify-center px-5 py-8 sm:items-center">
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

/* ── Masthead ─────────────────────────────────────────────────────────────
   The board's display heading register: tracked mono-caps eyebrow in the
   accent, a Sora display line, a body lede. Deliberately NOT `DisplayHead`
   from f0/parts: that primitive uppercases its title and takes the emphasis as
   a single trailing word, and every headline in this funnel is live marketing
   copy in sentence case with the mark mid-sentence. The register is the same;
   the title is a node so the copy survives verbatim. */
export function Mast({
  eyebrow,
  title,
  lede,
  align = "center",
  size = "lg",
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: "center" | "left";
  size?: "lg" | "md";
}) {
  const centered = align === "center";
  return (
    <header className={centered ? "text-center" : ""}>
      {eyebrow && (
        <p
          className={`flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent ${
            centered ? "justify-center" : ""
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h1
        className={`font-display font-extrabold leading-[1.08] tracking-[-0.02em] text-ink ${
          size === "lg" ? "text-[1.75rem] sm:text-[2.125rem]" : "text-[1.375rem] sm:text-[1.625rem]"
        } ${eyebrow ? "mt-3" : ""}`}
      >
        {title}
      </h1>
      {lede && (
        <p
          className={`mt-3 text-[15px] leading-relaxed text-soft ${
            centered ? "mx-auto max-w-sm" : "max-w-md"
          }`}
        >
          {lede}
        </p>
      )}
    </header>
  );
}

/** The accent underline the board draws under the one emphasised phrase. */
export function Marked({ children }: { children: React.ReactNode }) {
  return <span className="f0-underline-mark">{children}</span>;
}

/* ── Objects ──────────────────────────────────────────────────────────── */

/** Neutral white card — the default object of every funnel screen. */
export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return <As className={`club-b-card ${className}`}>{children}</As>;
}

/**
 * The ONE brand-tinted object per screen — the offer card. `badge` renders the
 * board's pill hung on the card's top edge (the "BEST VALUE" tab on the
 * pricing screen).
 */
export function WarmCard({
  children,
  badge,
  className = "",
}: {
  children: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={badge ? "relative pt-3" : ""}>
      {badge && (
        <span className="absolute right-4 top-0 z-10 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent-on)]">
          {badge}
        </span>
      )}
      <div className={`club-b-warm f0-grain ${className}`}>{children}</div>
    </div>
  );
}

/** A small hairline pill — eyebrow chips, trust chips, meta chips. */
export function Pill({
  children,
  tone = "quiet",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "quiet" | "accent" | "solid";
  className?: string;
}) {
  const tones: Record<string, string> = {
    quiet: "border-sand bg-card text-soft",
    accent: "border-[color:var(--accent-solid)] bg-card text-accent",
    solid: "border-transparent bg-accent text-[color:var(--accent-on)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* The board's `25,842 members in the Club` trust cells are deliberately NOT
   ported: this funnel has no verified standing member count to print in one,
   and inventing the numeral is forbidden. The landing's honest counts (families
   registered / seats left) stay as `Pill`s driven by the live API, and the soft
   fallback line covers the case where the real number is too small to show. */

/** Feature row with the board's small round accent check. */
export function CheckLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-accent"
        style={{ background: "color-mix(in srgb, var(--accent-solid) 15%, transparent)" }}
        aria-hidden
      >
        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
      </span>
      <span className="min-w-0 text-[14.5px] leading-snug text-ink">{children}</span>
    </div>
  );
}

/** Feature row carrying its own glyph (perks, activation hints). */
export function IconLine({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-accent"
        style={{ background: "color-mix(in srgb, var(--accent-solid) 13%, transparent)" }}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 text-[14.5px] leading-snug text-ink">{children}</span>
    </div>
  );
}

/**
 * The card's own icon mark — a tinted accent tile, board geometry. Deliberately
 * a TINT and not the solid `.club-b-orb`: the orb is the board's ACTION object,
 * and a solid orange circle that cannot be clicked reads as a button that does
 * nothing. `round` is the celebratory/identity variant.
 */
export function CardMark({
  icon: Icon,
  size = 44,
  round = false,
  glyph,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  size?: number;
  round?: boolean;
  /** Glyph size in px; defaults to roughly half the mark. */
  glyph?: number;
}) {
  const g = glyph ?? Math.round(size * 0.5);
  return (
    <span
      className={`grid shrink-0 place-items-center text-accent ${
        round ? "rounded-full" : "rounded-[12px]"
      }`}
      style={{
        width: size,
        height: size,
        background: "color-mix(in srgb, var(--accent-solid) 13%, transparent)",
      }}
      aria-hidden
    >
      <Icon className="" style={{ width: g, height: g }} />
    </span>
  );
}

/* ── Actions ──────────────────────────────────────────────────────────────
   Solid accent pill = the one primary action. Ink pill = the secondary.
   Hairline card pill = the tertiary. Nothing gradients. */

const ACTION_BASE =
  "f0-press f0-focus inline-flex items-center justify-center gap-2 rounded-full font-display font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const ACTION_TONE: Record<string, string> = {
  primary: "bg-accent text-[color:var(--accent-on)] hover:opacity-90",
  ink: "bg-ink text-paper hover:opacity-90",
  quiet: "border border-sand bg-card text-ink hover:border-[color:var(--accent-solid)]",
};

const ACTION_SIZE: Record<string, string> = {
  lg: "px-6 py-3.5 text-[15px]",
  md: "px-5 py-3 text-[14px]",
  sm: "px-4 py-2.5 text-[13px]",
};

export function Action({
  children,
  tone = "primary",
  size = "lg",
  href,
  external,
  onClick,
  disabled,
  full = true,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  tone?: "primary" | "ink" | "quiet";
  size?: "lg" | "md" | "sm";
  href?: string;
  /** Renders a plain anchor (API routes, off-app checkout). */
  external?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  full?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const cls = `${ACTION_BASE} ${ACTION_TONE[tone]} ${ACTION_SIZE[size]} ${
    full ? "w-full" : ""
  } ${className}`;
  if (href && external) {
    return (
      <a href={href} className={cls} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

/** The quiet "no thanks / skip" affordance — type only, no chrome. */
export function QuietAction({
  children,
  onClick,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const cls =
    "f0-focus block w-full rounded-full py-2 text-center font-display text-[14px] font-semibold text-soft transition-colors hover:text-ink";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/* ── Fine print ───────────────────────────────────────────────────────────
   Terms, guarantees and disclaimers. The container is the only thing this
   owns — the sentence is always the caller's, verbatim. */
export function Terms({
  children,
  icon: Icon,
  align = "center",
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  align?: "center" | "left";
}) {
  return (
    <p
      className={`flex items-start gap-1.5 text-[12px] leading-relaxed text-soft ${
        align === "center" ? "justify-center text-center" : ""
      }`}
    >
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

/**
 * Form-level error. NOT red: red is the price colour by law, and a mistyped
 * password is not a price. It reads as an ink-marked note against the paper,
 * announced to assistive tech.
 */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-3 border-l-2 border-ink pl-3 text-[13px] font-medium leading-snug text-ink"
    >
      {children}
    </p>
  );
}

/* ── Inputs ───────────────────────────────────────────────────────────── */

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
      <Icon className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-soft" />
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={`f0-focus w-full rounded-[14px] border border-sand py-3.5 pl-12 pr-4 font-body text-[15px] text-ink transition-colors placeholder:text-soft focus:border-[color:var(--accent-solid)] focus:outline-none ${
          readOnly ? "cursor-default bg-paper text-soft" : "bg-card"
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
      <div className="mb-6 text-center">
        <h2 className="font-display text-[1.375rem] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[1.5rem]">
          {stepDef.question}
        </h2>
        {stepDef.hint && <p className="mt-2 text-[14px] text-soft">{stepDef.hint}</p>}
      </div>
      <div className="space-y-2.5" role="radiogroup" aria-label={stepDef.question}>
        {stepDef.options.map((o) => {
          const active = selected === o.value;
          return (
            <button
              key={o.value}
              role="radio"
              aria-checked={active}
              onClick={() => onPick(o.value)}
              className={`club-b-card f0-focus f0-press flex w-full items-center gap-3 px-4 py-3.5 text-left ${
                active ? "club-b-card-lead" : ""
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors ${
                  active
                    ? "bg-accent text-[color:var(--accent-on)]"
                    : "border border-sand bg-paper"
                }`}
                aria-hidden
              >
                {active && <Check className="h-3 w-3" strokeWidth={3.5} />}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-bold text-ink">
                  {o.label}
                </span>
                {o.sub && <span className="mt-0.5 block text-[12.5px] text-soft">{o.sub}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Loading ──────────────────────────────────────────────────────────────
   LOADING IS NOT EMPTY. Every gate in this funnel keeps the page's chrome and
   shimmers the objects that are still arriving, rather than dropping the whole
   screen for a bare spinner on an empty page. */

export function FunnelSkeleton({ bar = false }: { bar?: boolean }) {
  return (
    <FunnelPage>
      <div className="h-14 w-full border-b border-sand" />
      {bar && (
        <div className="mx-auto w-full max-w-md px-5 pt-4">
          <div className="h-1 w-full rounded-full bg-sand" />
        </div>
      )}
      <div className="flex flex-1 items-start justify-center px-5 py-8 sm:items-center">
        <div
          className="w-full max-w-md space-y-4 motion-safe:animate-pulse"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="mx-auto h-3 w-32 rounded-full bg-sand" />
          <div className="mx-auto h-8 w-4/5 rounded-[10px] bg-sand" />
          <div className="mx-auto h-4 w-2/3 rounded-full bg-sand/70" />
          <div className="club-b-card h-36 w-full" />
          <div className="h-12 w-full rounded-full bg-sand" />
          <span className="sr-only">Loading…</span>
        </div>
      </div>
    </FunnelPage>
  );
}

/** Inline spinner for in-place waits. Inherits its host's colour, so the same
    component is legible inside an accent pill and on the paper. */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}
