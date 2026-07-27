"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

/* ══════════════════════════════════════════════════════════════════════════
   F0 — the shared surface vocabulary for the Profile / Settings / Learn lane.

   The brand register bans generic card containers and equal-column card grids.
   These primitives are the replacement set: a display masthead, a section rule,
   hairline ledger rows, a measure strip, a meter, and a switch. Every object on
   these three surfaces is built from them, so hierarchy comes from TYPE and
   RULES, never from a box.

   COLOUR LAW (hard):
     green/red = price ONLY · LIME = community sentiment ONLY ·
     volt orange = brand + ACTION ONLY · kai blue = Kai/AI ONLY.
   Nothing in this file introduces a semantic colour on its own — callers pass a
   tone only where the law allows it. There is deliberately NO "danger red"
   tone: red belongs to price, so a destructive row (sign out) is differentiated
   by its position and its sub-line, never by turning red.

   DARK: every surface colour here is a semantic token (ink / soft / sand /
   paper), so the whole set re-maps when :root[data-theme="dark"] flips. Orange
   TEXT uses the gold-* ramp, NOT volt-*: the volt ramp is frozen across themes
   (volt-700 is legible on cream and ~2.5:1 on the #17120B page), whereas in
   club mode the gold ramp IS volt orange AND it flips (--g700 #C24400 →
   #FF9A5C). So text-gold-700 is themed orange with no dark: variant. Orange
   FILLS keep bg-volt-500, which holds its value on both grounds.

   HONEST ABSENCE: `dash()` renders an em-dash for any stat the feed cannot
   supply. Nothing here ever substitutes a plausible-looking number.
   ══════════════════════════════════════════════════════════════════════════ */

/** The one honest empty value. A stat is "—", never a fabricated stand-in. */
export function dash(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString();
}

/* ── Display masthead ─────────────────────────────────────────────────────
   One per surface. text-display-1 is the hero voice (44px Sora); the eyebrow
   above it is the small-caps label register, and the lede sits under it in the
   body font so the three steps read as three different registers, not three
   sizes of the same thing. */
export function DisplayHead({
  eyebrow,
  title,
  lede,
  aside,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  /** Optional right-hand object (a back link, an action). */
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
        <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase text-ink">
          {title}
        </h1>
        {lede && <p className="mt-2 max-w-md text-[15px] text-soft">{lede}</p>}
      </div>
      {aside && <div className="shrink-0 pt-1">{aside}</div>}
    </header>
  );
}

/* ── Section rule ─────────────────────────────────────────────────────────
   A charged tick + label + hairline running to the edge. Replaces "bold 11px
   floating above a grid" as the section marker. */
