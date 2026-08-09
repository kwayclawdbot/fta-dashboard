"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import type { ForYouResponse, TrendingResponse } from "@/lib/clubhome/contract";
import { marketStatus } from "@/lib/alerts/watch-ui";
import { BrandTile } from "./board";

/**
 * MARKET PULSE — the mockup board's horizontal quote-card strip, verbatim.
 *
 * The reference home (board 10_07_23, top-left phone) draws:
 *
 *   HEADER — "MARKET PULSE" in white bold caps, "Market Open" right-aligned in
 *   signal green (plain text, no chip).
 *
 *   CARDS — a horizontal row of quote cards (three fit, the strip scrolls):
 *   brand logo + ticker on the top line, the price large and bold, the day
 *   move in the price ramp, and a bottom sentiment band — "81% Bullish" in
 *   green on a soft green ground. NO sparkline on these cards (the board draws
 *   its row curves in the watchlist section, not here).
 *
 * DATA. The tickers are the member's own watchlist first (`forYouCore`'s items
 * already carry a live price/changePct off screener_metrics), topped up from
 * the trending ledger's quoted rows — 3–4 cards, no duplicates. A ticker with
 * no price never renders a card.
 *
 * SENTIMENT BAND. The board's "NN% Bullish" maps to the REAL community stance
 * split the trending ledger already carries (`sentiment.bullPct`, bull ÷
 * positioned). A ticker with no positioned members — or one that never appears
 * in the ledger — renders WITHOUT the band; the number is never faked. Kid
 * register never sees sentiment, so the band is walled behind `isKid`.
 *
 * MARKET CLOCK. The "Market open / Pre-market / After hours" stamp is the real
 * America/New_York session clock (src/lib/alerts/watch-ui.ts marketStatus),
 * read through a minute-ticking external store so nothing impure runs during
 * render and SSR/first-client-render agree (null → no stamp on that frame).
 */

/* ── minute-bucketed market clock store (same shape as ./clock.ts) ────────── */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let primed = false;
let status: { open: boolean; label: string } = { open: false, label: "" };

