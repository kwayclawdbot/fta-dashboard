"use client";

/**
 * BOARD PRIMITIVES — the drawn vocabulary of mockup boards 02 (Discover) and
 * 15 (Discover · Screener), from `.planning/design-project-v2/Cheat Code App
 * Light.dc.html` and its dark twin `Cheat Code App.dc.html`.
 *
 * The boards are built from WHITE ROUNDED CARDS on the warm-sand page, orange
 * mono section marks, pill tabs, radial donuts and bare sparklines. That is the
 * language every surface in this lane now speaks — Discover, Screener, News and
 * the retired Picks notice — so none of them can drift from the drawing.
 *
 * TOKEN MAP (board hex → app token, verified against globals.css `[data-mode=
 * "club"]` and its dark block):
 *
 *   #F7F4EF page      → --paper    (dark twin #0D0B0E)
 *   #FFFFFF card      → --card     (dark twin #17141A)
 *   #E5DFD5 hairline  → --sand     (dark twin #2A2530)
 *   #1A1614 ink       → --ink      (dark twin #F4F0EC)
 *   #7B7369 soft      → --soft     (dark twin #8F8894)
 *   #FF7A1A signal    → --accent-solid  (fills / rules / pills)
 *   #0BA05A / #D92652 → --price-up / --price-down  (PRICE ONLY)
 *
 * TWO DELIBERATE DEVIATIONS FROM THE DRAWN HEX, both quality rules that
 * outrank the drawing and are called out in the return note:
 *
 *  1. SECTION MARKS render `text-gold-700` (#C24400 in club light) rather than
 *     the drawn #FF7A1A. #FF7A1A on #F7F4EF is ~2.4:1 — the mark would be
 *     unreadable at 9.5px. gold-700 IS the club orange ramp's text end and it
 *     flips correctly for the dark twin, which frozen `volt-*` does not.
 *  2. COMMUNITY SENTIMENT (the "most divisive" donut, the bullish/bearish
 *     cards) takes the LIME sentiment ramp, not the drawn green/red — green and
 *     red are reserved for price everywhere in this app, and a red opinion next
 *     to a red price delta reads as one signal. The donut, the split and the
 *     geometry are drawn exactly as the board has them.
 *
 * NO SCRIPT FONT EXISTS in the app (the boards set the mastheads in Kaushan
 * Script). `BoardHead` renders the closest available register — the display
 * face, lowercase, tight — and the missing token is reported to the shared
 * layer owner.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchBars } from "@/lib/market/client";

/* ── card ────────────────────────────────────────────────────────────────────
 * The board's base object: white fill, 1px sand hairline, 12–18px radius. It is
 * a real card and it is meant to be — the owner's drawing is built from these. */
