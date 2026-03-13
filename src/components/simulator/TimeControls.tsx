"use client";

import { Play, Pause, SkipForward, RotateCcw } from "lucide-react";

interface TimeControlsProps {
  isPlaying: boolean;
  speed: number;
  barCount: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onStepForward: () => void;
  onReset: () => void;
}

const SPEEDS = [1, 2, 5, 10];

export default function TimeControls({
  isPlaying,
  speed,
  barCount,
  onTogglePlay,
  onSpeedChange,
  onStepForward,
  onReset,
}: TimeControlsProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-midnight-800 border border-midnight-700/50 text-gold-400 hover:bg-midnight-700 transition-colors"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      {/* Step Forward */}
      <button
        onClick={onStepForward}
        disabled={isPlaying}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-midnight-800 border border-midnight-700/50 text-midnight-300 hover:text-gold-400 hover:bg-midnight-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <SkipForward className="w-4 h-4" />
      </button>

      {/* Speed selector */}
      <div className="flex items-center gap-1 bg-midnight-800 border border-midnight-700/50 rounded-lg p-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
              speed === s
                ? "bg-gold-400/15 text-gold-400"
                : "text-midnight-400 hover:text-midnight-200"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Bar counter */}
      <span className="text-xs font-mono text-midnight-400">
        Bar {barCount}
      </span>

      {/* Reset */}
      <button
        onClick={onReset}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-midnight-800 border border-midnight-700/50 text-midnight-400 hover:text-red-500 hover:bg-midnight-700 transition-colors ml-auto"
        title="Reset simulation"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
}
