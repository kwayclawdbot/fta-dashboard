"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * WATCHLIST PERFORMANCE — the ONE dark object on the watchlist surface.
 *
 * The canvas rebuild moved this off a bordered white card and onto the F0 hero
 * field: an obsidian full-bleed panel carrying an oversized mono return, the
 * up/down/flat split, and the aggregate curve. The warm-sand page is light, so
 * this single dark field is what lets one object actually dominate the screen —
 * everything below it is hairline ledger, never another box.
 *
 * DATA (unchanged, honest): baseline per ticker = its snapshot_price at add-time
 * (family_watchlist), or its earliest available daily close if the snapshot is
 * missing. The aggregate series is the EQUAL-WEIGHT mean normalized return across
 * held names on each date, built from screener_history daily closes (computed
 * nightly — zero API load).
 *
 * Never fabricates: with no market history yet it says so plainly rather than
 * drawing a flat zero line.
 *
 * COLOUR LAW: this object is PRICE, so green/red are the only semantic colours
 * on it. No lime (community sentiment), no orange (brand/action).
 *
 * THEME: `.f0-hero-field` is deliberately obsidian in BOTH themes and sets its
 * own cream foreground, so everything in here inherits that colour — no literal
 * hex, no bg-white, no text-white. Secondary type is the inherited cream at a
 * reduced opacity and the chart strokes are `currentColor`, which is why the
 * whole object reads identically on the cream page and on the #17120B night page.
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

  // ── Loading ───────────────────────────────────────────────────────────────
  if (hist === null) {
    return (
      <section className="f0-hero-field f0-grain px-5 py-7 sm:px-8">
        <Eyebrow />
        <div className="mt-4 h-11 w-48 animate-pulse rounded-md bg-current opacity-10" />
        <div className="mt-6 h-24 w-full animate-pulse rounded-lg bg-current opacity-[0.06]" />
      </section>
    );
  }

  // ── Honest empty / not-enough-history ─────────────────────────────────────
  if (!computed || computed.empty) {
    return (
      <section className="f0-hero-field f0-grain px-5 py-7 sm:px-8">
        <Eyebrow />
        <p className="mt-3 font-display text-display-3 font-extrabold">
          Tracking starts at the next close
        </p>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed opacity-65">
          Your names need a day of market history before there is a real number
          here. Nothing is estimated in the meantime.
        </p>
      </section>
    );
  }

  const { series, up, down, flat, total } = computed;
  const upTotal = total >= 0;
  // PRICE ramp only. Both steps are chosen to clear on obsidian, which is what
  // the hero field is in light AND dark.
  const priceTone = upTotal ? "text-price-up-island" : "text-price-down-island";

  // Build the SVG path (viewBox 0..W x 0..H, higher return = higher on chart).
  const W = 640;
  const H = 108;
  const min = Math.min(...series, 0);
  const max = Math.max(...series, 0);
  const range = max - min || 1;
  const x = (i: number) => (series.length === 1 ? W : (i / (series.length - 1)) * W);
  const y = (v: number) => H - ((v - min) / range) * (H - 10) - 5;
  const line = series
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const zeroY = y(0);
  const gid = `wperf-${upTotal ? "up" : "dn"}`;

  return (
    <section className="f0-hero-field f0-grain px-5 py-7 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <Eyebrow />
          <p
            className={`mt-2.5 font-mono text-[44px] font-semibold leading-none tracking-tight tabular-nums ${priceTone}`}
          >
            {upTotal ? "+" : ""}
            {total.toFixed(2)}%
          </p>
          <p className="mt-2 text-[12px] leading-snug opacity-55">
            Equal-weight average return since each name was added
          </p>
        </div>

        {/* up / down / flat — a split, not three stat cards */}
        <dl className="flex items-end gap-6">
          <Split label="Up" value={up} dot="bg-price-up-island" />
          <Split label="Down" value={down} dot="bg-price-down-island" />
          <Split label="Flat" value={flat} dot="bg-current opacity-45" />
        </dl>
      </div>

      {/* The svg inherits the field's cream, so the zero rule is currentColor;
          only the series itself is re-coloured to the price ramp. */}
      <div className="mt-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-24 w-full overflow-visible sm:h-28"
          role="img"
          aria-label={`Watchlist aggregate return ${total.toFixed(1)} percent`}
        >
          <line
            x1="0"
            y1={zeroY}
            x2={W}
            y2={zeroY}
            stroke="currentColor"
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          <g className={priceTone}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.34" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`} />
            <path
              d={line}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </svg>
      </div>
    </section>
  );
}

function Eyebrow() {
  return (
    <span className="font-mono text-eyebrow font-semibold uppercase opacity-55">
      Watchlist performance
    </span>
  );
}

function Split({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  /** utility classes for the tone dot — price ramp or inherited cream */
  dot: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] opacity-55">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 font-mono text-[26px] font-semibold leading-none tabular-nums">
        {value}
      </dd>
    </div>
  );
}
