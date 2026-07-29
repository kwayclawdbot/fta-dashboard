"use client";

/**
 * TICKER · FUNDAMENTALS — v2 (board 13 of the owner's "cc" artboard set).
 *
 * A DROP-IN TWIN of `Fundamentals.tsx`: identical prop signature
 * (`research` · `companyName` · `locked` · `upsell`), identical real data, every
 * data-state preserved. What changed is only the skin — the v1 warm-gold board
 * chrome (`board.tsx` Donut/CompareBar on `--color-*` tokens) is re-cut into the
 * v2 "cc" anatomy of board 13:
 *
 *   ┌ health-grade RING · FINANCIAL HEALTH · verdict · one-line read ───────┐
 *   ┌ what's strong ┐ ┌ what's weak ┐   (v1's paid-gated breakdown, kept)
 *   ┌ REVENUE ····························· +N% YoY · four bars ────────────┐
 *   ┌ ring ┐ ┌ ring ┐ ┌ ring ┐   gross · operating · net margin
 *   ┌ VALUATION VS PEERS · TRAILING P/E ───────────────────────────────────┐
 *   Fundamentals from the latest reported filings · Delayed data
 *
 * HONESTY (unchanged from v1 — the data cannot say more just because the skin
 * changed):
 *   • the third ring is NET margin, not the board's FCF margin — free cash flow
 *     needs capex the aggregate doesn't carry.
 *   • "peers" are this name's P/E against the SECTOR MEDIAN and MARKET MEDIAN the
 *     aggregate stores, NOT the board's hand-picked "AMD / AVGO" rows — nothing
 *     in the payload says who two named peers are, so we don't invent them. The
 *     row renders only when those medians actually resolved.
 *   • the ring reads TRAILING P/E (what the aggregate computes), not "FWD P/E".
 *   • loading + `research.insufficient` are owned by the parent panel (this
 *     component only ever receives a non-null payload, exactly as v1 does); the
 *     states this component owns — ungraded grades, empty strengths/weaknesses,
 *     a too-short revenue history, absent margins/valuation, and the `locked`
 *     upsell gate — each degrade to an honest "—" / stated-absence in place.
 *
 * COLOUR: `--cc-*` tokens only. Grade tone maps to the cc palette
 * (A/B → up-green · C → yellow · D/F → down-pink · ungraded → dim) rather than
 * borrowing v1's semantic letter hexes. Orange stays the single brand accent
 * (newest revenue bar · the subject's valuation bar), per cc brand law.
 */

import { Fragment, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Lock } from "lucide-react";

import type { GradesResult, Letter } from "@/lib/research/grades";
import type { ResearchPayload } from "@/lib/research/types";
import { lastPairAdjacent, proseName, seriesBreaks } from "@/lib/research/labels";
import { Card, Ring } from "@/components/cc/ui";

/** A loss on a filing — a dim ink, deliberately NOT the pink/green tape tones so
 *  a reported loss never reads as a move on the price. */
const LOSS = "color-mix(in srgb, var(--cc-ink) 45%, transparent)";

/** How many strengths / weaknesses read before the card asks to be opened. */
const POINTS_PREVIEW = 4;

/** Grade letter → cc palette tone (never a v1 semantic hex; ungraded is neutral). */
function gradeTone(letter: Letter | null): string {
  if (!letter) return "var(--cc-dim)";
  if (letter === "A" || letter === "B") return "var(--cc-up)";
  if (letter === "C") return "var(--cc-yellow)";
  return "var(--cc-down)";
}

function abbrev(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const s =
    a >= 1e12
      ? `$${(a / 1e12).toFixed(1)}T`
      : a >= 1e9
        ? `$${(a / 1e9).toFixed(0)}B`
        : a >= 1e6
          ? `$${(a / 1e6).toFixed(0)}M`
          : `$${a.toFixed(0)}`;
  return v < 0 ? `-${s}` : s;
}

const MONO = "font-[family-name:var(--font-plex-mono)]";

