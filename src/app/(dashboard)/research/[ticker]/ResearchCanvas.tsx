"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Sparkles } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import CompanyLogo from "@/components/fic/CompanyLogo";
import { fetchBars, type MarketBar, type MarketQuote } from "@/lib/market/client";
import { formatExchange } from "@/lib/market/exchange";
import { fmtMcap, fmtVol } from "@/lib/screener";
import type { ResearchPayload } from "@/lib/research/types";

/**
 * RESEARCH CANVAS — the identity + market head of /research/[ticker].
 *
 * This is the densest surface in the app, and that is correct HERE and only
 * here: a member arrives to decide something, so the numbers get to crowd.
 * Density is achieved with RULES, never with boxes — the composition is
 *
 *   identity (logo at scale · display name · $CASHTAG · big mono price)
 *   ────────────────────────────────────────────────────────────────────
 *   fundamentals as hairline-separated COLUMNS (thin vertical rules)
 *   52-week range as a physical rail with the price tick on it
 *   range tabs → price chart
 *   Ask Kai band (Kai blue)
 *
 * COLOUR LAW, enforced here:
 *   • green / red  — price only (the change readout + the chart stroke/fill)
 *   • orange       — brand + action only (the active range tab, never a number)
 *   • Kai blue     — the Kai band
 *   • lime         — community sentiment, and it lives in ClubRead, not here
 *
 * REAL DATA ONLY. Every metric is rendered from a source that actually resolved:
 *   market cap · P/E  → /api/research/[ticker] aggregate (Polygon financials)
 *   volume            → screener_metrics (the nightly grouped-daily cron)
 *   52-week range     → the daily bar series (accurate) with the aggregate as
 *                       the fallback until bars land
 * A column that RESOLVED to nothing renders "—". A column whose source hasn't
 * resolved yet renders nothing at all, so the strip never claims an absence it
 * hasn't verified — and nothing is ever invented to fill the grid.
 */

/* ── ranges ────────────────────────────────────────────────────────────────
   Only the windows the market API can genuinely serve. The daily path
   (/api/market/bars?range=) tops out at 2y, and there is no 5y series, so no
   5Y tab exists — an empty tab is a lie with a nicer label. 1D/1W come off the
   intraday path; the rest slice the 2y daily series the page already loaded,
   so switching those ranges costs zero requests. */
type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "2Y";

const RANGES: {
  key: RangeKey;
  /** intraday timeframe (tf=) — daily-slice ranges leave this null */
  tf: string | null;
  /** window in ms used to slice whichever series backs the range */
  windowMs: number;
}[] = [
  { key: "1D", tf: "15m", windowMs: 0 }, // 0 → "the last session present"
  { key: "1W", tf: "1h", windowMs: 7 * 864e5 },
  { key: "1M", tf: null, windowMs: 31 * 864e5 },
  { key: "3M", tf: null, windowMs: 92 * 864e5 },
  { key: "1Y", tf: null, windowMs: 366 * 864e5 },
  { key: "2Y", tf: null, windowMs: 0 },
];

interface ScreenerVolume {
  vol: number | null;
  avg_vol_20: number | null;
  mcap: number | null;
}

function money(v: number | null | undefined, dp = 2): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

/* ── The chart ─────────────────────────────────────────────────────────────
   One stroke + one wash, green or red by the direction of the WINDOW (not of
   the day) — the chart is price, so it is the one place those two colours are
   allowed to carry meaning. Price labels ride the right edge in mono against a
   hairline, so the plot needs no frame. */
function PriceChart({ bars, loading }: { bars: MarketBar[]; loading: boolean }) {
  const gid = `rcg-${useId().replace(/:/g, "")}`;
  const W = 640;
  const H = 172;
  const padY = 12;

  if (loading && bars.length === 0) {
    return <div className="h-[172px] animate-pulse rounded-lg bg-sand/40" aria-hidden />;
  }
  if (bars.length < 2) {
    return (
      <div className="flex h-[172px] items-center border-y border-sand">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
          Price series unavailable for this window
        </p>
      </div>
    );
  }

  const closes = bars.map((b) => b.c);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const stepX = W / (bars.length - 1);
  const y = (v: number) => padY + (H - padY * 2) * (1 - (v - min) / span);
  const line = bars.map((b, i) => `${(i * stepX).toFixed(1)},${y(b.c).toFixed(1)}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const up = closes[closes.length - 1] >= closes[0];
  // The canonical price tokens: same hue in both themes, different ramp step,
  // so the stroke keeps its meaning AND stays legible on the dark page.
  const stroke = up ? "var(--color-price-up)" : "var(--color-price-down)";

  return (
    <div className="flex items-stretch gap-3">
      <div className="relative min-w-0 flex-1 border-y border-sand">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-[172px] w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.20" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.015" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gid})`} />
          <polyline
            points={line}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="flex w-[62px] shrink-0 flex-col justify-between py-1 font-mono text-[10.5px] tabular-nums text-soft">
        <span>{max.toFixed(2)}</span>
        <span>{((max + min) / 2).toFixed(2)}</span>
        <span>{min.toFixed(2)}</span>
      </div>
    </div>
  );
}

