"use client";

import { useState, useReducer, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { m } from "@/lib/motion";
import { RotateCcw } from "lucide-react";
import TimeControls from "@/components/simulator/TimeControls";
import ChartDrawingTools from "@/components/simulator/ChartDrawingTools";
import OrderPanel from "@/components/simulator/OrderPanel";
import PortfolioSummary from "@/components/simulator/PortfolioSummary";
import PositionsList from "@/components/simulator/PositionsList";
import TradeHistory from "@/components/simulator/TradeHistory";
import { SimChip } from "@/components/simulator/parts";
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

/**
 * PRACTICE · TRADING FLOOR
 *
 * A composition rebuild, not a feature change: the market engine, the tick
 * loop, the stop/target checks, the Supabase persistence and the reducer are
 * exactly as they were. What changed is the surface — a display masthead, ONE
 * dark object carrying the portfolio (`f0-hero-field`, in PortfolioSummary),
 * and hairline ledgers for the positions and the trade history instead of
 * stacked bordered panels.
 *
 * The chart pane keeps `.chart-frame` — a foundation class written for exactly
 * this surface ("the trading-simulator / practice chart pane"). It is the media
 * canvas, not a card: lightweight-charts paints its own candles and axis type
 * against it in both themes.
 */

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
  const prevClose = bars.length >= 2 ? bars[bars.length - 2].close : null;
  const barMove = prevClose != null ? currentPrice - prevClose : null;

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
        <div className="mb-6 flex h-12 items-end gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <m.span
              key={i}
              className="w-2.5 rounded-sm bg-volt-500/80"
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
        <h1 className="font-display text-display-3 font-extrabold text-ink">
          Warming up the trading floor
        </h1>
        <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-soft">
          Booting a live-feeling market so you can practise with pretend money —
          place orders, manage a portfolio, zero real risk.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-24">
      <SimulatorTabs />

      {/* Masthead — the display voice, no icon chip, no card. */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
            Practice
          </p>
          <h1 className="mt-2 font-display text-display-1 font-extrabold text-ink">
            Trading floor
          </h1>
          <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-soft">
            A simulated market and a $100,000 practice account. Run the tape, place
            orders, live with the outcome — none of it touches real money.
          </p>
        </div>
        <button
          onClick={handlePortfolioReset}
          className="inline-flex shrink-0 items-center gap-1.5 pt-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-soft transition-colors hover:text-ink"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to $100,000
        </button>
      </header>

      <PortfolioSummary state={portfolio} />

      {/* Chart column + order ticket. This is an ASYMMETRIC page layout (the
          canvas takes the room, the ticket is a fixed rail) — not an
          equal-column card grid, and neither side is boxed. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0 space-y-4">
          {/* Instrument — mono chips, the tape you're watching. */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-soft">
              Instrument
            </span>
            {SYMBOLS.map((s) => (
              <SimChip key={s} active={symbol === s} onClick={() => setSymbol(s)}>
                ${s}
              </SimChip>
            ))}
          </div>

          <TimeControls
            isPlaying={isPlaying}
            speed={speed}
            barCount={bars.length}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSpeedChange={setSpeed}
            onStepForward={handleStepForward}
            onReset={handleReset}
          />

          <ChartDrawingTools chartRef={chartRef} currentPrice={currentPrice} />

          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="chart-frame p-2">
            <CandlestickChart
              ref={chartRef}
              bars={bars}
              markers={tradeMarkers}
              height={420}
            />
          </m.div>

          {/* The mark — every number mono, the move in the price ramp. */}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[12px] tabular-nums text-soft">
            <span className="font-display text-[13px] font-extrabold tracking-tight text-ink">
              ${symbol}
            </span>
            <span className="text-[15px] font-semibold text-ink">
              {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : "—"}
            </span>
            {barMove != null && prevClose ? (
              <span
                className={`font-semibold ${
                  barMove === 0
                    ? "text-soft"
                    : barMove > 0
                      ? "text-price-up"
                      : "text-price-down"
                }`}
              >
                {barMove > 0 ? "+" : ""}
                {barMove.toFixed(2)} ({barMove > 0 ? "+" : ""}
                {((barMove / prevClose) * 100).toFixed(2)}%)
              </span>
            ) : (
              <span>—</span>
            )}
            <span className="uppercase tracking-[0.14em]">
              Vol{" "}
              {bars.length > 0 ? bars[bars.length - 1].volume.toLocaleString() : "—"}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <OrderPanel
            currentPrice={currentPrice}
            balance={portfolio.balance}
            symbol={symbol}
            onSubmitOrder={handleSubmitOrder}
          />
        </div>
      </div>

      <PositionsList
        positions={portfolio.positions}
        onClosePosition={(id) => handleClosePosition(id)}
      />

      <TradeHistory trades={portfolio.trades} />
    </div>
  );
}
