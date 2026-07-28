"use client";

/**
 * The games surface's streak flame — now a thin wrapper over the drawn art
 * layer rather than a second flame of its own.
 *
 * This file used to own a gradient-filled flame that flickered on a 0.7s loop.
 * It was a different mark from the emoji the rest of the app shipped, which is
 * how the same member could see three different flames in one session. There is
 * one ember now (`@/components/art/StreakFlame`), and this module survives only
 * so the existing `games/*` importers keep working with the props they already
 * pass. New call sites should import from `@/components/art` directly.
 */
import ArtStreakFlame from "@/components/art/StreakFlame";

export default function StreakFlame({
  streak,
  size = 22,
  showZero = false,
}: {
  streak: number;
  size?: number;
  showZero?: boolean;
}) {
  return <ArtStreakFlame streak={streak} size={size} showZero={showZero} />;
}
