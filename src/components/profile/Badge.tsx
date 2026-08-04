"use client";

import { useId } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   BADGE — vibrant, energetic achievement emblems for the profile shelf.

   Replaces the plain orange letter-discs (F, X, R, S, …) with crisp inline-SVG
   crest emblems: a gradient hexagon medallion carrying a bold white icon per
   concept, with a soft brand glow. Everything is drawn — no raster assets, no
   external fonts — so an emblem is razor-sharp at any size and identical in
   light and dark.

   EARNED = the full vibrant medallion.
   LOCKED = the same emblem desaturated + ghosted (a muted crest), so the shelf
            reads as "these are earned, this is what's next" without a second
            drawing to maintain.

   COLOUR LAW: emblems are BRAND objects, so their gradients live on the brand
   axis only — volt (orange), gold, and Club teal, in energetic pairings
   (volt→gold, volt→teal, gold). They never borrow green/red (price), lime
   (sentiment) or kai-blue (AI). Belt emblems are the one exception and carry the
   belt's own intrinsic hex, exactly as belts do everywhere else.

   ── ADDING A BADGE ──────────────────────────────────────────────────────────
   Add one row to EMBLEMS keyed by the badge slug: a palette (VOLT_GOLD /
   VOLT_TEAL / TEAL / GOLD / VOLT) and an `icon` renderer. Unknown slugs fall
   back to the star crest, so a new DB badge is never broken — just add its art
   when you want it. Owner-vocabulary aliases (first_call, ten_calls, …) point at
   the same art as the shipped DB slugs (scout, analyst, …).
   ══════════════════════════════════════════════════════════════════════════ */

type Palette = { a: string; b: string; glow: string };

// Brand-axis gradients (intrinsic hex — theme-independent, like belts).
const VOLT_GOLD: Palette = { a: "#E85400", b: "#FFB020", glow: "#FF6A00" };
const VOLT_TEAL: Palette = { a: "#FF6A00", b: "#00C389", glow: "#FF6A00" };
const TEAL: Palette = { a: "#00B8A0", b: "#34E3A8", glow: "#00C389" };
const GOLD: Palette = { a: "#B9781A", b: "#F5C043", glow: "#E39A2B" };
const VOLT: Palette = { a: "#E85400", b: "#FF9A2E", glow: "#FF6A00" };

/** Icon renderer — draws in `c` (main, white when earned) with `cut` for
 *  interior detail and `gid` for the medallion gradient (colored knockouts). */
type IconFn = (p: { c: string; cut: string; gid: string }) => React.ReactNode;

/* ── ICONS ───────────────────────────────────────────────────────────────────
   Centered on (24,24) inside a hexagon spanning x[6..42] y[3..45]. Bold, few
   shapes, instantly readable at 34px. */

const rocket: IconFn = ({ c, cut }) => (
  <>
    <path d="M24 11 C27.5 14.5 29 19 29 24 L29 30 L19 30 L19 24 C19 19 20.5 14.5 24 11 Z" fill={c} />
    <path d="M19 27 L15.5 31.5 L19 30 Z" fill={c} />
    <path d="M29 27 L32.5 31.5 L29 30 Z" fill={c} />
    <path d="M21.6 30 L24 35.5 L26.4 30 Z" fill={c} opacity="0.85" />
    <circle cx="24" cy="20" r="2.6" fill={cut} />
  </>
);

const multiplier: IconFn = ({ c }) => (
  <g fill="none" stroke={c} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16,32 24,26 32,32" />
    <polyline points="16,26 24,20 32,26" />
    <polyline points="16,20 24,14.5 32,20" />
  </g>
);

const magnifier: IconFn = ({ c }) => (
  <>
    <circle cx="22" cy="22" r="8" fill="none" stroke={c} strokeWidth="2.7" />
    <line x1="27.8" y1="27.8" x2="33" y2="33" stroke={c} strokeWidth="3.1" strokeLinecap="round" />
    <g stroke={c} strokeWidth="2" strokeLinecap="round">
      <line x1="19.5" y1="24" x2="19.5" y2="21.5" />
      <line x1="22" y1="24" x2="22" y2="18.5" />
      <line x1="24.5" y1="24" x2="24.5" y2="20.5" />
    </g>
  </>
);

const flame: IconFn = ({ c }) => (
  <>
    <circle cx="24" cy="24" r="12" fill="none" stroke={c} strokeWidth="1.6" opacity="0.4" />
    <path
      d="M24 12.5 C26.5 16.5 29 19 29 23.5 C29 28 26 31 24 31 C22 31 19 28 19 23.5 C19 21 20.4 19.6 21.4 18.2 C21.7 20.3 22.8 21.4 24 21 C24.9 19 24.7 15.6 24 12.5 Z"
      fill={c}
    />
  </>
);

