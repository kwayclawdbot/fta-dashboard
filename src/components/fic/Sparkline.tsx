"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fetchBars, type MarketBar } from "@/lib/market/client";

/**
 * Lightweight LOCAL price sparkline drawn from /api/market/bars (Polygon daily
 * closes, cached ~15 min). Replaces the TradingView mini-symbol iframes — a
 * board of 30 companies used to inject 30 iframes; this is one tiny inline SVG
 * each, key-free (the Polygon key stays on the server).
 *
 * Lazy: only fetches once the card scrolls into view (IntersectionObserver).
 * Colored by net direction over the window (locked green-team / red-team).
 * The line draws in on reveal (stroke-dashoffset) unless reduced-motion.
 * Graceful: renders nothing tall/broken if data is missing.
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
  let up = true;
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
    up = closes[closes.length - 1] >= closes[0];
    const last = pts[pts.length - 1];
    const first = pts[0];
    areaPath = `${path} L${last[0].toFixed(1)},${H - pad} L${first[0].toFixed(1)},${H - pad} Z`;
  }

  const stroke = up ? "#16A34A" : "#DC2626";
  const fill = up ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.10)";

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
          aria-label={`${symbol} 3-month price trend, ${up ? "up" : "down"} over the window`}
        >
          <path d={areaPath} fill={fill} stroke="none" />
          <motion.path
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
