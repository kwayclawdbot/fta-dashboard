"use client";

/**
 * Cheat Code App — interactive / animated primitives (client-only).
 * Split from ui.tsx because these need state, effects, or dynamic imports.
 * Brand law: orange = brand/live only · green/pink = market truth · tokens only.
 */
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ── SubTabs — controlled pill row (FEED · CIRCLES · LIVE) ─────────────────── */

/**
 * Sub-tab chips under a script title. Active = orange fill with dark ink,
 * inactive = card2 ghost. Fully controlled: parent owns `value`.
 */
export function SubTabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} role="tablist">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className="rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors"
            style={
              active
                ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
                : {
                    background: "var(--cc-card2)",
                    color: "var(--cc-soft)",
                    border: "1px solid var(--cc-line)",
                  }
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── CountdownChip — ⏳ live-ticking mono countdown to a target ────────────── */

function fmtRemaining(ms: number): { text: string; done: boolean } {
  if (ms <= 0) return { text: "0h 0m", done: true };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return { text: `${d}d ${h}h ${m}m`, done: false };
  if (h > 0) return { text: `${h}h ${m}m ${sec}s`, done: false };
  return { text: `${m}m ${sec}s`, done: false };
}

/**
 * Countdown chip — ⏳ Xd Xh Xm mono, live counts down to `target` (never
 * static). SSR-safe: renders a stable first value, then ticks on the client.
 * Respects prefers-reduced-motion only for decorative pulse, not the count.
 */
export function CountdownChip({
  target,
  prefix = "",
  className = "",
  bare = false,
}: {
  target: Date | string | number;
  prefix?: string;
  className?: string;
  /** Drop the pill chrome (bg/border/padding) — inline ⏳ + mono, for meta rows. */
  bare?: boolean;
}) {
  const targetMs =
    target instanceof Date ? target.getTime() : new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Before hydration `now` is null → render from targetMs with a neutral base so
  // server and first client paint match (no layout shift, no hydration warning).
  const remaining = now === null ? targetMs - targetMs : targetMs - now;
  const { text, done } = fmtRemaining(remaining);

  return (
    <span
      className={
        bare
          ? `inline-flex items-center gap-1 ${className}`
          : `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${className}`
      }
      style={
        bare
          ? undefined
          : { background: "var(--cc-card2)", border: "1px solid var(--cc-line)" }
      }
    >
      <span aria-hidden style={{ fontSize: bare ? 9 : 11 }}>
        ⏳
      </span>
      <span
        className={`font-[family-name:var(--font-plex-mono)] font-semibold tabular-nums ${bare ? "text-[9px]" : "text-[11px]"}`}
        style={{ color: done ? "var(--cc-dim)" : bare ? "var(--cc-orange-ink)" : "var(--cc-ink)" }}
      >
        {prefix}
        {now === null ? "—" : done ? "closed" : text}
      </span>
    </span>
  );
}

/* ── ZoneChart — lightweight-charts wrapper w/ entry + invalidation bands ──── */

export type ZoneLevel = { price: number; label: string; kind?: "level" | "entry" | "target" | "stop" };
export type ZoneBand = { low: number; high: number };

export type ZoneChartProps = {
  /** Price series (close values, oldest→newest). Absent → static SVG fallback. */
  series?: number[];
  /** Green-tinted accumulation / entry band. */
  entry?: ZoneBand;
  /** Pink-tinted invalidation band (thesis is wrong below/above here). */
  invalidation?: ZoneBand;
  /** Dashed horizontal level lines w/ mono labels. */
  levels?: ZoneLevel[];
  height?: number;
  className?: string;
};

/**
 * ZoneChart — board-19 setup chart. Renders entry band (green tint),
 * invalidation band (pink tint), dashed level lines and mono labels. When
 * `series` data is present it mounts lightweight-charts (dynamic import, v5
 * addSeries API) and overlays the tinted bands via price→coordinate; when data
 * is absent it draws a self-contained static SVG with the same visual grammar
 * (graceful fallback). prefers-reduced-motion is honoured (no fit animation).
 */
export function ZoneChart({
  series,
  entry,
  invalidation,
  levels = [],
  height = 200,
  className = "",
}: ZoneChartProps) {
  const hasData = Array.isArray(series) && series.length >= 2;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    if (!hasData || !containerRef.current) return;
    let disposed = false;
    let chart: import("lightweight-charts").IChartApi | null = null;
    let cleanupResize: (() => void) | null = null;

    (async () => {
      const lc = await import("lightweight-charts");
      if (disposed || !containerRef.current) return;
      const host = containerRef.current;
      const cssVar = (name: string): string => {
        const v = getComputedStyle(host).getPropertyValue(name).trim();
        return v || "#888";
      };
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      chart = lc.createChart(containerRef.current, {
        height,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: cssVar("--cc-dim"),
          fontFamily: "var(--font-plex-mono), monospace",
          fontSize: 9,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: cssVar("--cc-line") },
        },
        rightPriceScale: { borderColor: cssVar("--cc-line") },
        timeScale: { visible: false, borderColor: cssVar("--cc-line") },
        crosshair: { horzLine: { visible: false }, vertLine: { visible: false } },
        handleScroll: false,
        handleScale: false,
      });

      const s = chart.addSeries(lc.AreaSeries, {
        lineColor: cssVar("--cc-orange"),
        lineWidth: 2,
        topColor: "rgba(255,122,26,0.14)",
        bottomColor: "rgba(255,122,26,0.0)",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(
        series!.map((v, i) => ({
          time: (i + 1) as import("lightweight-charts").UTCTimestamp,
          value: v,
        })),
      );

      for (const lv of levels) {
        s.createPriceLine({
          price: lv.price,
          color:
            lv.kind === "stop"
              ? cssVar("--cc-down")
              : lv.kind === "target"
                ? cssVar("--cc-up")
                : cssVar("--cc-soft"),
          lineWidth: 1,
          lineStyle: lc.LineStyle.Dashed,
          axisLabelVisible: true,
          title: lv.label,
        });
      }

      if (!reduce) chart.timeScale().fitContent();
      else chart.timeScale().fitContent();

      const drawBands = () => {
        if (!overlayRef.current || !chart) return;
        const w = containerRef.current?.clientWidth ?? 0;
        overlayRef.current.innerHTML = "";
        const band = (b: ZoneBand, color: string) => {
          const yHigh = s.priceToCoordinate(b.high);
          const yLow = s.priceToCoordinate(b.low);
          if (yHigh == null || yLow == null) return;
          const top = Math.min(yHigh, yLow);
          const h = Math.abs(yLow - yHigh);
          const el = document.createElement("div");
          el.style.cssText = `position:absolute;left:0;width:${w}px;top:${top}px;height:${h}px;background:${color};pointer-events:none;`;
          overlayRef.current!.appendChild(el);
        };
        if (entry) band(entry, "rgba(74,222,128,0.12)");
        if (invalidation) band(invalidation, "rgba(244,114,182,0.12)");
      };
      drawBands();
      chart.timeScale().subscribeVisibleLogicalRangeChange(drawBands);

      const ro = new ResizeObserver(() => {
        chart?.applyOptions({ width: containerRef.current?.clientWidth });
        drawBands();
      });
      ro.observe(containerRef.current);
      cleanupResize = () => ro.disconnect();
      setChartReady(true);
    })();

    return () => {
      disposed = true;
      cleanupResize?.();
      chart?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, height, series]);

  if (hasData) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-[var(--cc-line)] bg-[var(--cc-card)] ${className}`}
        style={{ height }}
      >
        <div ref={containerRef} className="absolute inset-0" />
        <div ref={overlayRef} className="pointer-events-none absolute inset-0" />
        {!chartReady && (
          <div className="absolute inset-0 grid place-items-center">
            <span
              className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.16em]"
              style={{ color: "var(--cc-dim)" }}
            >
              loading chart…
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <ZoneChartStatic
      entry={entry}
      invalidation={invalidation}
      levels={levels}
      height={height}
      className={className}
    />
  );
}

/** Static SVG zone chart — the no-data fallback (same visual grammar). */
function ZoneChartStatic({
  entry,
  invalidation,
  levels = [],
  height,
  className = "",
}: Omit<ZoneChartProps, "series">) {
  const W = 320;
  const H = height ?? 200;
  const pad = 10;

  // Derive a price domain from whatever levels/bands we were given.
  const prices = [
    ...levels.map((l) => l.price),
    ...(entry ? [entry.low, entry.high] : []),
    ...(invalidation ? [invalidation.low, invalidation.high] : []),
  ];
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 100;
  const span = max - min || 1;
  const y = (p: number) =>
    pad + (1 - (p - min) / span) * (H - pad * 2);

  // A gentle demo path so the fallback still reads as a chart.
  const pts = Array.from({ length: 24 }, (_, i) => {
    const t = i / 23;
    const base = min + span * (0.35 + 0.32 * t);
    const wobble = Math.sin(t * 7) * span * 0.06;
    return { x: pad + t * (W - pad * 2), y: y(base + wobble) };
  });
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const bandRect = (b: ZoneBand, fill: string, key: string) => {
    const top = Math.min(y(b.high), y(b.low));
    const h = Math.abs(y(b.low) - y(b.high));
    return (
      <rect key={key} x={0} y={top} width={W} height={h} fill={fill} />
    );
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-[var(--cc-line)] bg-[var(--cc-card)] ${className}`}
    >
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: "block", height: H }}
        role="img"
        aria-label="Setup zone chart"
      >
        {entry && bandRect(entry, "rgba(74,222,128,0.12)", "entry")}
        {invalidation &&
          bandRect(invalidation, "rgba(244,114,182,0.12)", "inval")}
        {levels.map((lv, i) => {
          const c =
            lv.kind === "stop"
              ? "var(--cc-down)"
              : lv.kind === "target"
                ? "var(--cc-up)"
                : "var(--cc-soft)";
          return (
            <g key={i}>
              <line
                x1={0}
                x2={W}
                y1={y(lv.price)}
                y2={y(lv.price)}
                stroke={c}
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.7}
              />
              <text
                x={W - 4}
                y={y(lv.price) - 3}
                textAnchor="end"
                fontSize={8}
                fontFamily="var(--font-plex-mono), monospace"
                fill={c}
              >
                {lv.label}
              </text>
            </g>
          );
        })}
        <path
          d={d}
          fill="none"
          stroke="var(--cc-orange)"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
