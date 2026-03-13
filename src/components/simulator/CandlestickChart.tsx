"use client";

import { useEffect, useRef, useCallback } from "react";
import type { OHLCV } from "@/lib/simulator/market-engine";
import type { IndicatorPoint } from "@/lib/simulator/indicators";

export interface TradeMarker {
  time: number;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowDown" | "arrowUp" | "circle";
  text: string;
}

export interface PatternAnnotation {
  startBar: number;
  endBar: number;
  label: string;
}

interface CandlestickChartProps {
  bars: OHLCV[];
  sma20?: IndicatorPoint[];
  sma50?: IndicatorPoint[];
  sma200?: IndicatorPoint[];
  markers?: TradeMarker[];
  annotations?: PatternAnnotation[];
  height?: number;
}

export default function CandlestickChart({
  bars,
  sma20,
  sma50,
  sma200,
  markers,
  height = 400,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleSeriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumeSeriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sma20SeriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sma50SeriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sma200SeriesRef = useRef<any>(null);
  const initRef = useRef(false);

  const initChart = useCallback(async () => {
    if (!containerRef.current || initRef.current) return;

    const lc = await import("lightweight-charts");
    initRef.current = true;

    const chart = lc.createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: lc.ColorType.Solid, color: "transparent" },
        textColor: "#75819d",
        fontFamily: "var(--font-body), sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(15, 27, 55, 0.8)" },
        horzLines: { color: "rgba(15, 27, 55, 0.8)" },
      },
      crosshair: {
        mode: lc.CrosshairMode.Normal,
        vertLine: { color: "rgba(251, 191, 36, 0.3)", style: lc.LineStyle.Dashed },
        horzLine: { color: "rgba(251, 191, 36, 0.3)", style: lc.LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: "rgba(15, 27, 55, 0.8)",
      },
      timeScale: {
        borderColor: "rgba(15, 27, 55, 0.8)",
        timeVisible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick series (v5 API)
    const candleSeries = chart.addSeries(lc.CandlestickSeries, {
      upColor: "#4ADE80",
      downColor: "#EF4444",
      borderUpColor: "#4ADE80",
      borderDownColor: "#EF4444",
      wickUpColor: "#4ADE80",
      wickDownColor: "#EF4444",
    });
    candleSeriesRef.current = candleSeries;

    // Volume histogram (v5 API)
    const volumeSeries = chart.addSeries(lc.HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // SMA lines (v5 API)
    sma20SeriesRef.current = chart.addSeries(lc.LineSeries, {
      color: "#FBBF24",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "SMA 20",
    });

    sma50SeriesRef.current = chart.addSeries(lc.LineSeries, {
      color: "#60A5FA",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "SMA 50",
    });

    sma200SeriesRef.current = chart.addSeries(lc.LineSeries, {
      color: "#A78BFA",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "SMA 200",
    });

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

    // SMA data
    if (sma20SeriesRef.current && sma20) {
      sma20SeriesRef.current.setData(
        sma20.map((p) => ({ time: p.time, value: p.value }))
      );
    }
    if (sma50SeriesRef.current && sma50) {
      sma50SeriesRef.current.setData(
        sma50.map((p) => ({ time: p.time, value: p.value }))
      );
    }
    if (sma200SeriesRef.current && sma200) {
      sma200SeriesRef.current.setData(
        sma200.map((p) => ({ time: p.time, value: p.value }))
      );
    }

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

    // Auto-scroll to latest
    if (chartRef.current && bars.length > 0) {
      chartRef.current.timeScale().scrollToPosition(2, false);
    }
  }, [bars, sma20, sma50, sma200, markers]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ height }}
    />
  );
}
