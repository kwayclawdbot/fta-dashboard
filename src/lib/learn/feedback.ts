/**
 * Learning World — register-scaled step feedback.
 *
 * The reward moment is scaled to the audience (FIC-LEARNING-WORLD §8): subtle
 * for adults, warmer for kids, never cartoon explosions. Sound is opt-in only
 * (mirrors Celebrate's useSoundOptIn) and never plays for adults. Motion is
 * gated by prefers-reduced-motion at the component layer.
 */

import type { Register } from "@/lib/register";

export type Cue = "correct" | "wrong" | "advance" | "win";

/** How energetic the visual feedback is, by register. */
export interface FeedbackScale {
  /** particle burst count for a win (0 = none). */
  burst: number;
  burstPower: number;
  /** whether a small guide reaction shows. */
  guideReaction: boolean;
}

export function feedbackScale(register: Register): FeedbackScale {
  switch (register) {
    case "kid":
      return { burst: 20, burstPower: 130, guideReaction: true };
    case "teen":
      return { burst: 12, burstPower: 95, guideReaction: true };
    default: // adult — editorial, minimal gamification
      return { burst: 0, burstPower: 0, guideReaction: false };
  }
}

let sharedCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AC) sharedCtx = new AC();
  }
  if (sharedCtx?.state === "suspended") sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

function blip(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  vol: number
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  gain.gain.setValueAtTime(0.0001, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
}

/**
 * Play a feedback cue. No-op unless the member opted into sound AND is not an
 * adult (adults stay silent by design). Must be called from within a user
 * gesture the first time (all step interactions are gestures, so this is safe).
 */
export function playCue(cue: Cue, register: Register, soundOn: boolean): void {
  if (!soundOn || register === "adult") return;
  const c = ctx();
  if (!c) return;
  const kid = register === "kid";
  switch (cue) {
    case "correct":
      blip(c, 660, 0, 0.09, "sine", 0.05);
      blip(c, 880, 0.08, 0.12, "sine", 0.05);
      break;
    case "wrong":
      blip(c, 220, 0, 0.16, "triangle", 0.04);
      break;
    case "advance":
      blip(c, 520, 0, 0.05, "triangle", 0.03);
      break;
    case "win":
      [523.25, 659.25, 783.99, kid ? 1046.5 : 880].forEach((f, i) =>
        blip(c, f, i * 0.1, 0.28, "sine", 0.06)
      );
      break;
  }
}
