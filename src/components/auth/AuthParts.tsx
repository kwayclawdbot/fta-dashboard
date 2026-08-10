"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * PRE-AUTH PARTS (lane L6) — the shared vocabulary for splash / login /
 * forgot-password / invite-signup, built from the canvas boards 09–11.
 *
 * Three decisions worth knowing before you edit anything here:
 *
 * 1. NO BOXED CARD. The old auth screens wrapped every form in a
 *    rounded-rect panel floating on a dark page — the exact generic-container
 *    failure the standing design rule names. The form now sits directly on the
 *    paper: a display headline with ONE marked word, a hairline rule, fields,
 *    and the action. Structure is carried by type and rules, not by a box.
 *
 * 2. FIELDS ARE HAIRLINE, NOT FILLED. `f0-frame` + a 3% ink wash, so the
 *    control reads as a slot on the page in BOTH themes without needing a
 *    surface token that inverts. `.f0-focus` goes on the focusable element
 *    itself (the documented TickerTile trap), never on a wrapper.
 *
 * 3. NOTICES CARRY NO RED. COLOUR LAW is green/red = PRICE only, and a
 *    sign-in error is not a price. The error state is carried by an icon, a
 *    hairline rule and weight instead of a tint — colour-law clean, and it
 *    renders identically in light and dark with no `dark:` variant.
 */

/** The canvas's signature emphasis: a drawn underline under ONE word. */
export function MarkWord({ children }: { children: ReactNode }) {
  return <span className="f0-underline-mark">{children}</span>;
}

/** Display masthead for a pre-auth surface. `title` is a node so a single word
 *  can carry <MarkWord>. */
export function AuthHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div>
      {eyebrow && (
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-700">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-2.5 font-display text-[30px] font-extrabold leading-[1.05] tracking-tight text-ink">
        {title}
      </h1>
      {sub && (
        <p className="mt-2.5 max-w-[38ch] text-[14px] leading-relaxed text-soft">
          {sub}
        </p>
      )}
    </div>
  );
}

/** A labelled input. The wash is a token mix so it lifts on cream AND on the
 *  warm night page without a second declaration. */
export function AuthField({
  label,
  icon: Icon,
  trailing,
  ...input
}: {
  label: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-soft">
        {label}
      </span>
      <span className="relative mt-2 block">
        {Icon && (
          <Icon
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-soft"
          />
        )}
        <input
          {...input}
          className={`f0-frame f0-focus w-full rounded-xl py-3 text-[15px] text-ink transition-colors placeholder:text-soft/70 ${
            Icon ? "pl-11" : "pl-4"
          } ${trailing ? "pr-11" : "pr-4"}`}
          style={{ background: "color-mix(in srgb, var(--ink) 3%, transparent)" }}
        />
        {trailing}
      </span>
    </label>
  );
}

/** The show/hide affordance that rides inside a password field. */
export function FieldToggle({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="f0-focus f0-press absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-soft transition-colors hover:text-ink"
    >
      {children}
    </button>
  );
}

/** The primary action. FLAT solid orange as the board draws it — no gradient,
 *  no hover lift. `--accent-on` carries the glyph colour, never `text-ink`
 *  (which flips near-white at night on a fill). `entry-cta` re-radiuses it to
 *  the club terminal's pill anatomy in club-dark only (globals.css ENTRY
 *  TERMINAL); light keeps the warm rounded-2xl. */
export function AuthSubmit({
  children,
  ...button
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...button}
      className="entry-cta f0-focus f0-press inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 font-display text-[15px] font-bold tracking-[0.02em] text-[color:var(--accent-on)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** A status line. `tone="alert"` is icon + rule + weight, deliberately not red
 *  (COLOUR LAW: green/red is reserved for market price). */
export function AuthNotice({
  tone = "alert",
  children,
}: {
  tone?: "alert" | "done";
  children: ReactNode;
}) {
  const Icon = tone === "done" ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={tone === "alert" ? "alert" : "status"}
      className="f0-rule-left flex items-start gap-2.5 py-1 pl-3.5"
      style={
        tone === "alert"
          ? { borderLeftColor: "var(--accent-solid)", borderLeftWidth: "2px" }
          : undefined
      }
    >
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
      <p
        className={`text-[13.5px] leading-relaxed ${
          tone === "alert" ? "font-semibold text-ink" : "text-soft"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

/** "or" — a mono tick between two hairlines. The string stays lowercase in the
 *  DOM; the small-caps look is CSS. */
export function AuthOrRule({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3.5">
      <span aria-hidden className="f0-rule-top flex-1" />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-soft">
        {label}
      </span>
      <span aria-hidden className="f0-rule-top flex-1" />
    </div>
  );
}

/** Google OAuth. The four-colour glyph is a licensed brand asset — its hexes
 *  live in SVG fill attributes, never in a className. */
export function GoogleButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="entry-cta f0-frame f0-focus f0-press inline-flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 font-display text-[14px] font-bold text-ink transition-colors"
      style={{ background: "color-mix(in srgb, var(--ink) 3%, transparent)" }}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      {children}
    </button>
  );
}