/** Board-13 eyebrow — mono, uppercase, wide-tracked. Orange = brand section
 *  mark (REVENUE / VALUATION); soft = the quiet grey label. */
function Eyebrow({
  children,
  tone = "soft",
}: {
  children: ReactNode;
  tone?: "soft" | "brand";
}) {
  return (
    <span
      className={`${MONO} text-[8.5px] font-semibold uppercase leading-none tracking-[0.14em]`}
      style={{ color: tone === "brand" ? "var(--cc-orange-ink)" : "var(--cc-soft)" }}
    >
      {children}
    </span>
  );
}

const CARD = "rounded-2xl border border-[var(--cc-line)] bg-[var(--cc-card)]";

export default function FundamentalsV2({
  research,
  companyName,
  locked,
  upsell,
}: {
  research: ResearchPayload;
  companyName: string;
  /** Free tier — the written detail is a paid read; the rings stay visible. */
  locked: boolean;
  upsell: ReactNode;
}) {
  const grades: GradesResult = research.grades;
  const overall = grades.overall;

  /* TTM margins from the last four reported quarters. Summing four quarters is
     the only honest way to state a margin here: one quarter is seasonal, and the
     aggregate's annual rows carry revenue and net income but not the gross or
     operating lines. Fewer than four quarters → no rings, stated plainly. */
  const margins = useMemo(() => {
    const q = research.charts.quarterly.slice(-4);
    if (q.length < 4) return null;
    const sum = (pick: (r: (typeof q)[number]) => number | null) =>
      q.reduce<number | null>((acc, r) => {
        const v = pick(r);
        if (acc == null || v == null) return null;
        return acc + v;
      }, 0);
    const rev = sum((r) => r.revenue);
    if (rev == null || rev <= 0) return null;
    const gross = sum((r) => r.grossProfit);
    const op = sum((r) => r.operatingIncome);
    const net = sum((r) => r.netIncome);
    const pct = (v: number | null) => (v == null ? null : Math.round((v / rev) * 100));
    return { gross: pct(gross), op: pct(op), net: pct(net) };
  }, [research.charts.quarterly]);

  /* Annual revenue — the board's four-bar chart. Whatever the aggregate
     reported, newest last, capped at four so the bars stay readable.

     PERIODS ARE NOT ALWAYS CONSECUTIVE. Polygon's annual set can miss a filing,
     and four bars in a row IS a claim that they are four years in a row. So:
     `breaks` marks a missing year and the chart draws the discontinuity, and the
     year-on-year figure is computed only when the last two bars genuinely are
     adjacent. `peak` is on MAGNITUDE so a restated negative year draws as a loss,
     not a clipped stub. */
  const revenue = useMemo(() => {
    const rows = research.charts.annual.filter((a) => a.revenue != null).slice(-4);
    if (rows.length < 2) return null;
    const labels = rows.map((r) => r.label);
    const breaks = seriesBreaks(labels);
    const peak = Math.max(...rows.map((r) => Math.abs(r.revenue!)), 1);
    const prev = rows[rows.length - 2].revenue;
    const yoy =
      lastPairAdjacent(labels) && prev != null && prev > 0
        ? ((rows[rows.length - 1].revenue! - prev) / prev) * 100
        : null;
    return { rows, peak, yoy, breaks, gapped: breaks.some(Boolean) };
  }, [research.charts.annual]);

  /* Valuation — this name against the two medians the aggregate stores. */
  const valuation = useMemo(() => {
    const pe = research.keyStats.pe;
    const m = research.sectorMedians;
    if (pe == null || pe <= 0) return null;
    const rows = [
      { name: research.company.ticker, v: pe, highlight: true },
      m.sectorMedian != null && m.sectorN > 0
        ? { name: "Sector", v: m.sectorMedian, highlight: false }
        : null,
      m.marketMedian != null && m.marketN > 0
        ? { name: "Market", v: m.marketMedian, highlight: false }
        : null,
    ].filter(Boolean) as { name: string; v: number; highlight: boolean }[];
    if (rows.length < 2) return null;
    const peak = Math.max(...rows.map((r) => r.v));
    return { rows, peak, sector: m.sector, cheaper: rows[0].v < rows[1].v };
  }, [research.keyStats.pe, research.sectorMedians, research.company.ticker]);

  const tone = gradeTone(overall.letter);

  return (
    <div className="space-y-3">
      {/* ── FINANCIAL HEALTH ──────────────────────────────────────────────── */}
      <div className={`${CARD} flex items-center gap-4 p-4`}>
        <div
          role="img"
          aria-label={
            overall.letter
              ? `Financial health grade ${overall.letter}`
              : "Financial health not graded"
          }
        >
          <Ring
            value={overall.gauge == null ? 0 : overall.gauge * 100}
            size={72}
            stroke={8}
            color={tone}
          >
            <span className="text-[22px] font-extrabold leading-none" style={{ color: tone }}>
              {overall.letter ?? "—"}
            </span>
          </Ring>
        </div>
        <div className="min-w-0 flex-1">
          <Eyebrow>Financial health</Eyebrow>
          <p
            className="mt-1.5 text-[16px] font-extrabold leading-tight"
            style={{ color: overall.label ? "var(--cc-ink)" : "var(--cc-soft)" }}
          >
            {overall.label ?? "Not enough data"}
          </p>
          <p className="mt-1 text-[10.5px] leading-snug" style={{ color: "var(--cc-soft)" }}>
            {overall.label
              ? `${overall.graded} of 4 areas graded · value, growth, health, momentum`
              : `Many smaller companies and funds don't publish the numbers this scorecard needs.`}
          </p>
        </div>
      </div>

      {/* ── STRENGTHS / WEAKNESSES — v1's paid-gated breakdown, kept ───────── */}
      {(grades.strengths.length > 0 || grades.weaknesses.length > 0) && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <PointsCard
            label="What's strong"
            items={grades.strengths}
            locked={locked}
            tone="var(--cc-up)"
            empty="No standout strengths from the data we have."
          />
          <PointsCard
            label="What's weak"
            items={grades.weaknesses}
            locked={locked}
            tone="var(--cc-down)"
            empty="No notable weaknesses from the data we have."
          />
        </div>
      )}
      {locked && <div>{upsell}</div>}

      {/* ── REVENUE ───────────────────────────────────────────────────────── */}
      {revenue ? (
        <div className={`${CARD} px-4 py-3.5`}>
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow tone="brand">Revenue</Eyebrow>
            {revenue.yoy != null && (
              <span
                className={`${MONO} text-[9.5px] font-semibold tabular-nums`}
                style={{ color: revenue.yoy >= 0 ? "var(--cc-up)" : "var(--cc-down)" }}
              >
                {revenue.yoy >= 0 ? "+" : "−"}
                {Math.abs(revenue.yoy).toFixed(0)}% YoY
              </span>
            )}
          </div>
          <div className="mt-3 flex h-[92px] items-end gap-2.5 px-1">
            {revenue.rows.map((r, i) => {
              const newest = i === revenue.rows.length - 1;
              const loss = (r.revenue ?? 0) < 0;
              const barStyle: CSSProperties = {
                height: `${Math.max(6, (Math.abs(r.revenue!) / revenue.peak) * 100)}%`,
                minHeight: 6,
                background: loss
                  ? LOSS
                  : newest
                    ? "var(--cc-orange)"
                    : "var(--cc-card2)",
              };
              return (
                <Fragment key={r.label}>
                  {/* The hole in the filing history, drawn as a hole. */}
                  {revenue.breaks[i] && (
                    <span
                      className="flex h-full w-[9px] shrink-0 flex-col items-center justify-center gap-[3px]"
                      title="A reporting year is missing between these two"
                    >
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="h-[3px] w-[3px] rounded-full"
                          style={{ background: "var(--cc-dim)" }}
                        />
                      ))}
                      <span className="sr-only">missing reporting year</span>
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span
                      className={`${MONO} text-[8.5px] tabular-nums`}
                      style={{ color: newest ? "var(--cc-ink)" : "var(--cc-soft)" }}
                    >
                      {abbrev(r.revenue)}
                    </span>
                    <span
                      className="w-full rounded-t-[5px]"
                      style={barStyle}
                      aria-hidden
                    />
                    <span
                      className={`${MONO} text-[8px] uppercase`}
                      style={{ color: "var(--cc-dim)" }}
                    >
                      {r.label}
                    </span>
                  </div>
                </Fragment>
              );
            })}
          </div>
          {revenue.gapped && (
            <p className="mt-2.5 text-[10.5px] leading-snug" style={{ color: "var(--cc-soft)" }}>
              A reporting year is missing from this filing history — the bars
              either side of the break are not consecutive, so no year-on-year
              change is shown.
            </p>
          )}
        </div>
      ) : (
        <div className={`${CARD} px-4 py-3.5`}>
          <Eyebrow tone="brand">Revenue</Eyebrow>
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            {proseName(companyName, research.company.ticker)} hasn&apos;t reported
            enough annual periods for a revenue chart yet.
          </p>
        </div>
      )}

      {/* ── MARGIN RINGS ──────────────────────────────────────────────────── */}
      {margins && (
        <div className="flex gap-2.5">
          <MarginRing pct={margins.gross} label="Gross margin" color="var(--cc-up)" />
          <MarginRing pct={margins.op} label="Operating margin" color="var(--cc-yellow)" />
          <MarginRing pct={margins.net} label="Net margin" color="var(--cc-blue)" />
        </div>
      )}

      {/* ── VALUATION VS PEERS ────────────────────────────────────────────── */}
      {valuation && (
        <div className={`${CARD} px-4 py-3.5`}>
          <Eyebrow tone="brand">Valuation vs peers · Trailing P/E</Eyebrow>
          <div className="mt-3 space-y-2.5">
            {valuation.rows.map((r) => (
              <CompareBar
                key={r.name}
                name={r.name}
                pct={(r.v / valuation.peak) * 100}
                value={`${r.v.toFixed(0)}×`}
                highlight={r.highlight}
              />
            ))}
          </div>
          <p className="mt-3 text-[10.5px] leading-snug" style={{ color: "var(--cc-soft)" }}>
            {valuation.cheaper
              ? `Trades on a lower multiple than the ${valuation.sector ?? "sector"} median.`
              : `Trades on a higher multiple than the ${valuation.sector ?? "sector"} median.`}{" "}
            A multiple on its own is not a verdict — it is one input.
          </p>
        </div>
      )}

      {/* ── SOURCING FOOTER (verbatim from v1) ─────────────────────────────── */}
      <p
        className="mt-5 border-t pt-3.5 text-center text-[11px] leading-relaxed"
        style={{ borderColor: "var(--cc-line)", color: "var(--cc-soft)" }}
      >
        Fundamentals come from the latest reported filings · Market data delayed
        ~15 min · Not investment advice
      </p>
    </div>
  );
}

