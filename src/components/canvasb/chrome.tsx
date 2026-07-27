"use client";

import Link from "next/link";
import {
  Home,
  Search,
  MessageSquare,
  Bookmark,
  CircleUser,
} from "lucide-react";

/**
 * Canvas rebuild B3 — shared app chrome for boards 06/07/08.
 * Pixel-faithful to the `Cheat Code Club - App UI.dc.html` artboards: the warm
 * CHEAT CODE CLUB masthead (square infinity logo + stacked wordmark) and the
 * five-item bottom nav (Home · Discover · The Club · Watchlist · You). Composed
 * from typography + rules, not generic card containers.
 */

/* ── the infinity mark — the C◇C successor logo (square black tile, volt/teal
   interlocked loop). Self-contained SVG, no asset dependency. ──────────────── */
export function InfinityMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[11px] bg-midnight-950"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.62} height={size * 0.36} viewBox="0 0 62 36" fill="none">
        <path
          d="M18 6c-7 0-12 5-12 12s5 12 12 12c8 0 12-9 18-9"
          stroke="var(--color-volt-500)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M44 30c7 0 12-5 12-12S51 6 44 6c-8 0-12 9-18 9"
          stroke="var(--color-teal-400)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function ClubWordmark() {
  return (
    <span className="font-display text-[13px] font-extrabold uppercase leading-[1.02] tracking-[0.04em] text-volt-600">
      Cheat
      <br />
      Code
      <br />
      Club
    </span>
  );
}

/* ── top bar — logo + wordmark left; optional search + avatar right ────────── */
export function TopBar({
  avatarUrl,
  showSearch = true,
}: {
  avatarUrl?: string | null;
  showSearch?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-4">
      <div className="flex items-center gap-2.5">
        <InfinityMark size={40} />
        <ClubWordmark />
      </div>
      <div className="flex items-center gap-3.5">
        {showSearch && <Search className="h-[22px] w-[22px] text-ink" aria-hidden />}
        <span
          className="grid h-11 w-11 place-items-center overflow-hidden rounded-full ring-2 ring-volt-500"
          aria-hidden
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="h-full w-full bg-midnight-800" />
          )}
        </span>
      </div>
    </div>
  );
}

/* ── bottom nav — five items, active tinted volt ──────────────────────────── */
const NAV = [
  { label: "Home", icon: Home, href: "/dashboard" },
  { label: "Discover", icon: Search, href: "/discover" },
  { label: "The Club", icon: MessageSquare, href: "/community" },
  { label: "Watchlist", icon: Bookmark, href: "/watchlist" },
  { label: "You", icon: CircleUser, href: "/you" },
] as const;

export function TabBar({ active }: { active: (typeof NAV)[number]["label"] }) {
  return (
    <nav className="flex items-stretch justify-between border-t border-sand bg-paper px-3 pb-2 pt-2.5">
      {NAV.map(({ label, icon: Icon, href }) => {
        const on = label === active;
        return (
          <Link
            key={label}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 ${
              on ? "text-volt-600" : "text-soft"
            }`}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={on ? 2.4 : 2} />
            <span className={`text-[11px] ${on ? "font-bold" : "font-medium"}`}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ── display masthead — big volt title + soft subline ─────────────────────── */
export function DisplayTitle({
  title,
  sub,
}: {
  title: string;
  sub: string;
}) {
  return (
    <div className="px-5 pt-3">
      <h1 className="font-display text-[40px] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] text-volt-600">
        {title}
      </h1>
      <p className="mt-1 font-display text-[17px] font-medium text-soft">{sub}</p>
    </div>
  );
}
