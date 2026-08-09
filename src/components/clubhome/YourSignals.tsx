"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { ForYouResponse } from "@/lib/clubhome/contract";
import { BrandTile, signedPct, toneFor } from "./board";
import { sparkPath, sparkAreaPath, useBarSeries } from "./MarketPulse";

/**
 * MY WATCHLIST MOVERS — the CCDoors watchlist section.
 *
 * One contained card (16px radius, sand hairline, card ground) listing the
 * member's own tickers as divided rows: 34px brand tile, ticker plus the human
 * "what changed" line stacked, a small green/red sparkline mid-row (the
 * reference board draws a real curve in EVERY watchlist row — same
 * /api/market/bars closes MarketPulse uses, omitted when no series lands),
 * and the live percentage move in mono on the right. Where a quote is missing
 * the row falls back to an arrow rather than a fabricated 0.00%.
 *
 * The lines themselves are `forYouCore`'s per-ticker deltas, derived from
 * `ticker_intel_snapshots` for the tickers this member's family actually
 * watches. Nothing here is composed by the UI.
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
  /* Sentiment display is kid-walled everywhere on this surface.
   *
   * FEWER ROWS BEATS REPEATED ROWS. `forYouCore` now hands each ticker the
   * strongest reason no earlier row already used, so identical lines only
   * survive when the data genuinely has one thing to say about several tickers
   * at once. When that happens this drops the repeats rather than printing the
   * same sentence four times under four different tickers — which is what this
   * section used to do, and it read as broken rather than as quiet. */
  const seen = new Set<string>();
  const items = (foryou?.items ?? [])
    .filter((it) => !(isKid && it.kind === "sentiment"))
    .filter((it) => {
      const line = (it.delta || "").trim();
      if (!line) return true;
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .slice(0, 4);

  // Real daily closes for the row sparklines — same fetch path as MarketPulse
  // (CDN-cached per symbol). A ticker whose series never lands simply draws
  // no curve.
  const series = useBarSeries(items.map((it) => it.ticker));

  return (
    <section aria-labelledby="club-signals">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="club-signals"
          className="min-w-0 text-[11px] font-bold uppercase tracking-[0.16em] text-ink"
        >
          {isKid ? "Your companies" : "My watchlist movers"}
        </h2>
        <Link
          href="/watchlist"
          className="f0-focus f0-press shrink-0 rounded-md text-[12px] font-semibold text-accent"
        >
          See all
        </Link>
      </div>

      {loading && items.length === 0 ? (
        <div
          className="mt-3 overflow-hidden rounded-[16px] border border-sand bg-card"
          aria-busy="true"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-sand px-4 py-3.5 last:border-b-0 motion-safe:animate-pulse"
            >
              <div className="h-[34px] w-[34px] shrink-0 rounded-[11px] bg-ink/10" />
              <div className="min-w-0 flex-1">
                <div className="h-2.5 w-14 rounded-full bg-ink/10" />
                <div className="mt-1.5 h-2 w-32 rounded-full bg-ink/[0.07]" />
              </div>
              <div className="h-2.5 w-10 shrink-0 rounded-full bg-ink/10" />
            </div>
          ))}
          <span className="sr-only">Loading your watchlist movers</span>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 rounded-[16px] border border-sand bg-card px-4 py-4">
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
        <div className="mt-3 overflow-hidden rounded-[16px] border border-sand bg-card">
          {items.map((it) => {
            const hasPct =
              typeof it.changePct === "number" && Number.isFinite(it.changePct);
            const closes = series[it.ticker];
            // Curve colour: the day move decides; with no quote, the month's
            // real drift — never an assumed green.
            const up = hasPct
              ? (it.changePct as number) >= 0
              : closes
                ? closes[closes.length - 1] >= closes[0]
                : true;
            const strokeVar = up ? "var(--price-up)" : "var(--price-down)";
            const path = closes ? sparkPath(closes) : null;
            const area = closes ? sparkAreaPath(closes) : null;
            return (
              <Link
                key={it.ticker}
                href={`/research/${encodeURIComponent(it.ticker)}`}
                className="f0-focus f0-press flex items-center gap-3 border-b border-sand px-4 py-3.5 transition-colors last:border-b-0 hover:bg-accent/5"
              >
                <BrandTile
                  ticker={it.ticker}
                  size={34}
                  radius={11}
                  fontSize={13}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold leading-tight text-ink">
                    {it.ticker}
                  </span>
                  <span className="mt-[3px] block truncate text-[11.5px] leading-snug text-soft">
                    {it.delta}
                  </span>
                </span>
                {/* the board's mid-row curve — real closes only */}
                {path && (
                  <span className="block h-[22px] w-[56px] shrink-0" aria-hidden>
                    <svg
                      viewBox="0 0 90 24"
                      preserveAspectRatio="none"
                      className="h-full w-full"
                    >
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
                {hasPct ? (
                  <span
                    className={`shrink-0 font-mono text-[12.5px] font-semibold tabular-nums ${toneFor(
                      it.changePct
                    )}`}
                  >
                    {signedPct(it.changePct)}
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
