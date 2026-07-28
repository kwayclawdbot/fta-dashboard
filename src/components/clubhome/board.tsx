"use client";

/**
 * BOARD 01 — the shared objects the Home screens are drawn from.
 *
 * These are transcriptions of the reference board, not interpretations of it:
 * the brand identity tile, the numeric rank pip's host card, the conic score
 * dial and the signed market/attention numerals. Geometry follows the board's
 * own measures (34px tile, 74px card, 48px dial) because those measures are
 * what make the strip read as a strip at 390px.
 *
 * The chrome lives in globals.css (`.club-b-*`); this file supplies the
 * composition and the one thing CSS cannot: the per-company colour pair.
 */

/* ── Brand identity tile ──────────────────────────────────────────────────
   The board paints each ticker tile in its company's own colours — a green
   NVIDIA mark on near-black, a red Tesla mark, a neutral Apple. That is
   IDENTITY, not data: it says nothing about price or sentiment, so it does not
   touch the market ramp. Anything not in the map falls back to the achromatic
   ink ground, which is what the rest of the app's tiles already are, so an
   unknown ticker degrades into the house style rather than into a guess. */
interface BrandInk {
  bg: string;
  fg: string;
}

const BRAND: Record<string, BrandInk> = {
  NVDA: { bg: "#101408", fg: "#76B900" },
  TSLA: { bg: "#1A0E10", fg: "#E82127" },
  AMD: { bg: "#140E14", fg: "#ED1C24" },
  AAPL: { bg: "#1C1A19", fg: "#E8E4DF" },
  GOOG: { bg: "#0B1020", fg: "#4285F4" },
  GOOGL: { bg: "#0B1020", fg: "#4285F4" },
  MSFT: { bg: "#0B1216", fg: "#5AC0F0" },
  META: { bg: "#0B1220", fg: "#4B8DFF" },
  AMZN: { bg: "#140F08", fg: "#FF9900" },
  NFLX: { bg: "#150A0B", fg: "#E50914" },
  SMCI: { bg: "#0E1216", fg: "#3D8BFF" },
  PLTR: { bg: "#0E1216", fg: "#3D8BFF" },
  NKE: { bg: "#0E0E0E", fg: "#F2F2F2" },
  PLUG: { bg: "#06140F", fg: "#2BD07E" },
  RBLX: { bg: "#101014", fg: "#E9E7EE" },
  TXN: { bg: "#160B0D", fg: "#E6373F" },
  FRPH: { bg: "#0C1210", fg: "#7FD1B9" },
  SPY: { bg: "#0B1020", fg: "#8FB4FF" },
  QQQ: { bg: "#0B1020", fg: "#8FB4FF" },
  IWM: { bg: "#0B1020", fg: "#8FB4FF" },
};

const NEUTRAL: BrandInk = { bg: "#141216", fg: "#F4F0EC" };

export function brandInk(ticker?: string | null): BrandInk {
  const sym = (ticker ?? "").trim().toUpperCase();
  return BRAND[sym] ?? NEUTRAL;
}

export function BrandTile({
  ticker,
  size = 34,
  radius = 10,
  fontSize = 15,
  className = "",
}: {
  ticker?: string | null;
  size?: number;
  radius?: number;
  fontSize?: number;
  className?: string;
}) {
  const sym = (ticker ?? "").trim().toUpperCase();
  const ink = brandInk(sym);
  return (
    <span
      className={`club-b-tile shrink-0 ${className}`}
      style={
        {
          width: size,
          height: size,
          borderRadius: radius,
          fontSize,
          "--tile-bg": ink.bg,
          "--tile-fg": ink.fg,
        } as React.CSSProperties
      }
      aria-hidden
    >
      {sym.slice(0, 1) || "+"}
    </span>
  );
}

/** The empty slot: same footprint, obviously nothing in it. */
export function EmptyTile({
  size = 34,
  radius = 10,
  className = "",
}: {
  size?: number;
  radius?: number;
  className?: string;
}) {
  return (
    <span
      className={`f0-tile-empty grid shrink-0 place-items-center ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
      aria-hidden
    >
      <span className="font-display text-[13px] font-black text-soft/45">+</span>
    </span>
  );
}

/* ── Signed numerals ──────────────────────────────────────────────────────
   The board writes every delta as a caret plus a magnitude. `null` renders an
   em dash — never a fabricated 0.00%. */

/* The caret and the colour are decided on the DISPLAYED magnitude, not the raw
   one. A −0.004% move rounds to 0.00% at two decimals, and pairing a down caret
   and a red with a printed zero is a contradiction on its face. Rounded to
   nothing means flat, and flat is neutral and uncarreted. */
function rounded(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
}

export function toneFor(n: number | null | undefined): string {
  const r = rounded(n);
  if (r == null || r === 0) return "text-soft";
  return r > 0 ? "text-price-up" : "text-price-down";
}

export function signedPct(n: number | null | undefined): string {
  const r = rounded(n);
  if (r == null) return "—";
  const caret = r > 0 ? "▲" : r < 0 ? "▼" : "";
  return `${caret}${Math.abs(r).toFixed(2)}%`;
}

export function signedCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const caret = n > 0 ? "▲" : n < 0 ? "▼" : "";
  return `${caret} ${Math.abs(Math.round(n))}`.trim();
}

/* ── Score dial ───────────────────────────────────────────────────────────
   The board's 48px conic ring with a numeral and a five-character label
   inside it. A ring is a ring: it can only ever show a bounded 0–100 read, so
   the caller must hand it something that genuinely IS one.

   The geometry is the shared `.f0-dial` (globals.css) — five surfaces had each
   re-derived the same conic-plus-punched-disc by hand, so it now lives in one
   place and this supplies only the sweep, the size and what goes in the hole. */
export function Dial({
  pct,
  value,
  label,
  size = 48,
  title,
}: {
  /** 0–100 sweep. */
  pct: number;
  /** The numeral in the middle. */
  value: string;
  /** The tiny caps line under it. Five or six characters. */
  label: string;
  size?: number;
  /** Accessible description of what the ring measures. */
  title: string;
}) {
  const sweep = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <span
      className="f0-dial shrink-0"
      style={
        { "--dial-pct": sweep, "--dial-size": `${size}px` } as React.CSSProperties
      }
      role="img"
      aria-label={title}
    >
      <span>
        <span>
          <span className="block font-mono text-[13px] font-semibold leading-none text-ink tabular-nums">
            {value}
          </span>
          <span className="mt-[1px] block text-[6.5px] font-semibold tracking-[0.08em] text-soft">
            {label}
          </span>
        </span>
      </span>
    </span>
  );
}

/* ── Section mark ─────────────────────────────────────────────────────────
   The board's section label: tracked mono caps with ONE phrase carried in the
   signal orange, and an optional plain "See all" on the right. No rule, no
   box — the label and the gap under it are the whole device. */
export function BoardSection({
  label,
  mark,
  sub,
  action,
  id,
  children,
}: {
  label: string;
  /** The phrase carried in brand colour, appended to `label`. */
  mark?: string;
  sub?: string;
  action?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={id}
          className="min-w-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink"
        >
          {label}
          {mark && <span className="text-accent"> {mark}</span>}
        </h2>
        {action}
      </div>
      {sub && (
        <p className="mt-[3px] text-[10.5px] leading-snug text-soft">{sub}</p>
      )}
      {children}
    </section>
  );
}
