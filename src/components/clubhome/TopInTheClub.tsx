"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { TickerTile, TickerTileStrip } from "@/components/canvas2";
import type { TrendingResponse } from "@/lib/clubhome/contract";

/**
 * TOP IN THE CLUB — canvas v2, board 01, the first content object on Home.
 *
 * The canvas replaces the big swipeable ticker panel with a DENSE RANKED STRIP:
 * five small tiles, each carrying a rank pip, an identity mark, the ticker, its
 * conviction number and its price delta. That change is the point of the board —
 * one screen now shows five tickers where the panel showed one and a half, and
 * the swipe stops being load-bearing.
 *
 * Built on the L0 primitive (`TickerTile` / `TickerTileStrip`), which was drawn
 * for exactly this row. The tile is only the identity mark here (`showDelta`
 * off): the column beneath it is composed by this file so the reading order
 * matches the canvas — ticker, then price, then conviction — rather than the
 * primitive's own default of price-immediately-under-the-mark.
 *
 * COLOUR LAW:
 *   · the tile field is achromatic (the primitive's own rule)
 *   · the delta is text-price-up / text-price-down, never a dark: variant
 *   · the ONLY brand colour in the strip is the #1 pip and the #1 ring, which
 *     mark rank — an editorial emphasis, not a price and not a sentiment
 *   · conviction is a club-attention score, so it stays on the ink ramp; it is
 *     deliberately NOT lime, because lime means a bull/bear split and this is
 *     not one.
 *
 * HONESTY, three ways:
 *   1. `heat` (the normalised club score) is null for every ticker below
 *      FLOORS.trendingScore, which at production size is all of them. Rather
 *      than print a dash under every tile, the conviction line is dropped for
 *      the WHOLE strip and the subline says why. A column of em-dashes reads as
 *      breakage; a stated absence reads as a young club.
 *   2. A missing quote renders "—", never 0.00%.
 *   3. Below the floor the strip pads out to five DESIGNED EMPTY SLOTS
 *      (`minSlots`) instead of collapsing, so nine tickers look like a board
 *      filling up rather than a broken row.
 *
 * LOADING ≠ EMPTY: `loading` renders the primitive's pulsing tiles; zero rows
 * after loading renders the founding line. The two can never be confused.
 */

const LEAD = 5;

export default function TopInTheClub({
  trending,
  loading = false,
  isKid = false,
}: {
  trending?: TrendingResponse | null;
  loading?: boolean;
  isKid?: boolean;
}) {
  const all = trending?.rows ?? [];
  const rows = all.slice(0, 10);
  const total = trending?.totalCount ?? all.length;

  // Conviction is all-or-nothing for the strip — see the header.
  const showConviction = rows.some((r) => r.heat != null);

  const trackRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [rows.length, loading]);

  return (
    <section aria-labelledby="club-top">
      <div className="flex items-end justify-between gap-3">
        <h2 id="club-top" className="f0-section-rule min-w-0 flex-1">
          <span className="font-display text-eyebrow font-bold uppercase text-ink">
            Top in{" "}
            {/* The canvas marks ONE phrase per heading in brand colour. gold-700
                is the THEMED orange (in club mode the gold ramp IS volt and it
                lifts at night); volt-700 is frozen and would go dim. */}
            <span className="text-gold-700">the club</span>
          </span>
        </h2>
        {total > rows.length && (
          <Link
            href="/discover"
            className="f0-focus f0-press inline-flex shrink-0 items-center gap-1 rounded-md font-display text-[13px] font-bold text-gold-700 hover:text-gold-600"
          >
            See all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>

      <p className="mt-1.5 text-[12.5px] leading-snug text-soft">
        {showConviction
          ? "Live ranking by member attention and conviction."
          : "Live ranking by member attention. Conviction scores unlock as the Club grows."}
      </p>

      <div className="relative mt-3">
        {loading ? (
          <TickerTileStrip loading loadingCount={5} size="md" />
        ) : (
          <div
            ref={trackRef}
            className="club2-track -m-1 flex gap-2.5 overflow-x-auto p-1"
            role="group"
            aria-label="Tickers ranked by Club attention"
          >
            {rows.map((r, i) => {
              const hasDelta =
                typeof r.changePct === "number" && Number.isFinite(r.changePct);
              const up = (r.changePct ?? 0) > 0;
              const down = (r.changePct ?? 0) < 0;
              return (
                <div key={r.ticker} className="relative shrink-0" style={{ width: 58 }}>
                  <span
                    className={`f0-rank pointer-events-none absolute -left-1 -top-1 z-10 ${
                      i === 0 ? "f0-rank-lead" : ""
                    }`}
                    aria-hidden
                  >
                    {r.rank}
                  </span>

                  <TickerTile
                    ticker={r.ticker}
                    size="md"
                    showDelta={false}
                    href={`/research/${encodeURIComponent(r.ticker)}`}
                    className={i === 0 ? "f0-tile-lead" : ""}
                  />

                  <p className="mt-1.5 text-center font-mono text-[10.5px] font-semibold text-ink">
                    {r.ticker}
                  </p>
                  <p
                    className={`text-center font-mono text-[9.5px] font-semibold tabular-nums ${
                      !hasDelta
                        ? "text-soft"
                        : up
                          ? "text-price-up"
                          : down
                            ? "text-price-down"
                            : "text-soft"
                    }`}
                  >
                    {hasDelta
                      ? `${up ? "+" : down ? "−" : ""}${Math.abs(r.changePct as number).toFixed(2)}%`
                      : "—"}
                  </p>
                  {showConviction && (
                    <p className="mt-0.5 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-soft tabular-nums">
                      {r.heat != null ? r.heat : "—"}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Founding pad — designed slots, never a collapsed row. */}
            {rows.length < LEAD &&
              Array.from({ length: LEAD - rows.length }).map((_, i) => (
                <div key={`slot-${i}`} className="shrink-0" style={{ width: 58 }}>
                  <TickerTile size="md" showDelta={false} />
                  <p className="mt-1.5 text-center font-mono text-[10.5px] font-semibold text-soft/45">
                    —
                  </p>
                </div>
              ))}
          </div>
        )}

        {!loading && rows.length > LEAD && (
          <div
            aria-hidden
            className={`f0-strip-fade ${atEnd ? "opacity-0" : "opacity-100"}`}
          />
        )}
      </div>

      {!loading && rows.length === 0 && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-soft">
          {isKid
            ? "No company has caught the Club's eye yet. Pick one you know and it lands here first."
            : "No ticker has drawn the Club's attention yet. Rate one and yours is the first on this board."}
        </p>
      )}
    </section>
  );
}
