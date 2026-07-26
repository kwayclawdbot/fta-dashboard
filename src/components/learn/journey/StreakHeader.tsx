"use client";

import { Flame } from "lucide-react";
import type { Register } from "@/lib/register";
import { registerSkin } from "@/lib/learn/worlds";
import { beltForXp } from "@/lib/belts";
import { levelForXp } from "@/lib/xp";

/**
 * StreakHeader — the journey's opening line (FIC-LEARNING-WORLD §3): register
 * eyebrow · level/belt · streak · XP. Built on the open canvas (PageIntro tier),
 * not a card. Register-scaled copy; the belt is the earned competency read.
 */
export default function StreakHeader({
  register,
  xp,
  streakDays,
}: {
  register: Register;
  xp: number;
  streakDays: number;
}) {
  const skin = registerSkin(register);
  const belt = beltForXp(xp);
  const level = levelForXp(xp);

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
          {skin.journeyEyebrow}
        </p>
        <h1 className="font-display text-[28px] font-black leading-none tracking-tight text-ink sm:text-[34px]">
          {register === "kid"
            ? "Let's learn!"
            : register === "teen"
              ? "Level up"
              : "Keep building"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-soft">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: belt.belt.hex, boxShadow: `0 0 0 1px ${belt.belt.borderHex}` }}
              aria-hidden
            />
            <span className="font-semibold text-ink">{belt.label}</span>
            <span className="text-soft">· {level.name}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center rounded-2xl bg-[color-mix(in_srgb,var(--accent-solid)_12%,transparent)] px-4 py-2">
          <span className="inline-flex items-center gap-1 font-display text-xl font-black text-[var(--accent-strong)]">
            <Flame className="h-5 w-5" strokeWidth={2.4} />
            {streakDays}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-soft">
            day streak
          </span>
        </div>
        <div className="flex flex-col items-center rounded-2xl bg-sand/50 px-4 py-2">
          <span className="font-display text-xl font-black text-ink">
            {xp.toLocaleString()}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-soft">
            total XP
          </span>
        </div>
      </div>
    </header>
  );
}
