"use client";

import { m } from "@/lib/motion";

/**
 * Floating "+N" that rises and fades. Mount via a changing key to fire.
 *
 * It always renders INSIDE the night-island stage, which is deliberately dark
 * in both themes, so these values are chosen against that dark ground rather
 * than against the page — the old gold (#B45309) and green (#15803D) both sat
 * under 3:1 on it. Points are not a price, so the default tone is the warm
 * combo amber; the price tones remain available for a price-shaped readout.
 */
export default function ScorePop({
  label,
  tone = "gold",
}: {
  label: string;
  tone?: "gold" | "green" | "red";
}) {
  const color =
    tone === "green" ? "#4ADE80" : tone === "red" ? "#F87171" : "#FBBF24";
  return (
    <m.div
      className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 font-display text-2xl font-extrabold"
      style={{ color }}
      initial={{ opacity: 0, y: 8, scale: 0.7 }}
      animate={{ opacity: [0, 1, 1, 0], y: -56, scale: 1 }}
      transition={{ duration: 1.1, ease: "easeOut", times: [0, 0.15, 0.7, 1] }}
    >
      {label}
    </m.div>
  );
}