const heartHands: IconFn = ({ c }) => (
  <>
    <path
      d="M24 30.5 C24 30.5 15 25 15 19.8 C15 17 17 15 19.4 15 C21.2 15 22.8 16.1 24 18 C25.2 16.1 26.8 15 28.6 15 C31 15 33 17 33 19.8 C33 25 24 30.5 24 30.5 Z"
      fill={c}
    />
    <path d="M15 31.5 C18.5 35 29.5 35 33 31.5" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
  </>
);

const compass: IconFn = ({ c, cut, gid }) => (
  <>
    <circle cx="24" cy="24" r="11.5" fill="none" stroke={c} strokeWidth="2" />
    <path d="M24 15 L27 24 L24 27 L21 24 Z" fill={c} />
    <path d="M24 33 L21 24 L24 21 L27 24 Z" fill={c} opacity="0.55" />
    <circle cx="24" cy="24" r="2" fill={gid ? `url(#${gid})` : cut} stroke={c} strokeWidth="1.2" />
  </>
);

const shield: IconFn = ({ c, cut, gid }) => (
  <>
    <path d="M24 12.5 L33 15.8 V24 C33 30.2 29 33.8 24 35.5 C19 33.8 15 30.2 15 24 V15.8 Z" fill={c} />
    <polyline
      points="19.6,24 22.6,27.4 29,19.6"
      fill="none"
      stroke={gid ? `url(#${gid})` : cut}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>
);

const growth: IconFn = ({ c }) => (
  <g fill="none" stroke={c} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15,30 21,24 25,27.5 33,17" />
    <polyline points="27.5,17 33,17 33,22.5" />
  </g>
);

const candles: IconFn = ({ c }) => (
  <g stroke={c} strokeLinecap="round">
    <line x1="18.5" y1="17" x2="18.5" y2="31" strokeWidth="2" />
    <rect x="16.7" y="21" width="3.6" height="6.5" rx="1" fill={c} stroke="none" />
    <line x1="24" y1="14.5" x2="24" y2="33.5" strokeWidth="2" />
    <rect x="22.2" y="18.5" width="3.6" height="9.5" rx="1" fill={c} stroke="none" />
    <line x1="29.5" y1="18" x2="29.5" y2="30" strokeWidth="2" />
    <rect x="27.7" y="22" width="3.6" height="5" rx="1" fill={c} stroke="none" />
  </g>
);

const crown: IconFn = ({ c, cut }) => (
  <>
    <path d="M14.5 31 L14.5 20.5 L20 24.5 L24 16.5 L28 24.5 L33.5 20.5 L33.5 31 Z" fill={c} />
    <rect x="14.5" y="30.5" width="19" height="2.4" rx="1.2" fill={c} />
    <circle cx="14.5" cy="19.5" r="1.7" fill={c} />
    <circle cx="24" cy="15.5" r="1.9" fill={c} />
    <circle cx="33.5" cy="19.5" r="1.7" fill={c} />
    <circle cx="24" cy="26.5" r="1.8" fill={cut} />
  </>
);

const star: IconFn = ({ c }) => (
  <path
    d="M24 13 L27.4 20.2 L35 21.2 L29.5 26.6 L30.9 34.2 L24 30.5 L17.1 34.2 L18.5 26.6 L13 21.2 L20.6 20.2 Z"
    fill={c}
  />
);

type Emblem = { pal: Palette; icon: IconFn };

/* ── REGISTRY ─────────────────────────────────────────────────────────────── */
const EMBLEMS: Record<string, Emblem> = {
  // Shipped DB slugs (migration 033 professional titles).
  scout: { pal: TEAL, icon: compass },
  analyst: { pal: VOLT_TEAL, icon: magnifier },
  risk_manager: { pal: GOLD, icon: shield },
  investor: { pal: TEAL, icon: growth },
  technician: { pal: VOLT_GOLD, icon: candles },
  ceo: { pal: GOLD, icon: crown },

  // Owner-vocabulary concepts / future slugs.
  first_call: { pal: VOLT_GOLD, icon: rocket },
  ten_calls: { pal: VOLT_TEAL, icon: multiplier },
  calls_10: { pal: VOLT_TEAL, icon: multiplier },
  researcher: { pal: VOLT_TEAL, icon: magnifier },
  streak: { pal: VOLT, icon: flame },
  streak_30: { pal: VOLT, icon: flame },
  thirty_day_streak: { pal: VOLT, icon: flame },
  helper: { pal: VOLT_TEAL, icon: heartHands },
};

const FALLBACK: Emblem = { pal: VOLT_GOLD, icon: star };

// Belt intrinsic hex (mirrors src/lib/belts.ts) for belt-tier emblems.
const BELT_HEX: Record<string, string> = {
  white: "#E8EAF0",
  yellow: "#E39A2B",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  black: "#1F2430",
};