/**
 * One margin ring — board 13's three-up row, in the cc palette.
 *
 * A NEGATIVE MARGIN IS A NUMBER, NOT A GAP. cc's shared `Ring` clamps to
 * 0–100 and always draws a positive arc, so a company losing 38 cents on the
 * dollar would draw the same empty track — in the positive colour — as a company
 * whose margin we simply couldn't compute. So the ring is drawn here in cc's own
 * grammar (`--cc-line` track, the given cc arc colour) with the arc filled to the
 * magnitude and switched to the loss tone below zero; the figure carries its own
 * minus sign, and "—" is reserved for genuine absence.
 */
function MarginRing({
  pct,
  label,
  color,
}: {
  pct: number | null;
  label: string;
  color: string;
}) {
  const size = 64;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const loss = pct != null && pct < 0;
  const magnitude = pct == null ? 0 : Math.min(100, Math.abs(pct));
  const arc = loss ? LOSS : color;
  return (
    <div className={`${CARD} flex min-w-0 flex-1 flex-col items-center px-2 py-3.5`}>
      <span
        className="relative inline-grid shrink-0 place-items-center"
        style={{ width: size, height: size }}
        role="img"
        aria-label={
          pct == null
            ? `${label} unavailable`
            : loss
              ? `${label}: a loss of ${Math.abs(pct)} percent of revenue`
              : `${label} ${pct} percent`
        }
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--cc-line)"
            strokeWidth={stroke}
          />
          {pct != null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={arc}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - magnitude / 100)}
              className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
            />
          )}
        </svg>
        <span
          className={`relative z-[1] ${MONO} text-[13px] font-semibold tabular-nums`}
          style={{ color: "var(--cc-ink)" }}
        >
          {pct == null ? "—" : `${pct < 0 ? "−" : ""}${Math.abs(pct)}%`}
        </span>
      </span>
      <span className="mt-2 text-center text-[9.5px] leading-tight" style={{ color: "var(--cc-soft)" }}>
        {label}
        {loss && (
          <span className="mt-0.5 block text-[8.5px] uppercase tracking-[0.1em]">loss</span>
        )}
      </span>
    </div>
  );
}

