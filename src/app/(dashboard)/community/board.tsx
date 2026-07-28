"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════
   THE CLUB SCREENS — the drawn kit.

   Every primitive in this file is a direct build of `.planning/design-project-v2/
   Club Screens.dc.html` (boards 01–07) rather than an interpretation of it. The
   previous pass reduced those boards to one-accent hairline ledgers; the owner
   rejected that and asked for the boards as drawn. So:

     · CARDS ARE THE UNIT. `BoardCard` is the drawn white card — #fff on the warm
       paper ground, 1px sand hairline, 14px radius. It is used everywhere the
       boards draw a card.
     · THE ROOM TILES KEEP THEIR COLOUR. Board 02's 2×2 grid is four saturated
       tiles and it ships as four saturated tiles (`RoomTile`).
     · THE STRIPE FIELD IS THE DRAWN HERO. Board 02's pinned thread and board 07's
       on-air room are the same object: a near-black panel with the 118° stripe
       overlay, an orange ring annotation and an orange action (`StripeField`).
     · THE MARKER NOTES SURVIVE. "strong opinions, loosely held", "be specific!",
       "live!" are drawn in Caveat. The app ships three families and none is a
       script, so the marker rides a script stack that resolves on the platforms
       members are actually on and degrades to the system cursive elsewhere. The
       CSS need (load Caveat + expose `--font-marker`) is reported to the shared
       layer rather than patched into globals.css from here.

   TOKENS. The boards' literals map onto the club-mode tokens already in the
   system, so both themes come free:
       #F5F1E8 ground → bg-paper      #fff card   → bg-card
       #E4DCCC hairline → border-sand #14110F ink → text-ink
       #8A8279 → text-soft            #F05A28 fill → bg-volt-500
       orange TEXT → text-gold-700 (the club ramp's burnt orange, themed)
   The only literals kept are the ones that ARE the drawing: the room-tile
   grounds and the stance/sentiment fills, which are deliberately outside the
   price tokens so `text-price-up` / `text-price-down` stay price-only.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── marker annotation ────────────────────────────────────────────────────── */

/** The hand-drawn margin note the boards put in the corner of a screen. */
export const MARKER_FONT =
  '"Caveat", "Bradley Hand", "Segoe Script", "Brush Script MT", cursive';

export function Marker({
  children,
  className = "",
  rotate = -8,
}: {
  children: ReactNode;
  className?: string;
  rotate?: number;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none select-none whitespace-pre-line text-[20px] font-bold leading-[1.05] text-gold-700 ${className}`}
      style={{ fontFamily: MARKER_FONT, transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

/* ── masthead ─────────────────────────────────────────────────────────────── */

/**
 * Board 01/02/03/06/07 all open the same way: a black uppercase word set at the
 * top-left with the room's live line beneath it, and the screen's utilities on
 * the right. It is the loudest type on the screen by a wide margin.
 */
export function BoardMasthead({
  title,
  presence,
  actions,
  marker,
}: {
  title: string;
  presence?: ReactNode;
  actions?: ReactNode;
  marker?: ReactNode;
}) {
  return (
    <header className="relative flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[clamp(30px,8.5vw,38px)] font-black uppercase leading-[0.9] tracking-[-0.04em] text-ink">
          {title}
        </h1>
        {presence && <div className="mt-2.5">{presence}</div>}
      </div>
      {marker}
      {actions && <div className="flex shrink-0 items-center gap-4 pt-1">{actions}</div>}
    </header>
  );
}

/** The pulsing green presence dot + line the boards put under every masthead. */
export function PresenceLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11.5px] font-medium text-soft">
      <span className="relative inline-flex h-[7px] w-[7px] shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1BA94C] opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-[#1BA94C]" />
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </p>
  );
}

/* ── tab strip ────────────────────────────────────────────────────────────── */

export interface BoardTab {
  id: string;
  label: string;
  /** Renders the tab as a link instead of a mode switch (destination screens). */
  href?: string;
  onAir?: boolean;
}

/**
 * FEED · DISCUSSIONS · CHANGED MY MIND — the drawn tab strip. A 1.5px sand rule
 * under the row, a 3px orange rule under the active label, and the label itself
 * lifts to orange. Nothing else changes weight, so the row stays quiet.
 */
export function BoardTabs({
  tabs,
  active,
  onSelect,
  ariaLabel,
}: {
  tabs: BoardTab[];
  active: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="-mb-px flex gap-x-6 gap-y-0 overflow-x-auto border-b-[1.5px] border-sand [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((t) => {
        const on = t.id === active;
        const cls = `f0-focus relative -mb-[1.5px] shrink-0 whitespace-nowrap border-b-[3px] py-2.5 font-display text-[11px] uppercase tracking-[0.1em] transition-colors ${
          on
            ? "border-volt-500 font-extrabold text-gold-700"
            : "border-transparent font-bold text-soft hover:text-ink"
        }`;
        const body = (
          <>
            {t.onAir && (
              <span className="mr-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-red-500 align-middle" aria-hidden />
            )}
            {t.label}
          </>
        );
        if (t.href) {
          return (
            <Link key={t.id} href={t.href} className={cls} role="tab" aria-selected={on}>
              {body}
            </Link>
          );
        }
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(t.id)}
            className={cls}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}

/* ── filter pills ─────────────────────────────────────────────────────────── */

/** HOT · NEW · TICKERS · MINE — the drawn filter row (boards 02, 06, 07). */
export function PillRow({ children }: { children: ReactNode }) {
  return (
    <div className="club2-track -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">{children}</div>
  );
}

export function Pill({
  children,
  active = false,
  onClick,
  href,
  ariaLabel,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  ariaLabel?: string;
}) {
  const cls = `f0-focus f0-press shrink-0 whitespace-nowrap rounded-[7px] px-3.5 py-[7px] font-display text-[10.5px] uppercase tracking-[0.08em] transition-colors ${
    active
      ? "bg-volt-500 font-extrabold text-white"
      : "border border-sand bg-card font-bold text-soft hover:text-ink"
  }`;
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} aria-label={ariaLabel} className={cls}>
      {children}
    </button>
  );
}

/* ── card ─────────────────────────────────────────────────────────────────── */

/**
 * THE DRAWN CARD. White on the warm ground, one sand hairline, 14px radius.
 * `flush` drops the padding for cards that hold their own divided rows (the
 * trending-threads card, the stats card).
 */
export function BoardCard({
  children,
  className = "",
  flush = false,
  href,
  onClick,
  style,
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
  href?: string;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const cls = `rounded-[14px] border border-sand bg-card ${flush ? "" : "p-3.5"} ${
    href || onClick ? "f0-focus block text-left transition-colors hover:border-gold-300" : ""
  } ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`w-full ${cls}`} style={style}>
        {children}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}

/** A divided row inside a `flush` BoardCard. */
export function CardRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-3 px-3.5 py-3 [&+&]:border-t [&+&]:border-sand/70 ${className}`}>
      {children}
    </div>
  );
}

/* ── section label ────────────────────────────────────────────────────────── */

/** TOP IN THE CLUB 🔥 · CHANGED MY MIND · See all — the drawn section head. */
export function SectionLabel({
  children,
  action,
  actionHref,
  onAction,
  glyph,
}: {
  children: ReactNode;
  action?: ReactNode;
  actionHref?: string;
  onAction?: () => void;
  /** The board sets a single emoji beside a few of these ("🔥"). */
  glyph?: string;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink">
        {children}
        {glyph && (
          <span aria-hidden className="text-[11px]">
            {glyph}
          </span>
        )}
      </span>
      {action &&
        (actionHref ? (
          <Link href={actionHref} className="f0-focus shrink-0 text-[11px] font-bold text-gold-700 hover:text-gold-600">
            {action}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="f0-focus shrink-0 text-[11px] font-bold text-gold-700 hover:text-gold-600"
          >
            {action}
          </button>
        ))}
    </div>
  );
}

/* ── stripe field ─────────────────────────────────────────────────────────── */

/**
 * The near-black panel with the 118° stripe overlay — board 02's pinned thread
 * and board 07's on-air room. Theme-INVARIANT by design: it is the drawn dark
 * object on a light screen and stays dark in both themes, so its contents are
 * painted against a known ground (cream, not `text-ink`).
 */
export function StripeField({
  children,
  className = "",
  minHeight,
}: {
  children: ReactNode;
  className?: string;
  minHeight?: number;
}) {
  return (
    <div
      className={`relative isolate overflow-hidden rounded-[16px] ${className}`}
      style={{
        minHeight,
        background: "linear-gradient(150deg,#332B23,#14110F)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(118deg, rgba(255,255,255,.055) 0 11px, transparent 11px 22px)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** The lassoed orange ring the boards drop over the corner of a stripe field. */
export function RingMark({
  size = 56,
  className = "",
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute rounded-full border-[3px] border-volt-500 ${className}`}
      style={{ width: size, height: size, transform: "rotate(-14deg)", ...style }}
    />
  );
}

