"use client";

import Link from "next/link";
import { beltProgress } from "@/lib/belts";
import { Belt, BeltMark } from "@/components/art";

/**
 * Persistent self-visibility belt chip. Shows the member's current belt (color
 * swatch + short name) and a compact XP progress bar toward their next belt/
 * degree. Links to the Leaderboard so the chip is the always-present door into
 * the earned axis.
 *
 * Two shapes:
 *   compact — TopBar (sm+). Belt mark + name + slim bar in a rounded pill.
 *   full    — mobile More-sheet header. Adds the "N XP to <next>" line.
 *
 * Both shapes used to draw the belt as a coloured tile with the belt's first
 * LETTER in it ("W", "B", "B" — Black and Blue collided, which is how you know
 * an initial was never the right mark). Both now draw the belt object itself at
 * a size that resolves it: 34px in the sheet header, 20px in the top bar. The
 * chip is not a LevelObject and shouldn't be — it lives in the dark chrome on
 * midnight tokens, not on the page surface, and it is a NAVIGATION affordance
 * whose bar is a hint rather than a readout.
 *
 * XP is resolved by the parent (DashboardShell) so both instances share one
 * fetch; while it is null a neutral skeleton renders so layout never jumps.
 */

/**
 * THE BAR THAT LOOKED EMPTY. Both bars filled themselves in `belt.hex`, which
 * works for the three mid-tone belts and fails completely for the two ends of
 * the ladder — exactly the failure BeltBadge already documents for its label.
 * A White Belt (#E8EAF0) painting onto the midnight-800 track (#EFEAE1 on the
 * light board) is white on off-white: the fill IS there, at the right width,
 * and no one can see it. Since every new member starts on White, the drawer
 * read as a broken empty bar to precisely the people whose first impression it
 * was. Black had the mirror-image problem on the night board.
 *
 * So the two neutral belts hand the FILL back to the progress accent — the same
 * gold the canonical LevelObject uses — and keep their identity in the drawn
 * belt sitting next to it, which is what the belt drawing is for. The three
 * belts that can colour a bar still do.
 */
const NEUTRAL_BELTS = new Set(["white", "black"]);

function barFill(belt: { key: string; hex: string }): string {
  return NEUTRAL_BELTS.has(belt.key) ? "var(--color-gold-600, #C24400)" : belt.hex;
}

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
        <Belt
          belt={belt.key}
          degree={bp.current.degree}
          size={34}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-midnight-50 truncate">
            {bp.current.label}
          </p>
          <div className="mt-1 h-1.5 rounded-full bg-midnight-800 overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{ width: `${bp.pct}%`, backgroundColor: barFill(belt) }}
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
      <BeltMark belt={belt.key} size={20} className="shrink-0" />
      <span className="hidden md:inline font-display text-[11px] font-bold text-midnight-100 whitespace-nowrap">
        {bp.current.short}
      </span>
      <span className="w-12 h-1.5 rounded-full bg-midnight-800 overflow-hidden">
        <span
          className="block h-full rounded-full"
          style={{ width: `${bp.pct}%`, backgroundColor: barFill(belt) }}
        />
      </span>
    </Link>
  );
}
