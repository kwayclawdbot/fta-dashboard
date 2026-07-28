"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { m, useReducedMotion } from "@/lib/motion";
import { Volume2, VolumeX, Captions, RotateCcw } from "lucide-react";
import type { AudioAsset } from "@/lib/learn/schema";

/* ══════════════════════════════════════════════════════════════════════════
   THE VOICE — the audio-first controller for <LessonEngine/>.

   A lesson is SPOKEN. Kai reads the teaching copy while the screen holds the
   drawing, one line of large type, and the interaction. This module owns the
   part of that which is not visual: one audio element, a play queue of exactly
   one, and the three member controls (replay, mute, captions).

   WHY ONE ELEMENT. Mobile Safari unlocks audio per *element*, on a real user
   gesture, and only the first time. Creating a fresh <audio> per beat would
   need a fresh gesture per beat. So the lesson creates one element, arms it on
   the Start press (the gesture), and every segment after that is a `src` swap
   on the already-unlocked element. That is the entire reason the lesson has a
   Start screen.

   AUTOPLAY IS NEVER ASSUMED. `play()` may still be rejected — an autoplay
   policy, a dead file, a browser with no codec. Every rejection resolves the
   beat as "done" and flips captions on, so the lesson keeps moving and the
   words are still on screen. A member never gets stuck waiting on silence.

   MUTED IS A FIRST-CLASS PATH, not a degradation: captions come on
   automatically, beats stop auto-advancing, and every screen grows the manual
   Next it needs. The whole lesson is completable with the sound off.
   ══════════════════════════════════════════════════════════════════════════ */

const MUTE_KEY = "fic.lesson.audio.muted";
const CAPTION_KEY = "fic.lesson.audio.captions";

export interface LessonAudio {
  /** Has a real user gesture unlocked the element yet? */
  armed: boolean;
  arm: () => void;
  muted: boolean;
  toggleMuted: () => void;
  /** Full-transcript captions. OFF by default; forced on when muted or blocked. */
  captions: boolean;
  toggleCaptions: () => void;
  /** Captions the member should actually see right now. */
  captionsVisible: boolean;
  /** Can narration actually be heard? (armed, unmuted, not blocked) */
  audible: boolean;
  /** Play one segment. `onEnd` fires on natural end, on error, or immediately
   *  when nothing can be heard — callers can always rely on it. */
  play: (asset: AudioAsset | undefined, onEnd?: () => void) => void;
  /** Replay whatever is loaded, from the top. */
  replay: () => void;
  stop: () => void;
  current: AudioAsset | null;
  playing: boolean;
}

const Ctx = createContext<LessonAudio | null>(null);

export function useLessonAudio(): LessonAudio | null {
  return useContext(Ctx);
}

