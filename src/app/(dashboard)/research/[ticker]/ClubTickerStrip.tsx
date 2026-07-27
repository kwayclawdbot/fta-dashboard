"use client";

import { useEffect, useState } from "react";

import { TickerTile, TickerTileStrip } from "@/components/canvas2";
import type { TrendingResponse } from "@/lib/clubhome/contract";

/**
 * ELSEWHERE IN THE CLUB — the dense lateral strip at the foot of the ticker
 * page, and this lane's adoption of the canvas `TickerTile` primitive (plan
 * §1.3: the tile beats logo+row wherever the job is density rather than detail).
 *
 * WHY A STRIP AND NOT A LEDGER: the ledger form is already spent twice on this
 * page (the board, the discussion). What is missing at the bottom of a ticker
 * page is the cheapest possible way to leave it — nine identity marks and nine
 * deltas, scannable in one pass, no rows to read. That is exactly the object the
 * tile was drawn for.
 *
 * DATA IS REAL AND SERVER-CAPPED. /api/club/trending is the community-ATTENTION
 * ledger off `ticker_intel_snapshots` — the same object Home and Discover read,
 * with the free-tier row cap applied server-side. The delta on each tile is the
 * ROW'S OWN QUOTE, so it is price, and it is absent (rendered "—" by the tile)
 * rather than invented when the market feed didn't answer. The endpoint's
 * compliance line is rendered VERBATIM from the response body, which is the only
 * way to guarantee it stays byte-identical to TRENDING_DISCLAIMER.
 *
 * LOADING ≠ EMPTY: in flight the strip pulses filled tiles; resolved-and-short
 * pads with the tile's designed empty slots. A founding club with four names on
 * the board should look like a board that is filling up, never like a bug.
 */

const MAX_TILES = 9;
/** Pads the strip so a four-name board still reads as a row, not a fragment. */
const MIN_SLOTS = 6;

export default function ClubTickerStrip({ ticker }: { ticker: string }) {
  const [data, setData] = useState<TrendingResponse | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let on = true;
    fetch("/api/club/trending")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TrendingResponse | null) => {
        if (!on) return;
        setData(d);
        setResolved(true);
      })
      .catch(() => {
        if (on) setResolved(true);
      });
    return () => {
      on = false;
    };
  }, []);

  // The member is already on this ticker — it is the one name the strip must
  // not offer as a way out.
  const rows = (data?.rows ?? [])
    .filter((r) => (r.ticker || "").toUpperCase() !== ticker.toUpperCase())
    .slice(0, MAX_TILES);

  // The read came back with nothing at all AND no disclaimer to hang it on:
  // the attention board isn't live for this member. Say nothing.
  if (resolved && rows.length === 0 && !data?.disclaimer) return null;

  return (
    <section aria-labelledby="club-elsewhere" className="mt-12">
      <h2 id="club-elsewhere" className="f0-section-rule">
        <span className="font-display text-eyebrow font-bold uppercase text-ink">
          Elsewhere in the club
        </span>
      </h2>

      <div className="mt-4">
        {!resolved ? (
          <TickerTileStrip loading loadingCount={6} />
        ) : (
          <TickerTileStrip minSlots={MIN_SLOTS}>
            {rows.map((r) => (
              <TickerTile
                key={r.ticker}
                ticker={r.ticker}
                changePct={r.changePct ?? null}
                href={`/research/${encodeURIComponent(r.ticker)}`}
              />
            ))}
          </TickerTileStrip>
        )}
      </div>

      {resolved && rows.length === 0 && (
        <p className="mt-3 text-[13px] leading-relaxed text-soft">
          No other name has drawn the club&apos;s attention this week yet.
        </p>
      )}

      {data?.disclaimer && (
        <p className="mt-4 text-[11px] leading-relaxed text-soft">{data.disclaimer}</p>
      )}
    </section>
  );
}
