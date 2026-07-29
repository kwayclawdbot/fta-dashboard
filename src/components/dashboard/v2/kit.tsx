"use client";

/**
 * Cheat Code App v2 — shell chrome kit. Small pieces the sidebar / top bar /
 * tab bar share so the identity kit renders identically everywhere a face or a
 * belt appears. Everything reads from --cc-* tokens (with dark fallbacks so the
 * one pre-hydration frame is not unstyled). No v1 midnight/gold tokens here.
 */
import Link from "next/link";
import { beltProgress } from "@/lib/belts";
import { BELT_COLORS } from "@/components/cc/ui";

/** Two-letter initials from a name/email (same rule the v1 sidebar uses). */
export function initialsOf(nameOrEmail?: string): string {
  return (nameOrEmail || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Belt hex from a belt key, via the intrinsic cc BELT_COLORS map. */
function beltHex(key: string): string {
  return BELT_COLORS[key] ?? BELT_COLORS.white;
}

/**
 * Belt identity chip — belt-ringed initials + belt name + a slim progress hint,
 * the top-bar counterpart of the mobile More-sheet belt row. Links to the
 * leaderboard (the earned axis). `xp == null` renders a footprint-matched
 * skeleton so nothing shifts while XP loads.
 */
export function BeltChipV2({
  xp,
  initials,
  href = "/leaderboard",
  onNavigate,
  className = "",
}: {
  xp: number | null;
  initials: string;
  href?: string;
  onNavigate?: () => void;
  className?: string;
}) {
  if (xp == null) {
    return (
      <span
        className={`hidden sm:flex h-8 items-center gap-2 rounded-full px-2 ${className}`}
        style={{ border: "1px solid var(--cc-line, #2b2731)" }}
      >
        <span
          className="h-4 w-4 animate-pulse rounded-full"
          style={{ background: "var(--cc-card2, #232028)" }}
        />
        <span
          className="h-1.5 w-10 animate-pulse rounded-full"
          style={{ background: "var(--cc-card2, #232028)" }}
        />
      </span>
    );
  }

  const bp = beltProgress(xp);
  const key = bp.current.belt.key;
  const ring = beltHex(key);
  const toNext = bp.next
    ? `${bp.toNext.toLocaleString()} XP to ${bp.next.short}`
    : "Black Belt — top belt reached";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={`${bp.current.label} · ${toNext}`}
      aria-label={`${bp.current.label}, ${toNext}. Open leaderboard`}
      className={`hidden sm:flex h-8 items-center gap-2 rounded-full pl-1 pr-2.5 transition-colors ${className}`}
      style={{ border: "1px solid var(--cc-line, #2b2731)" }}
    >
      <span
        className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold"
        style={{
          background: "var(--cc-card2, #232028)",
          color: "var(--cc-ink, #f4f0ec)",
          border: `2px solid ${ring}`,
        }}
      >
        {initials}
      </span>
      <span
        className="hidden md:inline font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--cc-soft, #8d8794)" }}
      >
        {bp.current.short}
      </span>
      <span
        className="h-1.5 w-10 overflow-hidden rounded-full"
        style={{ background: "var(--cc-card2, #232028)" }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${bp.pct}%`, background: ring }}
        />
      </span>
    </Link>
  );
}

/**
 * Full belt row — the mobile More-sheet header variant: larger belt-ringed
 * initials, belt label, progress bar and the "N XP to next" line.
 */
export function BeltRowV2({
  xp,
  initials,
  href = "/leaderboard",
  onNavigate,
}: {
  xp: number | null;
  initials: string;
  href?: string;
  onNavigate?: () => void;
}) {
  if (xp == null) {
    return (
      <div className="flex items-center gap-3 px-2 py-2.5">
        <span
          className="h-9 w-9 animate-pulse rounded-full"
          style={{ background: "var(--cc-card2, #232028)" }}
        />
        <div className="flex-1 space-y-1.5">
          <span
            className="block h-3 w-24 animate-pulse rounded"
            style={{ background: "var(--cc-card2, #232028)" }}
          />
          <span
            className="block h-1.5 w-full animate-pulse rounded-full"
            style={{ background: "var(--cc-card2, #232028)" }}
          />
        </div>
      </div>
    );
  }

  const bp = beltProgress(xp);
  const ring = beltHex(bp.current.belt.key);
  const toNext = bp.next
    ? `${bp.toNext.toLocaleString()} XP to ${bp.next.short}`
    : "Black Belt — top belt reached";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors"
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold"
        style={{
          background: "var(--cc-card2, #232028)",
          color: "var(--cc-ink, #f4f0ec)",
          border: `2px solid ${ring}`,
        }}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold"
          style={{ color: "var(--cc-ink, #f4f0ec)" }}
        >
          {bp.current.label}
        </p>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--cc-card2, #232028)" }}
        >
          <span
            className="block h-full rounded-full"
            style={{ width: `${bp.pct}%`, background: ring }}
          />
        </div>
        <p
          className="mt-1 truncate font-[family-name:var(--font-plex-mono)] text-[10px]"
          style={{ color: "var(--cc-dim, #5d5865)" }}
        >
          {toNext}
        </p>
      </div>
    </Link>
  );
}
