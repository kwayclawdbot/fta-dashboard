"use client";

import { Play, Pause, SkipForward, RotateCcw } from "lucide-react";
import { SimChip, SimChipGroup, SimIconButton } from "./parts";

/**
 * TIME CONTROLS — the transport for the simulated tape.
 *
 * Same controls, same handlers; they now sit as quiet round buttons and mono
 * chips directly on the paper instead of inside nested dark pill-boxes. The
 * bar counter is mono because it is a market number.
 */

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
    <div className="flex flex-wrap items-center gap-2.5">
      <SimIconButton
        onClick={onTogglePlay}
        label={isPlaying ? "Pause the tape" : "Run the tape"}
        active={isPlaying}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </SimIconButton>

      <SimIconButton onClick={onStepForward} label="Step one bar" disabled={isPlaying}>
        <SkipForward className="h-4 w-4" />
      </SimIconButton>

      {/* Speed is one-of-N, so it is a radiogroup: one tab stop, arrows move
          within it — the same singular keyboard model as SegmentedRail. */}
      <SimChipGroup ariaLabel="Tape speed">
        {SPEEDS.map((s) => (
          <SimChip key={s} radio active={speed === s} onClick={() => onSpeedChange(s)}>
            {s}×
          </SimChip>
        ))}
      </SimChipGroup>

      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
        Bar {barCount}
      </span>

      <div className="ml-auto">
        <SimIconButton onClick={onReset} label="Reset the simulation">
          <RotateCcw className="h-4 w-4" />
        </SimIconButton>
      </div>
    </div>
  );
}
