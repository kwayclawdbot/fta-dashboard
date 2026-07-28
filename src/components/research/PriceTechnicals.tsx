"use client";

/**
 * TICKER · TECHNICALS — board 12 of the owner's mockup, rebuilt object for
 * object:
 *
 *   ┌ dial ──┬ TECHNICAL PICTURE / verdict / N of M signals ─────────┐
 *   ┌ RSI · 14D ─────────────┐ ┌ MACD · cross ────────────────────┐
 *   ┌ KEY LEVELS — dashed resistances, the live mark, supports ─────┐
 *   [ MA20 ] [ MA50 ] [ MA200 ] [ Rel. volume ]
 *   Technicals refresh every 15 min · Not investment advice
 *
 * TWO THINGS THE BOARD DRAWS THAT THIS DELIBERATELY DOES NOT:
 *   • the word BUY under the dial, and the SELL/BUY end-labels on it. This
 *     product never renders a directive. The dial ships — it is a real,
 *     drawn object and the owner asked for it — but it reads WEAK → STRONG,
 *     and the verdict under it is the scorecard's own compliance vocabulary
 *     (Strong / Solid / Mixed / Weak, `verdictLabel` in lib/research/grades).
 *   • "PATTERN DETECTED · Ascending Triangle · 72% historical follow-through".
 *     There is no pattern detector behind this app and no follow-through
 *     statistic to publish, so the card is out rather than mocked up. When a
 *     detector exists it drops into the same slot.
 *
 * EVERY NUMBER IS DERIVED FROM DATA THIS PAGE ALREADY HAS — the 2Y daily
 * closes from /api/market/bars and the `momentum` block of the research
 * aggregate. Nothing here calls a new service and nothing is interpolated:
 *   dial       → the share of the checks below that a name actually passes
 *   RSI        → momentum.rsi14 (aggregate)
 *   MACD       → 12/26/9 EMAs over the same closes, computed client-side
 *   key levels → rolling 60-day and 252-day extremes of the close series
 *   MA cards   → close vs its own 20 / 50 / 200-day simple average
 *   rel. vol   → momentum.volRatio (screener_metrics' 20-day average)
 * A measure whose source has not answered renders "—", never a stand-in.
 */

import { useEffect, useMemo, useState } from "react";
import { fetchBars, type MarketBar } from "@/lib/market/client";
import { verdictLabel } from "@/lib/research/grades";
import type { MomentumStats } from "@/lib/research/types";
import { BoardFoot, Card, CardLabel, HalfGauge, StatCard } from "@/components/research/board";

function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  let prev = values[0];
  const out = [prev];
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/* ── The checks behind the dial ───────────────────────────────────────────
   Each is a plain, checkable statement about the tape. `state` is null when
   the check's own input is missing, and a null check is EXCLUDED from the
   count rather than counted as a miss — a name with 40 days of history is not
   "failing" the 200-day test, it simply cannot take it. */
interface Signal {
  label: string;
  state: boolean | null;
}