/* ── ticker mark ──────────────────────────────────────────────────────────── */

/**
 * The black rounded square carrying a letter mark — the boards' most reused
 * object (thread rows, chat cards, the composer's bound company). `tone` paints
 * the letter; the field itself stays near-black so a strip of them never becomes
 * a colour chart.
 */
export function TickerMark({
  ticker,
  size = 30,
  radius = 9,
  tone = "cream",
  field = "#14110F",
  className = "",
}: {
  ticker: string;
  size?: number;
  radius?: number;
  tone?: "cream" | "up" | "down" | "accent" | "ink";
  /** The tile ground. Near-black by default; the boards flip it to white when
   *  the mark sits ON a dark field (the pinned thread's header). */
  field?: string;
  className?: string;
}) {
  const color =
    tone === "up"
      ? "#1BA94C"
      : tone === "down"
        ? "#E0392B"
        : tone === "accent"
          ? "#FF6A00"
          : tone === "ink"
            ? "#14110F"
            : "#F7F3EA";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center font-display font-black leading-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: field,
        color,
        fontSize: Math.round(size * 0.44),
      }}
    >
      {ticker.slice(0, 1).toUpperCase()}
    </span>
  );
}

/* ── room tile ────────────────────────────────────────────────────────────── */

/**
 * ROOMS BY TOPIC — board 02's 2×2 of saturated tiles, built as drawn. The colour
 * is the room's identity, assigned in rooms.ts and stable per room, so a member
 * navigates by shape and colour rather than by re-reading four labels.
 */