/* ── 52-week rail ──────────────────────────────────────────────────────────
   A physical track with the current price sitting on it. The tick is INK, not
   green or red: it marks a position in a range, it is not a direction. */
function RangeRail({
  low,
  high,
  price,
}: {
  low: number | null;
  high: number | null;
  price: number | null;
}) {
  if (low == null || high == null || high <= low) return null;
  const pos = price == null ? null : Math.max(0, Math.min(1, (price - low) / (high - low)));
  return (
    <div className="mt-5">
      <div className="relative h-[3px] w-full rounded-full bg-sand">
        {pos != null && (
          <span
            className="absolute top-1/2 h-3.5 w-[3px] -translate-y-1/2 rounded-full bg-ink"
            style={{ left: `calc(${(pos * 100).toFixed(2)}% - 1.5px)` }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        <span>52w low {low.toFixed(2)}</span>
        <span>52w high {high.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function ResearchCanvas({
  ticker,
  companyName,
  quote,
  research,
  dailyBars,
  supabase,
  back,
  onAskKai,
}: {
  ticker: string;
  companyName: string;
  quote: MarketQuote | null;
  research: ResearchPayload | null;
  /** the 2y daily close series the page already loads (slices the long ranges) */
  dailyBars: MarketBar[];
  supabase: SupabaseClient;
  back: { href: string; label: string };
  onAskKai: () => void;
}) {
  const [range, setRange] = useState<RangeKey>("3M");
  const [intraday, setIntraday] = useState<Record<string, MarketBar[]>>({});
  const [screener, setScreener] = useState<ScreenerVolume | null>(null);
  const [screenerResolved, setScreenerResolved] = useState(false);
  const asked = useRef<Set<string>>(new Set());

  /* Volume is not part of the research aggregate — it lives in screener_metrics
     (same nightly Polygon grouped-daily pull that powers the screener). One
     read, fails soft: no row → the volume column reports "—", never a guess. */
  useEffect(() => {
    let on = true;
    supabase
      .from("screener_metrics")
      .select("vol, avg_vol_20, mcap")
      .eq("ticker", ticker)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (!on) return;
          setScreener((data as ScreenerVolume) ?? null);
          setScreenerResolved(true);
        },
        () => {
          if (on) setScreenerResolved(true);
        }
      );
    return () => {
      on = false;
    };
  }, [supabase, ticker]);

  /* Intraday windows only. The daily ranges slice `dailyBars`, which the page
     already has, so tabbing 1M↔2Y never hits the network. */
  useEffect(() => {
    const cfg = RANGES.find((r) => r.key === range);
    if (!cfg?.tf) return;
    const key = cfg.tf;
    if (asked.current.has(key)) return;
    asked.current.add(key);
    let on = true;
    // No separate `loading` flag: an ABSENT key means "in flight", and a failed
    // fetch writes an empty array. One source of truth, no effect-time setState.
    fetch(`/api/market/bars?symbol=${encodeURIComponent(ticker)}&tf=${key}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on) return;
        setIntraday((prev) => ({ ...prev, [key]: (d?.bars as MarketBar[]) ?? [] }));
      })
      .catch(() => {
        if (on) setIntraday((prev) => ({ ...prev, [key]: [] }));
      });
    return () => {
      on = false;
    };
  }, [ticker, range]);

  /* Fallback: if the page never handed us daily bars (a failed load upstream),
     pull the 2y series here rather than showing a permanently empty chart. */
  useEffect(() => {
    if (dailyBars.length > 0 || asked.current.has("daily")) return;
    asked.current.add("daily");
    let on = true;
    fetchBars(ticker, "2y").then((b) => {
      if (on && b.length) setIntraday((prev) => ({ ...prev, daily: b }));
    });
    return () => {
      on = false;
    };
  }, [ticker, dailyBars.length]);

  const daily = useMemo(
    () => (dailyBars.length > 0 ? dailyBars : intraday.daily ?? []),
    [dailyBars, intraday.daily]
  );

  /* Windows are anchored to the NEWEST BAR IN THE FEED, not to the wall clock.
     Over a weekend (or when the feed lags) a wall-clock cut silently returns an
     empty series and the chart claims the data is missing when it is simply
     older than "now". Anchoring keeps the window honest and the render pure. */
  const visible = useMemo(() => {
    const cfg = RANGES.find((r) => r.key === range) ?? RANGES[3];
    const series = cfg.tf ? intraday[cfg.tf] ?? [] : daily;
    if (series.length === 0) return [];
    const newest = series[series.length - 1].t;

    if (cfg.key === "1D") {
      // The last SESSION present in the feed, not "the last 24 hours".
      const lastDay = new Date(newest).toDateString();
      return series.filter((b) => new Date(b.t).toDateString() === lastDay);
    }
    if (cfg.windowMs === 0) return series;
    const win = series.filter((b) => b.t >= newest - cfg.windowMs);
    // Never fall back to an unusable 1-point chart: show the full series instead.
    return win.length >= 2 ? win : series;
  }, [range, intraday, daily]);

  const rangeTf = RANGES.find((r) => r.key === range)?.tf ?? null;
  const loading = rangeTf ? intraday[rangeTf] === undefined : daily.length === 0;

  /* Window delta — derived from the first and last close of what is actually
     drawn, so the label can never disagree with the line above it. */
  const windowPct = useMemo(() => {
    if (visible.length < 2) return null;
    const a = visible[0].c;
    const b = visible[visible.length - 1].c;
    if (!a) return null;
    return ((b - a) / a) * 100;
  }, [visible]);

  // 52-week extremes: prefer the true series max/min, fall back to the aggregate.
  const week52 = useMemo(() => {
    if (daily.length >= 20) {
      const closes = daily.slice(-252).map((b) => b.c);
      return { low: Math.min(...closes), high: Math.max(...closes) };
    }
    const k = research?.keyStats;
    if (k?.week52Low != null && k?.week52High != null) {
      return { low: k.week52Low, high: k.week52High };
    }
    return null;
  }, [daily, research]);

  const price = quote?.price ?? null;
  const chgPct = quote?.changePercent ?? null;
  const chgAbs =
    quote?.change ?? (price != null && quote?.prevClose != null ? price - quote.prevClose : null);
  const up = (chgPct ?? 0) >= 0;
  const exchange = research?.company.exchange ? formatExchange(research.company.exchange) : null;

  /* ── the fundamentals columns ───────────────────────────────────────────
     `ready` is what keeps this honest: a column only appears once its SOURCE
     has answered. Answered-with-nothing renders "—"; hasn't-answered renders
     nothing at all. */
  const researchReady = research != null;
  const cols: { label: string; value: string | null; ready: boolean }[] = [
    {
      label: "Market cap",
      value:
        research?.keyStats.marketCapText ??
        (research?.keyStats.marketCap != null
          ? fmtMcap(research.keyStats.marketCap)
          : screener?.mcap != null
            ? fmtMcap(screener.mcap)
            : null),
      ready: researchReady || screenerResolved,
    },
    {
      label: "P/E",
      value:
        research?.keyStats.pe != null && Number.isFinite(research.keyStats.pe)
          ? `${research.keyStats.pe.toFixed(1)}×`
          : null,
      ready: researchReady,
    },
    {
      // Volume carries its own context when the 20-day average is available:
      // "42.1M 1.3×" says more than a raw share count ever does. The multiple
      // is only appended when BOTH figures exist — never derived from one.
      label: "Volume",
      value:
        screener?.vol != null
          ? screener.avg_vol_20 != null && screener.avg_vol_20 > 0
            ? `${fmtVol(screener.vol)} ${(screener.vol / screener.avg_vol_20).toFixed(1)}×`
            : fmtVol(screener.vol)
          : null,
      ready: screenerResolved,
    },
    {
      label: "52w range",
      value: week52 ? `${week52.low.toFixed(2)}–${week52.high.toFixed(2)}` : null,
      ready: week52 != null || researchReady,
    },
  ];
  const shownCols = cols.filter((c) => c.ready);

  return (
    <div>
      {/* back — quiet, mono, no chrome */}
      <Link
        href={back.href}
        className="inline-flex items-center gap-1.5 pt-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {back.label}
      </Link>

      {/* ── IDENTITY ──────────────────────────────────────────────────────── */}
      <div className="mt-5 flex items-start gap-4">
        <CompanyLogo symbol={ticker} name={companyName} size={64} rounded="rounded-2xl" />
        <div className="min-w-0 flex-1 pt-0.5">
          <h1 className="font-display text-display-2 font-extrabold text-ink line-clamp-2">
            {companyName}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em]">
            <span className="font-semibold text-ink">${ticker}</span>
            {exchange && (
              <>
                <span className="h-3 w-px bg-sand" aria-hidden />
                <span className="text-soft">{exchange}</span>
              </>
            )}
            {research?.company.sector && (
              <>
                <span className="h-3 w-px bg-sand" aria-hidden />
                <span className="text-soft">{research.company.sector}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* the mark */}
      <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-1">
        {price != null ? (
          <span className="font-mono text-[42px] font-semibold leading-none tabular-nums text-ink">
            {money(price)}
          </span>
        ) : (
          <span className="font-mono text-[42px] font-semibold leading-none text-soft/50">—</span>
        )}
        {chgPct != null && (
          <span
            className={`font-mono text-[15px] font-semibold tabular-nums ${
              up ? "text-price-up" : "text-price-down"
            }`}
          >
            {up ? "+" : "−"}
            {Math.abs(chgPct).toFixed(2)}%
            {chgAbs != null && (
              <span className="ml-2 text-[13px] font-medium opacity-80">
                {up ? "+" : "−"}
                {Math.abs(chgAbs).toFixed(2)}
              </span>
            )}
          </span>
        )}
      </div>
      <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-soft/80">
        {quote?.delayed === false ? "Real time" : "Delayed ~15 min"}
      </p>

      {/* ── FUNDAMENTALS — hairline columns, thin vertical rules ──────────── */}
      {shownCols.length > 0 && (
        <div className="mt-6 flex border-y border-sand">
          {shownCols.map((c, i) => (
            <div
              key={c.label}
              className={`min-w-0 flex-1 py-3.5 ${i > 0 ? "border-l border-sand pl-3.5" : "pr-3.5"}`}
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-soft">
                {c.label}
              </p>
              <p
                className={`mt-1.5 truncate font-mono text-[14.5px] font-semibold tabular-nums ${
                  c.value ? "text-ink" : "text-soft/60"
                }`}
              >
                {c.value ?? "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 52-week rail — the range column, made physical */}
      <RangeRail low={week52?.low ?? null} high={week52?.high ?? null} price={price} />

      {/* ── RANGE TABS + CHART ────────────────────────────────────────────── */}
      <div className="mt-7 flex items-center justify-between gap-3 border-b border-sand pb-2">
        <div className="flex items-center gap-1" role="tablist" aria-label="Chart range">
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(r.key)}
                className={`relative px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  active ? "text-gold-700" : "text-soft hover:text-ink"
                }`}
              >
                {r.key}
                {active && (
                  <span className="absolute inset-x-1.5 -bottom-[9px] h-[2px] rounded-full bg-gold-500" />
                )}
              </button>
            );
          })}
        </div>
        {windowPct != null && (
          <span
            className={`shrink-0 font-mono text-[12px] font-semibold tabular-nums ${
              windowPct >= 0 ? "text-price-up" : "text-price-down"
            }`}
          >
            {windowPct >= 0 ? "+" : "−"}
            {Math.abs(windowPct).toFixed(2)}%
            <span className="ml-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-soft">
              {range}
            </span>
          </span>
        )}
      </div>
      <div className="mt-3">
        <PriceChart bars={visible} loading={loading} />
      </div>

      {/* ── ASK KAI ───────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onAskKai}
        className="f0-grain relative mt-7 flex w-full items-center justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-kai-500 to-kai-700 px-5 py-4 text-left transition-transform active:scale-[0.995] dark:from-kai-400 dark:to-kai-600"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/75">
            <Sparkles className="h-3 w-3" aria-hidden /> Kai
          </span>
          <span className="mt-1.5 block font-display text-[18px] font-bold leading-tight text-white">
            Ask Kai about ${ticker}
          </span>
          <span className="mt-1 block text-[12.5px] leading-snug text-white/70">
            What&apos;s moving it, what the numbers say, what to watch next.
          </span>
        </span>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-white" aria-hidden />
      </button>
    </div>
  );
}