export default function PriceTechnicals({
  symbol,
  momentum,
  bars: providedBars,
}: {
  symbol: string;
  momentum: MomentumStats;
  /** Pre-loaded 2Y bars from the page (avoids a duplicate fetch). */
  bars?: MarketBar[];
}) {
  const [fetched, setFetched] = useState<MarketBar[] | null>(null);
  const hasProvided = providedBars != null && providedBars.length > 0;
  const bars: MarketBar[] | null = hasProvided ? providedBars! : fetched;

  useEffect(() => {
    if (hasProvided) return;
    let live = true;
    fetchBars(symbol, "2y").then((b) => {
      if (live) setFetched(b);
    });
    return () => {
      live = false;
    };
  }, [symbol, hasProvided]);

  const closes = useMemo(() => (bars || []).map((b) => b.c), [bars]);
  const last = closes.length > 0 ? closes[closes.length - 1] : null;

  const ma20 = useMemo(() => sma(closes, 20), [closes]);
  const ma50 = useMemo(() => sma(closes, 50), [closes]);
  const ma200 = useMemo(() => sma(closes, 200), [closes]);

  /* MACD — the standard 12/26/9. The histogram is the last eight readings, so
     the card shows the same shape the board draws, and the "cross" chip states
     the CURRENT relationship rather than predicting the next one. */
  const macd = useMemo(() => {
    if (closes.length < 35) return null;
    const e12 = ema(closes, 12);
    const e26 = ema(closes, 26);
    const line = e12.map((v, i) => v - e26[i]);
    const signal = ema(line.slice(25), 9);
    const offset = line.length - signal.length;
    const hist = line.slice(offset).map((v, i) => v - signal[i]);
    const tail = hist.slice(-8);
    const now = tail[tail.length - 1];
    const prev = tail.length >= 2 ? tail[tail.length - 2] : null;
    const crossed = prev != null && Math.sign(prev) !== Math.sign(now);
    return { tail, above: now >= 0, crossed };
  }, [closes]);

  /* Key levels — rolling extremes of the close series. Named for what they
     literally are, because "R2" without a definition is a number with no
     provenance. The board's geometry is kept: resistances dashed above, the
     live mark on a solid brand rule, supports dashed below. */
  const levels = useMemo(() => {
    if (closes.length < 40 || last == null) return null;
    const w60 = closes.slice(-60);
    const w252 = closes.slice(-252);
    const rows = [
      { label: "52-week high", v: Math.max(...w252), side: "up" as const },
      { label: "60-day high", v: Math.max(...w60), side: "up" as const },
      { label: "60-day low", v: Math.min(...w60), side: "down" as const },
      { label: "52-week low", v: Math.min(...w252), side: "down" as const },
    ];
    const above = rows.filter((r) => r.v > last).sort((a, b) => b.v - a.v).slice(0, 2);
    const below = rows.filter((r) => r.v < last).sort((a, b) => b.v - a.v).slice(0, 2);
    if (above.length === 0 && below.length === 0) return null;
    return { above, below };
  }, [closes, last]);

  /* The dial's checks. */
  const signals: Signal[] = useMemo(() => {
    const r = momentum.rsi14;
    return [
      { label: "RSI above 50", state: r == null ? null : r >= 50 },
      { label: "RSI not overbought", state: r == null ? null : r < 70 },
      {
        label: "Above the 20-day average",
        state: last == null || ma20 == null ? null : last >= ma20,
      },
      {
        label: "Above the 50-day average",
        state: last == null || ma50 == null ? null : last >= ma50,
      },
      {
        label: "Above the 200-day average",
        state: last == null || ma200 == null ? null : last >= ma200,
      },
      { label: "MACD above its signal line", state: macd == null ? null : macd.above },
      { label: "Up over the past month", state: momentum.chg1m == null ? null : momentum.chg1m > 0 },
      {
        label: "Up over the past three months",
        state: momentum.chg3m == null ? null : momentum.chg3m > 0,
      },
      {
        label: "Within 10% of the 52-week high",
        state: momentum.dist52wHigh == null ? null : Math.abs(momentum.dist52wHigh) <= 10,
      },
      {
        label: "Trading above average volume",
        state: momentum.volRatio == null ? null : momentum.volRatio >= 1,
      },
    ];
  }, [momentum, last, ma20, ma50, ma200, macd]);

  const taken = signals.filter((s) => s.state !== null);
  const passed = taken.filter((s) => s.state).length;
  // At least half the checks must be TAKEABLE before a verdict is drawn — a
  // read built on two of ten signals is not a read.
  const scored = taken.length >= 5;
  const score = scored ? (passed / taken.length) * 100 : null;
  const verdict = score == null ? null : verdictLabel(score);

  const rsi = momentum.rsi14;
  const loading = bars == null;

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Card className="h-[104px] motion-safe:animate-pulse">
          <span className="sr-only">Reading the tape</span>
        </Card>
        <div className="flex gap-2.5">
          <Card radius="sm" className="h-[92px] flex-1 motion-safe:animate-pulse" />
          <Card radius="sm" className="h-[92px] flex-1 motion-safe:animate-pulse" />
        </div>
        <Card radius="md" className="h-[188px] motion-safe:animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── THE DIAL ───────────────────────────────────────────────────────
          Weak → Strong. There is no BUY on this dial and no SELL under it. */}
      <Card className="flex items-center gap-4 p-4">
        <HalfGauge
          value={score == null ? null : score / 100}
          width={110}
          leftLabel="Weak"
          rightLabel="Strong"
          ariaLabel={
            verdict
              ? `Technical picture: ${verdict}, ${passed} of ${taken.length} signals constructive`
              : "Technical picture not available"
          }
        />
        <div className="min-w-0 flex-1">
          <CardLabel>Technical picture</CardLabel>
          <p
            className={`mt-1.5 font-display text-[22px] font-extrabold leading-none tracking-tight ${
              verdict == null ? "text-soft" : "text-ink"
            }`}
          >
            {verdict ?? "Not enough history"}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-soft">
            {verdict ? (
              <>
                <span className="font-bold text-ink">
                  {passed} of {taken.length}
                </span>{" "}
                trend and momentum signals are constructive
              </>
            ) : (
              "This name doesn't have enough price history yet for a technical read."
            )}
          </p>
        </div>
      </Card>

      {/* ── RSI + MACD ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2.5">
        <Card radius="sm" className="min-w-0 flex-1 px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <CardLabel className="tracking-[0.12em]">RSI · 14D</CardLabel>
            <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">
              {rsi == null ? "—" : Math.round(rsi)}
            </span>
          </div>
          <div
            className="relative mt-2.5 h-2 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--color-price-up) 0%, #D99A00 55%, var(--color-price-down) 100%)",
              opacity: rsi == null ? 0.35 : 1,
            }}
          >
            {rsi != null && (
              <span
                className="absolute -top-[3px] h-3.5 w-[3px] rounded-sm bg-ink"
                style={{ left: `calc(${Math.max(0, Math.min(100, rsi))}% - 1.5px)` }}
                aria-hidden
              />
            )}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[8px] text-soft">
            <span>30</span>
            <span>70</span>
          </div>
        </Card>

        <Card radius="sm" className="min-w-0 flex-1 px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <CardLabel className="tracking-[0.12em]">MACD</CardLabel>
            <span
              className={`font-mono text-[10px] font-semibold ${
                macd == null
                  ? "text-soft"
                  : macd.above
                    ? "text-price-up"
                    : "text-price-down"
              }`}
            >
              {macd == null
                ? "—"
                : macd.crossed
                  ? macd.above
                    ? "CROSS ▲"
                    : "CROSS ▼"
                  : macd.above
                    ? "ABOVE"
                    : "BELOW"}
            </span>
          </div>
          <div className="mt-2.5 flex h-[26px] items-end gap-[2.5px]" aria-hidden>
            {macd
              ? (() => {
                  const peak = Math.max(...macd.tail.map((v) => Math.abs(v)), 1e-9);
                  return macd.tail.map((v, i) => (
                    <span
                      key={i}
                      className={`min-w-0 flex-1 rounded-[2px] ${
                        v >= 0 ? "bg-price-up" : "bg-price-down"
                      }`}
                      style={{
                        height: `${Math.max(8, (Math.abs(v) / peak) * 100)}%`,
                        opacity: 0.35 + 0.65 * (Math.abs(v) / peak),
                      }}
                    />
                  ));
                })()
              : Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className="min-w-0 flex-1 rounded-[2px] bg-sand" style={{ height: "20%" }} />
                ))}
          </div>
        </Card>
      </div>

      {/* ── KEY LEVELS ─────────────────────────────────────────────────────── */}
      {levels && last != null && (
        <Card radius="md" className="px-4 py-3.5">
          <CardLabel tone="brand">Key levels</CardLabel>
          <div className="mt-3 space-y-3.5">
            {levels.above.map((r) => (
              <LevelRow key={r.label} label={r.label} value={r.v} tone="down" />
            ))}
            <div className="flex items-center gap-2.5">
              <span className="w-[58px] shrink-0 rounded bg-volt-500 py-0.5 text-center font-mono text-[10px] font-bold tabular-nums text-[#1A1614]">
                {last.toFixed(2)}
              </span>
              <span
                className="h-[3px] min-w-0 flex-1 rounded-full bg-volt-500"
                style={{ boxShadow: "0 0 8px rgba(255,122,26,.35)" }}
                aria-hidden
              />
            </div>
            {levels.below.map((r) => (
              <LevelRow key={r.label} label={r.label} value={r.v} tone="up" />
            ))}
          </div>
          <p className="mt-3.5 text-[10.5px] leading-snug text-soft">
            Levels are the highest and lowest closes over the past 60 sessions and
            the past year — not targets.
          </p>
        </Card>
      )}

      {/* ── THE FOUR MEASURES ──────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <StatCard
          value={maText(last, ma20)}
          label="vs 20-day avg"
          tone={maTone(last, ma20)}
        />
        <StatCard
          value={maText(last, ma50)}
          label="vs 50-day avg"
          tone={maTone(last, ma50)}
        />
        <StatCard
          value={maText(last, ma200)}
          label="vs 200-day avg"
          tone={maTone(last, ma200)}
        />
        <StatCard
          value={momentum.volRatio == null ? "—" : `${momentum.volRatio.toFixed(1)}×`}
          label="Rel. volume"
          tone={momentum.volRatio == null ? "ink" : "brand"}
        />
      </div>

      <BoardFoot>Technicals refresh every 15 min · Not investment advice</BoardFoot>
    </div>
  );
}

/** "▲ 4.1%" above the average, "▼ 2.0%" below it, "—" when either is missing. */
function maText(price: number | null, avg: number | null): string {
  if (price == null || avg == null || avg === 0) return "—";
  const pct = ((price - avg) / avg) * 100;
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`;
}

function maTone(price: number | null, avg: number | null): "ink" | "up" | "down" {
  if (price == null || avg == null) return "ink";
  return price >= avg ? "up" : "down";
}

/** One dashed level rule — resistance above the mark, support below it. */
function LevelRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "up" | "down";
}) {
  const col = tone === "up" ? "var(--color-price-up)" : "var(--color-price-down)";
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`w-[58px] shrink-0 font-mono text-[10px] tabular-nums ${
          tone === "up" ? "text-price-up" : "text-price-down"
        }`}
        title={label}
      >
        {value.toFixed(2)}
      </span>
      <span
        className="h-[2px] min-w-0 flex-1"
        style={{
          background: `repeating-linear-gradient(90deg, color-mix(in srgb, ${col} 45%, transparent) 0 8px, transparent 8px 14px)`,
        }}
        aria-hidden
      />
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
        {label}
      </span>
    </div>
  );
}