/**
 * Board 13's "valuation vs peers" row: name · track · figure. The subject's own
 * bar is brand orange; everything it is compared against is dim.
 */
function CompareBar({
  name,
  pct,
  value,
  highlight = false,
}: {
  name: string;
  pct: number | null;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`${MONO} w-11 shrink-0 truncate text-[10px] ${highlight ? "font-semibold" : ""}`}
        style={{ color: highlight ? "var(--cc-ink)" : "var(--cc-soft)" }}
      >
        {name}
      </span>
      <span
        className="h-3 min-w-0 flex-1 overflow-hidden rounded-full"
        style={{ background: "var(--cc-card2)" }}
      >
        {pct != null && (
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.max(2, Math.min(100, pct))}%`,
              background: highlight ? "var(--cc-orange)" : "var(--cc-dim)",
            }}
          />
        )}
      </span>
      <span
        className={`${MONO} w-9 shrink-0 text-right text-[10px] tabular-nums`}
        style={{ color: highlight ? "var(--cc-ink)" : "var(--cc-soft)" }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Strengths / weaknesses, as board-13 cards.
 *
 * BOUNDED. The grades engine can emit a dozen bullets per side; four read, the
 * rest are one tap away and stay in place when they open. When `locked`, one
 * bullet shows and the rest sit behind the upsell gate — matching v1 exactly.
 */
function PointsCard({
  label,
  items,
  locked,
  tone,
  empty,
}: {
  label: string;
  items: string[];
  locked: boolean;
  /** cc token for the bullet dot — up-green for strengths, down-pink for weaks. */
  tone: string;
  empty: string;
}) {
  const [all, setAll] = useState(false);
  const shown = locked ? items.slice(0, 1) : all ? items : items.slice(0, POINTS_PREVIEW);
  const hidden = items.length - shown.length;
  return (
    <div className={`${CARD} px-4 py-3.5`}>
      <Eyebrow>{label}</Eyebrow>
      {items.length === 0 ? (
        <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          {empty}
        </p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {shown.map((s, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-[12.5px] leading-snug"
              style={{ color: "var(--cc-ink)" }}
            >
              <span
                className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full"
                style={{ background: tone }}
                aria-hidden
              />
              <span className="min-w-0">{s}</span>
            </li>
          ))}
          {locked && items.length > 1 && (
            <li
              className="flex items-center gap-1.5 pt-1 text-[11px]"
              style={{ color: "var(--cc-soft)" }}
            >
              <Lock className="h-3 w-3 shrink-0" />
              {items.length - 1} more — join the Club to read the full breakdown
            </li>
          )}
        </ul>
      )}
      {!locked && (hidden > 0 || all) && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className={`${MONO} mt-3 text-[9.5px] font-bold uppercase tracking-[0.16em] transition-colors`}
          style={{ color: "var(--cc-orange-ink)" }}
        >
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}
