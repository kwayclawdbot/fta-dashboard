"use client";

import Link from "next/link";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { Spark } from "@/components/clubhome/parts";
import type { TrendingRow } from "@/lib/clubhome/contract";

/**
 * CLUB CARD — the "Score Led" carousel object (owner pick, round ten).
 *
 * Composition law: the CLUB SCORE dial is the dominant element; logo, ticker,
 * price and sparkline support it on the left. This is deliberately NOT a generic
 * container — it is a charcoal field with one oversized object in it, which is
 * what keeps a carousel of data panels from reading as a boxed grid.
 *
 * COLOUR: the dial ring is CREAM, not lime. The chosen render had a lime dial
 * sitting directly above the lime community-sentiment bars, so the two strongest
 * signals on the screen were the same colour and competed. Cream keeps the dial
 * dominant (it is the largest thing on the card) while leaving lime to mean one
 * thing only. Price stays green/red, per the colour law:
 *     green/red = price · lime = community sentiment · orange = brand + action
 *
 * FLOORS: `heat` is null below FLOORS.trendingScore, so a founding club never
 * shows a manufactured 100. The dial renders its founding state instead of a
 * fabricated number — see ScoreDial.
 */

function fmtPrice(p?: number | null): string | null {
  if (p == null || !Number.isFinite(p)) return null;
  return p.toFixed(2);
}

/* ── Score dial ────────────────────────────────────────────────────────────
   An arc, not a full ring — the gap reads as "measured", and the cream stroke
   keeps it out of the semantic colour ramps entirely. Below floor we show a dash
   and the honest label rather than a number nobody earned. */
/* BELOW FLOOR, SHOW RANK — NOT AN EMPTY RING.
   `heat` is null until the club clears FLOORS.trendingScore, which at this club
   size is every ticker. That rendered a hollow arc with the label "Early" as the
   card's DOMINANT object — the emptiest thing on screen sitting in the most
   prominent slot. Rank is real at any club size and is the same fact the ledger
   is already sorted by, so the dial keeps its weight and stops apologising. The
   arc is omitted rather than faked: nothing is drawn that isn't measured. */
function ScoreDial({
  heat,
  rank,
}: {
  heat?: number | null;
  rank: number;
}) {
  const R = 42;
  const C = 2 * Math.PI * R;
  // 78% of the circle is the track; the arc sweeps that span.
  const SPAN = 0.78;
  const pct = heat != null ? Math.max(0, Math.min(100, heat)) / 100 : 0;

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: 116, height: 116 }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-[125deg]" aria-hidden>
        <circle
          cx="50" cy="50" r={R} fill="none"
          stroke="rgba(247,243,234,0.16)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${C * SPAN} ${C}`}
        />
        {heat != null && (
          <circle
            cx="50" cy="50" r={R} fill="none"
            stroke="#F7F3EA" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${C * SPAN * pct} ${C}`}
            className="club-donut-arc"
          />
        )}
      </svg>
      <div className="relative text-center">
        <div className="font-display text-[34px] font-extrabold leading-none tracking-tight text-[#F7F3EA] tabular-nums">
          {heat != null ? heat : `#${rank}`}
        </div>
        <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#F7F3EA]/60">
          {heat != null ? "Club score" : "On the board"}
        </div>
      </div>
    </div>
  );
}

export default function ClubCard({
  row,
  spark = [],
}: {
  row: TrendingRow;
  /** Inline series joined from the Pulse feed — Trending ranks, it doesn't chart. */
  spark?: number[];
}) {
  const price = fmtPrice(row.price);
  const pct = row.changePct;
  const up = (pct ?? 0) >= 0;

  return (
    <Link
      href={`/research/${encodeURIComponent(row.ticker)}`}
      className="club2-card f0-grain relative flex shrink-0 snap-center items-center gap-4 overflow-hidden rounded-[22px] px-5 py-5"
      aria-label={`${row.ticker}${price ? `, ${price}` : ""}${
        row.heat != null ? `, club score ${row.heat}` : ""
      }`}
    >
      {/* left — identity + market mark */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2.5">
          <CompanyLogo symbol={row.ticker} name={row.company} size={30} rounded="rounded-lg" />
          <span className="font-display text-[17px] font-extrabold tracking-tight text-[#F7F3EA]">
            {row.ticker}
          </span>
        </div>

        {price ? (
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-[26px] font-semibold leading-none tabular-nums text-[#F7F3EA]">
              {price}
            </span>
            {pct != null && (
              <span
                className={`font-mono text-[13px] font-semibold tabular-nums ${
                  up ? "text-price-up-island" : "text-price-down-island"
                }`}
              >
                {up ? "+" : ""}
                {pct.toFixed(2)}%
              </span>
            )}
          </div>
        ) : (
          // No quote joined — an honest absence, never a "score N" stand-in.
          <div className="mt-3 font-mono text-[12px] text-[#F7F3EA]/45">Price unavailable</div>
        )}

        <div className="mt-2 -ml-1">
          <Spark
            series={spark}
            tone={pct == null ? "flat" : up ? "up" : "down"}
            width={132}
            height={30}
          />
        </div>
      </div>

      {/* right — the dominant object */}
      <ScoreDial heat={row.heat} rank={row.rank} />
    </Link>
  );
}
