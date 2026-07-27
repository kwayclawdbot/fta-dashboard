"use client";

import { m, useReducedMotion } from "@/lib/motion";

/**
 * Streak flame — grows and flickers with the streak count. Deck-warm, no emoji.
 */
export default function StreakFlame({
  streak,
  size = 22,
  showZero = false,
}: {
  streak: number;
  size?: number;
  showZero?: boolean;
}) {
  const reduce = useReducedMotion();
  const active = streak > 0;
  const intensity = Math.min(streak, 8) / 8; // 0..1
  const scale = 0.85 + intensity * 0.5;
  const hot = intensity > 0.55;

  return (
    <span className="inline-flex items-center gap-1.5 leading-none">
      <m.svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ transformOrigin: "50% 90%" }}
        animate={
          reduce || !active
            ? { scale }
            : {
                scale: [scale, scale * 1.12, scale * 0.96, scale],
                rotate: [0, -3, 3, 0],
              }
        }
        transition={{ duration: 0.7, repeat: active && !reduce ? Infinity : 0, ease: "easeInOut" }}
      >
        <defs>
          {/* An unlit flame is an EMPTY SLOT, so it takes the page's own sand
              token and re-maps with the theme. The old hardcoded #D8CDB4 /
              #E4DBC6 / #EAE2D0 were light-theme sand values and rendered as a
              pale grey blob on the dark page. The lit flame keeps its intrinsic
              amber in both themes — fire is fire. */}
          <linearGradient id="flame-g" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={active ? "#D97706" : "var(--sand)"} />
            <stop offset="55%" stopColor={active ? "#F59E0B" : "var(--sand)"} />
            <stop
              offset="100%"
              stopColor={active ? (hot ? "#FDE68A" : "#FBBF24") : "var(--m800)"}
            />
          </linearGradient>
        </defs>
        <path
          d="M12 2c1.6 3.2.4 5-1 6.6C9.4 10.4 8 12 8 14.6A4 4 0 0016 15c0-1.8-.8-3-1.4-4 .9.3 1.6 1 2 2 .6-2.2-.2-4.4-1.6-6.2C13.8 5.2 13.2 3.4 12 2z"
          fill="url(#flame-g)"
        />
        {active && hot && (
          <m.path
            d="M12 11c.9.8 1.4 1.8 1.4 3A1.4 1.4 0 0110.6 14c0-1 .5-2 1.4-3z"
            fill="#FFFBEB"
            animate={reduce ? {} : { opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </m.svg>
      {(active || showZero) && (
        <span
          className={`font-display font-bold tabular-nums ${
            active ? "text-gold-600" : "text-soft"
          }`}
        >
          {streak}
        </span>
      )}
    </span>
  );
}
