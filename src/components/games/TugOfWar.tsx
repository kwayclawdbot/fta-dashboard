"use client";

import { m, useReducedMotion } from "@/lib/motion";

/**
 * Tug-of-war meter — the deck's core metaphor. Green team (buyers) pull left,
 * red team (sellers) pull right. The knot leans toward whoever is winning the
 * battle right now. `lean` is -1..1 (+1 = buyers fully winning).
 *
 * COLOUR LAW: this is the law's own exception, not a breach of it — the two
 * teams literally ARE the direction of price, which is the one thing green and
 * red are reserved for. The two winning LABELS therefore use the semantic price
 * stops (text-price-up / text-price-down) rather than raw `green-400`/`red-500`,
 * so they track the same values every price figure in the app uses and stay
 * correct when the ramp is retuned. The zone washes stay on the raw ramp on
 * purpose: they are a translucent field on a dark stage, not type, and the
 * semantic stops are tuned for text contrast rather than for a 25% wash.
 */
export default function TugOfWar({ lean }: { lean: number }) {
  const reduce = useReducedMotion();
  const l = Math.max(-1, Math.min(1, lean));
  // knot travels within the middle 76% of the track; +lean pulls it left (green)
  const knotPct = 50 - l * 38;
  const tension = Math.abs(l);
  const buyersWin = l > 0.06;
  const sellersWin = l < -0.06;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2 text-[11px] font-display font-bold tracking-wide">
        <span className={buyersWin ? "text-price-up" : "text-night-300"}>
          GREEN TEAM · BUYERS
        </span>
        <span className={sellersWin ? "text-price-down" : "text-night-300"}>
          SELLERS · RED TEAM
        </span>
      </div>

      <div className="relative h-11 rounded-full bg-night-800 border border-white/5 overflow-hidden">
        {/* team zones */}
        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-green-500/25 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-red-500/25 to-transparent" />
        {/* center marker */}
        <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-px bg-white/20" />

        {/* rope */}
        <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gradient-to-r from-green-500/60 via-white/25 to-red-500/60" />

        {/* knot / flag */}
        <m.div
          className="absolute top-1/2 z-10"
          style={{ transform: "translate(-50%, -50%)" }}
          animate={{
            left: `${knotPct}%`,
            rotate: reduce ? 0 : sellersWin ? 6 : buyersWin ? -6 : 0,
          }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
        >
          <div
            className="w-7 h-7 rounded-full border-2 border-white/70 shadow-lg flex items-center justify-center"
            style={{
              background: buyersWin
                ? "radial-gradient(circle at 35% 30%, #4ADE80, #16A34A)"
                : sellersWin
                  ? "radial-gradient(circle at 35% 30%, #F87171, #DC2626)"
                  : "radial-gradient(circle at 35% 30%, #FCD34D, #D97706)",
            }}
          >
            <m.span
              className="block w-2 h-2 rounded-full bg-white/90"
              animate={reduce ? {} : { scale: [1, 1.25 + tension * 0.5, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          </div>
        </m.div>
      </div>

      <p className="mt-2 text-center text-xs font-medium text-night-300">
        {buyersWin
          ? "Buyers are pulling the price up"
          : sellersWin
            ? "Sellers are dragging the price down"
            : "Dead even — the rope hasn't moved yet"}
      </p>
    </div>
  );
}
