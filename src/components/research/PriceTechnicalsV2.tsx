"use client";

/**
 * TICKER · TECHNICALS — V2 (cc lane, board 12 anatomy)
 *
 * A drop-in twin of `PriceTechnicals` (v1). SAME props, SAME real data, SAME
 * every-measure-is-derived honesty — re-skinned out of the warm-gold `board.tsx`
 * chrome into the Cheat Code app `cc` artboard system (dark/light --cc-* tokens,
 * IBM Plex Mono data voice, cc primitives). Board 12's anatomy, object for
 * object:
 *
 *   ┌ half-gauge ──┬ TECHNICAL PICTURE / verdict / N of M signals ─────────┐
 *   ┌ RSI · 14D ─────────────┐ ┌ MACD · cross ────────────────────┐
 *   ┌ KEY LEVELS — LevelLadder: resistances above, live mark, supports ────┐
 *   [ vs MA20 ] [ vs MA50 ] [ vs MA200 ] [ Rel. volume ]
 *   Technicals refresh every 15 min · Not investment advice
 *
 * WHAT THIS DELIBERATELY DOES NOT DRAW (identical to v1):
 *   • the board's literal "BUY" verdict + SELL/BUY end-labels on the dial. This
 *     product never renders a directive — the dial reads WEAK → STRONG and the
 *     verdict beneath it is the scorecard's own compliance vocabulary
 *     (Strong / Solid / Mixed / Weak, `verdictLabel`).
 *   • the board's "8 of 12 indicators bullish". There is no 12-indicator
 *     battery behind this app. There are TEN checkable statements about the tape
 *     (`signals` below), and only the ones whose own input has landed are
 *     counted — the card shows the HONEST "{passed} of {takeable}".
 *   • "PATTERN DETECTED · Ascending Triangle · 72% follow-through". No detector,
 *     no statistic to publish, so the card is out rather than mocked. When a
 *     detector exists it drops into the same slot.
 *
 * EVERY NUMBER IS DERIVED FROM DATA THIS PAGE ALREADY HAS — the 2Y daily closes
 * from /api/market/bars and the `momentum` block of the research aggregate.
 * Nothing here calls a new service and nothing is interpolated:
 *   gauge      → the share of the checks below that a name actually passes
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
import { Card, Kicker, LevelLadder, type LadderRung } from "@/components/cc/ui";

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

/* ── The checks behind the gauge ──────────────────────────────────────────
   Each is a plain, checkable statement about the tape. `state` is null when
   the check's own input is missing, and a null check is EXCLUDED from the
   count rather than counted as a miss — a name with 40 days of history is not
   "failing" the 200-day test, it simply cannot take it. */
interface Signal {
  label: string;
  state: boolean | null;
}

/** Momentum when the aggregate itself hasn't landed — every check abstains. */
const NO_MOMENTUM: MomentumStats = {
  rsi14: null,
  ema20State: null,
  ema50State: null,
  dist52wHigh: null,
  dist52wLow: null,
  volRatio: null,
  gapPct: null,
  chg1d: null,
  chg5d: null,
  chg1m: null,
  chg3m: null,
};

