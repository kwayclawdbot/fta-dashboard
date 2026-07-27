"use client";

import Link from "next/link";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { TRENDING_DISCLAIMER } from "@/lib/club/score";
import type { TrendingResponse, TrendingRow } from "@/lib/clubhome/contract";

/**
 * THE LEDGER — the whole board as hairline-ruled rows (`f0-ledger`), the
 * card-stack replacement. No boxes, no equal-column grid: identity comes from
 * the logo, the $CASHTAG and the type scale inside each row.
 *
 * The carousel above is the SCORE lens (which tickers the club is most on). This
 * is the STANCE lens — the same universe re-sorted by how many members have
 * actually positioned, which is why the community-sentiment bar lives here and
 * nowhere else on the surface.
 *
 * COLOUR LAW, strictly:
 *   · green / red — the price change, and nothing else
 *   · LIME        — the community sentiment bar, and nothing else
 *   · orange      — reserved for brand + action; it does not appear in a row
 * This all sits on the page, never on the orange band, so red/green stays
 * legible.
 *
 * DARK: price uses the canonical `text-price-up` / `text-price-down` tokens,
 * which carry the green/red MEANING and re-map per theme (#15803D/#B91C1C on
 * cream → #4ADE80/#F87171 on obsidian, where the light-theme pair would have
 * measured ~3.8:1 and ~2.9:1 and failed at 12px). Never write a dark: variant
 * for price. Everything else here is a semantic token (ink / soft / sand) or a
 * law colour (lime) and flips for free.
 *
 * HONESTY: price renders as an em-dash when the quote feed didn't join, the
 * percentage is simply absent rather than zeroed, and the sentiment bar always
 * shows its DENOMINATOR ("62% bull · 8 positioned") so a split computed from a
 * handful of votes can never read as a mandate.
 *
 * KID WALL: sentiment display is kid-walled. Kids get the same ledger with the
 * company name in place of the stance bar.
 */

function fmtPrice(p?: number | null): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return p.toFixed(2);
}

/** Stance lens: most-positioned first, falling back to the club rank. */
function byStance(a: TrendingRow, b: TrendingRow): number {
  const av = a.participants ?? a.watchers ?? 0;
  const bv = b.participants ?? b.watchers ?? 0;
  if (av !== bv) return bv - av;
  return a.rank - b.rank;
}

function SentimentBar({ row }: { row: TrendingRow }) {
  const s = row.sentiment;
  const positioned = s ? s.bull + s.neutral + s.bear : 0;
  const bullPct = s?.bullPct ?? null;

  if (bullPct == null || positioned === 0) {
    return (
      <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        No stance yet
      </span>
    );
  }

  /* A PERCENTAGE NEEDS A CROWD. At one or two positions "100% bull" is
     arithmetically true and reads as consensus — the single most misleading
     thing this surface could say. Below the floor we state the raw count and
     drop the bar entirely: one voice is a voice, not a split. */
  const PCT_FLOOR = 4;
  if (positioned < PCT_FLOOR) {
    return (
      <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        {positioned === 1 ? "1 member positioned" : `${positioned} members positioned`}
      </span>
    );
  }

  return (
    <span className="mt-1.5 flex items-center gap-2">
      <span
        className="relative block h-1 w-20 shrink-0 overflow-hidden rounded-full bg-sand"
        aria-hidden
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-lime-400"
          style={{ width: `${Math.max(2, Math.min(100, bullPct))}%` }}
        />
      </span>
      <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        {bullPct}% bull · {positioned.toLocaleString()} positioned
      </span>
    </span>
  );
}

export default function BoardLedger({
  trending,
  isKid,
}: {
  trending?: TrendingResponse | null;
  isKid: boolean;
}) {
  const rows = [...(trending?.rows ?? [])].sort(byStance).slice(0, 8);

  return (
    <section aria-labelledby="club-board">
      <h2 id="club-board" className="f0-section-rule mb-1">
        <span className="font-display text-eyebrow font-bold uppercase text-ink">
          {isKid ? "The board" : "Where the club stands"}
        </span>
      </h2>

      {rows.length === 0 ? (
        <p className="py-4 text-[14px] leading-relaxed text-soft">
          The board is still forming. Rate a ticker and yours is the first stance on
          it.
        </p>
      ) : (
        <div className="f0-ledger">
          {rows.map((r) => {
            const pct = r.changePct;
            const up = (pct ?? 0) >= 0;
            return (
              <Link
                key={r.ticker}
                href={`/research/${encodeURIComponent(r.ticker)}`}
                className="f0-ledger-row"
              >
                <CompanyLogo
                  symbol={r.ticker}
                  name={r.company}
                  size={34}
                  rounded="rounded-lg"
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[15px] font-extrabold tracking-tight text-ink">
                    ${r.ticker}
                  </span>
                  {isKid ? (
                    <span className="mt-1 block truncate text-[12px] text-soft">
                      {r.company || " "}
                    </span>
                  ) : (
                    <SentimentBar row={r} />
                  )}
                </span>

                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[15px] font-semibold tabular-nums text-ink">
                    {fmtPrice(r.price)}
                  </span>
                  {pct != null && (
                    <span
                      className={`mt-0.5 block font-mono text-[12px] font-semibold tabular-nums ${
                        up ? "text-price-up" : "text-price-down"
                      }`}
                    >
                      {up ? "+" : ""}
                      {pct.toFixed(2)}%
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        {TRENDING_DISCLAIMER}
      </p>
    </section>
  );
}
