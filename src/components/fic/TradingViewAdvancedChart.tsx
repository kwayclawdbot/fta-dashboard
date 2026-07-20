"use client";

import { useEffect, useRef } from "react";

/**
 * FREE TradingView Advanced Chart embed — the Practice Chart. No API key, no
 * licence (small TV branding is accepted). Warm-paper-compatible light theme.
 *
 * `lineStyle` picks a kid-friendly area/line preset vs candles for teens+parents.
 * Re-injects only when symbol/style actually change so the page never janks.
 */
export default function TradingViewAdvancedChart({
  symbol,
  lineStyle,
}: {
  symbol: string;
  lineStyle: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.innerHTML = "";
    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = "100%";
    inner.style.width = "100%";
    el.appendChild(inner);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "light",
      // 3 = area (kids), 1 = candles (teens/parents)
      style: lineStyle ? "3" : "1",
      locale: "en",
      backgroundColor: "#FFFFFF",
      gridColor: "rgba(16, 24, 40, 0.06)",
      hide_top_toolbar: false,
      hide_side_toolbar: lineStyle, // fewer distractions for kids
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [symbol, lineStyle]);

  return (
    <div
      ref={hostRef}
      className="tradingview-widget-container h-full w-full"
      style={{ height: "100%", width: "100%" }}
    />
  );
}