export function LessonAudioProvider({ children }: { children: React.ReactNode }) {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const endRef = useRef<(() => void) | null>(null);
  const [armed, setArmed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [current, setCurrent] = useState<AudioAsset | null>(null);
  const [playing, setPlaying] = useState(false);

  // One element for the whole lesson. Built on mount, torn down with the engine.
  useEffect(() => {
    const el = new Audio();
    el.preload = "auto";
    elRef.current = el;
    const done = () => {
      setPlaying(false);
      const cb = endRef.current;
      endRef.current = null;
      cb?.();
    };
    const fail = () => {
      setBlocked(true);
      done();
    };
    el.addEventListener("ended", done);
    el.addEventListener("error", fail);
    return () => {
      el.removeEventListener("ended", done);
      el.removeEventListener("error", fail);
      el.pause();
      el.src = "";
      elRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    endRef.current = null;
    const el = elRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlaying(false);
  }, []);

  const start = useCallback(
    (asset: AudioAsset, onEnd?: () => void) => {
      const el = elRef.current;
      if (!el) {
        onEnd?.();
        return;
      }
      endRef.current = onEnd ?? null;
      setCurrent(asset);
      if (el.src !== new URL(asset.url, window.location.href).href) {
        el.src = asset.url;
      }
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.then(
          () => setPlaying(true),
          (err: unknown) => {
            // A play() that WE interrupted — a newer segment called stop() on
            // its way in, or React re-ran the effect — rejects with AbortError.
            // That is the system working, not a browser refusing us. Treating
            // it as "blocked" was silently killing the rest of the lesson's
            // audio and forcing captions on; the newer play already owns
            // endRef, so this one must simply walk away.
            if ((err as { name?: string })?.name === "AbortError") return;
            // Anything else is real: autoplay policy, or a file that will not
            // decode. Show the words instead of stalling on silence.
            setBlocked(true);
            setPlaying(false);
            const cb = endRef.current;
            endRef.current = null;
            cb?.();
          }
        );
      } else {
        setPlaying(true);
      }
    },
    []
  );

  const audible = armed && !muted && !blocked;

  const play = useCallback(
    (asset: AudioAsset | undefined, onEnd?: () => void) => {
      stop();
      if (!asset) {
        setCurrent(null);
        onEnd?.();
        return;
      }
      setCurrent(asset);
      if (!armed || muted) {
        // Nothing to hear — the caption IS the beat, and the caller advances.
        onEnd?.();
        return;
      }
      start(asset, onEnd);
    },
    [armed, muted, start, stop]
  );

  const replay = useCallback(() => {
    if (!current) return;
    setBlocked(false);
    if (!armed) setArmed(true);
    if (muted) {
      setMuted(false);
      try {
        window.localStorage.setItem(MUTE_KEY, "0");
      } catch {
        /* ignore */
      }
    }
    start(current);
  }, [current, armed, muted, start]);

  // Arming is the one moment stored preferences matter, and it is a real user
  // gesture — so they are read HERE rather than in a mount effect. That keeps
  // localStorage out of render (the server has none, and a mismatched first
  // paint is a hydration error) without a cascading set-state-on-mount.
  const arm = useCallback(() => {
    try {
      if (window.localStorage.getItem(MUTE_KEY) === "1") setMuted(true);
      if (window.localStorage.getItem(CAPTION_KEY) === "1") setCaptions(true);
    } catch {
      /* private mode — defaults are fine */
    }
    setArmed(true);
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (next) stop();
      return next;
    });
  }, [stop]);

  const toggleCaptions = useCallback(() => {
    setCaptions((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(CAPTION_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<LessonAudio>(
    () => ({
      armed,
      arm,
      muted,
      toggleMuted,
      captions,
      toggleCaptions,
      // Silence must never be silent AND wordless. If they cannot hear it,
      // they read it — whatever the toggle says.
      captionsVisible: captions || muted || blocked || !armed,
      audible,
      play,
      replay,
      stop,
      current,
      playing,
    }),
    [
      armed,
      arm,
      muted,
      toggleMuted,
      captions,
      toggleCaptions,
      blocked,
      audible,
      play,
      replay,
      stop,
      current,
      playing,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ── the hook every step uses ───────────────────────────────────────────── */

/**
 * Speak one segment, and tell the caller when the voice has stopped.
 *
 * `cue` is the identity of the moment, not of the file — re-entering the same
 * beat with a new cue replays it. `done` is what an advance affordance waits
 * for: true the instant the voice stops, or immediately when there is nothing
 * to hear, so the button appears at the right time in both worlds.
 */
export function useNarration(
  asset: AudioAsset | undefined,
  cue: string,
  opts: { enabled?: boolean; onEnd?: () => void } = {}
): { done: boolean; playing: boolean } {
  const audio = useLessonAudio();
  const enabled = opts.enabled !== false;
  const [done, setDone] = useState(false);
  const onEndRef = useRef(opts.onEnd);
  onEndRef.current = opts.onEnd;

  const playFn = audio?.play;
  useEffect(() => {
    if (!enabled) return;
    setDone(false);
    let alive = true;
    if (!playFn) {
      setDone(true);
      onEndRef.current?.();
      return;
    }
    playFn(asset, () => {
      if (!alive) return;
      setDone(true);
      onEndRef.current?.();
    });
    return () => {
      alive = false;
    };
    // `cue` is the trigger; the asset is looked up fresh each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue, enabled, playFn]);

  return { done, playing: audio?.playing ?? false };
}

/**
 * Speak several segments back to back, and report WHICH one is running.
 *
 * The reveal of a prediction is the reason this exists: the headline, then each
 * authored paragraph, each landing on screen as its own sentence is spoken, with
 * the drawing animating on the segment that describes it. Callers read `index`
 * to decide how much of the reveal has arrived.
 *
 * The advance is deferred through a timer because with sound off `play()`
 * finishes synchronously — walking the queue inline would recurse inside a
 * state update. The silent path therefore lands on the last index a tick later,
 * which is exactly "show it all at once".
 */
export function useNarrationSequence(
  assets: (AudioAsset | undefined)[],
  cue: string,
  opts: { enabled?: boolean; onEnd?: () => void } = {}
): { index: number; done: boolean } {
  const audio = useLessonAudio();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const listRef = useRef(assets);
  listRef.current = assets;
  const onEndRef = useRef(opts.onEnd);
  onEndRef.current = opts.onEnd;
  const playFn = audio?.play;
  const enabled = opts.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setIndex(0);
    setDone(false);
    if (!playFn) {
      setIndex(Math.max(0, listRef.current.length - 1));
      setDone(true);
      onEndRef.current?.();
      return;
    }
    let i = 0;
    const step = () => {
      if (!alive) return;
      setIndex(i);
      playFn(listRef.current[i], () => {
        if (!alive) return;
        i += 1;
        if (i >= listRef.current.length) {
          setDone(true);
          onEndRef.current?.();
          return;
        }
        window.setTimeout(step, 0);
      });
    };
    step();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue, enabled, playFn]);

  return { index, done };
}

/* ── the on-screen pieces ───────────────────────────────────────────────── */

/** The three controls, as a quiet row. Not a card — a rail of icon buttons. */
export function AudioControls({ className = "" }: { className?: string }) {
  const audio = useLessonAudio();
  if (!audio) return null;
  const btn =
    "f0-press f0-focus grid h-8 w-8 place-items-center rounded-full border border-sand text-soft transition-colors hover:text-ink";
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={audio.replay}
        aria-label="Replay what Kai just said"
        title="Replay"
        className={btn}
        disabled={!audio.current}
      >
        <RotateCcw className="h-[15px] w-[15px]" />
      </button>
      <button
        type="button"
        onClick={audio.toggleMuted}
        aria-label={audio.muted ? "Unmute narration" : "Mute narration"}
        aria-pressed={audio.muted}
        title={audio.muted ? "Sound off" : "Sound on"}
        className={btn}
      >
        {audio.muted ? (
          <VolumeX className="h-[15px] w-[15px]" />
        ) : (
          <Volume2 className="h-[15px] w-[15px]" />
        )}
      </button>
      <button
        type="button"
        onClick={audio.toggleCaptions}
        aria-label={audio.captions ? "Hide captions" : "Show captions"}
        aria-pressed={audio.captionsVisible}
        title="Captions"
        className={btn}
        style={
          audio.captionsVisible
            ? { borderColor: "var(--accent-solid)", color: "var(--ink)" }
            : undefined
        }
      >
        <Captions className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}

/** The speaking indicator — three bars that breathe while the voice runs.
 *  Under prefers-reduced-motion it is a static dot: the state is still legible,
 *  nothing moves. */
export function SpeakingDots({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  if (!active) return null;
  if (reduce)
    return (
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--accent-solid)" }}
      />
    );
  return (
    <span aria-hidden className="inline-flex items-end gap-[3px]">
      {[0, 1, 2].map((i) => (
        <m.span
          key={i}
          className="block w-[3px] rounded-full"
          style={{ background: "var(--accent-solid)" }}
          animate={{ height: [4, 11, 4] }}
          transition={{
            duration: 0.72,
            repeat: Infinity,
            delay: i * 0.14,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

/**
 * The caption line — the FULL words Kai is saying, shown only when the member
 * asked for them (or cannot hear). This is the accessibility contract: the
 * lesson is never audio-only.
 *
 * It is deliberately typographically quiet and set below the interaction: the
 * headline is what the screen is FOR, the caption is a transcript.
 */
export function Caption({
  asset,
  fallback,
  className = "",
}: {
  asset?: { say: string };
  fallback?: string;
  className?: string;
}) {
  const audio = useLessonAudio();
  const text = asset?.say ?? fallback;
  if (!text || !audio?.captionsVisible) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      data-caption
      className={`mt-4 max-w-[62ch] border-l-2 border-sand pl-3 text-[14px] leading-relaxed text-soft ${className}`}
    >
      {text}
    </p>
  );
}
