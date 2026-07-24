"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * WATCHLIST PERFORMANCE (R4) — an honest, computed aggregate of how a family's
 * watchlist has done since each name was added.
 *
 * Baseline per ticker = its snapshot_price at add-time (family_watchlist), or its
 * earliest available daily close if the snapshot is missing. The aggregate series
 * is the EQUAL-WEIGHT mean normalized return across held names on each date, built
 * from screener_history daily closes (already computed nightly — zero API load).
 *
 * Never fabricates: with no market history yet it shows a plain "tracking starts
 * soon" state rather than a flat zero line. Green for up, red for down — teal is
 * never used on price/performance data (owner decision 3).
 */

interface SnapRow {
  ticker: string;
  snapshot_price: number | null;
}
interface HistRow {
  ticker: string;
  as_of: string;
  close: number;
}

export default function WatchlistPerformance({
  tickers,
  familyId,
}: {
  tickers: string[];
  familyId: string | null;
}) {
  const [hist, setHist] = useState<HistRow[] | null>(null);
  const [snaps, setSnaps] = useState<Record<string, number>>({});

  const tKey = useMemo(() => [...new Set(tickers)].sort().join(","), [tickers]);

  useEffect(() => {
    const uniq = tKey ? tKey.split(",").filter(Boolean) : [];
    if (uniq.length === 0) {
      setHist([]);
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 120);
      const sinceStr = since.toISOString().slice(0, 10);
      const [{ data: h }, { data: s }] = await Promise.all([
        supabase
          .from("screener_history")
          .select("ticker, as_of, close")
          .in("ticker", uniq)
          .gte("as_of", sinceStr)
          .order("as_of", { ascending: true }),
        familyId
          ? supabase
              .from("family_watchlist")
              .select("ticker, snapshot_price")
              .eq("family_id", familyId)
          : Promise.resolve({ data: [] as SnapRow[] }),
      ]);
      if (cancelled) return;
      const sMap: Record<string, number> = {};
      for (const r of (s || []) as SnapRow[]) {
        if (r.snapshot_price != null && r.snapshot_price > 0)
          sMap[r.ticker] = r.snapshot_price;
      }
      setSnaps(sMap);
      setHist((h || []) as HistRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [tKey, familyId]);

  const computed = useMemo(() => {
    if (!hist) return null;
    // Group closes per ticker (already date-sorted).
    const byTicker = new Map<string, HistRow[]>();
    for (const r of hist) {
      const arr = byTicker.get(r.ticker) || [];
      arr.push(r);
      byTicker.set(r.ticker, arr);
    }
    // Baseline per ticker: snapshot price, else earliest close in window.
    const baseline = new Map<string, number>();
    for (const [t, rows] of byTicker) {
      const b = snaps[t] ?? rows[0]?.close ?? null;
      if (b != null && b > 0) baseline.set(t, b);
    }
    // Union of dates.
    const dateSet = new Set<string>();
    for (const rows of byTicker.values())
      for (const r of rows) dateSet.add(r.as_of);
    const dates = [...dateSet].sort();
    if (dates.length < 2 || baseline.size === 0) return { empty: true } as const;

    // Carry-forward last close per ticker; aggregate = mean normalized return of
    // tickers that have started (have a close on/before the date).
    const lastClose = new Map<string, number>();
    const idx = new Map<string, number>();
    for (const t of byTicker.keys()) idx.set(t, 0);
    const series: number[] = [];
    for (const d of dates) {
      for (const [t, rows] of byTicker) {
        let i = idx.get(t)!;
        while (i < rows.length && rows[i].as_of <= d) {
          lastClose.set(t, rows[i].close);
          i++;
        }
        idx.set(t, i);
      }
      let sum = 0;
      let n = 0;
      for (const [t, b] of baseline) {
        const c = lastClose.get(t);
        if (c == null) continue;
        sum += c / b - 1;
        n++;
      }
      series.push(n > 0 ? (sum / n) * 100 : 0);
    }
    // Per-ticker latest return → up/down/flat counts.
    let up = 0,
      down = 0,
      flat = 0;
    for (const [t, b] of baseline) {
      const c = lastClose.get(t);
      if (c == null) {
        flat++;
        continue;
      }
      const pct = (c / b - 1) * 100;
      if (pct > 0.5) up++;
      else if (pct < -0.5) down++;
      else flat++;
    }
    const total = series[series.length - 1] ?? 0;
    return { empty: false as const, series, up, down, flat, total };
  }, [hist, snaps]);

  // Loading
  if (hist === null) {
    return (
      <div className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
        <div className="h-4 w-40 animate-pulse rounded bg-sand" />
        <div className="mt-4 h-28 animate-pulse rounded-xl bg-sand/50" />
      </div>
    );
  }

  // Honest empty / not-enough-history state.
  if (!computed || computed.empty) {
    return (
      <div className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
        <p className="font-display text-sm font-bold text-ink">
          Watchlist Performance
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-soft">
          Performance starts tracking once your picks have a day of market
          history. Check back after the next market close.
        </p>
      </div>
    );
  }

  const { series, up, down, flat, total } = computed;
  const upTotal = total >= 0;
  const color = upTotal ? "#059669" : "#DC2626"; // emerald / red (never teal)

  // Build the SVG path (viewBox 0..W x 0..H, higher return = higher on chart).
  const W = 320;
  const H = 96;
  const min = Math.min(...series, 0);
  const max = Math.max(...series, 0);
  const range = max - min || 1;
  const x = (i: number) => (series.length === 1 ? W : (i / (series.length - 1)) * W);
  const y = (v: number) => H - ((v - min) / range) * (H - 8) - 4;
  const line = series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const zeroY = y(0);
  const gid = `wperf-${upTotal ? "up" : "dn"}`;

  return (
    <div className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-sm font-bold text-ink">
            Watchlist Performance
          </p>
          <p
            className="mt-0.5 font-display text-2xl font-extrabold tabular-nums"
            style={{ color }}
          >
            {upTotal ? "+" : ""}
            {total.toFixed(2)}%
          </p>
          <p className="text-[11px] text-soft">Average return since added</p>
        </div>
        <div className="flex items-center gap-3 text-[12px] font-semibold tabular-nums">
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <TrendingUp className="h-3.5 w-3.5" /> {up}
          </span>
          <span className="inline-flex items-center gap-1 text-red-600">
            <TrendingDown className="h-3.5 w-3.5" /> {down}
          </span>
          <span className="inline-flex items-center gap-1 text-soft">
            <Minus className="h-3.5 w-3.5" /> {flat}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-24 w-full overflow-visible"
          role="img"
          aria-label={`Watchlist aggregate return ${total.toFixed(1)}%`}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* zero baseline */}
          <line
            x1="0"
            y1={zeroY}
            x2={W}
            y2={zeroY}
            stroke="currentColor"
            className="text-sand"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <path d={area} fill={`url(#${gid})`} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}
