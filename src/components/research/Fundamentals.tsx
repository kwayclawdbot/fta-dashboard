"use client";

/**
 * TICKER · FUNDAMENTALS — board 13 of the owner's mockup, rebuilt object for
 * object:
 *
 *   ┌ ring + FINANCIAL HEALTH / verdict / one-line read ────────────┐
 *   ┌ REVENUE  ································· +N% YoY ──────────┐
 *   ┌ ring ┐ ┌ ring ┐ ┌ ring ┐   gross · operating · net margin
 *   ┌ VALUATION VS PEERS · FWD P/E ────────────────────────────────┐
 *   Fundamentals from the latest reported filings · Delayed data
 *
 * The board's letter grade, its three margin rings and its peer bars are all
 * things this app already computes — so they ship as drawn. What changed from
 * the board is only what the data can honestly support:
 *   • the third ring is NET margin, not FCF margin. Free cash flow needs
 *     capital expenditure and the aggregate does not carry it, so the ring
 *     reports a margin we can actually derive.
 *   • the peer bars compare this name's P/E against its SECTOR MEDIAN and the
 *     MARKET MEDIAN (both stored on the aggregate), not against two
 *     hand-picked tickers. The board's "AMD / AVGO" rows would be a claim
 *     about who the peers are that nothing in the product makes.
 *   • the ring reads TRAILING P/E, because that is the multiple the aggregate
 *     computes. The board's "FWD P/E" label would misdescribe it.
 *
 * Every figure is derived from `ResearchPayload` — the /api/research/[ticker]
 * aggregate (Polygon financials + our sector medians). A figure whose source
 * resolved to nothing renders "—"; a section whose whole source is missing
 * states that plainly instead of drawing an empty chart.
 */

import { useMemo } from "react";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";

import type { GradesResult } from "@/lib/research/grades";
import type { ResearchPayload } from "@/lib/research/types";
import { letterColor } from "@/components/research/GradeVisuals";
import {
  BoardFoot,
  Card,
  CardLabel,
  CompareBar,
  Donut,
} from "@/components/research/board";

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