export function RoomTile({
  name,
  meta,
  color,
  active = false,
  locked = false,
  onClick,
  href,
}: {
  name: string;
  meta: ReactNode;
  color: string;
  active?: boolean;
  locked?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <span className="font-display text-[15px] font-extrabold leading-[1.05] tracking-[-0.01em]">
        {name}
      </span>
      <span className="flex items-center gap-1.5 text-[10px] font-medium opacity-[0.86]">
        {locked && (
          <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden className="shrink-0">
            <path
              d="M7 10V7.5a5 5 0 0 1 10 0V10M5.5 10h13v10h-13Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {meta}
      </span>
    </>
  );
  const cls = `f0-focus f0-press flex h-[78px] flex-col justify-between rounded-[13px] p-3 text-left text-white transition-all duration-200 ${
    active ? "ring-2 ring-ink/70 ring-offset-2 ring-offset-paper" : "hover:-translate-y-px"
  } ${locked ? "opacity-70" : ""}`;
  if (href) {
    return (
      <Link href={href} className={cls} style={{ background: color }}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls} style={{ background: color }}>
      {inner}
    </button>
  );
}

/* ── stance chip ──────────────────────────────────────────────────────────── */

/**
 * BEAR → BULL. Board 03 draws the flip as two small caps chips with the prior
 * stance muted and the new one filled. Direction is carried by the WORD and the
 * ▲▼ mark as well as the fill, so it survives greyscale — and the fills are
 * literals, deliberately NOT the price tokens, so a stance can never be confused
 * with a quote by the stylesheet.
 */
const STANCE_FILL: Record<string, { bg: string; fg: string; mark: string; label: string }> = {
  bull: { bg: "#1BA94C", fg: "#FFFFFF", mark: "▲", label: "Bull" },
  bear: { bg: "#E0392B", fg: "#FFFFFF", mark: "▼", label: "Bear" },
  neutral: { bg: "#8A8279", fg: "#FFFFFF", mark: "—", label: "Neutral" },
};

export function StanceChip({
  stance,
  muted = false,
  size = "md",
}: {
  stance: "bull" | "bear" | "neutral";
  muted?: boolean;
  size?: "sm" | "md";
}) {
  const s = STANCE_FILL[stance];
  const dims = size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-[7px] py-[3px] text-[9.5px]";
  if (muted) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-[5px] bg-sand font-mono font-extrabold uppercase tracking-[0.04em] text-soft ${dims}`}
      >
        <span aria-hidden>{s.mark}</span>
        {s.label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[5px] font-mono font-extrabold uppercase tracking-[0.04em] ${dims}`}
      style={{ background: s.bg, color: s.fg }}
    >
      <span aria-hidden>{s.mark}</span>
      {s.label}
    </span>
  );
}

