"use client";

import { motion } from "framer-motion";

/** Floating "+N" that rises and fades. Mount via a changing key to fire. */
export default function ScorePop({
  label,
  tone = "gold",
}: {
  label: string;
  tone?: "gold" | "green" | "red";
}) {
  const color =
    tone === "green" ? "#15803D" : tone === "red" ? "#B91C1C" : "#B45309";
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 font-display text-2xl font-extrabold"
      style={{ color }}
      initial={{ opacity: 0, y: 8, scale: 0.7 }}
      animate={{ opacity: [0, 1, 1, 0], y: -56, scale: 1 }}
      transition={{ duration: 1.1, ease: "easeOut", times: [0, 0.15, 0.7, 1] }}
    >
      {label}
    </motion.div>
  );
}
