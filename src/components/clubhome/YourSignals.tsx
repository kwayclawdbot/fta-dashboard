"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { ForYouResponse } from "@/lib/clubhome/contract";
import { BoardSection, BrandTile, signedPct, toneFor } from "./board";

/**
 * YOUR SIGNALS — board 01's third object, built as drawn.
 *
 * The board draws WHITE ROUNDED CARDS stacked with a 7px gap. Each row is: a
 * 26px brand tile, the ticker in mono, a human line ("Kai Watch: Getting
 * Close", "24 new opinions"), and a small trailing affordance. An earlier pass
 * rendered this as a hairline ledger with a two-line price block on the right;
 * this is the card row.
 *
 * THE TRAILING SLOT. The board draws three different affordances (a plus, a
 * count badge, an arrow), each standing for an action we do not have a
 * per-signal source for. What we DO have on every row is the ticker's live
 * percentage move, which is real, is the right size for that slot, and is the
 * thing a member actually wants there. It renders on the price ramp; where a
 * quote is missing the row falls back to the board's arrow rather than a
 * fabricated 0.00%.
 *
 * The lines themselves are `forYouCore`'s per-ticker deltas, derived from
 * `ticker_intel_snapshots` for the tickers this member's family actually
 * watches. Nothing here is composed by the UI.
 *
 * NO CATALYST ROW. The board's middle line is "Earnings in 3 days". There is no
 * earnings or economic calendar anywhere in this app (Polygon financials report
 * what has been FILED, not what is scheduled), so that line is absent rather
 * than approximated.
 *
 * STATES: loading (pulsing cards) · empty watchlist (a stated absence with the
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
  // Sentiment display is kid-walled everywhere on this surface.
  const items = (foryou?.items ?? [])
    .filter((it) => !(isKid && it.kind === "sentiment"))
    .slice(0, 4);

  return (
    <BoardSection
      id="club-signals"
      label={isKid ? "Your companies" : "Your signals"}
      action={
        <Link
          href="/watchlist"
          className="f0-focus f0-press shrink-0 rounded-md text-[11px] font-semibold text-accent"
        >
          See all
        </Link>
      }
    >
      {loading && items.length === 0 ? (
        <div className="mt-2.5 flex flex-col gap-[7px]" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="club-b-card flex items-center gap-2.5 px-3 py-[10px] motion-safe:animate-pulse"
            >
              <div className="h-[26px] w-[26px] shrink-0 rounded-[8px] bg-ink/10" />
              <div className="h-2.5 w-10 shrink-0 rounded-full bg-ink/10" />
              <div className="h-2.5 flex-1 rounded-full bg-ink/[0.07]" />
              <div className="h-2.5 w-9 shrink-0 rounded-full bg-ink/10" />
            </div>
          ))}
          <span className="sr-only">Loading your signals</span>
        </div>
      ) : items.length === 0 ? (
        <div className="club-b-card mt-2.5 px-3.5 py-3.5">
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
        <div className="mt-2.5 flex flex-col gap-[7px]">
          {items.map((it) => {
            const hasPct =
              typeof it.changePct === "number" && Number.isFinite(it.changePct);
            return (
              <Link
                key={it.ticker}
                href={`/research/${encodeURIComponent(it.ticker)}`}
                className="club-b-card f0-focus f0-press flex items-center gap-2.5 px-3 py-[10px]"
              >
                <BrandTile
                  ticker={it.ticker}
                  size={26}
                  radius={8}
                  fontSize={11}
                />
                <span className="shrink-0 font-mono text-[11px] font-semibold text-ink">
                  {it.ticker}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-soft">
                  {it.delta}
                </span>
                {hasPct ? (
                  <span
                    className={`shrink-0 font-mono text-[10.5px] font-semibold tabular-nums ${toneFor(
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
    </BoardSection>
  );
}
