"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./TodayIn30.module.css";

/**
 * The ▶ on "TODAY IN 30 SECONDS" — Kai reading today's brief aloud.
 *
 * Three states and no fourth:
 *   idle     ▶  the artboard's triangle
 *   loading  ▶  dimmed and inert while /api/v3/brief-audio renders
 *   playing  ■  a stop control, because a play button that cannot be stopped is
 *               a worse control than no play button
 *
 * FAILURE IS SILENT. No key, no brief, a model error, a 204 — the button goes
 * back to idle and says nothing. There is no error state and no toast: a member
 * who taps a speaker icon and hears nothing has lost a nicety, and telling them
 * about a TTS backend is telling them about our problem.
 *
 * The audio is fetched rather than handed to <audio src>, so a 204 or a 500 is
 * caught HERE, before an empty element gets a play() it cannot honour. The blob
 * URL is revoked when the clip ends and on unmount; nothing outlives the panel.
 */
type State = "idle" | "loading" | "playing";

export default function BriefPlayButton() {
  const [state, setState] = useState<State>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const teardown = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  useEffect(() => teardown, []);

  const onClick = async () => {
    if (state === "loading") return;
    if (state === "playing") {
      teardown();
      setState("idle");
      return;
    }

    setState("loading");
    try {
      const res = await fetch("/api/v3/brief-audio");
      // 204 is "there is nothing to read", not an error — same silent return.
      if (!res.ok || res.status === 204) throw new Error(`brief audio ${res.status}`);
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("brief audio empty");

      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        teardown();
        setState("idle");
      };
      audio.onerror = () => {
        teardown();
        setState("idle");
      };
      await audio.play();
      setState("playing");
    } catch {
      teardown();
      setState("idle");
    }
  };

  return (
    <button
      type="button"
      className={styles.play}
      onClick={onClick}
      disabled={state === "loading"}
      data-state={state}
      aria-label={state === "playing" ? "Stop today's brief" : "Play today's brief"}
    >
      <span className={state === "playing" ? styles.stopGlyph : styles.playGlyph} />
    </button>
  );
}
