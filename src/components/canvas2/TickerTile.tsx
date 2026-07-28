"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════
   TICKER TILE — canvas v2 §1.3 (Club Screens 01 "TOP IN THE CLUB", App 01).

   The canvas's most reusable object: a black rounded square carrying a letter
   mark, with the delta set BENEATH it rather than inside. That split is the
   whole point — the field stays achromatic so the tile can sit in a dense strip
   without nine coloured squares fighting each other, and the one coloured thing
   on the object is the number that is genuinely a price.

   COLOUR LAW:
     • The field is achromatic in both themes (.f0-tile-field). The canvas paints
       some tiles in brand colour — a red Tesla square, a green mark — and that is
       deliberately NOT adopted: `green/red = PRICE only`, and a red field sitting
       directly above a green delta is the exact unreadable pairing the law was
       written after. Identity is carried by the mark, not the ground.
     • The delta uses text-price-up / text-price-down and NEVER a dark: variant —
       those tokens already re-map per theme.

   HONEST ABSENCE: a tile with no delta renders "—", never a fabricated 0.00%.
   LOADING ≠ EMPTY: `loading` pulses a filled tile (content is coming);
   omitting `ticker` renders the dashed slot (there is nothing here).
   ══════════════════════════════════════════════════════════════════════════ */

export type TickerTileSize = "sm" | "md" | "lg";

/** Geometry only. `md` (58px / r12 / 20px mark) is the canvas's own measure;
 *  `sm` is the dense-strip step and `lg` the ticker-header step. */
const SIZES: Record<
  TickerTileSize,
  { box: number; radius: number; mark: string; delta: string; gap: string }
> = {
  sm: { box: 44, radius: 10, mark: "text-[15px]", delta: "text-[9px]", gap: "mt-1" },
  md: { box: 58, radius: 12, mark: "text-[20px]", delta: "text-[10px]", gap: "mt-1.5" },
  lg: { box: 72, radius: 14, mark: "text-[25px]", delta: "text-[11px]", gap: "mt-2" },
};

