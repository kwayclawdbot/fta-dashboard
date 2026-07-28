"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, X } from "lucide-react";
import type React from "react";

/* ══════════════════════════════════════════════════════════════════════════
   THE MISSION VOCABULARY — the drawn objects the five day-boards share.

   The standing "no generic card containers" rule was lifted for this canvas by
   the owner: the boards draw cards, radial dials and playful medallions, and
   this lane builds what the boards draw. What was NOT lifted is the colour law,
   because it is a legibility rule rather than a taste one:

     green / red ....... PRICE only          (fmtPct + priceTone)
     lime .............. community sentiment  (the room's split, a stance)
     volt orange ....... brand + ACTION       (the rail, the CTA, the medallion)
     kai blue .......... Kai / AI             (Day 2's coach notes and nothing else)

   So a "Bull" vote is never green and a filled practice ticket is never red;
   direction is carried by the label and by position, which is the same test
   StanceControl was built to pass.
   ══════════════════════════════════════════════════════════════════════════ */

/* `.f0-chip` sets `border-radius: 0.5rem` UNLAYERED, which outranks every
   Tailwind radius utility — so a `rounded-full` on a chip silently does nothing.
   The canvas draws every one of these as a pill, and an inline style is the one
   thing that wins that cascade without editing globals.css (which this lane does
   not own). One constant so the twelve call sites cannot drift. */
export const PILL: React.CSSProperties = { borderRadius: "999px" };

/* ── the three-step rail ──────────────────────────────────────────────────
   Left: an X on step one (leave the mission), a back arrow after it. Centre:
   three bars, filled to the step. Right: "1/3". Exactly the canvas's chrome. */
