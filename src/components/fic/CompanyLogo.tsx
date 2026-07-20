"use client";

import { useState } from "react";

/**
 * Real company logo via our /api/market/logo proxy (Polygon company-branding —
 * the legal real-logo source; the key is appended server-side, never exposed).
 * Falls back to a warm gold monogram chip if the company has no branding image
 * or the fetch fails — so a card never shows a broken image box.
 */
export default function CompanyLogo({
  symbol,
  name,
  size = 44,
  rounded = "rounded-xl",
  className = "",
}: {
  symbol: string;
  name?: string | null;
  size?: number;
  rounded?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const dim = { width: size, height: size };
  const label = (name || symbol || "?").trim();
  const mono = label
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (broken || !symbol) {
    return (
      <div
        style={dim}
        className={`flex shrink-0 items-center justify-center ${rounded} bg-chip-amber font-display text-sm font-bold text-gold-700 ${className}`}
        aria-label={label}
      >
        {mono || "?"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/market/logo?symbol=${encodeURIComponent(symbol)}`}
      alt={`${label} logo`}
      loading="lazy"
      style={dim}
      onError={() => setBroken(true)}
      className={`shrink-0 ${rounded} bg-white object-contain p-1 ring-1 ring-sand ${className}`}
    />
  );
}
