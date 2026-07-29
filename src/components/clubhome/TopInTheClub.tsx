"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { TrendingResponse, TrendingRow } from "@/lib/clubhome/contract";
import { TickerQuickSheet } from "@/components/collective";
import {
  BoardSection,
  BrandTile,
  EmptyTile,
  signedCount,
  signedPct,
  toneFor,
} from "./board";

/**
 * TOP IN THE CLUB — board 01's first content object, built as drawn.
 *
 * The board draws a horizontal strip of 74px WHITE ROUNDED CARDS. Each carries,
 * top to bottom: a 15px numeric rank pip hung off the top-left corner, a 34px
 * brand identity tile, the ticker in mono, a large percentage, and a small green
 * caret line. Card #1 wears an orange border and a soft bloom.
 *
 * An earlier pass rendered this as bare tiles on the page with no card, no
 * percentage and a price delta where the caret line goes. This is the card.
 *
 * WHAT THE TWO NUMERALS ARE, and why they change shape below the floor:
 *
 *   AT SCALE (any row clears FLOORS.trendingScore)
 *     big   = `heat` — club_score normalised 0–100 against the top of the
 *             ledger. That IS the board's conviction percentage.
 *     small = `change` — club_change_14d, the attention delta. The board's
 *             "▲ 6".
 *
 *   AT FOUNDING SIZE (today: nine tickers, top score 22, floor 50)
 *     `heat` is null for every row, so a conviction column would be five em
 *     dashes stacked where the board's loudest numeral goes — which reads as
 *     breakage, not as a young club. The card keeps its exact geometry and the
 *     two slots carry the market mark instead, which is real for every row:
 *     big   = the last price
 *     small = today's percentage move, on the price ramp
 *     The sub-line states which reading is on screen, so the numerals are never
 *     ambiguous.
 *
 *   WITH NEITHER (the market feed is down AND the club is below the floor)
 *     the card drops both numeral lines rather than stacking two em dashes
 *     under every ticker. No number available means no number printed; the
 *     ranking itself — which is the object's actual subject — still stands.
 *
 * The reading is chosen ONCE for the whole strip: a row of mixed meanings would
 * be worse than any of the three.
 *
 * LOADING ≠ EMPTY: `loading` renders pulsing cards; zero rows after loading
 * renders the founding line. Below five rows the strip pads with designed empty
 * slots so nine tickers look like a board filling up.
 *
 * The verbatim compliance line (`disclaimer`) rides under the strip: this is the
 * attention ranking, so it is the object that has to carry it.
 */

const LEAD = 5;
const CARD_W = 74;

