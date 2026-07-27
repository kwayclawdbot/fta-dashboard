"use client";

import { useState } from "react";
import { Minus, Eraser, X, Plus } from "lucide-react";
import type { ChartHandle } from "./CandlestickChart";
import { SimChip, SimNumField } from "./parts";

/**
 * CHART DRAWING TOOLS — mark your levels on the practice chart.
 *
 * Behaviour is untouched (add a level at the current price, add one at a typed
 * price, remove one, clear all — all through the same ChartHandle). The chrome
 * is now chips and an underlined mono field on the paper, not a nested dark
 * toolbar.
 *
 * The six swatch values are literal hex ON PURPOSE: they are passed to
 * lightweight-charts as canvas stroke colours, which cannot read a CSS token,
 * and they render on the chart's own always-dark pane rather than on the page.
 */

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

const LINE_COLORS = [
  { color: "#FF8A00", label: "Orange" },
  { color: "#4ADE80", label: "Green" },
  { color: "#EF4444", label: "Red" },
  { color: "#60A5FA", label: "Blue" },
  { color: "#A78BFA", label: "Purple" },
  { color: "#FBBF24", label: "Gold" },
];

export default function ChartDrawingTools({ chartRef, currentPrice }: ChartDrawingToolsProps) {
  const [drawnLines, setDrawnLines] = useState<DrawnLine[]>([]);
  const [selectedColor, setSelectedColor] = useState(LINE_COLORS[0].color);
  const [priceInput, setPriceInput] = useState("");
  const [showAddLine, setShowAddLine] = useState(false);

  function handleAddLine() {
    if (!chartRef.current) return;
    const price = parseFloat(priceInput);
    if (isNaN(price) || price <= 0) return;

    const label = price > currentPrice ? "R" : "S";
    const id = chartRef.current.addHorizontalLine(price, selectedColor, label);
    setDrawnLines((prev) => [
      ...prev,
      { id, price, label: `${label} $${price.toFixed(2)}`, color: selectedColor },
    ]);
    setPriceInput("");
    setShowAddLine(false);
  }

  function handleAddAtPrice() {
    if (!chartRef.current) return;
    const label = "S/R";
    const id = chartRef.current.addHorizontalLine(currentPrice, selectedColor, label);
    setDrawnLines((prev) => [
      ...prev,
      {
        id,
        price: currentPrice,
        label: `${label} $${currentPrice.toFixed(2)}`,
        color: selectedColor,
      },
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-soft">
        Levels
      </span>

      <SimChip onClick={handleAddAtPrice} title="Draw a level at the current price">
        <Minus className="h-3.5 w-3.5" />
        At the mark
      </SimChip>

      <SimChip
        active={showAddLine}
        onClick={() => setShowAddLine((v) => !v)}
        title="Draw a level at a price you type"
      >
        <Plus className="h-3.5 w-3.5" />
        At a price
      </SimChip>

      {drawnLines.length > 0 && (
        <SimChip onClick={handleClearAll} title="Clear every level">
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </SimChip>
      )}

      {/* Swatches — the stroke colour of the next level drawn. */}
      <span className="flex items-center gap-1.5">
        {LINE_COLORS.map((c) => (
          <button
            key={c.color}
            type="button"
            onClick={() => setSelectedColor(c.color)}
            title={c.label}
            aria-label={`${c.label} level colour`}
            aria-pressed={selectedColor === c.color}
            className={`h-3.5 w-3.5 rounded-full transition-transform ${
              selectedColor === c.color
                ? "scale-125 ring-2 ring-ink ring-offset-2 ring-offset-paper"
                : "opacity-55 hover:opacity-100"
            }`}
            style={{ backgroundColor: c.color }}
          />
        ))}
      </span>

      {showAddLine && (
        <span className="flex items-center gap-2">
          <SimNumField
            ariaLabel="Level price"
            prefix="$"
            value={priceInput}
            onChange={setPriceInput}
            step="0.01"
            width="w-20"
          />
          <SimChip onClick={handleAddLine} title="Draw the level">
            Draw
          </SimChip>
        </span>
      )}

      {drawnLines.length > 0 && (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {drawnLines.map((line) => (
            <span
              key={line.id}
              className="inline-flex items-center gap-1.5 font-mono text-[10.5px] tabular-nums text-soft"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: line.color }}
                aria-hidden
              />
              {line.label}
              <button
                type="button"
                onClick={() => handleRemoveLine(line.id)}
                aria-label={`Remove level ${line.label}`}
                className="text-soft transition-colors hover:text-ink"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
