"use client";

import type { CSSProperties, ReactNode } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   BOARD PRIMITIVES — the ticker surfaces, built to the owner's mockup.

   SOURCE OF TRUTH: `.planning/design-project-v2/Cheat Code App Light.dc.html`
   boards 03 (Ticker · NVDA), 12 (Ticker · Technicals), 13 (Ticker ·
   Fundamentals) and 14 (Ticker · Kai Report), plus their dark twins in
   `Cheat Code App.dc.html`.

   A previous pass "interpreted" these boards into hairline ledgers and the
   owner rejected it. The boards ARE built from cards, radial gauges and filled
   pill tabs, so this file ships those objects verbatim:

     card      #FFFFFF on #F7F4EF, 1px #E5DFD5, r14/16/18   → bg-card / border-sand
     dark card #17141A on #0D0B0E, 1px #2A2530              → the same tokens, flipped
     eyebrow   IBM Plex Mono 8.5px, .14em, uppercase        → CardLabel
     pill tab  filled #FF7A1A (Kai = blue) / white + border → PillTabs
     donut     conic ring + hollow centre                    → Donut
     dial      180° 3-segment arc + needle                   → HalfGauge

   Every colour is a THEME TOKEN, never a board hex — the board's hexes are
   already the club-mode values of those tokens (#F7F4EF = --paper, #E5DFD5 =
   --sand, #FF7A1A = --g500, #0BA05A/#D92652 = --price-up/--price-down), so the
   tokens reproduce the light board exactly and give us the dark twin for free.
   That is why nothing in this file carries a `dark:` variant.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Card ────────────────────────────────────────────────────────────────
   The board's base object: a white plane on the warm page with one hairline
   and a soft lift. `tone` covers the two tinted variants the boards draw —
   the Kai verdict field (board 14, blue gradient + blue hairline) and the
   "what would change Kai's mind" field (board 14, warm gradient). */
/* The two tinted variants are mixed from TOKENS (--color-kai-500 /
   --color-accent against --color-card and --color-sand), not from the board's
   literal hexes, so the light board reproduces exactly and the dark twin —
   which the canvas draws as the same tint over #17141A — comes out of the same
   expression with no `dark:` variant. globals.css is another lane's file, so
   these live inline rather than as utility classes. */
const TINT: Record<"kai" | "brand", CSSProperties> = {
  kai: {
    background:
      "linear-gradient(140deg, color-mix(in srgb, var(--color-kai-500) 13%, var(--color-card)) 0%, var(--color-card) 70%)",
    borderColor: "color-mix(in srgb, var(--color-kai-500) 32%, var(--color-sand))",
  },
  brand: {
    background:
      "linear-gradient(120deg, color-mix(in srgb, var(--color-accent) 14%, var(--color-card)) 0%, var(--color-card) 70%)",
    borderColor: "color-mix(in srgb, var(--color-accent) 30%, var(--color-sand))",
  },
};

export function Card({
  children,
  tone = "plain",
  radius = "lg",
  className = "",
  style,
}: {
  /** Optional so a bare `<Card className="h-20 animate-pulse" />` is a legal
   *  loading shape — the card's own geometry IS the skeleton. */
  children?: ReactNode;
  tone?: "plain" | "kai" | "brand";
  radius?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
}) {
  const r = radius === "sm" ? "rounded-[14px]" : radius === "md" ? "rounded-[16px]" : "rounded-[18px]";
  const tinted = tone !== "plain";
  return (
    <div
      className={`${r} border shadow-soft ${tinted ? "" : "border-sand bg-card"} ${className}`}
      style={tinted ? { ...TINT[tone as "kai" | "brand"], ...style } : style}
    >
      {children}
    </div>
  );
}

/* ── Card eyebrow ────────────────────────────────────────────────────────
   Mono, uppercase, wide-tracked. `tone="brand"` is the board's orange section
   mark (KEY LEVELS / REVENUE / VALUATION VS PEERS); `tone="kai"` is the blue
   one on the Kai verdict; the default is the quiet grey label. */
export function CardLabel({
  children,
  tone = "soft",
  className = "",
}: {
  children: ReactNode;
  tone?: "soft" | "brand" | "kai";
  className?: string;
}) {
  const c =
    tone === "brand" ? "text-gold-700" : tone === "kai" ? "text-kai-600" : "text-soft";
  return (
    <p
      className={`font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.14em] ${c} ${className}`}
    >
      {children}
    </p>
  );
}

/* ── Section mark ────────────────────────────────────────────────────────
   Board 03's "WHERE THE CLUB STANDS · Raw sentiment": a brand-orange mono
   label with a quiet, un-tracked suffix, and an optional right-hand action. */
export function SectionMark({
  children,
  suffix,
  action,
  id,
}: {
  children: ReactNode;
  suffix?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2
        id={id}
        className="min-w-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-700"
      >
        {children}
        {suffix && (
          <span className="ml-1.5 normal-case tracking-normal text-soft">· {suffix}</span>
        )}
      </h2>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Pill tabs ───────────────────────────────────────────────────────────
   Boards 12/13/14 draw the analysis nav as FILLED PILLS — orange for the
   brand tabs, Kai blue for the Kai tab — with the resting tabs as white
   bordered pills. A real tablist (roving tabindex, arrow keys, aria-controls)
   so the pills are navigation, not decoration. */
export interface PillTabDef<T extends string> {
  key: T;
  label: string;
  /** Kai's tab is blue: colour law reserves blue for Kai/AI. */
  tone?: "brand" | "kai";
}

export function PillTabs<T extends string>({
  tabs,
  active,
  onSelect,
  ariaLabel,
  tabId,
  panelId,
  className = "",
}: {
  tabs: PillTabDef<T>[];
  active: T;
  onSelect: (key: T) => void;
  ariaLabel: string;
  tabId: (k: T) => string;
  panelId: (k: T) => string;
  className?: string;
}) {
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex((t) => t.key === active);
    if (i < 0) return;
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onSelect(tabs[next].key);
    (e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`club2-track -mx-1 -my-1 flex gap-0.5 overflow-x-auto px-1 py-1 sm:gap-1.5 ${className}`}
    >
      {tabs.map((t) => {
        const on = t.key === active;
        const kai = t.tone === "kai";
        return (
          <button
            key={t.key}
            id={tabId(t.key)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId(t.key)}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(t.key)}
            /* FIVE PILLS MUST FIT A 390px PHONE. At px-3/11.5px the fifth pill
               (News) was physically clipped off the right edge — a whole tab
               invisible unless you knew to swipe a strip that gives no scroll
               affordance. Tighter padding and a half-point of type buys the
               ~40px the row was over by; sm: restores the roomier board metric. */
            className={`f0-focus shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 text-[10.5px] tracking-[-0.006em] transition-colors sm:px-3 sm:text-[11.5px] sm:tracking-normal ${
              on
                ? kai
                  ? "bg-kai-500 font-extrabold text-white"
                  : "bg-volt-500 font-extrabold text-[#1A1614]"
                : "border border-sand bg-card font-semibold text-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Range pills ─────────────────────────────────────────────────────────
   Board 03's 1D · 1W · 1M · 3M · 1Y · ALL strip: squarer (r8) and mono, the
   active one filled brand orange.

   NOT A TABLIST. These carried `role="tablist"` / `role="tab"` with no
   `aria-controls` and no panel to point at — they don't swap a region, they
   re-scope the one chart above them. A screen reader following the tab contract
   goes looking for a tabpanel that does not exist. They are what they are: a
   group of toggle buttons, one of which is pressed. */
export function RangePills<T extends string>({
  ranges,
  active,
  onSelect,
  ariaLabel,
}: {
  ranges: readonly T[];
  active: T;
  onSelect: (k: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="club2-track -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label={ariaLabel}>
      {ranges.map((r) => {
        const on = r === active;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(r)}
            className={`f0-focus shrink-0 rounded-lg px-2.5 py-1 font-mono text-[10.5px] transition-colors ${
              on
                ? "bg-volt-500 font-bold text-[#1A1614]"
                : "border border-sand bg-card font-semibold text-soft hover:text-ink"
            }`}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}

/* ── Donut ───────────────────────────────────────────────────────────────
   The board's conic ring, drawn in SVG rather than with `conic-gradient` so
   the track colour can be a token and the arc can animate. `pct == null` is an
   HONEST ABSENCE: the track draws, the arc does not, and the caller puts a
   dash in the middle. */
/**
 * SIGNED RINGS. `pct` used to be clamped at zero, which meant a −38% net margin
 * and "we have no margin data" drew the identical empty ring — in the positive
 * colour. A loss is a fact the ring should STATE: the arc is drawn at the
 * magnitude of the figure and takes `negativeColor` when the figure is below
 * zero, so a loss-making quarter reads as a filled ring in the loss tone rather
 * than as an absence.
 */
export function Donut({
  pct,
  size = 116,
  thickness = 8,
  color = "var(--color-accent)",
  negativeColor,
  track = "var(--color-sand)",
  glow = false,
  children,
  label,
}: {
  /** −100–100, or null when the source hasn't resolved / has nothing to say. */
  pct: number | null;
  size?: number;
  thickness?: number;
  color?: string;
  /** Arc colour when `pct` is negative. Defaults to `color` (unsigned rings). */
  negativeColor?: string;
  track?: string;
  glow?: boolean;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const p = pct == null ? 0 : Math.min(100, Math.abs(pct));
  const arcColor = pct != null && pct < 0 ? negativeColor ?? color : color;
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        style={
          glow && pct != null
            ? { filter: "drop-shadow(0 0 10px color-mix(in srgb, var(--color-accent) 40%, transparent))" }
            : undefined
        }
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        {pct != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={arcColor}
            strokeWidth={thickness}
            strokeLinecap="butt"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - p / 100)}
            className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
          />
        )}
      </svg>
      <span className="relative z-[1] text-center leading-none">{children}</span>
    </span>
  );
}

/* ── Half gauge ──────────────────────────────────────────────────────────
   Board 12's dial: a 180° arc in three bands with a needle. The bands are
   drawn WEAK → STRONG left to right, and the end labels are the caller's
   (this product never labels a dial SELL/BUY — see PriceTechnicals). */
export function HalfGauge({
  value,
  width = 116,
  leftLabel,
  rightLabel,
  ariaLabel,
}: {
  /** 0–1 needle position, or null when nothing could be measured. */
  value: number | null;
  width?: number;
  leftLabel?: string;
  rightLabel?: string;
  ariaLabel: string;
}) {
  const W = width;
  const stroke = Math.round(W * 0.13);
  const cx = W / 2;
  const rr = (W - stroke) / 2;
  const H = Math.round(rr + stroke / 2 + 12);
  const cy = H - 12;

  // Three bands, matching the board: down-tone · caution · up-tone.
  const bands: { col: string; from: number; to: number }[] = [
    { col: "var(--color-price-down)", from: 0, to: 0.34 },
    { col: "#D99A00", from: 0.34, to: 0.5 },
    { col: "var(--color-price-up)", from: 0.5, to: 1 },
  ];
  const arc = (from: number, to: number) => {
    const a0 = Math.PI - from * Math.PI;
    const a1 = Math.PI - to * Math.PI;
    const p0 = { x: cx + rr * Math.cos(a0), y: cy - rr * Math.sin(a0) };
    const p1 = { x: cx + rr * Math.cos(a1), y: cy - rr * Math.sin(a1) };
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${rr} ${rr} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  };

  const v = value == null ? null : Math.max(0, Math.min(1, value));
  const na = v == null ? null : Math.PI - v * Math.PI;
  const nLen = rr - stroke * 0.1;

  return (
    <div className="shrink-0" style={{ width: W }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {bands.map((b, i) => (
          <path
            key={i}
            d={arc(b.from, b.to)}
            fill="none"
            stroke={b.col}
            strokeWidth={stroke}
            opacity={v == null ? 0.28 : 1}
          />
        ))}
        {na != null && (
          <>
            <line
              x1={cx}
              y1={cy}
              x2={(cx + nLen * Math.cos(na)).toFixed(2)}
              y2={(cy - nLen * Math.sin(na)).toFixed(2)}
              stroke="var(--color-ink)"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={3.5} fill="var(--color-ink)" />
          </>
        )}
      </svg>
      {(leftLabel || rightLabel) && (
        <div className="-mt-1.5 flex justify-between font-mono text-[7.5px] uppercase tracking-[0.08em] text-soft">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────────
   Board 03's four-up row under the sentiment donut and board 12's four-up row
   under the pattern card. A mono figure over a small caption, centred. */
export function StatCard({
  value,
  label,
  tone = "ink",
  href,
  loading = false,
}: {
  value: ReactNode;
  label: string;
  tone?: "ink" | "up" | "down" | "brand";
  href?: string;
  loading?: boolean;
}) {
  const c =
    tone === "up"
      ? "text-price-up"
      : tone === "down"
        ? "text-price-down"
        : tone === "brand"
          ? "text-gold-700"
          : "text-ink";
  const body = (
    <>
      {loading ? (
        <span
          className="mx-auto block h-3.5 w-10 rounded-full bg-ink/10 motion-safe:animate-pulse"
          aria-hidden
        />
      ) : (
        <span className={`block font-mono text-[13px] font-semibold tabular-nums ${c}`}>{value}</span>
      )}
      <span className="mt-1 block text-[9px] leading-tight text-soft">{label}</span>
    </>
  );
  const cls =
    "min-w-0 flex-1 rounded-xl border border-sand bg-card px-1.5 py-2.5 text-center shadow-soft";
  if (href) {
    return (
      <a href={href} className={`${cls} f0-focus transition-colors hover:border-volt-300`}>
        {body}
      </a>
    );
  }
  return <div className={cls}>{body}</div>;
}

/* ── Insight card ────────────────────────────────────────────────────────
   Board 14's three signal cards: a small drawn object on the left, a bold
   title and a plain sub-line on the right. */
export function InsightCard({
  visual,
  title,
  body,
}: {
  visual?: ReactNode;
  title: ReactNode;
  body: ReactNode;
}) {
  return (
    <Card radius="md" className="flex items-center gap-3.5 p-[14px_15px]">
      {visual && (
        <span className="grid h-11 w-14 shrink-0 place-items-center" aria-hidden>
          {visual}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold leading-snug text-ink">{title}</span>
        <span className="mt-1 block text-[10.5px] leading-[1.5] text-soft">{body}</span>
      </span>
    </Card>
  );
}

/* ── Compare bar ─────────────────────────────────────────────────────────
   Board 13's "valuation vs peers" row: name · track · figure. The subject's
   own bar is brand orange, everything it is compared against is sand. */
export function CompareBar({
  name,
  pct,
  value,
  highlight = false,
}: {
  name: string;
  /** 0–100 fill, or null for an unresolved comparator. */
  pct: number | null;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`w-11 shrink-0 truncate font-mono text-[10px] ${
          highlight ? "font-semibold text-ink" : "text-soft"
        }`}
      >
        {name}
      </span>
      <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-sand">
        {pct != null && (
          <span
            className={`block h-full rounded-full ${highlight ? "bg-volt-500" : "bg-midnight-600/45"}`}
            style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
          />
        )}
      </span>
      <span
        className={`w-9 shrink-0 text-right font-mono text-[10px] tabular-nums ${
          highlight ? "text-ink" : "text-soft"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Dot tally ───────────────────────────────────────────────────────────
   Board 03's dot rows under BULLISH / BEARISH. Ten dots stand for the share,
   filled solid to the rounded tenth and half-tinted for the remainder, so the
   row is a readable count rather than decoration. */
export function DotTally({
  pct,
  tone,
  ariaLabel,
}: {
  pct: number;
  tone: "up" | "down";
  ariaLabel: string;
}) {
  const filled = Math.max(0, Math.min(10, Math.round(pct / 10)));
  const solid = tone === "up" ? "bg-price-up" : "bg-price-down";
  return (
    <div
      className="mx-auto mt-2 flex max-w-[92px] flex-wrap justify-center gap-[3px]"
      role="img"
      aria-label={ariaLabel}
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${solid} ${i < filled ? "" : "opacity-25"}`}
        />
      ))}
    </div>
  );
}

/* ── Compliance foot ─────────────────────────────────────────────────────
   The boards close every analysis screen with one quiet mono line above the
   tab bar. Verbatim strings only — the caller owns the words. */
export function BoardFoot({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 border-t border-sand pt-3.5 text-center text-[11px] leading-relaxed text-soft">
      {children}
    </p>
  );
}
