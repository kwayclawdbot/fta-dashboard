import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { familyRegister } from "@/components/family/register";

/* ══════════════════════════════════════════════════════════════════════════
   FAMILY MODE — the shared surface vocabulary for F1–F9 (Canvas v2, lane L1).

   Everything on the nine family screens is built from the objects in this file
   plus the F0 parts, so hierarchy comes from TYPE, RULES and identity — never
   from a rounded-rect card grid. The brand register bans boxed bento layouts;
   the replacement here is the ledger, the hairline, and the numeral.

   COLOUR: Family Mode is warm gold-orange, and purple is out of the system.
   `familyGold` below pins the accent for the whole subtree so a family screen
   renders gold even if the shell happens to be in club register — a teen
   looking at their own account should never see the Club's volt orange leak in.

   COLOUR LAW, unchanged: green/red = PRICE only · lime = COMMUNITY SENTIMENT
   only · gold/orange = BRAND + ACTION only · kai blue = Kai/AI only.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The family colour pin. `familyRegister` re-points the F0 primitives' hardcoded
 * volt stops at whatever accent the shell is in; this goes one step further and
 * pins the accent ITSELF to the constant metallic-gold ramp (--fg*), so Family
 * Mode is warm gold on every surface in this lane regardless of shell register.
 * Nothing outside the subtree is affected and no token is redefined globally.
 */
export const familyGold: CSSProperties = {
  ...familyRegister,
  "--accent-a": "var(--fg400)",
  "--accent-b": "var(--fg500)",
  "--accent-solid": "var(--fg500)",
  "--accent-strong": "var(--fg400)",
  // Orange TEXT rides the gold ramp (the volt ramp is frozen across themes).
  // Pinning g600/g700 to the metallic ramp keeps `text-gold-700` warm gold here
  // even when the shell register is club.
  "--g600": "var(--fg600)",
  "--g700": "var(--fg700)",
} as CSSProperties;

/** Every family screen's root. One place that owns the register + the measure. */
export function FamilySurface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div style={familyGold} className={`mx-auto w-full max-w-3xl ${className}`}>
      {children}
    </div>
  );
}

/* ── Masthead ─────────────────────────────────────────────────────────────
   The canvas annotates one word per headline ("learn about tonight",
   "learn together"). There is no handwriting face in this system, so the
   emphasis is carried by .f0-circle-mark / .f0-underline-mark on a single
   word — never on a phrase, or the mark stops meaning anything. */
export function FamilyMast({
  eyebrow,
  title,
  mark,
  markStyle = "underline",
  lede,
  aside,
}: {
  eyebrow?: string;
  /** Rendered before the marked word. */
  title: string;
  /** The ONE word that carries the annotation. */
  mark?: string;
  markStyle?: "underline" | "circle";
  lede?: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase leading-[1.05] text-ink">
          {title}
          {mark && (
            <>
              {" "}
              <span
                className={markStyle === "circle" ? "f0-circle-mark" : "f0-underline-mark"}
              >
                {mark}
              </span>
            </>
          )}
        </h1>
        {lede && <p className="mt-3 max-w-md text-[15px] leading-relaxed text-soft">{lede}</p>}
      </div>
      {aside && <div className="shrink-0 pt-1">{aside}</div>}
    </header>
  );
}

/* ── Back line ────────────────────────────────────────────────────────────
   The canvas puts a ← at the top of every drill-down. A hairline text link,
   not a chrome button. */
