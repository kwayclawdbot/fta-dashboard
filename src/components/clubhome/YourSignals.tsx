"use client";

import Link from "next/link";
import { ArrowRight, MoreHorizontal } from "lucide-react";

import type { ForYouResponse } from "@/lib/clubhome/contract";
import { BrandTile, toneFor } from "./board";
import { sparkPath, useBarSeries } from "./MarketPulse";

/** The board writes moves as "+6.41%" / "-0.65%" — signed, two decimals, no
 *  caret glyph. */
function boardPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/**
 * MY WATCHLIST MOVERS — the mockup board's watchlist section, verbatim.
 *
 * The reference home (board 10_07_23, top-left phone) draws:
 *
 *   HEADER — "MY WATCHLIST MOVERS" in white bold caps with a "···" overflow
 *   mark right-aligned (the door to the full watchlist).
 *
 *   ROWS — one quiet rounded row per ticker, stacked with a small gap (not a
 *   single divided card): brand logo + ticker in bold, a mid-row sparkline
 *   drawn as a LINE ONLY (no area wash), and the live day move in the price
 *   ramp on the right. The row carries NOTHING else — no sub-line.
 *
 * CURVE COLOUR. On the board the AMZN row pairs a red day move with a green
 * curve: the curve is the month's real drift (last close vs first), decided
 * independently of the day move. Same rule here — /api/market/bars closes via
 * the shared useBarSeries; a ticker whose series never lands draws no curve.
 *
 * DATA. The rows are `forYouCore`'s items — the tickers this member's family
 * actually watches, with the live changePct off screener_metrics. Where a
 * quote is missing the row falls back to an arrow rather than a fabricated
 * 0.00%.
 *
 * STATES: loading (pulsing rows) · empty watchlist (a stated absence with the
 * way out) · populated. All three are distinct.
 */
export default function YourSignals({
  foryou,
  isKid = false,
  loading = false,
}: {
  foryou?: ForYouResponse | null;
  isKid?: boolean;
  loading?: boolean;
}) {
  const items = (foryou?.items ?? []).slice(0, 4);

  // Real daily closes for the row sparklines — same fetch path as the rest of
  // the app (CDN-cached per symbol). A ticker whose series never lands simply
  // draws no curve.
  const series = useBarSeries(items.map((it) => it.ticker));

  return (
    <section aria-labelledby="club-signals">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="club-signals"
          className="min-w-0 text-[13px] font-bold uppercase tracking-[0.06em] text-ink"
        >
          {isKid ? "Your companies" : "My watchlist movers"}
        </h2>
        {/* the board's "···" overflow mark — the door to the full watchlist */}
        <Link
          href="/watchlist"
          aria-label="See your full watchlist"
          className="f0-focus f0-press shrink-0 rounded-md text-soft transition-colors hover:text-ink"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {loading && items.length === 0 ? (
        <div className="mt-3 space-y-[7px]" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-[12px] bg-card px-3 py-[11px] motion-safe:animate-pulse"
            >
              <div className="h-[30px] w-[30px] shrink-0 rounded-[9px] bg-ink/10" />
              <div className="h-2.5 w-14 rounded-full bg-ink/10" />
              <div className="h-2.5 flex-1 rounded-full bg-ink/[0.07]" />
              <div className="h-2.5 w-10 shrink-0 rounded-full bg-ink/10" />
            </div>
          ))}
          <span className="sr-only">Loading your watchlist movers</span>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 rounded-[12px] bg-card px-4 py-4">
          <p className="text-[13px] font-bold text-ink">
            Nothing on your watch yet
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-soft">
            {isKid
              ? "Pick a company you already know and it will show up here whenever the Club talks about it."
              : "Watch a ticker and this becomes the one place that tells you what changed on it."}
          </p>
          <Link
            href="/watchlist"
            className="f0-focus f0-press mt-2.5 inline-flex items-center gap-1 rounded-md text-[12px] font-semibold text-accent"
          >
            Build your watchlist
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-[7px]">
          {items.map((it) => {
            const hasPct =
              typeof it.changePct === "number" && Number.isFinite(it.changePct);
            const closes = series[it.ticker];
            // Curve colour: the MONTH's real drift, independent of the day
            // move (the board pairs a red day % with a green month curve).
            const drift = closes
              ? closes[closes.length - 1] >= closes[0]
              : true;
            const strokeVar = drift ? "var(--price-up)" : "var(--price-down)";
            const path = closes ? sparkPath(closes) : null;
            return (
              <Link
                key={it.ticker}
                href={`/research/${encodeURIComponent(it.ticker)}`}
                className="f0-focus f0-press flex items-center gap-3 rounded-[12px] bg-card px-3 py-[11px] transition-colors hover:bg-accent/5"
              >
                <BrandTile ticker={it.ticker} size={30} radius={9} fontSize={12} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold leading-none text-ink">
                  {it.ticker}
                </span>
                {/* the board's mid-row curve — a line only, real closes only */}
                {path && (
                  <span className="block h-[22px] w-[76px] shrink-0" aria-hidden>
                    <svg
                      viewBox="0 0 90 24"
                      preserveAspectRatio="none"
                      className="h-full w-full"
                    >
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
                {hasPct ? (
                  <span
                    className={`w-[58px] shrink-0 text-right font-mono text-[12.5px] font-semibold tabular-nums ${toneFor(
                      it.changePct
                    )}`}
                  >
                    {boardPct(it.changePct as number)}
                  </span>
                ) : (
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0 text-soft"
                    aria-hidden
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
