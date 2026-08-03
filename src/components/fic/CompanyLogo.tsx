"use client";

import { useEffect, useState } from "react";

/**
 * Real company logo via our /api/market/logo proxy (Polygon company-branding —
 * the legal real-logo source; the key is appended server-side, never exposed).
 * Falls back to a warm gold monogram chip if the company has no branding image
 * or the fetch fails — so a card never shows a broken image box.
 *
 * ── WHY THIS ASKS BEFORE IT RENDERS AN <img> ─────────────────────────────────
 * Much of the market has no branding image at Polygon (a fund is not a company;
 * plenty of small caps never filed one), so the proxy correctly answers 404.
 * Pointing an <img> straight at that works — `onError` swaps in the monogram —
 * but the browser logs a failed resource for every miss, and the screener paints
 * a hundred rows at a time. The console filled with red on a surface where
 * nothing was actually wrong.
 *
 * So the URL is checked with `fetch`, which reports a 404 as a VALUE rather than
 * an error. On a hit the same URL goes into the <img> and is served from the
 * HTTP cache (the route sets a long, immutable Cache-Control), so the check
 * costs no extra bytes. On a miss the monogram renders. Either answer is
 * remembered for the session, so one symbol is asked about once however many
 * rows it appears in — and simultaneous rows share a single in-flight request.
 */

/** SYMBOL → does branding exist? Survives remounts within the session. */
const KNOWN = new Map<string, boolean>();
/** In-flight checks, so N rows for one symbol make ONE request. */
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

export default function CompanyLogo({
  symbol,
  name,
  size = 44,
  rounded = "rounded-xl",
  className = "",
}: {
  symbol: string;
  name?: string | null;
  size?: number;
  rounded?: string;
  className?: string;
}) {
  // The answer is stored WITH the symbol it belongs to, so a row that swaps
  // ticker never renders the previous company's verdict for a frame — and the
  // effect only ever sets state from a callback, never synchronously.
  const [answer, setAnswer] = useState<{ sym: string; has: boolean | null }>(
    () => ({
      sym: symbol,
      has: symbol ? KNOWN.get(symbol.toUpperCase()) ?? null : false,
    })
  );

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    void logoExists(symbol).then((ok) => {
      if (!cancelled) setAnswer({ sym: symbol, has: ok });
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // `null` = not asked yet. The monogram holds the space meanwhile, so the row
  // never reflows and never flashes a broken image.
  const hasLogo =
    answer.sym === symbol
      ? answer.has
      : symbol
        ? KNOWN.get(symbol.toUpperCase()) ?? null
        : false;

  const dim = { width: size, height: size };
  const label = (name || symbol || "?").trim();
  const mono = label
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (hasLogo !== true) {
    return (
      <div
        style={dim}
        className={`flex shrink-0 items-center justify-center ${rounded} bg-chip-amber font-display text-sm font-bold text-gold-700 ${className}`}
        aria-label={label}
      >
        {mono || "?"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/market/logo?symbol=${encodeURIComponent(symbol)}`}
      alt={`${label} logo`}
      loading="lazy"
      style={dim}
      onError={() => {
        KNOWN.set(symbol.toUpperCase(), false);
        setAnswer({ sym: symbol, has: false });
      }}
      className={`shrink-0 ${rounded} bg-white object-contain p-1 ring-1 ring-sand ${className}`}
    />
  );
}
