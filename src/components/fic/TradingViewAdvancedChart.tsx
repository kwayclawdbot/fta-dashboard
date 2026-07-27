"use client";

import { useEffect, useRef } from "react";
import { useResolvedTheme } from "@/lib/useTheme";

/**
 * FREE TradingView Advanced Chart embed — the Practice Chart. No API key, no
 * licence (small TV branding is accepted). Warm-paper-compatible light theme.
 *
 * `lineStyle` picks a kid-friendly area/line preset vs candles for teens+parents.
 * Re-injects only when symbol/style actually change so the page never janks.
 *
 * SURFACE (canvas rebuild B, chrome only — no charting behaviour touched): the
 * embed's background and grid are read from the app's own surface tokens on the
 * host element, so the chart paints the same colour as the page it sits in for
 * every theme AND every mode (club cream, family warm paper, dark charcoal)
 * instead of a hardcoded #FFFFFF slab. Falls back to the previous literals if a
 * token is ever unavailable.
 */

/** Resolve a CSS custom property in the host's own cascade (mode-correct). */
function tokenOf(el: Element | null, name: string, fallback: string): string {
  if (!el) return fallback;
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}
export default function TradingViewAdvancedChart({
  symbol,
  lineStyle,
}: {
  symbol: string;
  lineStyle: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = useResolvedTheme();
  const dark = theme === "dark";

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.innerHTML = "";
    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = "100%";
    inner.style.width = "100%";
    el.appendChild(inner);

    const surface = tokenOf(el, "--card", dark ? "#221C14" : "#FFFFFF");
    const gridColor = dark
      ? "rgba(247, 242, 230, 0.06)"
      : "rgba(16, 24, 40, 0.06)";

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
      theme: dark ? "dark" : "light",
      // 3 = area (kids), 1 = candles (teens/parents)
      style: lineStyle ? "3" : "1",
      locale: "en",
      backgroundColor: surface,
      gridColor,
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
  }, [symbol, lineStyle, dark]);

  return (
    <div
      ref={hostRef}
      className="tradingview-widget-container h-full w-full"
      style={{ height: "100%", width: "100%" }}
    />
  );
}