export default function PriceTechnicalsV2({
  symbol,
  momentum = NO_MOMENTUM,
  bars: providedBars,
  barsOwned = false,
}: {
  symbol: string;
  /** Optional: the panel reads the tape on its own when the aggregate is late. */
  momentum?: MomentumStats;
  /** Pre-loaded 2Y bars from the page (avoids a duplicate fetch). */
  bars?: MarketBar[];
  /**
   * TRUE when the CALLER owns the bars lane and has already resolved it. When
   * the caller owns the lane it says so, and this panel renders what it was
   * handed instead of racing for a fourth copy of `/api/market/bars?range=2y`.
   */
  barsOwned?: boolean;
}) {
  const [fetched, setFetched] = useState<MarketBar[] | null>(null);
  const hasProvided = providedBars != null && providedBars.length > 0;
  const bars: MarketBar[] | null = useMemo(
    () => (hasProvided ? providedBars! : barsOwned ? providedBars ?? [] : fetched),
    [hasProvided, providedBars, barsOwned, fetched]
  );

  useEffect(() => {
    if (hasProvided || barsOwned) return;
    let live = true;
    fetchBars(symbol, "2y").then((b) => {
      if (live) setFetched(b);
    });
    return () => {
      live = false;
    };
  }, [symbol, hasProvided, barsOwned]);

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
     literally are. Resistances above the live mark, supports below it. */
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

    /* ONE RULE PER PRICE. When the 60-day window contains the year's extreme,
       the 60-day and 52-week rows are the SAME NUMBER — drawn once, with the
       wider window's name and the narrower one folded into the label. */
    const merged: { label: string; v: number; side: "up" | "down" }[] = [];
    for (const r of rows) {
      const twin = merged.find((m) => Math.abs(m.v - r.v) < 0.005 && m.side === r.side);
      if (twin) {
        if (!twin.label.includes("·")) twin.label = `${twin.label} · ${r.label}`;
        continue;
      }
      merged.push({ ...r });
    }

    const above = merged.filter((r) => r.v > last).sort((a, b) => b.v - a.v).slice(0, 2);
    const below = merged.filter((r) => r.v < last).sort((a, b) => b.v - a.v).slice(0, 2);
    if (above.length === 0 && below.length === 0) return null;
    return { above, below };
  }, [closes, last]);

  /* The gauge's checks. */
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
        <Card className="h-[104px] motion-safe:animate-pulse">{null}</Card>
        <div className="flex gap-2.5">
          <Card className="h-[92px] flex-1 motion-safe:animate-pulse">{null}</Card>
          <Card className="h-[92px] flex-1 motion-safe:animate-pulse">{null}</Card>
        </div>
        <Card className="h-[188px] motion-safe:animate-pulse">{null}</Card>
        <span className="sr-only">Reading the tape</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── THE GAUGE ──────────────────────────────────────────────────────
          Weak → Strong. There is no BUY on this dial and no SELL under it. */}
      <Card className="flex items-center gap-4 p-4">
        <CcHalfGauge
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
          <Kicker tone="soft">Technical picture</Kicker>
          <p
            className="cc-display mt-1.5 text-[22px] leading-none"
            style={{ color: verdict == null ? "var(--cc-soft)" : "var(--cc-ink)" }}
          >
            {verdict ?? "Not enough history"}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--cc-soft)" }}>
            {verdict ? (
              <>
                <span className="font-bold" style={{ color: "var(--cc-ink)" }}>
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
        <Card className="min-w-0 flex-1 px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`${MONO} text-[9px] font-semibold uppercase tracking-[0.12em]`} style={{ color: "var(--cc-soft)" }}>
              RSI · 14D
            </span>
            <span className={`${MONO} text-[13px] font-semibold tabular-nums`} style={{ color: "var(--cc-ink)" }}>
              {rsi == null ? "—" : Math.round(rsi)}
            </span>
          </div>
          <div
            className="relative mt-2.5 h-2 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--cc-up) 0%, var(--cc-yellow) 55%, var(--cc-down) 100%)",
              opacity: rsi == null ? 0.35 : 1,
            }}
          >
            {rsi != null && (
              <span
                className="absolute -top-[3px] h-3.5 w-[3px] rounded-sm"
                style={{
                  left: `calc(${Math.max(0, Math.min(100, rsi))}% - 1.5px)`,
                  background: "var(--cc-ink)",
                }}
                aria-hidden
              />
            )}
          </div>
          <div className={`${MONO} mt-1.5 flex justify-between text-[8px]`} style={{ color: "var(--cc-dim)" }}>
            <span>30</span>
            <span>70</span>
          </div>
        </Card>

        <Card className="min-w-0 flex-1 px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`${MONO} text-[9px] font-semibold uppercase tracking-[0.12em]`} style={{ color: "var(--cc-soft)" }}>
              MACD
            </span>
            <span
              className={`${MONO} text-[10px] font-semibold`}
              style={{
                color:
                  macd == null
                    ? "var(--cc-soft)"
                    : macd.above
                      ? "var(--cc-up)"
                      : "var(--cc-down)",
              }}
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
                      className="min-w-0 flex-1 rounded-[2px]"
                      style={{
                        background: v >= 0 ? "var(--cc-up)" : "var(--cc-down)",
                        height: `${Math.max(8, (Math.abs(v) / peak) * 100)}%`,
                        opacity: 0.35 + 0.65 * (Math.abs(v) / peak),
                      }}
                    />
                  ));
                })()
              : Array.from({ length: 8 }).map((_, i) => (
                  <span
                    key={i}
                    className="min-w-0 flex-1 rounded-[2px]"
                    style={{ background: "var(--cc-card2)", height: "20%" }}
                  />
                ))}
          </div>
        </Card>
      </div>

      {/* ── KEY LEVELS (LevelLadder primitive) ─────────────────────────────── */}
      {levels && last != null && (
        <Card className="px-4 py-3.5">
          <Kicker tone="orange">Key levels</Kicker>
          <LevelLadder className="mt-3" height={172} rungs={buildRungs(levels, last)} />
          <p className="mt-2 text-[10.5px] leading-snug" style={{ color: "var(--cc-soft)" }}>
            Levels are the highest and lowest closes over the past 60 sessions and the past year —
            not targets.
          </p>
        </Card>
      )}

      {/* ── THE FOUR MEASURES ──────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <MeasureCard value={maText(last, ma20)} label="vs 20-day avg" tone={maTone(last, ma20)} />
        <MeasureCard value={maText(last, ma50)} label="vs 50-day avg" tone={maTone(last, ma50)} />
        <MeasureCard value={maText(last, ma200)} label="vs 200-day avg" tone={maTone(last, ma200)} />
        <MeasureCard
          value={momentum.volRatio == null ? "—" : `${momentum.volRatio.toFixed(1)}×`}
          label="Rel. volume"
          tone={momentum.volRatio == null ? "ink" : "brand"}
        />
      </div>

      <p
        className="mt-5 border-t pt-3.5 text-center text-[11px] leading-relaxed"
        style={{ borderColor: "var(--cc-line)", color: "var(--cc-soft)" }}
      >
        Technicals refresh every 15 min · Not investment advice
      </p>
    </div>
  );
}

/** IBM Plex Mono family utility (cc data voice). */
const MONO = "font-[family-name:var(--font-plex-mono)]";

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

/**
 * Build the LevelLadder rungs from the real levels + the live mark. Vertical
 * `at` (0-100) is the price's position across the shown span — the geometry is
 * real distance, not decoration. Resistances (above the mark) tint pink, the
 * live mark is the orange pill, supports (below) tint green — the same colour
 * grammar v1 drew.
 */
function buildRungs(
  levels: { above: { label: string; v: number }[]; below: { label: string; v: number }[] },
  last: number
): LadderRung[] {
  const prices = [...levels.above.map((r) => r.v), last, ...levels.below.map((r) => r.v)];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const at = (p: number) => ((p - min) / span) * 100;

  const rungs: LadderRung[] = [];
  for (const r of levels.above) {
    rungs.push({ at: at(r.v), label: r.label, value: r.v.toFixed(2), tone: "var(--cc-down)" });
  }
  rungs.push({ at: at(last), label: "Last", value: last.toFixed(2), current: true });
  for (const r of levels.below) {
    rungs.push({ at: at(r.v), label: r.label, value: r.v.toFixed(2), tone: "var(--cc-up)" });
  }
  return rungs;
}

/** Board 12's four-up mini card — a mono figure over a small dim caption. */
function MeasureCard({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "ink" | "up" | "down" | "brand";
}) {
  const color =
    tone === "up"
      ? "var(--cc-up)"
      : tone === "down"
        ? "var(--cc-down)"
        : tone === "brand"
          ? "var(--cc-orange-ink)"
          : "var(--cc-ink)";
  return (
    <div
      className="min-w-0 flex-1 rounded-[12px] border px-1.5 py-2.5 text-center"
      style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)" }}
    >
      <span className={`${MONO} block text-[11px] font-semibold tabular-nums`} style={{ color }}>
        {value}
      </span>
      <span className="mt-1 block text-[8.5px] leading-tight" style={{ color: "var(--cc-dim)" }}>
        {label}
      </span>
    </div>
  );
}

