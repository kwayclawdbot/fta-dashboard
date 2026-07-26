"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import CompanyLogo from "@/components/fic/CompanyLogo";

/**
 * TickerRow — the ONE stock-row primitive (Lane A visual normalization).
 *
 * Consolidates the ≥6 ad-hoc ticker renderings the cohesion audit catalogued
 * (Discover row · Screener card · Watchlist entry · …) into a single shape:
 *
 *   [ leading? ]  [ logo chip ]  symbol / company   …right-aligned metric slots
 *
 * The right side is a `children` slot so each surface keeps its own metrics
 * (sparkline+price, screener stats, board deltas) with ZERO data/handler change
 * — only the frame, logo chip, symbol/name typography and hover are shared.
 *
 * Hover is register-aware via `.ticker-row` (globals.css): a faint accent tint
 * that is gold in Family Mode, volt in Club, metallic on the FTA desk.
 */
export default function TickerRow({
  symbol,
  name,
  logoSize = 30,
  leading,
  href,
  onClick,
  children,
  className = "",
  interactive = true,
}: {
  symbol: string;
  name?: string | null;
  logoSize?: number;
  /** Optional leading element (rank number, checkbox, drag handle). */
  leading?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Right-aligned metric slot(s). */
  children?: ReactNode;
  className?: string;
  /** Apply the accent hover affordance (off for static/read-only rows). */
  interactive?: boolean;
}) {
  const cls = `flex items-center gap-3 rounded-xl px-2.5 py-2.5 ${
    interactive ? "ticker-row transition-colors" : ""
  } ${className}`;

  const inner = (
    <>
      {leading}
      <CompanyLogo symbol={symbol} name={name} size={logoSize} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{symbol}</p>
        {name ? <p className="truncate text-[11px] text-soft">{name}</p> : null}
      </div>
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`w-full text-left ${cls}`}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}