export default function Fundamentals({
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
     the only honest way to state a margin here: one quarter is seasonal, and
     the aggregate's annual rows carry revenue and net income but not the gross
     or operating lines. Fewer than four quarters → no rings, stated plainly. */
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

  /* Annual revenue — the board's four-bar chart. Uses whatever the aggregate
     reported, newest last, capped at four so the bars stay readable. */
  const revenue = useMemo(() => {
    const rows = research.charts.annual.filter((a) => a.revenue != null).slice(-4);
    if (rows.length < 2) return null;
    const peak = Math.max(...rows.map((r) => r.revenue!));
    const yoy =
      rows.length >= 2 && rows[rows.length - 2].revenue
        ? ((rows[rows.length - 1].revenue! - rows[rows.length - 2].revenue!) /
            rows[rows.length - 2].revenue!) *
          100
        : null;
    return { rows, peak, yoy };
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

  const healthColor = letterColor(overall.letter);

  return (
    <div className="space-y-3">
      {/* ── FINANCIAL HEALTH ──────────────────────────────────────────────── */}
      <Card className="flex items-center gap-4 p-4">
        <Donut
          pct={overall.gauge == null ? null : overall.gauge * 100}
          size={72}
          thickness={8}
          color={healthColor}
          label={
            overall.letter
              ? `Financial health grade ${overall.letter}`
              : "Financial health not graded"
          }
        >
          <span
            className="font-display text-[22px] font-extrabold leading-none"
            style={{ color: healthColor }}
          >
            {overall.letter ?? "—"}
          </span>
        </Donut>
        <div className="min-w-0 flex-1">
          <CardLabel>Financial health</CardLabel>
          <p
            className={`mt-1.5 font-display text-[16px] font-extrabold leading-tight ${
              overall.label ? "text-ink" : "text-soft"
            }`}
          >
            {overall.label ?? "Not enough data"}
          </p>
          <p className="mt-1 text-[10.5px] leading-snug text-soft">
            {overall.label
              ? `${overall.graded} of 4 areas graded · value, growth, health, momentum`
              : `Many smaller companies and funds don't publish the numbers this scorecard needs.`}
          </p>
        </div>
      </Card>

      {/* ── STRENGTHS / WEAKNESSES — the board keeps this as two card
             columns rather than the ledger a previous pass shipped. ──────── */}
      {(grades.strengths.length > 0 || grades.weaknesses.length > 0) && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <PointsCard
            label="What's strong"
            items={grades.strengths}
            locked={locked}
            empty="No standout strengths from the data we have."
          />
          <PointsCard
            label="What's weak"
            items={grades.weaknesses}
            locked={locked}
            empty="No notable weaknesses from the data we have."
          />
        </div>
      )}
      {locked && <div>{upsell}</div>}

      {/* ── REVENUE ───────────────────────────────────────────────────────── */}
      {revenue ? (
        <Card radius="md" className="px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <CardLabel tone="brand">Revenue</CardLabel>
            {revenue.yoy != null && (
              <span
                className={`font-mono text-[9.5px] font-semibold tabular-nums ${
                  revenue.yoy >= 0 ? "text-price-up" : "text-price-down"
                }`}
              >
                {revenue.yoy >= 0 ? "+" : "−"}
                {Math.abs(revenue.yoy).toFixed(0)}% YoY
              </span>
            )}
          </div>
          <div className="mt-3 flex h-[92px] items-end gap-2.5 px-1">
            {revenue.rows.map((r, i) => {
              const newest = i === revenue.rows.length - 1;
              return (
                <div key={r.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span
                    className={`font-mono text-[8.5px] tabular-nums ${
                      newest ? "text-gold-700" : "text-soft"
                    }`}
                  >
                    {abbrev(r.revenue)}
                  </span>
                  <span
                    className={`w-full rounded-t-[5px] ${newest ? "bg-volt-500" : "bg-sand"}`}
                    style={{
                      height: `${Math.max(6, (r.revenue! / revenue.peak) * 100)}%`,
                      minHeight: 6,
                    }}
                    aria-hidden
                  />
                  <span className="font-mono text-[8px] uppercase text-soft">{r.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card radius="md" className="px-4 py-3.5">
          <CardLabel tone="brand">Revenue</CardLabel>
          <p className="mt-2 text-[12px] leading-relaxed text-soft">
            {companyName} hasn&apos;t reported enough annual periods for a revenue
            chart yet.
          </p>
        </Card>
      )}

      {/* ── MARGIN RINGS ──────────────────────────────────────────────────── */}
      {margins && (
        <div className="flex gap-2.5">
          <MarginRing pct={margins.gross} label="Gross margin" color="var(--color-price-up)" />
          <MarginRing pct={margins.op} label="Operating margin" color="#D99A00" />
          <MarginRing pct={margins.net} label="Net margin" color="var(--color-kai-500)" />
        </div>
      )}

      {/* ── VALUATION ─────────────────────────────────────────────────────── */}
      {valuation && (
        <Card radius="md" className="px-4 py-3.5">
          <CardLabel tone="brand">
            Valuation vs peers · Trailing P/E
          </CardLabel>
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
          <p className="mt-3 text-[10.5px] leading-snug text-soft">
            {valuation.cheaper
              ? `Trades on a lower multiple than the ${valuation.sector ?? "sector"} median.`
              : `Trades on a higher multiple than the ${valuation.sector ?? "sector"} median.`}{" "}
            A multiple on its own is not a verdict — it is one input.
          </p>
        </Card>
      )}

      <BoardFoot>
        Fundamentals come from the latest reported filings · Market data delayed
        ~15 min · Not investment advice
      </BoardFoot>
    </div>
  );
}

/** One margin ring — board 13's three-up row. */
function MarginRing({
  pct,
  label,
  color,
}: {
  pct: number | null;
  label: string;
  color: string;
}) {
  return (
    <Card radius="sm" className="flex min-w-0 flex-1 flex-col items-center px-2 py-3.5">
      <Donut
        pct={pct}
        size={64}
        thickness={7}
        color={color}
        label={pct == null ? `${label} unavailable` : `${label} ${pct} percent`}
      >
        <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">
          {pct == null ? "—" : `${pct}%`}
        </span>
      </Donut>
      <span className="mt-2 text-center text-[9.5px] leading-tight text-soft">{label}</span>
    </Card>
  );
}

/** Strengths / weaknesses, as the board's card rather than a hairline ledger. */
function PointsCard({
  label,
  items,
  locked,
  empty,
}: {
  label: string;
  items: string[];
  locked: boolean;
  empty: string;
}) {
  const shown = locked ? items.slice(0, 1) : items;
  return (
    <Card radius="md" className="px-4 py-3.5">
      <CardLabel>{label}</CardLabel>
      {items.length === 0 ? (
        <p className="mt-2.5 text-[12px] leading-relaxed text-soft">{empty}</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {shown.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[12.5px] leading-snug text-midnight-200">
              <span
                className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full bg-volt-500"
                aria-hidden
              />
              <span className="min-w-0">{s}</span>
            </li>
          ))}
          {locked && items.length > 1 && (
            <li className="flex items-center gap-1.5 pt-1 text-[11px] text-soft">
              <Lock className="h-3 w-3 shrink-0" />
              {items.length - 1} more — join the Club to read the full breakdown
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