/** A martial-arts belt knot — used by `belt-<key>` slugs, colored by the belt. */
const beltKnot: IconFn = ({ c }) => (
  <>
    <path d="M9 22 H39 V27 H9 Z" fill={c} opacity="0.9" />
    <path d="M20.5 23 L27.5 23 L26 33 L22 33 Z" fill={c} />
    <path d="M22 24.5 L18 34 L21.5 33 Z" fill={c} />
    <path d="M26 24.5 L30 34 L26.5 33 Z" fill={c} />
    <rect x="20.5" y="21.5" width="7" height="6" rx="1.4" fill={c} />
  </>
);

export interface BadgeProps {
  /** Badge slug (DB slug like "scout", concept like "first_call", or
   *  "belt-blue"). Unknown slugs render the star crest. */
  slug: string;
  /** Earned = full vibrant crest; false = muted/ghosted. Default true. */
  earned?: boolean;
  /** Rendered pixel size of the emblem. Default 44. */
  size?: number;
  /** Accessible label / tooltip (falls back to the slug). */
  title?: string;
  className?: string;
}

/** One emblem. Pure SVG, no layout chrome — the shelf/caller supplies the frame
 *  and caption. */
export function Badge({ slug, earned = true, size = 44, title, className = "" }: BadgeProps) {
  const gid = useId().replace(/:/g, "");
  const key = (slug || "").toLowerCase();

  // Belt emblems: intrinsic belt hex, white knot.
  const beltKey = key.startsWith("belt-") ? key.slice(5) : null;
  const isBelt = beltKey != null && beltKey in BELT_HEX;

  const emblem = isBelt ? { pal: null as Palette | null, icon: beltKnot } : EMBLEMS[key] ?? FALLBACK;
  const beltFill = isBelt ? BELT_HEX[beltKey as string] : null;

  // Earned face colors; locked is handled by a CSS muting filter on the SVG.
  const iconColor = beltKey === "white" ? "#1F2937" : "#FFFFFF";
  const cut = "rgba(12,9,6,0.24)";

  const HEX = "24,3 42,13.5 42,34.5 24,45 6,34.5 6,13.5";

  return (
    <svg
      role="img"
      aria-label={title || slug}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`badge-emblem ${earned ? "" : "badge-emblem--locked"} ${className}`}
      style={
        earned
          ? { filter: `drop-shadow(0 2px 5px color-mix(in srgb, ${(beltFill ?? emblem.pal?.glow) || "#FF6A00"} 45%, transparent))` }
          : undefined
      }
    >
      {!isBelt && emblem.pal ? (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={emblem.pal.a} />
            <stop offset="1" stopColor={emblem.pal.b} />
          </linearGradient>
        </defs>
      ) : null}

      {/* Medallion */}
      <polygon
        points={HEX}
        fill={isBelt ? (beltFill as string) : `url(#${gid})`}
        stroke={isBelt ? (beltFill as string) : `url(#${gid})`}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Top gloss — a sliver of light so the crest reads as a raised object. */}
      <path d="M9 12 C15 7 33 7 39 12 C33 10 15 10 9 12 Z" fill="#FFFFFF" opacity="0.22" />

      {/* Icon */}
      {emblem.icon({ c: iconColor, cut, gid: isBelt ? "" : gid })}

      {/* Hover sheen — a diagonal light sweep, clipped to the crest. Gated on
          reduced-motion in globals.css (see .badge-emblem / .badge-sheen). */}
      <clipPath id={`${gid}-clip`}>
        <polygon points={HEX} />
      </clipPath>
      <g clipPath={`url(#${gid}-clip)`}>
        <rect className="badge-sheen" x="-24" y="0" width="16" height="48" fill="url(#badge-sheen-grad)" />
      </g>
    </svg>
  );
}

/** Shared sheen gradient — declared once for the whole document. Render this
 *  anywhere on a page that uses badges (BadgeShelf includes it automatically). */
export function BadgeSheenDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="badge-sheen-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export interface BadgeShelfItem {
  slug: string;
  title: string;
  subtitle?: string | null;
  awarded: boolean;
}

/**
 * BadgeShelf — the profile's horizontal emblem scroller. Drop-in replacement
 * for the letter-disc shelf: same club2-track row, same 92px caption cards, now
 * carrying vibrant crests. Locked cards keep the caption in soft ink; the emblem
 * carries the earned/locked state itself.
 */
export function BadgeShelf({ badges, className = "" }: { badges: BadgeShelfItem[]; className?: string }) {
  return (
    <div className={`club2-track flex gap-2 overflow-x-auto pb-1 ${className}`}>
      <BadgeSheenDefs />
      {badges.map((b) => (
        <div
          key={b.slug}
          title={b.subtitle ?? undefined}
          className="club-b-card flex w-[92px] shrink-0 flex-col items-center gap-2 rounded-[13px] px-1.5 py-[11px] text-center"
        >
          <Badge slug={b.slug} earned={b.awarded} size={40} title={b.title} />
          <span className={`font-display text-[9.5px] font-bold leading-tight ${b.awarded ? "text-ink" : "text-soft"}`}>
            {b.title}
          </span>
        </div>
      ))}
    </div>
  );
}

export default Badge;
