"use client";

/**
 * DiscoverV2Spark — the cc-canvas sparkline for the v2 Discover surface.
 *
 * The v1 board draws its sparklines with `<TickerSpark>` (components/discover/
 * board.tsx), which tones off the BASE `text-price-up/down` tokens — the warm
 * paper ramp. On the cc canvas a line must read from `--cc-*` only, so this
 * primitive fetches the SAME real 3-month closes (no synthesised series) and
 * hands them to the cc `Sparkline` (auto-tones cc-up green / cc-down pink).
 *
 * It is a NEW primitive built under the Discover route dir (the cc kit has no
 * data-fetching sparkline, and board.tsx is off-limits / v1-tokened). It keeps
 * the two costs board.tsx already solved: the fetch is deferred until the line
 * scrolls into view, and deduplicated through a module promise cache so a ticker
 * drawn three times on the surface is fetched once. No bars → nothing draws
 * (the slot holds its height so the row never reflows when a line lands).
 */
import { useEffect, useRef, useState } from "react";
import { fetchBars } from "@/lib/market/client";
import { Sparkline } from "@/components/cc/ui";

const barCache = new Map<string, Promise<number[]>>();

function loadCloses(symbol: string): Promise<number[]> {
  const key = symbol.toUpperCase();
  let p = barCache.get(key);
  if (!p) {
    p = fetchBars(key, "3m")
      .then((bars) => bars.map((b) => b.c))
      .catch(() => []);
    barCache.set(key, p);
  }
  return p;
}

export function DiscoverV2Spark({
  symbol,
  width = 72,
  height = 24,
  className = "",
}: {
  symbol: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [closes, setCloses] = useState<number[] | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    let live = true;
    loadCloses(symbol).then((c) => {
      if (live && c.length >= 2) setCloses(c);
    });
    return () => {
      live = false;
    };
  }, [seen, symbol]);

  return (
    <span
      ref={host}
      className={`inline-block ${className}`}
      style={{ height, width }}
      role={closes ? "img" : "presentation"}
      aria-label={closes ? `${symbol.toUpperCase()} three-month price trend` : undefined}
    >
      {closes ? (
        <Sparkline points={closes} width={width} height={height} />
      ) : null}
    </span>
  );
}
