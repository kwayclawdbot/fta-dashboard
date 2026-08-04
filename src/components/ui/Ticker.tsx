"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   TICKER — the app-wide stock-symbol primitive.

   STANDING RULE (new, app-wide): a stock ticker NEVER renders as plain body
   text. It renders either
     • WITH its real company logo (a rounded white tile + the symbol), or
     • when there is no room for a logo, as a VIBRANT volt chip — the symbol in
       the Club's brand/volt treatment, so identity still reads at a glance.
   A bare `<span>AAPL</span>` in ink text is exactly what this replaces.

   COLOUR LAW: the vibrant fallback is BRAND, so it is volt (orange) — the
   action/brand hue. It never borrows green/red (price), lime (sentiment) or
   kai-blue (AI). The logo tile itself is achromatic (white ground, sand
   hairline); brand identity is carried by the logo art or the volt chip, never
   by a coloured ground behind the symbol.

   FAIL-SOFT LOGOS (follows CompanyLogo/TickerTile): most of the market has no
   branding image at Polygon (funds, small caps), so `/api/market/logo` answers
   404 for them. Pointing an <img> straight at that logs a failed resource for
   every miss and floods the console on a dense surface. Instead the URL is
   probed with `fetch` (a 404 is a VALUE, not an error), the answer is cached
   per symbol for the session, and simultaneous instances share one in-flight
   request. On a miss we render the volt chip — never a broken-image box.

   ── USAGE ──────────────────────────────────────────────────────────────────
     <Ticker symbol="AAPL" />                         logo tile + symbol
     <Ticker symbol="AAPL" companyName="Apple" showName />
     <Ticker symbol="AAPL" variant="logo-only" size="lg" />   just the tile
     <Ticker symbol="TSLA" variant="chip" size="sm" />        tight-space chip
     <Ticker symbol="NVDA" href="/research/NVDA" />           whole thing links
   Use `variant="chip"` inside dense rows / lead slots where a 28px tile will
   not fit (e.g. a RowCard lead, an inline mention). Use the default `logo`
   everywhere there is room for the tile.
   ══════════════════════════════════════════════════════════════════════════ */

export type TickerSize = "sm" | "md" | "lg";
export type TickerVariant = "logo" | "logo-only" | "chip";

export interface TickerProps {
  /** The ticker symbol, e.g. "AAPL". Rendered uppercased. */
  symbol: string;
  /** Company name, shown as a secondary line when `showName` (logo variants). */
  companyName?: string | null;
  size?: TickerSize;
  /**
   * `logo` (default) — logo tile + symbol text.
   * `logo-only` — just the tile (symbol lives in aria-label).
   * `chip` — vibrant volt chip, no logo attempt (tight spaces).
   */
  variant?: TickerVariant;
  /** Show the company name under/next to the symbol (logo variants only). */
  showName?: boolean;
  /** Make the whole ticker a link (usually to /research/SYMBOL). */
  href?: string;
  className?: string;
}

/* ── SIZE TABLE ─────────────────────────────────────────────────────────────
   `tile` px is the logo/mono square; `radius` its corner; `sym`/`name` the type
   steps; `chip` the padding/type of the vibrant chip. */
const SIZES: Record<
  TickerSize,
  { tile: number; radius: number; sym: string; name: string; chip: string; gap: string }
> = {
  sm: { tile: 20, radius: 6, sym: "text-[11px]", name: "text-[9px]", chip: "text-[10px] px-1.5 py-[3px]", gap: "gap-1.5" },
  md: { tile: 28, radius: 8, sym: "text-[13px]", name: "text-[10px]", chip: "text-[11px] px-2 py-0.5", gap: "gap-2" },
  lg: { tile: 40, radius: 10, sym: "text-[15px]", name: "text-[11px]", chip: "text-[13px] px-2.5 py-1", gap: "gap-2.5" },
};

/* Session cache of "does branding exist for this symbol?" — survives remounts.
   Kept module-local so one symbol is asked about once across every Ticker on a
   surface. Mirrors CompanyLogo's cache (separate map, same contract). */
const KNOWN = new Map<string, boolean>();
const PENDING = new Map<string, Promise<boolean>>();

function logoExists(symbol: string): Promise<boolean> {
  const key = symbol.toUpperCase();
  const known = KNOWN.get(key);
  if (known !== undefined) return Promise.resolve(known);
  const existing = PENDING.get(key);
  if (existing) return existing;
  const p = fetch(`/api/market/logo?symbol=${encodeURIComponent(symbol)}`)
    .then((res) => res.ok)
    .catch(() => false)
    .then((ok) => {
      KNOWN.set(key, ok);
      PENDING.delete(key);
      return ok;
    });
  PENDING.set(key, p);
  return p;
}

