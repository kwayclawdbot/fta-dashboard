"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Tiny WebAudio synth for game feedback — no audio files. Muted by DEFAULT;
 * nothing plays until the player flips the toggle (which also creates the
 * AudioContext inside a user gesture, satisfying autoplay policies).
 */
type Cue = "tick" | "correct" | "wrong" | "win";

export function useGameSound() {
  const [muted, setMuted] = useState(true);
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }
    return ctxRef.current;
  }, []);

  const toggle = useCallback(() => {
    setMuted((m) => {
      if (m) ensureCtx()?.resume().catch(() => {});
      return !m;
    });
  }, [ensureCtx]);

  const blip = useCallback(
    (ctx: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, vol = 0.06) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.02);
    },
    []
  );

  const play = useCallback(
    (cue: Cue) => {
      if (muted) return;
      const ctx = ensureCtx();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      switch (cue) {
        case "tick":
          blip(ctx, 320 + Math.random() * 80, 0, 0.05, "triangle", 0.02);
          break;
        case "correct":
          blip(ctx, 523.25, 0, 0.12, "sine");
          blip(ctx, 783.99, 0.08, 0.16, "sine");
          break;
        case "wrong":
          blip(ctx, 196, 0, 0.18, "sawtooth", 0.05);
          break;
        case "win":
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
            blip(ctx, f, i * 0.12, 0.2, "sine")
          );
          break;
      }
    },
    [muted, ensureCtx, blip]
  );

  return { muted, toggle, play };
}