function Card({
  rank,
  ticker,
  big,
  small,
  smallTone,
  lead,
  onSelect,
}: {
  rank: number;
  ticker: string;
  /** Omitted in BARE mode — see `mode` below. */
  big?: string;
  small?: string;
  smallTone?: string;
  lead: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="relative shrink-0" style={{ width: CARD_W }}>
      <span
        className={`club-b-pip pointer-events-none absolute -top-[7px] left-2 z-10 ${
          lead ? "club-b-pip-lead" : ""
        }`}
        aria-hidden
      >
        {rank}
      </span>
      <button
        type="button"
        onClick={onSelect}
        className={`club-b-card f0-focus f0-press block py-[9px] text-center ${
          lead ? "club-b-card-lead" : ""
        }`}
      >
        <BrandTile ticker={ticker} className="mx-auto mt-[2px]" />
        <span className="mt-1.5 block font-mono text-[10px] font-semibold text-ink">
          {ticker}
        </span>
        {big !== undefined && (
          <span className="block text-[11px] font-bold text-ink tabular-nums">
            {big}
          </span>
        )}
        {small !== undefined && (
          <span
            className={`mt-px block font-mono text-[9px] tabular-nums ${smallTone}`}
          >
            {small}
          </span>
        )}
      </button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="shrink-0" style={{ width: CARD_W }} aria-hidden>
      <div className="club-b-card py-[9px] text-center motion-safe:animate-pulse">
        <div className="mx-auto mt-[2px] h-[34px] w-[34px] rounded-[10px] bg-ink/10" />
        <div className="mx-auto mt-2 h-2 w-9 rounded-full bg-ink/10" />
        <div className="mx-auto mt-1.5 h-2.5 w-7 rounded-full bg-ink/10" />
        <div className="mx-auto mt-1.5 h-1.5 w-6 rounded-full bg-ink/[0.07]" />
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div className="shrink-0" style={{ width: CARD_W }}>
      <div className="club-b-card py-[9px] text-center opacity-70">
        <EmptyTile className="mx-auto mt-[2px]" />
        <span className="mt-1.5 block font-mono text-[10px] font-semibold text-soft/50">
          —
        </span>
        <span className="block text-[11px] font-bold text-soft/40">—</span>
        <span className="mt-px block font-mono text-[9px] text-soft/40">—</span>
      </div>
    </div>
  );
}

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

  // Which pair of numerals the strip is carrying — decided ONCE for the whole
  // strip, because a row of mixed meanings is worse than either reading.
  const mode: "conviction" | "price" | "bare" = rows.some((r) => r.heat != null)
    ? "conviction"
    : rows.some((r) => r.price != null && Number.isFinite(r.price))
      ? "price"
      : "bare";

  const trackRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(true);
  const [selected, setSelected] = useState<TrendingRow | null>(null);

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
    <>
    <BoardSection
      id="club-top"
      label="Top in"
      mark="the club"
      sub={
        mode === "conviction"
          ? "Live ranking by member attention & conviction"
          : mode === "price"
            ? "Live ranking by member attention · today's move"
            : "Live ranking by member attention"
      }
      action={
        total > rows.length ? (
          <Link
            href="/discover"
            className="f0-focus f0-press shrink-0 rounded-md text-[11px] font-semibold text-accent"
          >
            See all
          </Link>
        ) : undefined
      }
    >
      <div className="relative mt-[11px]">
        {loading ? (
          <div className="flex gap-[9px] overflow-hidden" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
            <span className="sr-only">Loading the Club ranking</span>
          </div>
        ) : (
          <div
            ref={trackRef}
            className="club2-track -m-1 flex gap-[9px] overflow-x-auto p-1"
            role="group"
            aria-label="Tickers ranked by Club attention"
          >
            {rows.map((r, i) => {
              const hasPct =
                typeof r.changePct === "number" && Number.isFinite(r.changePct);
              const big =
                mode === "conviction"
                  ? r.heat != null
                    ? `${r.heat}%`
                    : "—"
                  : mode === "price"
                    ? r.price != null && Number.isFinite(r.price)
                      ? r.price.toFixed(2)
                      : "—"
                    : undefined;
              const small =
                mode === "conviction"
                  ? signedCount(r.change)
                  : mode === "price"
                    ? signedPct(hasPct ? r.changePct : null)
                    : undefined;
              const smallTone =
                mode === "conviction"
                  ? toneFor(r.change)
                  : toneFor(hasPct ? r.changePct : null);
              return (
                <Card
                  key={r.ticker}
                  rank={r.rank}
                  ticker={r.ticker}
                  big={big}
                  small={small}
                  smallTone={smallTone}
                  lead={i === 0}
                  onSelect={() => setSelected(r)}
                />
              );
            })}

            {rows.length > 0 &&
              rows.length < LEAD &&
              Array.from({ length: LEAD - rows.length }).map((_, i) => (
                <EmptySlot key={`slot-${i}`} />
              ))}
          </div>
        )}

        {/* The board's own scroll affordance is the PEEK — the fifth card runs
            half off the screen edge and nothing is washed over it. The shared
            `.f0-strip-fade` was tried here and reads as a white block sitting on
            top of a white card, so the peek stands alone. `atEnd` still drives
            the aria state below. */}
        <span className="sr-only" aria-live="polite">
          {!loading && rows.length > LEAD && !atEnd
            ? "Scroll sideways for more of the ranking"
            : ""}
        </span>
      </div>

      {!loading && rows.length === 0 && (
        <p className="mt-3 text-[13px] leading-relaxed text-soft">
          {isKid
            ? "No company has caught the Club's eye yet. Pick one you know and it lands here first."
            : "No ticker has drawn the Club's attention yet. Rate one and yours is the first on this board."}
        </p>
      )}

      {trending?.disclaimer && (
        <p className="mt-2.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-soft">
          {trending.disclaimer}
        </p>
      )}
    </BoardSection>
    {selected && (
      <div
        className="fixed inset-0 z-50 flex items-end bg-ink/40 backdrop-blur-[2px]"
        role="presentation"
        onMouseDown={() => setSelected(null)}
      >
        <div
          className="mx-auto w-full max-w-xl"
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.ticker} quick view`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <TickerQuickSheet>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                  #{selected.rank} in the Club
                </span>
                <div className="mt-2 flex items-center gap-3">
                  <BrandTile ticker={selected.ticker} />
                  <div>
                    <h3 className="font-display text-2xl font-extrabold text-ink">
                      {selected.company || selected.ticker}
                    </h3>
                    <p className="font-mono text-xs text-soft">${selected.ticker}</p>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="f0-focus rounded-full border border-sand px-3 py-1 text-sm text-ink" aria-label="Close quick view">×</button>
            </div>
            <div className="mt-5 grid grid-cols-3 border-y border-sand py-3 text-center">
              <div><strong className="block font-mono text-sm text-ink">{selected.heat != null ? `${selected.heat}%` : "—"}</strong><span className="text-[10px] text-soft">Club signal</span></div>
              <div className="border-x border-sand"><strong className="block font-mono text-sm text-ink">{selected.watchers?.toLocaleString() || "—"}</strong><span className="text-[10px] text-soft">Watching</span></div>
              <div><strong className="block font-mono text-sm text-ink">{signedCount(selected.change)}</strong><span className="text-[10px] text-soft">Attention</span></div>
            </div>
            <div className="mt-5 flex gap-2">
              <Link href={`/research/${encodeURIComponent(selected.ticker)}?from=dashboard`} className="f0-focus f0-press rounded-xl bg-accent px-4 py-3 text-sm font-bold text-[var(--accent-on)]">Open ticker</Link>
              <Link href={`/watchlist?add=${encodeURIComponent(selected.ticker)}`} className="f0-focus f0-press rounded-xl border border-sand px-4 py-3 text-sm font-bold text-ink">Watch</Link>
            </div>
          </TickerQuickSheet>
        </div>
      </div>
    )}
    </>
  );
}
