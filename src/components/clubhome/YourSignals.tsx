"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { TickerTile } from "@/components/canvas2";
import type { ForYouResponse } from "@/lib/clubhome/contract";

/**
 * YOUR SIGNALS — canvas v2, board 01, the "what moved on MY tickers" ledger.
 *
 * The canvas draws three rows: an identity tile, the ticker, one line of context
 * ("Kai Watch: Getting Close", "Earnings in 3 days", "24 new opinions") and a
 * right-hand affordance. Ours is the same object built from real data — the
 * per-ticker deltas `forYouCore` derives from `ticker_intel_snapshots` for the
 * tickers this member's family actually watches — with the price mark in the
 * right-hand slot, where green and red are legible because it sits on paper.
 *
 * It is a HAIRLINE LEDGER, not three bordered boxes: the canvas's own rows are
 * outlined pills, and outlined pills stacked three deep is the boxed-grid
 * pattern the register bans. Identity comes from the tile and the $CASHTAG.
 *
 * NO CATALYSTS. The canvas's middle row is "Earnings in 3 days". There is no
 * earnings or economic calendar anywhere in this app (Polygon financials report
 * what has already been filed, not what is scheduled), so that line is simply
 * not rendered rather than approximated. It is the one board-01 element with no
 * source — reported, not faked.
 *
 * COLOUR LAW: price only in the right column, on the price tokens, never a
 * dark: variant. Nothing else in the row is coloured.
 *
 * STATES: loading (shimmer rows) · empty watchlist (a stated absence with the
 * way out) · populated. All three are distinct.
 */

function fmtPrice(p?: number | null): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return p.toFixed(2);
}

export default function YourSignals({
  foryou,
  isKid = false,
  loading = false,
}: {
  foryou?: ForYouResponse | null;
  isKid?: boolean;
  loading?: boolean;
}) {
  // Sentiment display is kid-walled everywhere on this surface.
  const items = (foryou?.items ?? [])
    .filter((it) => !(isKid && it.kind === "sentiment"))
    .slice(0, 4);

  return (
    <section aria-labelledby="club-signals">
      <div className="flex items-end justify-between gap-3">
        <h2 id="club-signals" className="f0-section-rule min-w-0 flex-1">
          <span className="font-display text-eyebrow font-bold uppercase text-ink">
            {isKid ? "Your companies" : "Your signals"}
          </span>
        </h2>
        <Link
          href="/watchlist"
          className="f0-focus f0-press inline-flex shrink-0 items-center gap-1 rounded-md font-display text-[13px] font-bold text-gold-700 hover:text-gold-600"
        >
          See all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {loading && items.length === 0 ? (
        <div className="f0-ledger mt-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="f0-ledger-row motion-safe:animate-pulse"
            >
              <div className="h-11 w-11 shrink-0 rounded-[10px] bg-ink/10" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-16 rounded-full bg-ink/10" />
                <div className="h-3 w-40 max-w-full rounded-full bg-ink/[0.07]" />
              </div>
              <div className="h-3.5 w-14 shrink-0 rounded-full bg-ink/10" />
            </div>
          ))}
          <span className="sr-only">Loading your signals</span>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 border-l-2 border-sand py-1 pl-4">
          <p className="font-display text-[15px] font-extrabold text-ink">
            Nothing on your watch yet
          </p>
          <p className="mt-1 max-w-md text-[13.5px] leading-relaxed text-soft">
            {isKid
              ? "Pick a company you already know and it will show up here whenever the Club talks about it."
              : "Watch a ticker and this becomes the one place that tells you what changed on it."}
          </p>
          <Link
            href="/watchlist"
            className="f0-focus f0-press mt-3 inline-flex items-center gap-1.5 rounded-md font-display text-[14px] font-bold text-gold-700 hover:text-gold-600"
          >
            Build your watchlist <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="f0-ledger mt-2">
          {items.map((it) => {
            const hasPct =
              typeof it.changePct === "number" && Number.isFinite(it.changePct);
            const up = (it.changePct ?? 0) > 0;
            const down = (it.changePct ?? 0) < 0;
            return (
              <Link
                key={it.ticker}
                href={`/research/${encodeURIComponent(it.ticker)}`}
                className="f0-ledger-row f0-focus"
              >
                <TickerTile ticker={it.ticker} size="sm" showDelta={false} />

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[15px] font-extrabold tracking-tight text-ink">
                    ${it.ticker}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-soft">
                    {it.delta}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[15px] font-semibold tabular-nums text-ink">
                    {fmtPrice(it.price)}
                  </span>
                  <span
                    className={`mt-0.5 block font-mono text-[12px] font-semibold tabular-nums ${
                      !hasPct
                        ? "text-soft"
                        : up
                          ? "text-price-up"
                          : down
                            ? "text-price-down"
                            : "text-soft"
                    }`}
                  >
                    {hasPct
                      ? `${up ? "+" : down ? "−" : ""}${Math.abs(it.changePct as number).toFixed(2)}%`
                      : "—"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
