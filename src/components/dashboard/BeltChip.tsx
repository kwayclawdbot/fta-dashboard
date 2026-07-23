"use client";

import Link from "next/link";
import { beltProgress } from "@/lib/belts";

/**
 * Persistent self-visibility belt chip. Shows the member's current belt (color
 * swatch + short name) and a compact XP progress bar toward their next belt/
 * degree. Links to the Leaderboard so the chip is the always-present door into
 * the earned axis.
 *
 * Two shapes:
 *   compact — TopBar (sm+). Swatch + name + slim bar in a rounded pill.
 *   full    — mobile More-sheet header. Adds the "N XP to <next>" line.
 *
 * XP is resolved by the parent (DashboardShell) so both instances share one
 * fetch; while it is null a neutral skeleton renders so layout never jumps.
 */

export default function BeltChip({
  xp,
  variant = "compact",
  href = "/leaderboard",
  onNavigate,
}: {
  xp: number | null;
  variant?: "compact" | "full";
  href?: string;
  onNavigate?: () => void;
}) {
  // Skeleton while XP loads — sized to the real chip so nothing shifts.
  if (xp == null) {
    if (variant === "full") {
      return (
        <div className="flex items-center gap-3 px-2 py-2.5">
          <span className="w-9 h-9 rounded-lg bg-midnight-800 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <span className="block h-3 w-24 rounded bg-midnight-800 animate-pulse" />
            <span className="block h-1.5 w-full rounded-full bg-midnight-800 animate-pulse" />
          </div>
        </div>
      );
    }
    return (
      <span className="hidden sm:flex items-center gap-2 h-8 px-2.5 rounded-full border border-midnight-700/60">
        <span className="w-3 h-3 rounded-full bg-midnight-800 animate-pulse" />
        <span className="h-1.5 w-12 rounded-full bg-midnight-800 animate-pulse" />
      </span>
    );
  }

  const bp = beltProgress(xp);
  const { belt } = bp.current;
  const toNextLabel = bp.next
    ? `${bp.toNext.toLocaleString()} XP to ${bp.next.short}`
    : "Black Belt — top belt reached";

  if (variant === "full") {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-midnight-950 transition-colors"
      >
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center font-display text-[11px] font-black shrink-0"
          style={{ backgroundColor: belt.hex, color: belt.onHex, boxShadow: `inset 0 0 0 1px ${belt.borderHex}` }}
        >
          {belt.name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-midnight-50 truncate">
            {bp.current.label}
          </p>
          <div className="mt-1 h-1.5 rounded-full bg-midnight-800 overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{ width: `${bp.pct}%`, backgroundColor: belt.hex }}
            />
          </div>
          <p className="mt-1 text-[11px] text-midnight-500 truncate">{toNextLabel}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={`${bp.current.label} · ${toNextLabel}`}
      aria-label={`${bp.current.label}, ${toNextLabel}. Open leaderboard`}
      className="hidden sm:flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-full border border-midnight-700/60 hover:border-midnight-600 hover:bg-midnight-800/40 transition-colors"
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center font-display text-[9px] font-black shrink-0"
        style={{ backgroundColor: belt.hex, color: belt.onHex, boxShadow: `inset 0 0 0 1px ${belt.borderHex}` }}
      >
        {belt.name[0]}
      </span>
      <span className="hidden md:inline font-display text-[11px] font-bold text-midnight-100 whitespace-nowrap">
        {bp.current.short}
      </span>
      <span className="w-12 h-1.5 rounded-full bg-midnight-800 overflow-hidden">
        <span
          className="block h-full rounded-full"
          style={{ width: `${bp.pct}%`, backgroundColor: belt.hex }}
        />
      </span>
    </Link>
  );
}
