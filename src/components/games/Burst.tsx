"use client";

import { m, useReducedMotion } from "@/lib/motion";
import { useMemo } from "react";

/**
 * Lightweight particle burst — pure framer-motion transforms/opacity, no deps.
 * Mount it (via a changing key) to fire. Sits absolutely inside a relative
 * parent and is pointer-events-none so it never blocks the UI.
 */
export default function Burst({
  colors = ["#FBBF24", "#F59E0B", "#22C55E", "#38BDF8"],
  count = 18,
  power = 120,
}: {
  colors?: string[];
  count?: number;
  power?: number;
}) {
  const reduce = useReducedMotion();
  const parts = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = power * (0.5 + Math.random() * 0.7);
        return {
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          size: 5 + Math.random() * 7,
          color: colors[i % colors.length],
          rot: Math.random() * 360,
          delay: Math.random() * 0.06,
        };
      }),
    [colors, count, power]
  );

  if (reduce) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-visible">
      {/* ring pulse */}
      <m.span
        className="absolute rounded-full border-2"
        style={{ borderColor: colors[0] }}
        initial={{ width: 20, height: 20, opacity: 0.7 }}
        animate={{ width: power * 2, height: power * 2, opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {parts.map((p) => (
        <m.span
          key={p.id}
          className="absolute rounded-[2px]"
          style={{ width: p.size, height: p.size, background: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            x: p.x,
            y: p.y + 30,
            opacity: 0,
            rotate: p.rot,
            scale: 0.3,
          }}
          transition={{ duration: 0.7 + Math.random() * 0.3, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