/** The vibrant volt chip — the brand-treatment fallback / tight-space form.
 *  Filled volt→amber gradient, white symbol, a faint volt glow. This is the
 *  "never plain text" guarantee made visible. */
function VoltChip({ sym, cls }: { sym: string; cls: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md font-display font-bold uppercase leading-none tracking-[0.02em] text-white ${cls}`}
      style={{
        background: "linear-gradient(135deg, var(--color-volt-600) 0%, #FFB020 100%)",
        boxShadow: "0 1px 6px color-mix(in srgb, var(--color-volt-500) 42%, transparent)",
      }}
    >
      {sym}
    </span>
  );
}

/** The volt identity tile shown while checking, or when no logo exists — a
 *  vibrant volt square with the symbol's monogram, so a logo-less ticker still
 *  gets a brand-coloured mark rather than a neutral placeholder. */
function VoltTile({ mono, tile, radius }: { mono: string; tile: number; radius: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center font-display font-black leading-none text-white"
      style={{
        width: tile,
        height: tile,
        borderRadius: radius,
        fontSize: Math.round(tile * 0.42),
        background: "linear-gradient(135deg, var(--color-volt-600) 0%, #FFB020 100%)",
        boxShadow: "0 1px 5px color-mix(in srgb, var(--color-volt-500) 38%, transparent)",
      }}
      aria-hidden
    >
      {mono}
    </span>
  );
}

export default function Ticker({
  symbol,
  companyName,
  size = "md",
  variant = "logo",
  showName = false,
  href,
  className = "",
}: TickerProps) {
  const s = SIZES[size];
  const sym = (symbol ?? "").trim().toUpperCase();
  const mono = sym.slice(0, 1) || "?";

  // Logo existence, stored WITH the symbol it belongs to so a reused instance
  // never paints the previous company's verdict for a frame.
  const [answer, setAnswer] = useState<{ sym: string; has: boolean | null }>(() => ({
    sym,
    has: sym ? KNOWN.get(sym) ?? null : false,
  }));

  const needsLogo = variant !== "chip";
  useEffect(() => {
    if (!needsLogo || !sym) return;
    let cancelled = false;
    void logoExists(sym).then((ok) => {
      if (!cancelled) setAnswer({ sym, has: ok });
    });
    return () => {
      cancelled = true;
    };
  }, [sym, needsLogo]);

  const hasLogo = answer.sym === sym ? answer.has : sym ? KNOWN.get(sym) ?? null : false;

  // ── The face ──────────────────────────────────────────────────────────────
  let face: React.ReactNode;

  if (variant === "chip") {
    // Pure vibrant chip, no logo attempt.
    face = <VoltChip sym={sym || "?"} cls={s.chip} />;
  } else {
    // Logo tile (or volt tile while checking / on miss) + optional symbol text.
    const tile =
      hasLogo === true ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/market/logo?symbol=${encodeURIComponent(sym)}`}
          alt={`${companyName || sym} logo`}
          loading="lazy"
          width={s.tile}
          height={s.tile}
          onError={() => {
            KNOWN.set(sym, false);
            setAnswer({ sym, has: false });
          }}
          style={{ width: s.tile, height: s.tile, borderRadius: s.radius }}
          className="shrink-0 bg-white object-contain p-0.5 ring-1 ring-sand"
        />
      ) : (
        <VoltTile mono={mono} tile={s.tile} radius={s.radius} />
      );

    if (variant === "logo-only") {
      face = tile;
    } else {
      face = (
        <span className={`inline-flex min-w-0 items-center ${s.gap}`}>
          {tile}
          <span className="min-w-0">
            <span className={`block truncate font-display font-bold leading-tight tracking-[-0.01em] text-ink ${s.sym}`}>
              {sym}
            </span>
            {showName && companyName ? (
              <span className={`block truncate leading-tight text-soft ${s.name}`}>{companyName}</span>
            ) : null}
          </span>
        </span>
      );
    }
  }

  const label = companyName ? `${sym}, ${companyName}` : sym;
  const wrapCls = `inline-flex max-w-full items-center ${className}`;

  if (href) {
    return (
      <Link href={href} aria-label={label} className={`f0-focus ${wrapCls} rounded-md`}>
        {face}
      </Link>
    );
  }
  return (
    <span className={wrapCls} aria-label={variant === "logo-only" ? label : undefined}>
      {face}
    </span>
  );
}
