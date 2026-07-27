"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import CompanyLogo from "@/components/fic/CompanyLogo";
import { fetchBars, type MarketBar, type MarketQuote } from "@/lib/market/client";
import type { ResearchPayload } from "@/lib/research/types";

/**
 * Canvas Ticker Research — board 04 rebuilt pixel-faithful to the "Ticker
 * research" artboard. Composition, top → bottom:
 *
 *   · HEADER          — back · centered "TICKER RESEARCH / Deep dives…" label
 *   · IDENTITY        — company name · ticker·company · big price · delta ·
 *                       ticker imagery slot (brand gradient + logo fallback)
 *   · RANGE TABS      — 1D · 1W · 1M · 3M · 1Y · 5Y (teal active pill)
 *   · CHART           — area line built from the real bars for the range
 *   · WHAT THE CLUB   — sentiment donut + bull/neutral/bear splits
 *     THINKS            (get_ticker_community_stats — floors at 4 positioned)
 *   · KEY METRICS     — market cap · P/E (fwd) hairline rows
 *   · ASK KAI BAND    — blue→teal gradient hand-off
 *
 * No fabricated numbers: price/delta render only when the quote supplies them;
 * the chart shows a calm "updating" state when bars are empty; the donut hides
 * below the 4-positioned floor. Metrics render a row only when the value exists.
 */

const RANGES: { key: string; label: string; api: string; tf?: string }[] = [
  { key: "1D", label: "1D", api: "1d", tf: "15m" },
  { key: "1W", label: "1W", api: "5d" },
  { key: "1M", label: "1M", api: "1m" },
  { key: "3M", label: "3M", api: "3m" },
  { key: "1Y", label: "1Y", api: "1y" },
  { key: "5Y", label: "5Y", api: "5y" },
];

interface CommunityStats {
  watching: number;
  discussions_week: number;
  bull: number;
  neutral: number;
  bear: number;
  positioned: number;
}

function fmtPrice(p?: number | null): string | null {
  if (p == null || !Number.isFinite(p)) return null;
  return `$${p.toFixed(2)}`;
}