/**
 * Board 12's dial, cc-skinned: a 180° arc in three bands (down · caution · up)
 * with a needle, read WEAK → STRONG. Colours are cc tokens; the needle is the
 * live score. `value == null` dims the arc and drops the needle (honest absence).
 * This never labels the dial BUY/SELL — the caller owns the end labels.
 */
function CcHalfGauge({
  value,
  width = 110,
  leftLabel,
  rightLabel,
  ariaLabel,
}: {
  value: number | null;
  width?: number;
  leftLabel?: string;
  rightLabel?: string;
  ariaLabel: string;
}) {
  const W = width;
  const stroke = Math.round(W * 0.13);
  const cx = W / 2;
  const rr = (W - stroke) / 2;
  const H = Math.round(rr + stroke / 2 + 12);
  const cy = H - 12;

  const bands: { col: string; from: number; to: number }[] = [
    { col: "var(--cc-down)", from: 0, to: 0.34 },
    { col: "var(--cc-yellow)", from: 0.34, to: 0.5 },
    { col: "var(--cc-up)", from: 0.5, to: 1 },
  ];
  const arc = (from: number, to: number) => {
    const a0 = Math.PI - from * Math.PI;
    const a1 = Math.PI - to * Math.PI;
    const p0 = { x: cx + rr * Math.cos(a0), y: cy - rr * Math.sin(a0) };
    const p1 = { x: cx + rr * Math.cos(a1), y: cy - rr * Math.sin(a1) };
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${rr} ${rr} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  };

  const v = value == null ? null : Math.max(0, Math.min(1, value));
  const na = v == null ? null : Math.PI - v * Math.PI;
  const nLen = rr - stroke * 0.1;

  return (
    <div className="shrink-0" style={{ width: W }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {bands.map((b, i) => (
          <path
            key={i}
            d={arc(b.from, b.to)}
            fill="none"
            stroke={b.col}
            strokeWidth={stroke}
            opacity={v == null ? 0.28 : 1}
          />
        ))}
        {na != null && (
          <>
            <line
              x1={cx}
              y1={cy}
              x2={(cx + nLen * Math.cos(na)).toFixed(2)}
              y2={(cy - nLen * Math.sin(na)).toFixed(2)}
              stroke="var(--cc-ink)"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={3.5} fill="var(--cc-ink)" />
          </>
        )}
      </svg>
      {(leftLabel || rightLabel) && (
        <div
          className={`${MONO} -mt-1.5 flex justify-between text-[7.5px] uppercase tracking-[0.08em]`}
          style={{ color: "var(--cc-soft)" }}
        >
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}