function recompute(): void {
  const next = marketStatus();
  if (next.label !== status.label || next.open !== status.open) {
    status = next;
    listeners.forEach((l) => l());
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!timer) {
    status = marketStatus();
    primed = true;
    timer = setInterval(recompute, 60_000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => (primed ? status : null);
const getServerSnapshot = () => null;

function useMarketStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ── sparkline path over real closes, 90×24 like the board ──────────────────
   EXPORTED for the watchlist movers (the one section the board draws row
   curves in). The pulse cards themselves no longer draw one — the reference
   board's quote cards carry price + move + sentiment, no chart. */
export function sparkPath(vals: number[], w = 90, h = 24): string | null {
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = w / (vals.length - 1);
  return vals
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (h - 2 - ((v - min) / span) * (h - 4)).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}

/**
 * Real daily closes per ticker, one cheap GET /api/market/bars per symbol
 * (s-maxage=900 server-side). A missing/failed series simply never lands in
 * the map — callers omit the curve, never fake one.
 */
export function useBarSeries(symbols: string[]): Record<string, number[]> {
  const [series, setSeries] = useState<Record<string, number[]>>({});
  const key = symbols.join(",");
  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    let mounted = true;
    for (const sym of key.split(",")) {
      void (async () => {
        try {
          const res = await fetch(
            `/api/market/bars?symbol=${encodeURIComponent(sym)}&range=1m`,
            { signal: ctrl.signal, headers: { accept: "application/json" } }
          );
          if (!res.ok) return;
          const json = (await res.json()) as { bars?: { t: number; c: number }[] };
          const closes = (json.bars ?? [])
            .map((b) => b.c)
            .filter((c) => Number.isFinite(c));
          if (mounted && closes.length >= 2) {
            setSeries((prev) => ({ ...prev, [sym]: closes }));
          }
        } catch {
          /* no series → no sparkline, the row still ships */
        }
      })();
    }
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [key]);
  return series;
}

interface PulseCard {
  ticker: string;
  price: number;
  changePct: number | null;
  /** Real community stance (bull ÷ positioned, 0–100) from the trending
   *  ledger. null = nobody positioned / not in the ledger → no band. */
  bullPct: number | null;
}

/** Member's watchlist tickers first, topped up from trending. Quoted only.
 *  The sentiment band joins from the trending ledger by ticker. */
function deriveCards(
  foryou?: ForYouResponse | null,
  trending?: TrendingResponse | null
): PulseCard[] {
  const bullByTicker = new Map<string, number>();
  for (const r of trending?.rows ?? []) {
    const sym = (r.ticker ?? "").toUpperCase();
    const pct = r.sentiment?.bullPct;
    if (sym && typeof pct === "number" && Number.isFinite(pct)) {
      bullByTicker.set(sym, pct);
    }
  }

  const out: PulseCard[] = [];
  const seen = new Set<string>();
  const push = (ticker?: string | null, price?: number | null, changePct?: number | null) => {
    const sym = (ticker ?? "").toUpperCase();
    if (!sym || seen.has(sym) || out.length >= 4) return;
    if (typeof price !== "number" || !Number.isFinite(price)) return;
    seen.add(sym);
    out.push({
      ticker: sym,
      price,
      changePct:
        typeof changePct === "number" && Number.isFinite(changePct) ? changePct : null,
      bullPct: bullByTicker.get(sym) ?? null,
    });
  };
  for (const it of foryou?.items ?? []) push(it.ticker, it.price, it.changePct);
  for (const r of trending?.rows ?? []) push(r.ticker, r.price, r.changePct);
  return out;
}

export default function MarketPulse({
  foryou,
  trending,
  isKid = false,
}: {
  foryou?: ForYouResponse | null;
  trending?: TrendingResponse | null;
  /** Kid register never sees sentiment — the bullish band is walled. */
  isKid?: boolean;
}) {
  const cards = deriveCards(foryou, trending);
  const clock = useMarketStatus();

  // No quoted ticker anywhere → the strip is honestly absent.
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="market-pulse">
      {/* the board writes the label in WHITE bold caps with the market clock
          right-aligned in signal green ("MARKET PULSE ··· Market Open") */}
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="market-pulse"
          className="min-w-0 text-[13px] font-bold uppercase tracking-[0.06em] text-ink"
        >
          Market pulse
        </h2>
        {clock && (
          <span
            className={`shrink-0 text-[12px] font-semibold leading-none ${
              clock.open ? "text-price-up" : "text-soft"
            }`}
          >
            {clock.label}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
        {cards.map((c) => {
          const up = c.changePct == null || c.changePct >= 0;
          const showBand = !isKid && c.bullPct != null;
          return (
            <Link
              key={c.ticker}
              href={`/research/${encodeURIComponent(c.ticker)}`}
              className="f0-focus f0-press w-[118px] flex-none overflow-hidden rounded-[14px] border border-sand bg-card text-left"
            >
              <span className="block px-3 pt-3" style={{ paddingBottom: showBand ? 10 : 12 }}>
                <span className="flex items-center gap-2">
                  <BrandTile ticker={c.ticker} size={28} radius={8} fontSize={11} />
                  <span className="truncate font-display text-[13.5px] font-bold leading-none text-ink">
                    {c.ticker}
                  </span>
                </span>
                <span className="mt-2.5 block font-display text-[17px] font-extrabold leading-none text-ink tabular-nums">
                  ${c.price.toFixed(2)}
                </span>
                {c.changePct != null && (
                  <span
                    className={`mt-[7px] block text-[12.5px] font-semibold leading-none tabular-nums ${
                      up ? "text-price-up" : "text-price-down"
                    }`}
                  >
                    {c.changePct > 0 ? "+" : ""}
                    {c.changePct.toFixed(2)}%
                  </span>
                )}
              </span>
              {/* the board's bottom sentiment band — real positioned members
                  only; absent band = nobody has positioned on this ticker */}
              {showBand && (
                <span
                  className="block px-3 py-[7px] text-[11.5px] font-semibold leading-none text-price-up"
                  style={{
                    background:
                      "color-mix(in srgb, var(--price-up) 10%, transparent)",
                  }}
                >
                  {Math.round(c.bullPct!)}% Bullish
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