export function SectionRule({
  children,
  action,
  id,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <h2
        id={id}
        className="f0-section-rule min-w-0 flex-1 text-eyebrow font-display font-bold uppercase text-soft"
      >
        <span className="shrink-0 whitespace-nowrap">{children}</span>
      </h2>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Ledger ───────────────────────────────────────────────────────────────
   A list of objects separated by rules rather than wrapped in boxes. */
export function Ledger({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`f0-ledger ${className}`}>{children}</div>;
}

/** A static ledger row — label left, value right, optional sub-line. */
export function LedgerRow({
  label,
  sub,
  value,
  children,
}: {
  label: React.ReactNode;
  sub?: React.ReactNode;
  value?: React.ReactNode;
  /** Replaces the value slot entirely (a switch, a meter, a control). */
  children?: React.ReactNode;
}) {
  return (
    <div className="f0-ledger-row justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-bold text-ink">{label}</p>
        {sub && <p className="mt-0.5 text-[13px] leading-snug text-soft">{sub}</p>}
      </div>
      {children ?? (
        <span className="shrink-0 font-mono text-[14px] font-semibold tabular-nums text-soft">
          {value}
        </span>
      )}
    </div>
  );
}

/** A navigating ledger row. */
export function LedgerLink({
  href,
  label,
  sub,
  meta,
  tone = "ink",
}: {
  href: string;
  label: React.ReactNode;
  sub?: React.ReactNode;
  meta?: React.ReactNode;
  tone?: "ink" | "volt";
}) {
  return (
    <Link href={href} className="f0-ledger-row group justify-between">
      <div className="min-w-0 flex-1">
        <p
          className={`font-display text-[15px] font-bold ${
            tone === "volt" ? "text-gold-700" : "text-ink"
          }`}
        >
          {label}
        </p>
        {sub && <p className="mt-0.5 text-[13px] leading-snug text-soft">{sub}</p>}
      </div>
      {meta && (
        <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-soft">
          {meta}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-soft transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
    </Link>
  );
}

/** An acting ledger row (sign out, replay the tour, open a picker…).
    NOTE: there is no red "danger" tone by law — see the header. A terminal
    action (`tone="quiet"`) reads a step back in `soft`, not alarming in red. */
export function LedgerAction({
  onClick,
  label,
  sub,
  meta,
  tone = "ink",
  disabled,
}: {
  onClick: () => void;
  label: React.ReactNode;
  sub?: React.ReactNode;
  meta?: React.ReactNode;
  tone?: "ink" | "volt" | "quiet";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="f0-ledger-row w-full justify-between text-left disabled:opacity-50"
    >
      <div className="min-w-0 flex-1">
        <p
          className={`font-display text-[15px] font-bold ${
            tone === "quiet"
              ? "text-soft"
              : tone === "volt"
                ? "text-gold-700"
                : "text-ink"
          }`}
        >
          {label}
        </p>
        {sub && <p className="mt-0.5 text-[13px] leading-snug text-soft">{sub}</p>}
      </div>
      {meta && (
        <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-soft">
          {meta}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-soft" />
    </button>
  );
}

/* ── Measure strip ────────────────────────────────────────────────────────
   The stat trio. NOT a card grid: no box, no border, no shadow — three measures
   separated by hairlines, sitting directly on the paper. The number is the
   dominant voice (display-2), the label is the small-caps register. */
export interface Measure {
  label: string;
  /** Pre-formatted; pass "—" for an honest absence. */
  value: string;
  /** Community-sentiment measures may carry LIME. Nothing else may. */
  tone?: "ink" | "sentiment";
}

export function MeasureStrip({ items }: { items: Measure[] }) {
  return (
    <div className="flex items-stretch">
      {items.map((m, i) => (
        <div
          key={m.label}
          className={`min-w-0 flex-1 ${
            i > 0 ? "border-l border-sand/70 pl-4 sm:pl-6" : "pr-4 sm:pr-6"
          } ${i > 0 && i < items.length - 1 ? "pr-4 sm:pr-6" : ""}`}
        >
          <p
            className={`font-display text-display-2 font-extrabold tabular-nums ${
              m.tone === "sentiment"
                ? "text-sentiment"
                : "text-ink"
            }`}
          >
            {m.value}
          </p>
          <p className="mt-1.5 text-eyebrow font-display font-bold uppercase text-soft">
            {m.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── Meter ────────────────────────────────────────────────────────────────
   Progress toward something you can act on → the ACTION colour by law.
   `onDark` flips the track for use inside a hero field.

   MODE CORRECTNESS (canvas v2, M1): the fill was a hardcoded `bg-volt-500`,
   which is the CLUB's orange — so every Family and FTA surface that adopted
   this primitive (family progress, teen paper account, lesson progress) painted
   Club orange into a gold register. Same defect the f0 hairline primitives were
   repointed to fix, same remedy: ride --accent-solid via `bg-accent`, so the bar
   is family gold / club orange / FTA metallic with no mode branch at the call
   site. In Club mode --accent-solid IS #FF6A00 — pixel-identical to volt-500 —
   so nothing in the Club changes. */
export function Meter({
  pct,
  onDark = false,
  className = "",
}: {
  pct: number;
  onDark?: boolean;
  className?: string;
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full ${
        onDark ? "bg-white/15" : "bg-sand"
      } ${className}`}
      role="progressbar"
      aria-valuenow={w}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

/* ── Switch ───────────────────────────────────────────────────────────────
   The only chrome-carrying control in the set. Volt when on (it is an action).
   The knob is theme-invariant white for the same reason type on the orange
   band is: when the switch is ON the knob rides directly on volt, and volt does
   not change between themes. */
export function Switch({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-volt-500" : "bg-sand"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/* ── Honest empty ─────────────────────────────────────────────────────────
   A stated absence with a way out — never a decorative placeholder pretending
   content exists. */
export function EmptyLine({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-sand py-1 pl-4">
      <p className="font-display text-display-3 font-extrabold text-ink">{title}</p>
      <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-soft">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ── Text action ──────────────────────────────────────────────────────────
   The standing "do it" affordance: volt type + arrow, no button chrome. */
export function TextAction({
  href,
  onClick,
  external,
  children,
}: {
  href?: string;
  onClick?: () => void;
  /** Renders a plain anchor (join links leave the app). */
  external?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    "inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600";
  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
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

/* ── Tab rail ─────────────────────────────────────────────────────────────
   A hairline-underscored rail, not a segmented pill control. The active tab is
   marked by a volt underscore (the action colour) and by weight — the labels
   themselves stay in the ink/soft register so the rail reads as a set of
   headings, not a widget. */
export function TabRail<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-7 border-b border-sand">
      {tabs.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`relative -mb-px pb-3 font-display text-[15px] font-extrabold uppercase tracking-[0.08em] transition-colors ${
              on ? "text-ink" : "text-soft hover:text-ink"
            }`}
          >
            {t.label}
            {on && (
              <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-volt-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}
