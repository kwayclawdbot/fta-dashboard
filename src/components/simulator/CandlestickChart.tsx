"use client";

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import type { OHLCV } from "@/lib/simulator/market-engine";

export interface TradeMarker {
  time: number;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowDown" | "arrowUp" | "circle";
  text: string;
}

export interface PriceLine {
  price: number;
  color: string;
  lineWidth?: number;
  lineStyle?: number; // 0=solid, 1=dotted, 2=dashed, 3=lg dashed
  title?: string;
  axisLabelVisible?: boolean;
}

export interface ChartHandle {
  addHorizontalLine: (price: number, color: string, title?: string) => string;
  removeLine: (id: string) => void;
  clearAllLines: () => void;
}

interface CandlestickChartProps {
  bars: OHLCV[];
  markers?: TradeMarker[];
  priceLines?: PriceLine[];
  height?: number;
  fitContent?: boolean;
}

const CandlestickChart = forwardRef<ChartHandle, CandlestickChartProps>(
  function CandlestickChart({ bars, markers, priceLines, height = 400, fitContent = true }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candleSeriesRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const volumeSeriesRef = useRef<any>(null);
    const initRef = useRef(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userLinesRef = useRef<Map<string, any>>(new Map());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hintLinesRef = useRef<any[]>([]);

    // Expose drawing API to parent
    useImperativeHandle(ref, () => ({
      addHorizontalLine(price: number, color: string, title?: string) {
        if (!candleSeriesRef.current) return "";
        const id = crypto.randomUUID();
        const line = candleSeriesRef.current.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: 2, // dashed
          title: title || "",
          axisLabelVisible: true,
        });
        userLinesRef.current.set(id, line);
        return id;
      },
      removeLine(id: string) {
        const line = userLinesRef.current.get(id);
        if (line && candleSeriesRef.current) {
          candleSeriesRef.current.removePriceLine(line);
          userLinesRef.current.delete(id);
        }
      },
      clearAllLines() {
        if (!candleSeriesRef.current) return;
        userLinesRef.current.forEach((line) => {
          candleSeriesRef.current.removePriceLine(line);
        });
        userLinesRef.current.clear();
      },
    }));

    const initChart = useCallback(async () => {
      if (!containerRef.current || initRef.current) return;

      const lc = await import("lightweight-charts");
      initRef.current = true;

      const chart = lc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: {
          // Warm-dark chart theme (Lane A): grid/text/borders warmed off the
          // old cold navy (#0F1B37) so the pane reads as an intentional warm
          // media panel in the paper app, not a cold trading terminal. bg stays
          // transparent so it inherits the warm .chart-frame container.
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: "#9C927E",
          fontFamily: "var(--font-body), sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(150, 132, 104, 0.14)" },
          horzLines: { color: "rgba(150, 132, 104, 0.14)" },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: { color: "rgba(255, 138, 0, 0.35)", style: lc.LineStyle.Dashed },
          horzLine: { color: "rgba(255, 138, 0, 0.35)", style: lc.LineStyle.Dashed },
        },
        rightPriceScale: {
          borderColor: "rgba(150, 132, 104, 0.22)",
        },
        timeScale: {
          borderColor: "rgba(150, 132, 104, 0.22)",
          timeVisible: false,
          rightOffset: 5,
        },
      });

      chartRef.current = chart;

      // Candlestick series
      const candleSeries = chart.addSeries(lc.CandlestickSeries, {
        upColor: "#4ADE80",
        downColor: "#EF4444",
        borderUpColor: "#4ADE80",
        borderDownColor: "#EF4444",
        wickUpColor: "#4ADE80",
        wickDownColor: "#EF4444",
      });
      candleSeriesRef.current = candleSeries;

      // Volume histogram
      const volumeSeries = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      volumeSeriesRef.current = volumeSeries;

      // Handle resize
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        chart.remove();
        initRef.current = false;
      };
    }, [height]);

    useEffect(() => {
      const cleanup = initChart();
      return () => {
        cleanup?.then((fn) => fn?.());
      };
    }, [initChart]);

    // Update data when bars change
    useEffect(() => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

      const candleData = bars.map((b) => ({
        time: b.time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }));
      candleSeriesRef.current.setData(candleData);

      const volumeData = bars.map((b) => ({
        time: b.time,
        value: b.volume,
        color: b.close >= b.open ? "rgba(74, 222, 128, 0.3)" : "rgba(239, 68, 68, 0.3)",
      }));
      volumeSeriesRef.current.setData(volumeData);

      // Trade markers
      if (markers && markers.length > 0) {
        candleSeriesRef.current.setMarkers(
          markers.map((m) => ({
            time: m.time,
            position: m.position,
            color: m.color,
            shape: m.shape,
            text: m.text,
          }))
        );
      }

      // Fit content so bars fill from left — no empty space
      if (chartRef.current && bars.length > 0 && fitContent) {
        chartRef.current.timeScale().fitContent();
      }
    }, [bars, markers, fitContent]);

    // Manage hint price lines (S/R from scenarios)
    useEffect(() => {
      if (!candleSeriesRef.current) return;

      // Remove old hint lines
      hintLinesRef.current.forEach((line) => {
        try {
          candleSeriesRef.current.removePriceLine(line);
        } catch {
          // ignore
        }
      });
      hintLinesRef.current = [];

      // Add new hint lines
      if (priceLines && priceLines.length > 0) {
        priceLines.forEach((pl) => {
          const line = candleSeriesRef.current.createPriceLine({
            price: pl.price,
            color: pl.color,
            lineWidth: pl.lineWidth ?? 1,
            lineStyle: pl.lineStyle ?? 2,
            title: pl.title || "",
            axisLabelVisible: pl.axisLabelVisible ?? false,
          });
          hintLinesRef.current.push(line);
        });
      }
    }, [priceLines]);

    return (
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ height }}
      />
    );
  }
);

export default CandlestickChart;
