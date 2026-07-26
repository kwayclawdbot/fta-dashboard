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
 * Two variants, because Kai is a full-body character (~1024px tall, big head):
 *   • medallion (default) — a small circular chip that FRAMES THE FACE (the
 *     expression is the whole point inline), used by the GuideLine.
 *   • hero — the full body, uncropped, no circle, for the completion cinematic
 *     and any large moment where the celebration pose must read.
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
  | "alarmed"
  | "pointing"
  | "thumbsup"
  | "waving"
  | "laughing";

export type KaiVariant = "medallion" | "hero";

/**
 * Resolve a semantic pose to a real asset file in `public/assets/kai/`. The
 * engine speaks in intent ("presenting a mission") while the manifest ships a
 * fixed pose vocabulary — this maps intent → the canonical file so a pose can
 * never 404 into the fallback. Aliases follow the manifest's `use` mapping:
 * presenting (direct attention / CTA) → pointing.
 */
const POSE_FILE: Record<KaiPose, string> = {
  watchful: "watchful",
  teaching: "teaching",
  celebrating: "celebrating",
  thinking: "thinking",
  resting: "resting",
  alarmed: "alarmed",
  pointing: "pointing",
  thumbsup: "thumbsup",
  waving: "waving",
  laughing: "laughing",
  // alias — no `presenting.webp`; the manifest's directing-attention pose is `pointing`.
  presenting: "pointing",
};

export default function KaiGuide({
  pose = "teaching",
  size = 44,
  float = false,
  variant = "medallion",
  className = "",
}: {
  pose?: KaiPose;
  size?: number;
  float?: boolean;
  variant?: KaiVariant;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const dim = { width: size, height: size } as const;
  const file = POSE_FILE[pose] ?? "teaching";
  const hero = variant === "hero";

  if (hero) {
    // Full body, uncropped, transparent — no circle. The pose IS the moment.
    return (
      <span
        aria-hidden
        style={dim}
        className={`${styles.mascotHero} ${float ? styles.mascotFloat : ""} ${className}`}
      >
        {broken ? (
          <span
            className="grid h-full w-full place-items-center rounded-full"
            style={{ color: "#fff", background: "var(--l-kai-medallion)" }}
          >
            <Bot style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/assets/kai/${file}.webp`}
            alt=""
            className={styles.mascotHeroImg}
            onError={() => setBroken(true)}
          />
        )}
      </span>
    );
  }

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
          src={`/assets/kai/${file}.webp`}
          alt=""
          className={styles.mascotImg}
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );
}
