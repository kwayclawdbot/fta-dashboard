"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import styles from "./skin.module.css";

/**
 * Kai mascot slot (Track A / A3 + CINEMATIC-LAYER §1). Renders the canonical
 * chrome-blue Kai character from `public/assets/kai/{pose}.webp` when the
 * asset lane has produced it; until then it degrades to the Kai-blue medallion
 * mark (the SAME identity as the shell's Kai FAB) — NEVER the generic sparkle.
 *
 * Poses are wired semantically by the caller:
 *   teaching → explainers · celebrating → correct / completion ·
 *   thinking → wrong-answer explains · resting → errors ·
 *   presenting → real-world missions · watchful → intro.
 */

export type KaiPose =
  | "watchful"
  | "presenting"
  | "celebrating"
  | "thinking"
  | "resting"
  | "teaching"
  | "alarmed";

export default function KaiGuide({
  pose = "teaching",
  size = 44,
  float = false,
  className = "",
}: {
  pose?: KaiPose;
  size?: number;
  float?: boolean;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const dim = { width: size, height: size } as const;

  return (
    <span
      aria-hidden
      style={dim}
      className={`${styles.mascot} ${float ? styles.mascotFloat : ""} ${className}`}
    >
      {broken ? (
        <span
          className="grid h-full w-full place-items-center"
          style={{ color: "#fff" }}
        >
          <Bot style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2.2} />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/assets/kai/${pose}.webp`}
          alt=""
          className={styles.mascotImg}
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );
}
