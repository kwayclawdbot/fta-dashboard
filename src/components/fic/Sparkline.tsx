"use client";

import { useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "@/lib/motion";
import { fetchBars, type MarketBar } from "@/lib/market/client";

/**
 * Lightweight LOCAL price sparkline drawn from /api/market/bars (Polygon daily
 * closes, cached ~15 min). Replaces the TradingView mini-symbol iframes — a
 * board of 30 companies used to inject 30 iframes; this is one tiny inline SVG
 * each, key-free (the Polygon key stays on the server).
 *
 * Lazy: only fetches once the card scrolls into view (IntersectionObserver).
 * The line draws in on reveal (stroke-dashoffset) unless reduced-m.
 * Graceful: renders nothing tall/broken if data is missing.
 *
 * COLOUR — tinted by the SIGN OF THE SESSION CHANGE, off the canonical price
 * tokens. It used to hardcode #16A34A / #DC2626: the raw Tailwind ramp frozen
 * into the component, which meant the one chart on the surface was the one
 * thing that did not follow the market ramp when the theme or the mode
 * changed — it kept a light-theme green on the dark page, where that value
 * measures under 4:1. `var(--price-up)` / `var(--price-down)` carry the right
 * ramp step per theme and per mode with nothing written at the call site.
 *
 * FLAT IS ITS OWN ANSWER. `up` was computed with `>=`, which quietly painted
 * an unchanged window green — a gain that never happened. A window that ends
 * where it started now draws in the neutral ink and says so in its label.
 */
export default function Sparkline({
  symbol,
  height = 48,
  className = "",
}: {
  symbol: string;
  height?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [bars, setBars] = useState<MarketBar[] | null>(null);
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = hostRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const ctrl = new AbortController();
    fetchBars(symbol, "3m", ctrl.signal).then((b) => {
      if (ctrl.signal.aborted) return;
      if (b.length >= 2) setBars(b);
      else setFailed(true);
    });
    return () => ctrl.abort();
  }, [visible, symbol]);

  const W = 240;
  const H = height;
  const pad = 3;

  let path = "";
  /** −1 down · 0 flat · 1 up — the sign of the change over the window. */
  let dir: -1 | 0 | 1 = 0;
  let areaPath = "";
  if (bars && bars.length >= 2) {
    const closes = bars.map((b) => b.c);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const stepX = (W - pad * 2) / (closes.length - 1);
    const pts = closes.map((c, i) => {
      const x = pad + i * stepX;
      const y = pad + (1 - (c - min) / span) * (H - pad * 2);
      return [x, y] as const;
    });
    path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const net = closes[closes.length - 1] - closes[0];
    dir = net > 0 ? 1 : net < 0 ? -1 : 0;
    const last = pts[pts.length - 1];
    const first = pts[0];
    areaPath = `${path} L${last[0].toFixed(1)},${H - pad} L${first[0].toFixed(1)},${H - pad} Z`;
  }

  const stroke =
    dir === 1 ? "var(--price-up)" : dir === -1 ? "var(--price-down)" : "var(--soft)";
  /* The fill is the same colour the line is, at a tenth — `color-mix` so the
     tint follows the token rather than a second hardcoded rgba() that drifts
     the moment the ramp moves. */
  const fill = `color-mix(in srgb, ${stroke} 10%, transparent)`;
  const trend = dir === 1 ? "up" : dir === -1 ? "down" : "flat";

  return (
    <div
      ref={hostRef}
      className={`w-full overflow-hidden rounded-lg bg-paper/60 ${className}`}
      style={{ height: H }}
    >
      {!bars && !failed && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
        </div>
      )}
      {failed && (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-[10px] text-midnight-500">chart unavailable</span>
        </div>
      )}
      {bars && bars.length >= 2 && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label={`${symbol} 3-month price trend, ${trend} over the window`}
        >
          <path d={areaPath} fill={fill} stroke="none" />
          <m.path
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={reduce ? undefined : { pathLength: 0 }}
            animate={reduce ? undefined : { pathLength: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
      )}
    </div>
  );
}
