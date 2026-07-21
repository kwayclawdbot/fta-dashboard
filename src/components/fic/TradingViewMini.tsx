"use client";

import { useEffect, useRef, useState } from "react";
import { useResolvedTheme } from "@/lib/useTheme";

/**
 * FREE TradingView "mini symbol overview" embed — a tiny price sparkline for a
 * ticker. No API key, no market-data licence.
 *
 * Lazy-loaded via IntersectionObserver so a board of 30 companies never injects
 * 30 iframes at once — the widget only mounts once its card scrolls into view.
 */
export default function TradingViewMini({
  symbol,
  height = 96,
}: {
  symbol: string;
  height?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const theme = useResolvedTheme();

  // Reveal when the card enters the viewport (load-once, keep mounted).
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

  // Inject the widget script once visible.
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !visible) return;
    el.innerHTML = "";
    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    el.appendChild(inner);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      symbol,
      width: "100%",
      height,
      locale: "en",
      dateRange: "3M",
      colorTheme: theme === "dark" ? "dark" : "light",
      isTransparent: true,
      autosize: false,
      largeChartUrl: "",
      chartOnly: true,
      noTimeScale: true,
      trendLineColor: "#F59E0B",
      underLineColor: "rgba(245,158,11,0.12)",
      underLineBottomColor: "rgba(245,158,11,0.0)",
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [visible, symbol, height, theme]);

  return (
    <div
      ref={hostRef}
      className="tradingview-widget-container w-full overflow-hidden rounded-lg bg-paper/60"
      style={{ height }}
    >
      {!visible && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
        </div>
      )}
    </div>
  );
}
