"use client";

import { useState, useRef } from "react";
import { Minus, TrendingUp, Eraser, X, Plus } from "lucide-react";
import type { ChartHandle } from "./CandlestickChart";

interface DrawnLine {
  id: string;
  price: number;
  label: string;
  color: string;
}

interface ChartDrawingToolsProps {
  chartRef: React.RefObject<ChartHandle | null>;
  currentPrice: number;
}

type Tool = "none" | "horizontal" | "trendline";

const LINE_COLORS = [
  { color: "#FBBF24", label: "Gold" },
  { color: "#4ADE80", label: "Green" },
  { color: "#EF4444", label: "Red" },
  { color: "#60A5FA", label: "Blue" },
  { color: "#A78BFA", label: "Purple" },
  { color: "#F97316", label: "Orange" },
];

export default function ChartDrawingTools({
  chartRef,
  currentPrice,
}: ChartDrawingToolsProps) {
  const [activeTool, setActiveTool] = useState<Tool>("none");
  const [drawnLines, setDrawnLines] = useState<DrawnLine[]>([]);
  const [selectedColor, setSelectedColor] = useState(LINE_COLORS[0].color);
  const [priceInput, setPriceInput] = useState("");
  const [showAddLine, setShowAddLine] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAddLine() {
    if (!chartRef.current) return;
    const price = parseFloat(priceInput);
    if (isNaN(price) || price <= 0) return;

    const label = price > currentPrice ? "R" : "S";
    const id = chartRef.current.addHorizontalLine(price, selectedColor, label);
    setDrawnLines((prev) => [...prev, { id, price, label: `${label} $${price.toFixed(2)}`, color: selectedColor }]);
    setPriceInput("");
    setShowAddLine(false);
  }

  function handleAddAtPrice() {
    if (!chartRef.current) return;
    const label = "S/R";
    const id = chartRef.current.addHorizontalLine(currentPrice, selectedColor, label);
    setDrawnLines((prev) => [
      ...prev,
      { id, price: currentPrice, label: `${label} $${currentPrice.toFixed(2)}`, color: selectedColor },
    ]);
  }

  function handleRemoveLine(lineId: string) {
    if (!chartRef.current) return;
    chartRef.current.removeLine(lineId);
    setDrawnLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  function handleClearAll() {
    if (!chartRef.current) return;
    chartRef.current.clearAllLines();
    setDrawnLines([]);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Drawing tools */}
      <div className="flex items-center gap-0.5 bg-midnight-900 border border-midnight-700/50 rounded-lg p-0.5">
        <button
          onClick={() => {
            setActiveTool(activeTool === "horizontal" ? "none" : "horizontal");
            handleAddAtPrice();
          }}
          title="Add S/R line at current price"
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTool === "horizontal"
              ? "bg-gold-400/15 text-gold-400"
              : "text-midnight-400 hover:text-midnight-200"
          }`}
        >
          <Minus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">S/R Line</span>
        </button>

        <button
          onClick={() => setShowAddLine(!showAddLine)}
          title="Add line at specific price"
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
            showAddLine
              ? "bg-gold-400/15 text-gold-400"
              : "text-midnight-400 hover:text-midnight-200"
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">At Price</span>
        </button>

        {drawnLines.length > 0 && (
          <button
            onClick={handleClearAll}
            title="Clear all lines"
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-midnight-400 hover:text-red-500 transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Color picker */}
      <div className="flex items-center gap-1">
        {LINE_COLORS.map((c) => (
          <button
            key={c.color}
            onClick={() => setSelectedColor(c.color)}
            title={c.label}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              selectedColor === c.color
                ? "border-white scale-125"
                : "border-transparent opacity-60 hover:opacity-100"
            }`}
            style={{ backgroundColor: c.color }}
          />
        ))}
      </div>

      {/* Price input for manual line */}
      {showAddLine && (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="number"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddLine()}
            placeholder="Price"
            step="0.01"
            className="w-24 bg-midnight-800 border border-midnight-700/50 rounded-md px-2 py-1 text-xs font-mono text-midnight-100 placeholder:text-midnight-600 focus:outline-none focus:border-gold-400/30"
            autoFocus
          />
          <button
            onClick={handleAddLine}
            className="px-2 py-1 rounded-md bg-gold-400/15 text-gold-400 text-xs font-medium hover:bg-gold-400/25 transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {/* Drawn lines list */}
      {drawnLines.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {drawnLines.map((line) => (
            <span
              key={line.id}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-midnight-800 border border-midnight-700/30 text-[10px] font-mono"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: line.color }}
              />
              <span className="text-midnight-300">{line.label}</span>
              <button
                onClick={() => handleRemoveLine(line.id)}
                className="text-midnight-500 hover:text-red-500 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
