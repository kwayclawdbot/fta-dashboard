"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import type { ForYouResponse, TrendingResponse } from "@/lib/clubhome/contract";
import { marketStatus } from "@/lib/alerts/watch-ui";
import { BrandTile } from "./board";

/**
 * MARKET PULSE — the CCDoors horizontal quote strip.
 *
 * A row of 122px cards, one per ticker: brand chip + symbol (Sora), the live
 * price in mono, the day move in mono (price ramp), and a 24px area sparkline
 * drawn from REAL daily closes — the reference board's terminal row chart.
 *
 * DATA. The tickers are the member's own watchlist first (`forYouCore`'s items
 * already carry a live price/changePct off screener_metrics), topped up from
 * the trending ledger's quoted rows — 3–4 cards, no duplicates. A ticker with
 * no price never renders a card, and a card whose bars fetch fails renders
 * WITHOUT a sparkline (price + change only) — the curve is never faked.
 *
 * SPARKLINE. One cheap GET /api/market/bars?symbol=X&range=1m per card
 * (s-maxage=900 on the server, so repeat opens are CDN hits): the last month of
 * daily closes, normalized into the prototype's 90×24 viewBox.
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

/* ── sparkline path over real closes, 90×24 like the prototype ──────────────
   EXPORTED: the reference board draws the same little curve wherever a ticker
   row appears (pulse cards AND the watchlist movers), so YourSignals reuses
   this path + the bars hook below instead of growing its own. */
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

/** The same curve closed to the baseline — the board's soft area fill under
 *  every row chart. Same real closes, presentation only. */
export function sparkAreaPath(vals: number[], w = 90, h = 24): string | null {
  const line = sparkPath(vals, w, h);
  return line ? `${line} L${w} ${h} L0 ${h} Z` : null;
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
}

/** Member's watchlist tickers first, topped up from trending. Quoted only. */
function deriveCards(
  foryou?: ForYouResponse | null,
  trending?: TrendingResponse | null
): PulseCard[] {
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
    });
  };
  for (const it of foryou?.items ?? []) push(it.ticker, it.price, it.changePct);
  for (const r of trending?.rows ?? []) push(r.ticker, r.price, r.changePct);
  return out;
}

export default function MarketPulse({
  foryou,
  trending,
}: {
  foryou?: ForYouResponse | null;
  trending?: TrendingResponse | null;
}) {
  const cards = deriveCards(foryou, trending);
  const clock = useMarketStatus();

  // Real daily closes per ticker; a missing series = no path, never a fake one.
  const series = useBarSeries(cards.map((c) => c.ticker));

  // No quoted ticker anywhere → the strip is honestly absent.
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="market-pulse">
      {/* The board writes section labels in WHITE caps with the market clock
          right-aligned in signal green ("MARKET PULSE · Market Open"). */}
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="market-pulse"
          className="min-w-0 text-[11px] font-bold uppercase tracking-[0.16em] text-ink"
        >
          Market pulse
        </h2>
        {clock && (
          <span
            className={`shrink-0 font-mono text-[11px] font-medium leading-none ${
              clock.open ? "text-price-up" : "text-soft"
            }`}
          >
            {clock.label}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
        {cards.map((c) => {
          const closes = series[c.ticker];
          // Direction: the day move when we have one; else the month's real
          // drift (last close vs first) — never an assumed green.
          const up =
            c.changePct != null
              ? c.changePct >= 0
              : closes
                ? closes[closes.length - 1] >= closes[0]
                : true;
          const strokeVar = up ? "var(--price-up)" : "var(--price-down)";
          const path = closes ? sparkPath(closes) : null;
          const area = closes ? sparkAreaPath(closes) : null;
          return (
            <Link
              key={c.ticker}
              href={`/research/${encodeURIComponent(c.ticker)}`}
              className="f0-focus f0-press w-[122px] flex-none rounded-[14px] border border-sand bg-card p-3.5 text-left"
            >
              <span className="flex items-center gap-2">
                <BrandTile ticker={c.ticker} size={26} radius={8} fontSize={11} />
                <span className="truncate font-display text-[12.5px] font-bold leading-none text-ink">
                  {c.ticker}
                </span>
              </span>
              <span className="mt-2.5 block font-mono text-[16px] font-semibold leading-none text-ink tabular-nums">
                ${c.price.toFixed(2)}
              </span>
              {c.changePct != null && (
                <span
                  className={`mt-[7px] block font-mono text-[12px] font-semibold leading-none tabular-nums ${
                    up ? "text-price-up" : "text-price-down"
                  }`}
                >
                  {c.changePct > 0 ? "+" : ""}
                  {c.changePct.toFixed(2)}%
                </span>
              )}
              {path && (
                <span className="mt-2.5 block h-[24px]" aria-hidden>
                  <svg
                    viewBox="0 0 90 24"
                    preserveAspectRatio="none"
                    className="h-full w-full"
                  >
                    {/* the board's soft area wash under every row curve */}
                    {area && (
                      <path d={area} fill={strokeVar} opacity={0.14} stroke="none" />
                    )}
                    <path
                      d={path}
                      fill="none"
                      stroke={strokeVar}
                      strokeWidth={1.6}
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