/** Signed, two-decimal, always with an explicit + so a gain never reads flat. */
function formatDelta(pct: number): string {
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct).toFixed(2)}%`;
}

/* The REAL COMPANY LOGO is the default mark. The tile shipped with `logoUrl` as
   an opt-in and not one of its eighteen call sites ever passed it, so every
   identity on the canvas was a single letter — three names sharing an initial
   were three identical squares. The proxy is keyless and CDN-cached, so the
   correct default is "ask for the logo"; the letter stays as the fallback face,
   which is the same contract CompanyLogo honours (a failed fetch reverts to a
   mark, never a broken-image box).

   Pass `logoUrl={null}` explicitly to opt a surface back out; `undefined` means
   "not specified" and takes the default. */
function logoSrc(sym: string): string {
  return `/api/market/logo?symbol=${encodeURIComponent(sym)}`;
}

/* onError IS NOT ENOUGH ON A SERVER-RENDERED IMAGE. The tag ships inside the
   HTML, so the browser starts the request while it is still parsing — well
   before React hydrates and attaches the handler. A 404 that lands in that
   window fires an error nobody is listening for, and the tile is left holding
   the browser's broken-image glyph forever. (Observed live: forcing the
   branding proxy to 404 left torn-page icons on the Club strip while the
   client-rendered surfaces fell back correctly.)
   The REF CALLBACK closes the gap: it runs the moment the node is attached, so
   it can ask the element what already happened — a finished image with zero
   natural width is, by definition, one that failed. (A ref callback rather than
   an effect because state set from an effect body is a re-render after paint;
   this one resolves in the same commit, so the fallback never flashes.) */
function useBrokenImage(
  src: string | null
): [(el: HTMLImageElement | null) => void, boolean, () => void] {
  const [broken, setBroken] = useState(false);
  // Render-phase reset: a tile reused for a different company starts clean
  // rather than inheriting the previous company's failure.
  const [seen, setSeen] = useState(src);
  if (seen !== src) {
    setSeen(src);
    setBroken(false);
  }
  const attach = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, []);
  return [attach, seen === src && broken, () => setBroken(true)];
}

export interface TickerTileProps {
  /** Omit to render the empty slot. */
  ticker?: string | null;
  /** Percent change. `null`/undefined is an honest absence, not zero. */
  changePct?: number | null;
  /** Overrides the derived letter mark (e.g. a two-letter mark for a strip
   *  where three tickers share an initial). Kept to 2 characters. */
  mark?: string;
  /** Company logo. Defaults to the real branding proxy for the given ticker;
   *  falls back to the letter mark if it fails to load. Pass `null` to force
   *  the letter mark. */
  logoUrl?: string | null;
  size?: TickerTileSize;
  /** Makes the whole tile a link. Without it the tile is inert (not focusable),
   *  which is correct for a decorative strip. */
  href?: string;
  /** Suppresses the delta line entirely — for strips where the tile is only an
   *  identity mark (a thread row, a composer's bound ticker). */
  showDelta?: boolean;
  /** Skeleton. Distinct from the empty slot by design — see the file header. */
  loading?: boolean;
  className?: string;
}

export default function TickerTile({
  ticker,
  changePct,
  mark,
  logoUrl,
  size = "md",
  href,
  showDelta = true,
  loading = false,
  className = "",
}: TickerTileProps) {
  const s = SIZES[size];
  const sym = (ticker ?? "").trim().toUpperCase();
  const glyph = (mark ?? sym.slice(0, 1)).slice(0, 2);

  // `undefined` = unspecified → take the real logo. `null` = an explicit opt-out.
  const src = logoUrl === undefined ? (sym ? logoSrc(sym) : null) : logoUrl;
  const [attachLogo, logoBroken, markLogoBroken] = useBrokenImage(src);
  const showLogo = Boolean(src) && !logoBroken;

  // ── LOADING — a filled, pulsing tile. It claims content is coming. ────────
  if (loading) {
    return (
      <div
        className={`shrink-0 ${className}`}
        style={{ width: s.box }}
        aria-hidden
      >
        <div
          className="f0-tile-field motion-safe:animate-pulse"
          style={{ height: s.box, borderRadius: s.radius }}
        />
        {showDelta && (
          <div
            className={`mx-auto h-2 w-8 rounded-full bg-sand motion-safe:animate-pulse ${s.gap}`}
          />
        )}
      </div>
    );
  }

  // ── EMPTY SLOT — a dashed outline. It claims nothing exists here. ─────────
  if (!sym) {
    return (
      <div className={`shrink-0 ${className}`} style={{ width: s.box }}>
        <div
          className="f0-tile-empty grid place-items-center"
          style={{ height: s.box, borderRadius: s.radius }}
        >
          <span className="font-display font-black text-soft/45" aria-hidden>
            +
          </span>
        </div>
        {showDelta && (
          <p
            className={`text-center font-mono font-semibold tabular-nums text-soft/45 ${s.delta} ${s.gap}`}
          >
            —
          </p>
        )}
      </div>
    );
  }

  const hasDelta = typeof changePct === "number" && Number.isFinite(changePct);
  const deltaText = hasDelta ? formatDelta(changePct) : "—";
  const deltaTone = !hasDelta
    ? "text-soft"
    : changePct > 0
      ? "text-price-up"
      : changePct < 0
        ? "text-price-down"
        : "text-soft";

  const readable = hasDelta
    ? `${sym}, ${changePct > 0 ? "up" : changePct < 0 ? "down" : "unchanged"} ${Math.abs(changePct).toFixed(2)} percent`
    : `${sym}, change unavailable`;

  /* THE LOGO NEEDS A LIGHT GROUND. Polygon's icons are opaque white-ground
     bitmaps (and TSLA's is an RGBA file carrying a DARK mark), so dropping one
     straight onto the achromatic field gives you either a white postage stamp
     on obsidian or an invisible mark. The face therefore flips to the chip
     CompanyLogo already uses app-wide — white ground, sand hairline — the
     moment an image is actually showing, and reverts to the drawn dark
     letter-mark face the moment it is not. Identity is still carried by the
     mark, not by a brand-coloured ground, so the colour law holds.

     The ground is set INLINE, not with `bg-white`: globals.css is unlayered, so
     `.f0-tile-field`'s gradient outranks every Tailwind background utility. The
     edge is a `border` rather than a `ring` for the same reason in reverse —
     `.f0-tile-lead .f0-tile-field` owns box-shadow, and a ring would silently
     eat the lead tile's accent halo. */
  const field = (
    <>
      <div
        className={`f0-tile-field grid place-items-center overflow-hidden transition-transform duration-200 ${
          showLogo ? "border border-sand" : ""
        } ${href ? "group-hover:-translate-y-0.5 motion-reduce:transform-none" : ""}`}
        style={{
          height: s.box,
          borderRadius: s.radius,
          ...(showLogo ? { background: "#FFFFFF" } : null),
        }}
      >
        {showLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={attachLogo}
            src={src as string}
            alt=""
            loading="lazy"
            onError={markLogoBroken}
            className="h-full w-full object-contain p-1.5"
          />
        ) : (
          // No colour of its own: currentColor is the field's constant cream, so
          // the mark can never invert to black-on-black in dark.
          <span
            className={`font-display font-black leading-none tracking-tight ${s.mark}`}
            aria-hidden
          >
            {glyph}
          </span>
        )}
      </div>
      {showDelta && (
        <p
          className={`text-center font-mono font-semibold tabular-nums ${deltaTone} ${s.delta} ${s.gap}`}
          aria-hidden
        >
          {deltaText}
        </p>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={readable}
        // f0-focus rides the ANCHOR, not the field inside it. The field is not
        // focusable, so a ring declared on it never matches :focus-visible and
        // the browser falls back to its own blue outline — which is both
        // off-system and, on the dark field, the only blue on the screen.
        className={`f0-focus group block shrink-0 rounded-[14px] ${className}`}
        style={{ width: s.box }}
      >
        {field}
      </Link>
    );
  }

  return (
    <div
      className={`shrink-0 ${className}`}
      style={{ width: s.box }}
      role="img"
      aria-label={readable}
    >
      {field}
    </div>
  );
}

/* ── Strip ────────────────────────────────────────────────────────────────
   The dense horizontal arrangement the tile was drawn for. Not a grid: a
   momentum-scrolling track (club2-track supplies the scrollbar suppression and
   overscroll containment), so a strip of 3 and a strip of 30 are the same
   object. Below the floor it renders empty slots rather than collapsing — a
   nine-ticker club should look like a club that is filling up, not a broken
   row. */
export function TickerTileStrip({
  children,
  minSlots = 0,
  size = "md",
  loading = false,
  loadingCount = 4,
  className = "",
}: {
  children?: React.ReactNode;
  /** Pads the strip out to this many tiles with empty slots. */
  minSlots?: number;
  size?: TickerTileSize;
  loading?: boolean;
  loadingCount?: number;
  className?: string;
}) {
  if (loading) {
    return (
      <div
        className={`club2-track -m-1 flex gap-2.5 overflow-hidden p-1 ${className}`}
        aria-busy="true"
      >
        {Array.from({ length: loadingCount }).map((_, i) => (
          <TickerTile key={i} size={size} loading />
        ))}
      </div>
    );
  }

  const count = Array.isArray(children) ? children.flat().filter(Boolean).length : children ? 1 : 0;
  const pad = Math.max(0, minSlots - count);

  return (
    // `-m-1 p-1`: overflow-x-auto also clips VERTICALLY (overflow-y computes to
    // auto the moment overflow-x is not visible), so a focused tile's ring —
    // which sits 2px outside its box by design — was being sheared off on the
    // first and last tiles and along the top edge. The negative margin buys the
    // track 4px of interior room without moving anything on screen.
    <div className={`club2-track -m-1 flex gap-2.5 overflow-x-auto p-1 ${className}`}>
      {children}
      {Array.from({ length: pad }).map((_, i) => (
        <TickerTile key={`slot-${i}`} size={size} />
      ))}
    </div>
  );
}