/* ── sentiment bars ───────────────────────────────────────────────────────── */

/** Board 04's CLUB SENTIMENT column: three labelled bars with a percentage. */
export function SentimentBars({
  rows,
}: {
  rows: { label: string; pct: number; color: string }[];
}) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between text-[10.5px] font-semibold" style={{ color: r.color }}>
            <span>{r.label}</span>
            <span className="font-mono tabular-nums text-ink">{Math.round(r.pct)}%</span>
          </div>
          <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-sand">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, r.pct))}%`, background: r.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── sparkline ────────────────────────────────────────────────────────────── */

/**
 * The 60×24 trend squiggle on board 02's trending-thread rows. It renders REAL
 * series only — no series, no squiggle. Colour is the price ramp because this
 * one genuinely is price.
 */
export function Sparkline({
  points,
  width = 60,
  height = 24,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = 100 / (points.length - 1);
  const d = points
    .map((p, i) => `${(i * step).toFixed(1)},${(36 - ((p - min) / span) * 32).toFixed(1)}`)
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden
      className={`shrink-0 ${up ? "text-price-up" : "text-price-down"}`}
    >
      <polyline
        points={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── story ring ───────────────────────────────────────────────────────────── */

/** The live ring + LIVE flag board 01 puts around an on-air member's avatar. */
export function StoryRing({
  children,
  live = false,
  label,
}: {
  children: ReactNode;
  live?: boolean;
  label: string;
}) {
  return (
    <div className="w-[62px] shrink-0 text-center">
      {/* The live ring is a 2.5px orange annulus with a paper gap inside it —
          the same device the board draws. A member who is not live gets the
          avatar alone, with no empty ring floating around it. */}
      <span
        className={`mx-auto grid h-[50px] w-[50px] place-items-center rounded-full ${
          live ? "bg-volt-500" : ""
        }`}
      >
        <span
          className={`grid h-[45px] w-[45px] place-items-center rounded-full ${
            live ? "bg-paper" : ""
          }`}
        >
          {children}
        </span>
      </span>
      {live && (
        <span className="relative -mt-2 inline-block rounded-[3px] bg-volt-500 px-[5px] py-px text-[8px] font-extrabold uppercase tracking-[0.1em] text-white">
          Live
        </span>
      )}
      <span className={`block truncate text-[9.5px] font-semibold text-ink ${live ? "mt-1" : "mt-2"}`}>
        {label}
      </span>
    </div>
  );
}

/* ── quiet founding line ──────────────────────────────────────────────────── */

/**
 * The boards print "152 new replies" everywhere. Production is a founding club,
 * so a count only prints once it is true; below that the object says what it is
 * FOR in the same slot. Never a fabricated number, never "0 replies".
 */
export function countLine(n: number, one: string, many: string, founding: string): string {
  if (n <= 0) return founding;
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}