export function BoardCard({
  as: Tag = "div",
  radius = 16,
  className = "",
  children,
  ...rest
}: {
  as?: React.ElementType;
  /** The board draws 12 (rows), 14 (small cards), 16–18 (feature cards). */
  radius?: 12 | 14 | 16 | 18;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={`border border-sand bg-card ${RADIUS[radius]} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const RADIUS: Record<number, string> = {
  12: "rounded-[12px]",
  14: "rounded-[14px]",
  16: "rounded-[16px]",
  18: "rounded-[18px]",
};

/* ── masthead ────────────────────────────────────────────────────────────── */
/**
 * Board 02/15 head: the surface's name set large and lowercase, a 12px soft
 * sub-line, and up to two 34px round icon buttons on the right.
 */
export function BoardHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[34px] font-extrabold lowercase leading-none tracking-[-0.035em] text-ink sm:text-[40px]">
          {title}
        </h1>
        {sub && <p className="mt-2 text-[12.5px] leading-snug text-soft">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2.5">{right}</div>}
    </div>
  );
}

/** The board's round 34px control on the head line. */
export function RoundButton({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`f0-focus f0-press grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border transition-colors ${
        active
          ? "border-accent bg-accent text-night-950"
          : "border-sand bg-card text-ink hover:border-accent"
      }`}
    >
      {children}
    </button>
  );
}

/* ── section mark ────────────────────────────────────────────────────────── */
/**
 * Board 02's section marker: 9.5px mono, uppercase, .16em tracking, orange —
 * with an optional right-hand affordance ("See all", "→") on the same baseline
 * and a 10.5px soft gloss underneath.
 */
export function SectionMark({
  label,
  gloss,
  right,
  className = "",
  id,
}: {
  label: string;
  gloss?: string;
  right?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={id}
          className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-gold-700"
        >
          {label}
        </h2>
        {right && <div className="shrink-0 text-[11px] text-soft">{right}</div>}
      </div>
      {gloss && <p className="mt-0.5 text-[10.5px] leading-snug text-soft">{gloss}</p>}
    </div>
  );
}

/* ── pill tabs ───────────────────────────────────────────────────────────── */
/**
 * Board 15's tab row: the current view is a filled ORANGE PILL with dark ink on
 * it; the rest are quiet 11px uppercase labels. Dark-on-orange is the board's
 * own choice and it is also the legible one (~6.4:1 vs 2.9:1 for white).
 *
 * Real `tablist` semantics because these drive a panel.
 */
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  panelId,
  className = "",
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
  ariaLabel: string;
  idPrefix: string;
  panelId: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`club2-track -mx-1 flex items-center gap-4 overflow-x-auto px-1 ${className}`}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            id={`${idPrefix}-${o.key}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={panelId}
            onClick={() => onChange(o.key)}
            className={
              on
                ? "f0-focus f0-press shrink-0 rounded-full bg-accent px-3.5 py-[5px] font-display text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-night-950"
                : "f0-focus f0-press shrink-0 rounded-full px-1 py-[5px] font-display text-[11px] font-semibold uppercase tracking-[0.04em] text-soft transition-colors hover:text-ink"
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── outlined chip ───────────────────────────────────────────────────────── */
/** Board 15's active-filter chip: white, orange 1px outline, orange label. */
export function BoardChip({
  tone = "quiet",
  as: Tag = "span",
  className = "",
  children,
  ...rest
}: {
  tone?: "accent" | "quiet";
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
  /* ButtonHTMLAttributes rather than HTMLAttributes so a chip rendered `as
     "button"` can declare `type="button"` — without it the browser defaults to
     `type="submit"` and a chip inside any form would submit it. */
} & React.ButtonHTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-[11px] py-[6px] text-[10.5px] font-semibold ${
        tone === "accent" ? "border-accent text-gold-700" : "border-sand text-soft"
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ── sparkline ───────────────────────────────────────────────────────────── */
/**
 * The board's bare sparkline: a 1.6–2px stroke, no axes, no fill, no container.
 * `points` is a REAL price series — this component never synthesises one, and
 * with fewer than two readings it renders nothing at all rather than a flat
 * line that would read as "no movement".
 *
 * Colour is the price ramp via currentColor, so it re-maps with the theme and
 * never needs a `dark:` variant.
 */
export function Spark({
  points,
  height = 22,
  width = 90,
  strokeWidth = 1.8,
  className = "",
  label,
}: {
  points: number[] | null | undefined;
  height?: number;
  width?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}) {
  const d = useMemo(() => pathFor(points, width, height), [points, width, height]);
  if (!d) {
    // No series is a real answer — the slot holds its height so the row does not
    // reflow when a line does land, but nothing is drawn.
    return <span aria-hidden className={className} style={{ height }} />;
  }
  const up = (points as number[])[points!.length - 1] >= (points as number[])[0];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`${up ? "text-price-up" : "text-price-down"} ${className}`}
      style={{ height }}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function pathFor(
  points: number[] | null | undefined,
  w: number,
  h: number
): string | null {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 2;
  const stepX = (w - pad * 2) / (points.length - 1);
  return points
    .map((c, i) => {
      const x = pad + i * stepX;
      const y = pad + (1 - (c - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/* ── bars-backed sparkline ───────────────────────────────────────────────── */
/**
 * `Spark` fed by REAL daily closes from /api/market/bars.
 *
 * Two costs the board's drawing hides: a strip of sparklines is a strip of
 * network calls, and the same ticker appears in more than one section. So the
 * fetch is (a) deferred until the line scrolls into view and (b) deduplicated
 * through a module-level promise cache, which means a ticker drawn three times
 * on the surface is fetched once for the life of the page.
 *
 * No bars → nothing draws. The card around it still says something true.
 */
const barCache = new Map<string, Promise<number[]>>();

function loadCloses(symbol: string): Promise<number[]> {
  const key = symbol.toUpperCase();
  let p = barCache.get(key);
  if (!p) {
    p = fetchBars(key, "3m")
      .then((bars) => bars.map((b) => b.c))
      .catch(() => []);
    barCache.set(key, p);
  }
  return p;
}

export function TickerSpark({
  symbol,
  height = 22,
  width = 90,
  strokeWidth = 1.8,
  className = "",
}: {
  symbol: string;
  height?: number;
  width?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [closes, setCloses] = useState<number[] | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      // No observer (very old browsers, jsdom): fall back to loading anyway,
      // but from a callback rather than synchronously inside the effect body —
      // a synchronous setState here would cascade a render on every mount.
      const id = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    let live = true;
    loadCloses(symbol).then((c) => {
      if (live && c.length >= 2) setCloses(c);
    });
    return () => {
      live = false;
    };
  }, [seen, symbol]);

  return (
    <span ref={host} className={className} style={{ height }}>
      <Spark
        points={closes}
        height={height}
        width={width}
        strokeWidth={strokeWidth}
        className="block w-full"
        label={closes ? `${symbol.toUpperCase()} three-month price trend` : undefined}
      />
    </span>
  );
}

/* ── donut ───────────────────────────────────────────────────────────────── */
/**
 * Board 02's "most divisive" ring and board 17's score dial: a conic-gradient
 * disc with a punched-out centre. The owner's boards draw this, so it is drawn.
 *
 * `tone`:
 *   "sentiment" — a community split. The filled arc is the LIME sentiment ramp
 *                 and the remainder is an ink tint; the board's green/red pair
 *                 would spend the price ramp on an opinion.
 *   "accent"    — a progress/score arc in brand orange.
 */
export function Donut({
  pct,
  size = 104,
  ring = 7,
  tone = "sentiment",
  children,
  className = "",
}: {
  /** 0–100. */
  pct: number;
  size?: number;
  ring?: number;
  tone?: "sentiment" | "accent";
  children?: React.ReactNode;
  className?: string;
}) {
  const p = Math.max(0, Math.min(100, pct));
  const fill = tone === "accent" ? "var(--accent-solid)" : "var(--sentiment-fill)";
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${fill} 0 ${p}%, color-mix(in srgb, var(--ink) 16%, transparent) ${p}% 100%)`,
        }}
      />
      <div
        className="absolute grid place-items-center rounded-full bg-paper"
        style={{ inset: ring }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── founding line ───────────────────────────────────────────────────────── */
/** A designed empty state, never a blank card: a charged rule and a sentence. */
export function FoundingLine({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`max-w-[56ch] border-l-2 border-accent pl-3.5 text-[12.5px] leading-relaxed text-soft ${className}`}
    >
      {children}
    </p>
  );
}

/* ── skeleton block ──────────────────────────────────────────────────────── */
/** LOADING ≠ EMPTY. A pulsing sand block is a promise that content is coming. */
export function Bone({
  w,
  h = 10,
  className = "",
}: {
  w: number | string;
  h?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`block rounded-full bg-sand motion-safe:animate-pulse ${className}`}
      style={{ width: w, height: h }}
    />
  );
}