export function MissionChrome({
  step,
  onBack,
  exitHref,
  label,
}: {
  step: 1 | 2 | 3;
  onBack?: () => void;
  exitHref: string;
  label: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {step === 1 || !onBack ? (
          <Link
            href={exitHref}
            aria-label="Leave this mission"
            className="f0-focus f0-press -m-2 rounded-full p-2 text-soft transition-colors hover:text-ink"
          >
            <X className="h-5 w-5" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back a step"
            className="f0-focus f0-press -m-2 rounded-full p-2 text-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <div className="flex flex-1 items-center justify-center gap-2" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-[5px] w-9 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-volt-500" : "bg-sand"
              }`}
            />
          ))}
        </div>

        <p className="w-8 shrink-0 text-right font-mono text-[13px] font-semibold tabular-nums text-soft">
          {step}/3
        </p>
      </div>
      <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
        {step} · {label}
      </p>
    </div>
  );
}

/* ── the medallion ────────────────────────────────────────────────────────
   The drawn disc at the head of every brief, with a small badge clipped to its
   corner. Tone decides the bloom: accent for a mission, kai blue on the day Kai
   is the tool, lime on the day the room is. */
export function Medallion({
  glyph,
  badge,
  tone = "accent",
}: {
  glyph: string;
  badge?: string;
  tone?: "accent" | "kai" | "sentiment";
}) {
  const bloom =
    tone === "kai"
      ? "var(--kai-blue)"
      : tone === "sentiment"
        ? "var(--sentiment-fill)"
        : "var(--accent-solid)";
  return (
    <div className="relative mx-auto h-[120px] w-[120px]">
      <div
        className="grid h-full w-full place-items-center rounded-full text-[46px] leading-none"
        style={{
          background: `radial-gradient(60% 60% at 50% 42%, color-mix(in srgb, ${bloom} 32%, transparent) 0%, transparent 72%)`,
        }}
      >
        <span aria-hidden>{glyph}</span>
      </div>
      {badge && (
        <span
          aria-hidden
          className="absolute bottom-2 right-1 grid h-9 w-9 place-items-center rounded-full text-[15px] leading-none"
          style={{
            background: bloom,
            color: tone === "accent" ? "var(--accent-on)" : "#FFFFFF",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

/* ── the script line ──────────────────────────────────────────────────────
   The canvas's handwritten "tonight's mission". There is no script face in the
   system, so it is the display face in italic at the eyebrow's weight — the
   register reads as an aside either way. */
export function ScriptLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center font-display text-[19px] font-bold italic text-gold-700">
      {children}
    </p>
  );
}

/* ── the mission headline ─────────────────────────────────────────────────
   The board's hero voice. `mark` is the ONE phrase the canvas paints orange —
   here it may be more than a word, because the canvas's own marks run to whole
   lines ("ACTUALLY KNOW", "NEVER HEARD OF"). */
export function MissionHead({
  children,
  mark,
  align = "center",
}: {
  children: React.ReactNode;
  mark?: string;
  align?: "center" | "left";
}) {
  return (
    <h1
      className={`font-display text-display-1 font-extrabold uppercase leading-[0.95] text-ink ${
        align === "center" ? "text-center" : ""
      }`}
    >
      {children}
      {mark && (
        <>
          {" "}
          <span className="text-gold-700">{mark}</span>
        </>
      )}
    </h1>
  );
}

/* ── the stat chip trio ───────────────────────────────────────────────────
   20 MIN · NO EXP · +125 XP. Every value is passed in from `challenge_days`;
   nothing here knows a number. */
export function StatChips({
  items,
}: {
  items: { icon: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((it) => (
        <div
          key={it.value}
          className="grid place-items-center gap-1.5 rounded-2xl border border-sand bg-card px-2 py-3.5"
        >
          <span className="text-[15px] leading-none" aria-hidden>
            {it.icon}
          </span>
          <span className="font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-ink">
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── the tinted brief field ───────────────────────────────────────────────
   "WHY THIS MATTERS" — a brand-tinted paper, never a neutral card. Price may
   never sit inside it (the tint is the accent's, and a delta beside it would
   read as tinted too). */
export function BriefField({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="f0-brief-field px-5 py-4">
      {label && (
        <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-gold-700">
          {label}
        </p>
      )}
      <div className={label ? "mt-2" : ""}>{children}</div>
    </div>
  );
}

/* ── a plain stated panel ─────────────────────────────────────────────────
   The neutral sibling of BriefField, for anything that carries a market number
   (which the tinted field may not). */
export function Panel({
  label,
  meta,
  children,
  lead = false,
}: {
  label?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  /** Rings the panel in the action colour — the canvas's selected object. */
  lead?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-card px-4 py-4 ${
        lead ? "border-transparent ring-2 ring-[color:var(--accent-solid)]" : "border-sand"
      }`}
    >
      {(label || meta) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {label && (
            <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-gold-700">
              {label}
            </p>
          )}
          {meta && (
            <p className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-soft">
              {meta}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Kai's note ───────────────────────────────────────────────────────────
   Kai blue, and Kai blue appears nowhere else on these boards. Kai here is the
   coach voice that ships with the mission — it never claims to have computed
   anything live, and nothing rendered inside it is presented as a reading of
   the member's own work. */
export function KaiNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="club-field-kai flex items-start gap-3 rounded-2xl px-4 py-3.5">
      <span
        className="f0-kai-mark mt-0.5 h-7 w-7 shrink-0 text-[13px]"
        aria-hidden
      >
        🐋
      </span>
      <p className="text-[14px] leading-relaxed text-ink">
        <span className="font-display font-bold text-kai-blue">Kai: </span>
        {children}
      </p>
    </div>
  );
}

/* ── a stated note with no persona attached ───────────────────────────────
   Used wherever the canvas puts a Kai line but the content is a plain fact
   about the exercise — attributing a scripted fact to an assistant that did not
   generate it is the small lie this component exists to avoid. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-sand py-1 pl-4 text-[14px] leading-relaxed text-soft">
      {children}
    </p>
  );
}

/* ── the radial dial ──────────────────────────────────────────────────────
   Explicitly re-permitted for this canvas. It carries ONE number and states its
   own units underneath; it is never a decorative ring around a stat that has no
   denominator. */
export function Dial({
  pct,
  value,
  unit,
  tone = "accent",
  size = 112,
}: {
  /** 0-100. */
  pct: number;
  value: string;
  unit?: string;
  tone?: "accent" | "sentiment";
  size?: number;
}) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(100, pct)) / 100;
  const stroke = tone === "sentiment" ? "var(--sentiment-fill)" : "var(--accent-solid)";
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value}${unit ? ` ${unit}` : ""}`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="var(--sand)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${C * p} ${C}`}
          className="club-donut-arc"
        />
      </svg>
      <div className="relative text-center">
        <p className="font-display text-[22px] font-extrabold leading-none tabular-nums text-ink">
          {value}
        </p>
        {unit && (
          <p className="mt-1 text-[9px] font-display font-bold uppercase tracking-[0.16em] text-soft">
            {unit}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── the reward strip ─────────────────────────────────────────────────────
   ⚡+125 Mission complete · 🔥28 Streak · 1/5 Days done. Every figure is passed
   in from server state; a streak of zero renders "—", never a fabricated 1. */
export function RewardTiles({
  items,
}: {
  items: { icon?: string; value: string; label: string; lead?: boolean }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className={`grid place-items-center gap-1 rounded-2xl px-2 py-3.5 ${
            it.lead ? "f0-brief-field" : "border border-sand bg-card"
          }`}
        >
          <p className="font-display text-[19px] font-extrabold leading-none tabular-nums text-ink">
            {it.icon && (
              <span className="mr-1 text-[14px]" aria-hidden>
                {it.icon}
              </span>
            )}
            {it.value}
          </p>
          <p className="text-center text-[10px] font-display font-bold uppercase tracking-[0.12em] text-soft">
            {it.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── the sticky footer action ─────────────────────────────────────────────
   Every board in the canvas ends in one full-width orange action pinned to the
   bottom of the phone. On a page that scrolls, "pinned" is a sticky footer with
   a fade so the content behind it never appears to be cut off. */
export function MissionFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-2 px-5 pb-5 pt-6 sm:-mx-8 sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-transparent to-[color:var(--paper)]"
      />
      <div className="relative bg-paper">{children}</div>
    </div>
  );
}

export function MissionButton({
  onClick,
  href,
  disabled,
  busy,
  children,
  tone = "accent",
}: {
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  busy?: boolean;
  children: React.ReactNode;
  tone?: "accent" | "quiet";
}) {
  const cls =
    tone === "accent"
      ? "cta-button f0-focus f0-press flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] disabled:opacity-45"
      : "f0-focus f0-press flex w-full items-center justify-center gap-2 rounded-full border border-sand px-6 py-3.5 font-display text-[15px] font-bold text-ink disabled:opacity-45";

  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} className={cls}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ── a selectable chip ────────────────────────────────────────────────────
   The tap-target for Day 1's brands and Day 4's filters. Selection is carried
   by the accent OUTLINE plus a check, never by a fill — a filled chip beside a
   price delta is the pairing the colour law exists to prevent. */
export function Chip({
  on,
  onClick,
  children,
  ariaLabel,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`f0-chip f0-focus f0-press inline-flex items-center gap-2 px-3.5 py-2 font-display text-[14px] font-bold transition-colors ${
        on ? "f0-chip-accent text-ink" : "text-soft hover:text-ink"
      }`}
      style={
        on ? { ...PILL, boxShadow: "inset 0 0 0 1px var(--accent-solid)" } : PILL
      }
    >
      {children}
      {on && (
        <span className="text-gold-700" aria-hidden>
          ✓
        </span>
      )}
    </button>
  );
}

/* ── an error line ────────────────────────────────────────────────────────
   The write failed and the member has to know. Never red (red is price), and
   never a toast that disappears before it is read. */
export function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="border-l-2 border-[color:var(--accent-solid)] py-1 pl-4 text-[14px] leading-relaxed text-ink"
    >
      {children}
    </p>
  );
}