/* ── Area chart — one gradient-filled line from the range's closes. ────────── */
function AreaChart({ bars, up }: { bars: MarketBar[]; up: boolean }) {
  const gid = `rc-${useId().replace(/:/g, "")}`;
  const W = 320;
  const H = 150;
  const padY = 14;
  if (bars.length < 2) {
    return (
      <div className="grid h-[150px] w-full place-items-center rounded-xl">
        <p className="text-sm text-soft">Chart updating…</p>
      </div>
    );
  }
  const closes = bars.map((b) => b.c);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const stepX = W / (bars.length - 1);
  const y = (v: number) => padY + (H - padY * 2) * (1 - (v - min) / span);
  const pts = bars.map((b, i) => `${(i * stepX).toFixed(1)},${y(b.c).toFixed(1)}`);
  const line = pts.join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const stroke = up ? "#15803d" : "#dc2626";
  const hi = max.toFixed(0);
  const mid = ((max + min) / 2).toFixed(0);
  const lo = min.toFixed(0);
  return (
    <div className="flex gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[150px] w-full" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gid})`} />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex shrink-0 flex-col justify-between py-1 font-mono text-xs tabular-nums text-soft">
        <span>{hi}</span>
        <span>{mid}</span>
        <span>{lo}</span>
      </div>
    </div>
  );
}

/* ── What the club thinks — sentiment donut + splits ──────────────────────── */
function ClubThinks({ stats, ticker }: { stats: CommunityStats; ticker: string }) {
  const total = stats.positioned;
  const bull = Math.round((stats.bull / total) * 100);
  const neutral = Math.round((stats.neutral / total) * 100);
  const bear = Math.max(0, 100 - bull - neutral);
  const R = 42;
  const C = 2 * Math.PI * R;
  const segs = [
    { pct: bull, color: "#15803d", label: "Bullish" },
    { pct: neutral, color: "#9a8c73", label: "Neutral" },
    { pct: bear, color: "#dc2626", label: "Bearish" },
  ];
  let offset = 0;
  return (
    <section className="border-t border-sand pt-6">
      <h2 className="font-display text-[17px] font-extrabold uppercase tracking-tight text-ink">
        What the club thinks
      </h2>
      <p className="mt-0.5 text-sm text-soft">
        {total.toLocaleString()} member{total === 1 ? "" : "s"} analyzing {ticker}
      </p>
      <div className="mt-4 flex items-center gap-6">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#eadfce" strokeWidth="11" />
            {segs.map((s, i) => {
              const len = (s.pct / 100) * C;
              const el = (
                <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth="11" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
              );
              offset += len;
              return el;
            })}
          </svg>
        </div>
        <div className="flex-1 space-y-2.5">
          {segs.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 text-[15px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-mono font-bold tabular-nums text-ink">{s.pct}%</span>
              <span className="text-soft">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CanvasResearchTop({
  ticker,
  companyName,
  quote,
  research,
  supabase,
  backHref,
  onAskKai,
}: {
  ticker: string;
  companyName: string;
  quote: MarketQuote | null;
  research: ResearchPayload | null;
  supabase: SupabaseClient;
  backHref: string;
  onAskKai: () => void;
}) {
  const [range, setRange] = useState("1D");
  const [bars, setBars] = useState<MarketBar[]>([]);
  const [barsLoading, setBarsLoading] = useState(true);
  const [stats, setStats] = useState<CommunityStats | null>(null);

  useEffect(() => {
    let on = true;
    const cfg = RANGES.find((r) => r.key === range) ?? RANGES[0];
    setBarsLoading(true);
    const url = cfg.tf
      ? `/api/market/bars?symbol=${encodeURIComponent(ticker)}&tf=${cfg.tf}`
      : null;
    const p = url
      ? fetch(url).then((r) => (r.ok ? r.json() : null)).then((d) => (d?.bars as MarketBar[]) ?? []).catch(() => [])
      : fetchBars(ticker, cfg.api).catch(() => []);
    p.then((b) => {
      if (!on) return;
      setBars(b);
      setBarsLoading(false);
    });
    return () => {
      on = false;
    };
  }, [ticker, range]);

  useEffect(() => {
    let on = true;
    supabase.rpc("get_ticker_community_stats", { p_ticker: ticker }).then(({ data }) => {
      if (!on) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setStats(row as CommunityStats);
    });
    return () => {
      on = false;
    };
  }, [supabase, ticker]);

  const price = quote?.price ?? null;
  const changePct = quote?.changePercent ?? null;
  const dollarChange = useMemo(() => {
    if (price == null || quote?.prevClose == null) return null;
    return price - quote.prevClose;
    // (derived only when both marks are present — never fabricated)
  }, [price, quote?.prevClose]);
  const up = changePct == null ? true : changePct >= 0;
  const exchange = research?.company.exchange ?? null;

  const metrics: { label: string; value: string }[] = [];
  const mcap = research?.keyStats.marketCapText;
  if (mcap) metrics.push({ label: "Market cap", value: mcap });
  const pe = research?.keyStats.pe;
  if (pe != null && Number.isFinite(pe)) metrics.push({ label: "P/E (fwd)", value: `${pe.toFixed(1)}x` });

  return (
    <div>
      {/* Header */}
      <div className="relative flex items-center justify-center pt-4 pb-2">
        <Link
          href={backHref}
          aria-label="Back"
          className="absolute left-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-sand/60"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <p className="font-display text-[13px] font-extrabold uppercase tracking-[0.14em] text-ink">
            Ticker Research
          </p>
          <p className="text-xs text-soft">Deep dives with club sentiment</p>
        </div>
      </div>

      {/* Identity + price + imagery */}
      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-tight text-ink">
            {companyName}
          </h1>
          <p className="mt-0.5 truncate font-mono text-[15px] text-soft">
            <span className={up ? "font-semibold text-green-600" : "font-semibold text-red-600"}>{ticker}</span>{" "}
            {research?.company.name && research.company.name !== companyName ? research.company.name : companyName}
          </p>
          {price != null ? (
            <>
              <p className="mt-2 font-display text-[46px] font-extrabold leading-none tracking-tight text-ink tabular-nums">
                {fmtPrice(price)}
              </p>
              {changePct != null && (
                <p className={`mt-1.5 font-display text-[17px] font-bold ${up ? "text-green-600" : "text-red-600"}`}>
                  {up ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
                  {dollarChange != null && (
                    <span> ({up ? "+" : "−"}${Math.abs(dollarChange).toFixed(2)})</span>
                  )}
                  <span className="text-soft"> Today</span>
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-soft">Price updating…</p>
          )}
        </div>
        {/* Ticker imagery slot — graceful brand gradient with the logo */}
        <div
          className="relative grid h-[110px] w-[150px] shrink-0 place-items-center overflow-hidden rounded-2xl shadow-soft"
          style={{ background: "linear-gradient(145deg,#0B1220 0%,#101A2E 55%,#0A2320 100%)" }}
        >
          <CompanyLogo symbol={ticker} name={companyName} size={56} rounded="rounded-xl" />
        </div>
      </div>

      {/* Range tabs */}
      <div className="mt-5 flex items-center gap-1 rounded-2xl border border-sand bg-card p-1 shadow-soft">
        {RANGES.map((r) => {
          const active = r.key === range;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`flex-1 rounded-xl py-2 font-display text-sm font-bold transition-colors ${
                active ? "bg-teal-400/25 text-teal-800" : "text-soft hover:text-ink"
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="mt-4">
        {barsLoading && bars.length === 0 ? (
          <div className="h-[150px] animate-pulse rounded-xl bg-sand/40" />
        ) : (
          <AreaChart bars={bars} up={up} />
        )}
      </div>

      {/* What the club thinks */}
      {stats && stats.positioned >= 4 && (
        <div className="mt-6">
          <ClubThinks stats={stats} ticker={ticker} />
        </div>
      )}

      {/* Key metrics */}
      {metrics.length > 0 && (
        <section className="mt-6 border-t border-sand pt-6">
          <h2 className="mb-3 font-display text-[17px] font-extrabold uppercase tracking-tight text-ink">
            Key metrics
          </h2>
          <div className="overflow-hidden rounded-2xl border border-sand bg-card shadow-soft">
            {metrics.map((m, i) => (
              <div
                key={m.label}
                className={`flex items-center justify-between px-4 py-3.5 ${i > 0 ? "border-t border-sand" : ""}`}
              >
                <span className="text-[15px] text-soft">{m.label}</span>
                <span className="font-display text-[16px] font-extrabold tabular-nums text-ink">{m.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ask Kai band */}
      <button
        type="button"
        onClick={onAskKai}
        className="mt-6 flex w-full items-center justify-between gap-3 rounded-2xl border border-kai-300/60 px-5 py-4 text-left shadow-soft transition-transform active:scale-[0.99]"
        style={{ background: "linear-gradient(105deg,#c7d2fe 0%,#bfdbdb 55%,#bbf7d0 100%)" }}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-display text-[19px] font-extrabold tracking-tight text-midnight-900">
            <Sparkles className="h-4.5 w-4.5" /> Ask Kai
          </span>
          <span className="mt-0.5 block text-sm text-midnight-700">Get deeper insight on {ticker}</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-midnight-900" />
      </button>
      {exchange && <span className="sr-only">{exchange}</span>}
    </div>
  );
}
