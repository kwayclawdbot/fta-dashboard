"use client";

import { useEffect, useId, useState } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   ALERT LEVEL CHART — the marked-up "plan on the chart" object, shared by the
   overview's SetupGraphCard (compact) and the /alerts/s/[id] hero (big).

   VISUAL LANGUAGE (owner directive, 2026-08-10): the chart reads like the
   levels-marked chart members know from the SMS alerts — the price action
   with the plan drawn ON it: CANDLESTICK bars on the intraday tf feed
   (/api/market/bars?tf=15m|1h carries real OHLC — the ClubStockHead candle
   renderer, copied not reinvented), clearly labelled ENTRY / STOP / TARGET
   horizontal level lines, a shaded RISK zone between entry and stop (price-
   down tint) and a shaded REWARD zone between entry and target (price-up
   tint). The SMS pipeline itself ships those levels as text lines
   ("Entry: $X · Target: $Y · Stop: $Z"); this is that plan, drawn.

   HONESTY LAW (inherited from the hub): every line is a STORED number — a
   missing leg is a missing line and a missing zone, never an invented one.
   Real bars only: no bars → a stated mono line, never a fake curve. A
   closes-only series (the daily 1M window) draws the honest line, not
   pretend candles.
   ══════════════════════════════════════════════════════════════════════════ */

/** One shape covers both feeds — o/h/l absent means "closes-only, draw the line". */
interface OhlcBar {
  t: number;
  o?: number;
  h?: number;
  l?: number;
  c: number;
  v?: number;
}

/** 15m / 1h ride the intraday OHLC path (candles); "1m" is the daily-close month. */
export type AlertChartTf = "15m" | "1h" | "1m";

/** Most-recent bar counts per tf — keeps candles readable at card width. */
const TF_SLICE: Record<AlertChartTf, number> = { "15m": 52, "1h": 70, "1m": 0 };

export const ALERT_CHART_TFS: { key: AlertChartTf; label: string }[] = [
  { key: "15m", label: "15M" },
  { key: "1h", label: "1H" },
  { key: "1m", label: "1M" },
];

/* On-demand bars, deduplicated through a module promise cache so the same
   symbol+tf never refetches across cards or revisits (SetupGraphCard's
   monthBarCache pattern, generalized). */
const barCache = new Map<string, Promise<OhlcBar[]>>();

function loadBars(symbol: string, tf: AlertChartTf): Promise<OhlcBar[]> {
  const key = `${symbol.toUpperCase()}:${tf}`;
  let p = barCache.get(key);
  if (!p) {
    const url =
      tf === "1m"
        ? `/api/market/bars?symbol=${encodeURIComponent(symbol)}&range=1m`
        : `/api/market/bars?symbol=${encodeURIComponent(symbol)}&tf=${tf}`;
    p = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const bars = ((d?.bars as OhlcBar[] | undefined) ?? []).filter(
          (b) => typeof b?.c === "number" && Number.isFinite(b.c)
        );
        const cap = TF_SLICE[tf];
        return cap > 0 && bars.length > cap ? bars.slice(-cap) : bars;
      })
      .catch(() => [] as OhlcBar[]);
    barCache.set(key, p);
  }
  return p;
}

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBound(v: number): string {
  return v >= 1000 ? v.toFixed(0) : v.toFixed(2);
}