export function BackLine({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="f0-focus f0-press inline-flex items-center gap-1.5 text-[13px] font-display font-bold uppercase tracking-[0.08em] text-soft transition-colors hover:text-ink"
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}

/* ── XP tag ───────────────────────────────────────────────────────────────
   The canvas's "⚡ +50". XP is a reward for an action, so it is brand/ACTION
   colour by law — never green (that is price) and never lime (that is
   community sentiment). */
export function XpTag({
  amount,
  prefix = "+",
  className = "",
}: {
  amount: number;
  prefix?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-display text-[12px] font-extrabold uppercase tracking-[0.08em] text-gold-700 ${className}`}
    >
      {prefix}
      {amount.toLocaleString()} XP
    </span>
  );
}

/* ── Numeral ──────────────────────────────────────────────────────────────
   The stat as it appears everywhere in the canvas: a big tabular numeral over
   a small-caps label. Sits directly on the paper — no box. */
export function Numeral({
  value,
  label,
  tone = "ink",
  size = "md",
}: {
  value: string;
  label: string;
  /** `price` is the ONLY tone that may go green/red; `sentiment` the only lime. */
  tone?: "ink" | "price-up" | "price-down" | "sentiment" | "accent";
  size?: "sm" | "md" | "lg";
}) {
  const toneClass =
    tone === "price-up"
      ? "text-price-up"
      : tone === "price-down"
        ? "text-price-down"
        : tone === "sentiment"
          ? "text-sentiment"
          : tone === "accent"
            ? "text-gold-700"
            : "text-ink";
  const sizeClass =
    size === "lg" ? "text-display-1" : size === "sm" ? "text-[22px]" : "text-display-2";
  return (
    <div className="min-w-0">
      <p className={`font-display font-extrabold tabular-nums ${sizeClass} ${toneClass}`}>
        {value}
      </p>
      <p className="mt-1 text-eyebrow font-display font-bold uppercase text-soft">{label}</p>
    </div>
  );
}

/** A row of numerals separated by hairlines — not an equal-column card grid. */
export function NumeralRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-stretch gap-y-5 [&>*]:pr-6 [&>*+*]:border-l [&>*+*]:border-sand/70 [&>*+*]:pl-6">
      {children}
    </div>
  );
}

/* ── Founding state ───────────────────────────────────────────────────────
   MANDATORY on every screen (adoption plan §0.5). The canvas is drawn at
   "126 families"; a real household on day one is three people and no history.
   This is the designed below-floor state — a stated absence with a way out,
   never a skeleton and never a decorative placeholder. */
export function FoundingState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="f0-rule-left py-1 pl-4">
      <p className="font-display text-display-3 font-extrabold text-ink">{title}</p>
      <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-soft">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ── Honest absence note ──────────────────────────────────────────────────
   Used wherever the canvas draws a number this product cannot truthfully
   produce. It states WHY rather than printing a zero. */
export function AbsenceNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-soft">{children}</p>
  );
}

/* ── A navigating family row ──────────────────────────────────────────────*/
export function FamilyLink({
  href,
  label,
  sub,
  meta,
}: {
  href: string;
  label: React.ReactNode;
  sub?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <Link href={href} className="f0-ledger-row f0-focus group justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-bold text-ink">{label}</p>
        {sub && <p className="mt-0.5 text-[13px] leading-snug text-soft">{sub}</p>}
      </div>
      {meta && <span className="shrink-0 text-[13px] font-semibold text-soft">{meta}</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-soft transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
    </Link>
  );
}

/* ── Bar ──────────────────────────────────────────────────────────────────
   The deliberate divergence from the canvas (adoption plan §1.5): the archive
   leans on donuts and skill rings; we keep bars and numerals. There is no
   gauge primitive in this system and this lane does not add one. */
export function Bar({
  pct,
  label,
  value,
  tone = "accent",
}: {
  pct: number;
  label?: string;
  value?: string;
  /** `sentiment` is lime — legal only for a community reading. */
  tone?: "accent" | "sentiment";
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="min-w-0">
      {(label || value) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && (
            <span className="truncate text-[13px] font-display font-bold text-ink">{label}</span>
          )}
          {value && (
            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-soft">
              {value}
            </span>
          )}
        </div>
      )}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-sand"
        role="progressbar"
        aria-valuenow={w}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${
            tone === "sentiment" ? "bg-sentiment-fill" : "bg-accent"
          }`}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}

/** Percent formatter that keeps an honest em-dash for a missing reading. */
export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function priceTone(n: number | null | undefined): "ink" | "price-up" | "price-down" {
  if (n == null) return "ink";
  return n >= 0 ? "price-up" : "price-down";
}
