"use client";

/**
 * Card-shaped loading placeholder — matches the LivingCard footprint exactly so
 * the shelf never shifts when real cards resolve: same max width per size, same
 * 5:7 aspect, same 18px frame radius, same inset stack of slots.
 *
 * LOADING, not EMPTY. Every pulsing bar stands where a real VALUE will land
 * (symbol, denomination, market value, growth, footer ledger); nothing here
 * claims an absence.
 *
 * The ground is `--island`, the app's declared dark-island token — the real
 * LivingCard face IS near-black in both themes (it is a collectible object, not
 * a page surface), so the skeleton has to be near-black too or the swap would
 * flash. That is also why the slots are translucent `white/xx`: on a dark
 * island a token wash would be the wrong direction. The frame hairline stays on
 * `--sand` so the card still reads as part of the paper shelf around it.
 */

import type { LivingCardSize } from "./LivingCard";

const MAX_W: Record<LivingCardSize, string> = {
  shelf: "100%",
  detail: "340px",
  hero: "420px",
};

export default function LivingCardSkeleton({
  size = "shelf",
}: {
  size?: LivingCardSize;
}) {
  return (
    <div className="w-full" style={{ maxWidth: MAX_W[size] }}>
      <div
        aria-busy
        className="relative overflow-hidden rounded-[18px] border border-sand"
        style={{ aspectRatio: "5 / 7", background: "var(--island)" }}
      >
        <div className="flex h-full animate-pulse flex-col p-5">
          <div className="flex justify-between">
            <div className="h-3 w-20 rounded-full bg-white/8" />
            <div className="h-3 w-14 rounded-full bg-white/8" />
          </div>
          <div className="mt-4 h-8 w-28 rounded-md bg-white/10" />
          <div className="mt-2 h-2.5 w-20 rounded-full bg-white/6" />
          <div className="mt-4 h-6 w-24 rounded-md bg-white/8" />
          <div className="flex-1" />
          <div className="h-7 w-32 rounded-md bg-white/12" />
          <div className="mt-2 h-3 w-24 rounded-full bg-white/6" />
          <div className="mt-4 h-px w-full bg-white/8" />
          <div className="mt-2 flex justify-between">
            <div className="h-2.5 w-24 rounded-full bg-white/6" />
            <div className="h-2.5 w-16 rounded-full bg-white/6" />
          </div>
        </div>
      </div>
    </div>
  );
}
