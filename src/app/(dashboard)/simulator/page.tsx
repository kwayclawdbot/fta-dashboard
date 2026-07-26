"use client";

import { useState, useReducer, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { m } from "@/lib/motion";
import TimeControls from "@/components/simulator/TimeControls";
import ChartDrawingTools from "@/components/simulator/ChartDrawingTools";
import OrderPanel from "@/components/simulator/OrderPanel";
import PortfolioSummary from "@/components/simulator/PortfolioSummary";
import PositionsList from "@/components/simulator/PositionsList";
import TradeHistory from "@/components/simulator/TradeHistory";
import {
  MarketEngine,
  SYMBOL_PRESETS,
  type OHLCV,
} from "@/lib/simulator/market-engine";
import {
  portfolioReducer,
  initialPortfolioState,
  loadPortfolio,
  ensurePortfolio,
  savePortfolioState,
  saveTradeToSupabase,
  savePositionToSupabase,
  removePositionFromSupabase,
  resetPortfolio,
  type Position,
} from "@/lib/simulator/portfolio-manager";
import type { ChartHandle } from "@/components/simulator/CandlestickChart";
import SimulatorTabs from "@/components/simulator/SimulatorTabs";

const CandlestickChart = dynamic(
  () => import("@/components/simulator/CandlestickChart"),
  { ssr: false }
);

const SYMBOLS = Object.keys(SYMBOL_PRESETS);

export default function SimulatorPage() {
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [bars, setBars] = useState<OHLCV[]>([]);
  const [portfolio, dispatch] = useReducer(portfolioReducer, initialPortfolioState);
  const [loading, setLoading] = useState(true);

  const engineRef = useRef<MarketEngine | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartRef = useRef<ChartHandle | null>(null);

  // Initialize engine for current symbol
  useEffect(() => {
    const config = SYMBOL_PRESETS[symbol];
    const engine = new MarketEngine(config);
    engine.generateBars(50);
    engineRef.current = engine;
    setBars([...engine.allBars]);
  }, [symbol]);

  // Load portfolio from Supabase
  useEffect(() => {
    async function load() {
      try {
        await ensurePortfolio();
        const saved = await loadPortfolio();
        if (saved) dispatch({ type: "SET_STATE", state: saved });
      } catch {
        // Supabase tables may not exist yet
      }
      setLoading(false);
    }
    load();
  }, []);

  // Debounced save
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePortfolioState(portfolio).catch(() => {});
    }, 5000);
  }, [portfolio]);

  // Tick loop
  useEffect(() => {
    if (!isPlaying || !engineRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const ms = Math.max(50, 500 / speed);
    intervalRef.current = setInterval(() => {
      const engine = engineRef.current!;
      const bar = engine.tick();
      setBars([...engine.allBars]);

      dispatch({
        type: "UPDATE_PRICES",
        prices: { [symbol]: bar.close },
      });

      checkStopsTakeProfits(bar.close);
    }, ms);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speed, symbol]);

  function checkStopsTakeProfits(currentPrice: number) {
    portfolio.positions
      .filter((p) => p.symbol === symbol)
      .forEach((pos) => {
        if (pos.stopLoss) {
          const triggered =
            pos.side === "long"
              ? currentPrice <= pos.stopLoss
              : currentPrice >= pos.stopLoss;
          if (triggered) handleClosePosition(pos.id, currentPrice);
        }
        if (pos.takeProfit) {
          const triggered =
            pos.side === "long"
              ? currentPrice >= pos.takeProfit
              : currentPrice <= pos.takeProfit;
          if (triggered) handleClosePosition(pos.id, currentPrice);
        }
      });
  }

  function handleStepForward() {
    if (!engineRef.current) return;
    const bar = engineRef.current.tick();
    setBars([...engineRef.current.allBars]);
    dispatch({ type: "UPDATE_PRICES", prices: { [symbol]: bar.close } });
  }

  function handleReset() {
    setIsPlaying(false);
    if (engineRef.current) {
      engineRef.current.reset();
      engineRef.current.generateBars(50);
      setBars([...engineRef.current.allBars]);
    }
  }

  function handleSubmitOrder(order: {
    side: "long" | "short";
    quantity: number;
    stopLoss?: number;
    takeProfit?: number;
  }) {
    const currentPrice =
      bars.length > 0 ? bars[bars.length - 1].close : 0;
    if (currentPrice === 0) return;

    const cost = order.quantity * currentPrice;
    if (cost > portfolio.balance) return;

    const position: Position = {
      id: crypto.randomUUID(),
      symbol,
      side: order.side,
      quantity: order.quantity,
      entryPrice: currentPrice,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      openedAt: new Date().toISOString(),
      currentPrice,
      unrealizedPnl: 0,
    };

    dispatch({ type: "OPEN_POSITION", position, cost });

    if (portfolio.portfolioId) {
      savePositionToSupabase(portfolio.portfolioId, position).catch(() => {});
    }
    scheduleSave();
  }

  function handleClosePosition(positionId: string, exitPriceOverride?: number) {
    const currentPrice =
      exitPriceOverride ??
      (bars.length > 0 ? bars[bars.length - 1].close : 0);

    const pos = portfolio.positions.find((p) => p.id === positionId);
    if (!pos) return;

    dispatch({ type: "CLOSE_POSITION", positionId, exitPrice: currentPrice });

    if (portfolio.portfolioId) {
      removePositionFromSupabase(positionId).catch(() => {});
      const pnl =
        pos.side === "long"
          ? (currentPrice - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - currentPrice) * pos.quantity;
      saveTradeToSupabase(portfolio.portfolioId, {
        id: crypto.randomUUID(),
        symbol: pos.symbol,
        side: pos.side,
        quantity: pos.quantity,
        entryPrice: pos.entryPrice,
        exitPrice: currentPrice,
        pnl: Math.round(pnl * 100) / 100,
        openedAt: pos.openedAt,
        closedAt: new Date().toISOString(),
      }).catch(() => {});
    }
    scheduleSave();
  }

  async function handlePortfolioReset() {
    if (portfolio.portfolioId) {
      try {
        await resetPortfolio(portfolio.portfolioId);
      } catch {
        // ignore
      }
    }
    dispatch({ type: "RESET" });
    const saved = await loadPortfolio();
    if (saved) dispatch({ type: "SET_STATE", state: saved });
  }

  const currentPrice = bars.length > 0 ? bars[bars.length - 1].close : 0;

  // Trade markers for chart
  const tradeMarkers = portfolio.trades
    .filter((t) => t.symbol === symbol)
    .slice(0, 20)
    .flatMap((t) => {
      const markers = [];
      const entryBar = bars.findIndex(
        (b) => Math.abs(b.close - t.entryPrice) < 0.5
      );
      const exitBar = bars.findIndex(
        (b) => Math.abs(b.close - t.exitPrice) < 0.5
      );
      if (entryBar >= 0) {
        markers.push({
          time: bars[entryBar].time,
          position: "belowBar" as const,
          color: t.side === "long" ? "#4ADE80" : "#EF4444",
          shape: "arrowUp" as const,
          text: `${t.side === "long" ? "BUY" : "SHORT"} ${t.quantity}`,
        });
      }
      if (exitBar >= 0) {
        markers.push({
          time: bars[exitBar].time,
          position: "aboveBar" as const,
          color: t.pnl >= 0 ? "#4ADE80" : "#EF4444",
          shape: "arrowDown" as const,
          text: `CLOSE ${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(0)}`,
        });
      }
      return markers;
    })
    .sort((a, b) => a.time - b.time);

  if (loading) {
    // Branded boot state (audit #15): animated candlestick bars + a one-line
    // "what this is" while the chart engine warms, instead of a bare spinner.
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-5 flex h-12 items-end gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <m.span
              key={i}
              className="w-2.5 rounded-sm bg-gold-500/80"
              initial={{ height: 8 }}
              animate={{ height: [8, 40, 16, 32, 8] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.12,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        <h1 className="font-display text-lg font-bold text-midnight-100">
          Warming up the Trading Floor
        </h1>
        <p className="mt-1.5 max-w-xs text-sm text-midnight-400">
          Booting a live-feeling market so you can practice with pretend
          money — place orders, manage a portfolio, zero real risk.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SimulatorTabs />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-midnight-100">
            Trading Floor
          </h1>
          <p className="text-xs text-midnight-400">
            Practice trading with simulated market data
          </p>
        </div>
        <button
          onClick={handlePortfolioReset}
          className="text-xs px-3 py-1.5 rounded-lg bg-midnight-800 border border-midnight-700/50 text-midnight-400 hover:text-red-500 hover:border-red-500/30 transition-colors"
        >
          Reset Portfolio ($100K)
        </button>
      </div>

      {/* Portfolio Summary */}
      <PortfolioSummary state={portfolio} />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Chart area */}
        <div className="lg:col-span-8 space-y-3">
          {/* Symbol selector */}
          <div className="flex gap-1 bg-midnight-900 border border-midnight-700/50 rounded-lg p-0.5 overflow-x-auto">
            {SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium whitespace-nowrap transition-colors ${
                  symbol === s
                    ? "bg-gold-400/15 text-gold-400"
                    : "text-midnight-400 hover:text-midnight-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Time controls */}
          <TimeControls
            isPlaying={isPlaying}
            speed={speed}
            barCount={bars.length}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSpeedChange={setSpeed}
            onStepForward={handleStepForward}
            onReset={handleReset}
          />

          {/* Drawing tools */}
          <ChartDrawingTools chartRef={chartRef} currentPrice={currentPrice} />

          {/* Chart */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="chart-frame p-2"
          >
            <CandlestickChart
              ref={chartRef}
              bars={bars}
              markers={tradeMarkers}
              height={420}
            />
          </m.div>

          {/* Price info bar */}
          <div className="flex items-center gap-4 px-2 text-xs font-mono">
            <span className="text-midnight-400">{symbol}</span>
            <span className="text-midnight-100 font-medium">
              ${currentPrice.toFixed(2)}
            </span>
            {bars.length >= 2 && (
              <span
                className={
                  bars[bars.length - 1].close >= bars[bars.length - 2].close
                    ? "text-green-400"
                    : "text-red-500"
                }
              >
                {bars[bars.length - 1].close >= bars[bars.length - 2].close ? "+" : ""}
                {(bars[bars.length - 1].close - bars[bars.length - 2].close).toFixed(2)}{" "}
                ({(((bars[bars.length - 1].close - bars[bars.length - 2].close) / bars[bars.length - 2].close) * 100).toFixed(2)}%)
              </span>
            )}
            <span className="text-midnight-500">
              Vol: {bars.length > 0 ? bars[bars.length - 1].volume.toLocaleString() : "—"}
            </span>
          </div>
        </div>

        {/* Right: Order + Positions */}
        <div className="lg:col-span-4 space-y-4">
          <OrderPanel
            currentPrice={currentPrice}
            balance={portfolio.balance}
            symbol={symbol}
            onSubmitOrder={handleSubmitOrder}
          />
          <PositionsList
            positions={portfolio.positions}
            onClosePosition={(id) => handleClosePosition(id)}
          />
        </div>
      </div>

      {/* Trade History */}
      <TradeHistory trades={portfolio.trades} />
    </div>
  );
}