export default function AlertLevelChart({
  symbol,
  entry,
  stop,
  target,
  tf = "1h",
  size = "compact",
}: {
  symbol: string;
  entry: number | null;
  stop: number | null;
  target: number | null;
  /** Chart window: 15m / 1h intraday candles, "1m" daily-close line. */
  tf?: AlertChartTf;
  /** compact = the overview card's 120px plot · hero = the detail page's 200px. */
  size?: "compact" | "hero";
}) {
  const gid = `alc-${useId().replace(/:/g, "")}`;
  // Bars kept PER symbol+tf so switching windows resets to the loading state
  // by derivation (no synchronous setState inside the effect).
  // absent key = still loading; [] = the feed had nothing for this window.
  const [loaded, setLoaded] = useState<Record<string, OhlcBar[]>>({});
  const barKey = `${symbol.toUpperCase()}:${tf}`;
  const bars: OhlcBar[] | null = loaded[barKey] ?? null;

  useEffect(() => {
    let live = true;
    const key = `${symbol.toUpperCase()}:${tf}`;
    loadBars(symbol, tf).then((b) => {
      if (!live) return;
      setLoaded((prev) => (prev[key] ? prev : { ...prev, [key]: b }));
    });
    return () => {
      live = false;
    };
  }, [symbol, tf]);

  const hero = size === "hero";
  const H = hero ? 200 : 120;
  const plotClass = hero ? "h-[200px]" : "h-[120px]";

  if (bars === null) {
    return (
      <div className={`${plotClass} rounded-[12px] bg-sand/60 motion-safe:animate-pulse`}>
        <span className="sr-only">Loading the price series</span>
      </div>
    );
  }
  if (bars.length < 2) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        No price series for this window
      </p>
    );
  }

  const W = hero ? 520 : 332;
  const padY = 8;
  // Candles only when the series genuinely carries OHLC (the intraday feed).
  const candle =
    bars.filter((b) => b.o != null && b.h != null && b.l != null).length >= bars.length * 0.9;

  const lows = bars.map((b) => (candle ? (b.l as number) : b.c));
  const highs = bars.map((b) => (candle ? (b.h as number) : b.c));
  // y-domain includes the stored levels so every drawn line and zone sits inside.
  let lo = Math.min(...lows);
  let hi = Math.max(...highs);
  for (const v of [entry, stop, target]) {
    if (v == null) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  const y = (v: number) => padY + (H - padY * 2) * (1 - (v - lo) / span);
  const n = bars.length;
  const step = W / n;

  const closes = bars.map((b) => b.c);
  const up = closes[closes.length - 1] >= closes[0];
  const stroke = up ? "var(--color-price-up)" : "var(--color-price-down)";

  const linePts = bars
    .map((b, i) => `${(i * step + step / 2).toFixed(1)},${y(b.c).toFixed(1)}`)
    .join(" ");
  const area = `${(step / 2).toFixed(1)},${H} ${linePts} ${(W - step / 2).toFixed(1)},${H}`;

  // The stored levels this alert genuinely carries — nothing else is drawn.
  const levels: { v: number; label: string; color: string; text: string }[] = [];
  if (entry != null)
    levels.push({ v: entry, label: "ENTRY", color: "var(--ink)", text: "text-ink" });
  if (stop != null)
    levels.push({
      v: stop,
      label: "STOP",
      color: "var(--color-price-down)",
      text: "text-price-down",
    });
  if (target != null)
    levels.push({
      v: target,
      label: "TARGET",
      color: "var(--color-price-up)",
      text: "text-price-up",
    });

  // The shaded plan zones — only when BOTH legs of a zone are stored.
  const zones: { from: number; to: number; fill: string }[] = [];
  if (entry != null && stop != null && stop !== entry)
    zones.push({ from: entry, to: stop, fill: "var(--color-price-down)" });
  if (entry != null && target != null && target !== entry)
    zones.push({ from: entry, to: target, fill: "var(--color-price-up)" });

  // The right-hand rail — four values off the drawn range, as the mockup rails.
  const axis = [hi, lo + (span * 2) / 3, lo + span / 3, lo];

  // Session stamps read off the bars drawn: times inside a session, dates beyond.
  const stamp = (t: number) =>
    tf === "15m"
      ? new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });

  const bodyW = Math.max(1.4, step * 0.55);
  const wickW = Math.max(0.7, step * 0.16);

  const levelWords = levels.map((l) => `${l.label.toLowerCase()} ${money(l.v)}`).join(", ");

  return (
    <>
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className={`block w-full ${plotClass}`}
            role="img"
            aria-label={`${symbol.toUpperCase()} price ${candle ? "candles" : "trend"}${
              levelWords ? ` with the plan's ${levelWords} marked` : ""
            }`}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.14" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* dotted grid — the mockup's faint horizontals */}
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1="0"
                x2={W}
                y1={padY + (H - padY * 2) * f}
                y2={padY + (H - padY * 2) * f}
                stroke="var(--color-sand)"
                strokeWidth="1"
                strokeDasharray="1 5"
              />
            ))}

            {/* the plan's shaded risk / reward zones — under the price action */}
            {zones.map((z, i) => {
              const top = Math.min(y(z.from), y(z.to));
              const bot = Math.max(y(z.from), y(z.to));
              return (
                <rect
                  key={i}
                  x="0"
                  y={top}
                  width={W}
                  height={Math.max(1, bot - top)}
                  fill={z.fill}
                  opacity="0.08"
                />
              );
            })}

            {/* the wash under the closes */}
            <polygon points={area} fill={`url(#${gid})`} />

            {candle ? (
              bars.map((b, i) => {
                const cUp = b.c >= (b.o as number);
                const col = cUp ? "var(--color-price-up)" : "var(--color-price-down)";
                const cx = i * step + step / 2;
                const top = y(Math.max(b.o as number, b.c));
                const bot = y(Math.min(b.o as number, b.c));
                return (
                  <g key={b.t}>
                    <line
                      x1={cx}
                      x2={cx}
                      y1={y(b.h as number)}
                      y2={y(b.l as number)}
                      stroke={col}
                      strokeWidth={wickW}
                    />
                    <rect
                      x={cx - bodyW / 2}
                      y={top}
                      width={bodyW}
                      height={Math.max(1, bot - top)}
                      fill={col}
                      rx={bodyW * 0.2}
                    />
                  </g>
                );
              })
            ) : (
              <polyline
                points={linePts}
                fill="none"
                stroke={stroke}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* stored level lines — dashed, one per leg the alert carries */}
            {levels.map((l) => (
              <line
                key={l.label}
                x1="0"
                x2={W}
                y1={y(l.v)}
                y2={y(l.v)}
                stroke={l.color}
                strokeOpacity={l.label === "ENTRY" ? 0.55 : 0.75}
                strokeWidth="1.4"
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {/* level tags — HTML overlays so the text never distorts. Close
              levels get their tags nudged apart (greedy top-down pass) so
              ENTRY/STOP/TARGET never stack over one another; the dashed
              lines themselves stay at the true prices. */}
          {(() => {
            const minSep = hero ? 8 : 13; // % of plot height per tag row
            const placed = levels
              .map((l) => ({ ...l, top: (y(l.v) / H) * 100 }))
              .sort((a, b) => a.top - b.top);
            for (let i = 1; i < placed.length; i++) {
              if (placed[i].top - placed[i - 1].top < minSep)
                placed[i].top = placed[i - 1].top + minSep;
            }
            // If the pass pushed the stack past the plot, walk it back up.
            const over = placed.length ? placed[placed.length - 1].top - 96 : 0;
            if (over > 0) for (const p of placed) p.top -= over;
            return placed.map((l) => (
              <span
                key={l.label}
                aria-hidden
                className={`absolute left-1 -translate-y-1/2 rounded-[5px] bg-card/90 px-1 py-px font-mono font-semibold tabular-nums leading-[1.2] ${
                  hero ? "text-[9.5px]" : "text-[8.5px]"
                } ${l.text}`}
                style={{ top: `${Math.max(4, l.top)}%` }}
              >
                {l.label} {money(l.v)}
              </span>
            ));
          })()}
        </div>

        {/* the price rail on the right, as drawn */}
        <div
          className="flex shrink-0 flex-col justify-between py-1 text-right font-mono text-[9.5px] tabular-nums text-soft"
          aria-hidden
        >
          {axis.map((v, i) => (
            <span key={i}>{fmtBound(v)}</span>
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex justify-between pr-9 font-mono text-[9.5px] tabular-nums text-soft">
        <span>{stamp(bars[0].t)}</span>
        <span>{stamp(bars[n - 1].t)}</span>
      </div>
    </>
  );
}
