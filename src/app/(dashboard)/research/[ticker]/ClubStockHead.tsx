"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plus, Share2, Star } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import CompanyLogo from "@/components/fic/CompanyLogo";
import SetAlertButton, { type AlertLevel } from "@/components/alerts/SetAlertButton";
import type { MarketBar, MarketQuote } from "@/lib/market/client";
import { formatExchange } from "@/lib/market/exchange";
import { fmtMcap } from "@/lib/screener";
import { fmtBound } from "@/lib/research/labels";
import { useClientNow } from "@/lib/research/clock";
import type { ResearchPayload } from "@/lib/research/types";
import { Card } from "@/components/research/board";
import type { ClubReadData } from "./ClubRead";

/**
 * CLUB-MODE STOCK DETAIL HEAD — the owner's dark mockup (board "NVDA
 * Corporation" phone, ChatGPT Image Aug 7 2026 10:07:23), rebuilt
 * object-for-object for `mode === "club"` ONLY. Family / kid keep the
 * ResearchCanvas composition byte-for-byte — the branch lives in
 * ResearchClient, not here.
 *
 *   ←  [logo]  NVIDIA Corporation                    🔔  ★  ↗
 *              NVDA · NASDAQ
 *   $184.59
 *   + 8.47 (+4.82%)  Today
 *   (mockup's "After Hours $185.20 +0.61" line: NO after-hours source exists
 *    in /api/market/quote, so per the real-data rule the slot renders the
 *    feed-freshness line instead — a true statement from a real field.)
 *   [1D] [1W] [1M] [3M] [1Y] [ALL]         ← pills ABOVE the chart, as drawn
 *   ┌ chart — candles on intraday windows (tf bars carry OHLC), an area line
 *   │ on daily windows (the daily feed is closes-only) — dotted grid, price
 *   │ axis on the right (186 · 182 · 178 · 174), session stamps underneath ┐
 *   9:30 AM      12 PM       3 PM       6 PM
 *   [Market Cap $4.55T] [P/E (TTM) 68.2] [Revenue (TTM) $60.9B] [EPS (TTM) 2.71]
 *   ┌ Community Sentiment — 81% Bullish ·· bar ·· 19% Bearish ┐
 *   (mockup's "Top Member Sentiment (Rated > 70%)": no rated-member store
 *    exists, so the object is omitted rather than invented.)
 *   [ + Watchlist ]  [ Create Opinion ]   ← orange CTA → /community (the
 *    structured composer at /community/compose is retired and itself
 *    redirects there)
 *
 * REAL DATA ONLY — every object states its source:
 *   price / move        → /api/market/quote (delayed ~15 min)
 *   candles             → /api/market/bars?tf=15m|1h (OHLC)
 *   the line            → /api/market/bars?range=2y daily closes (page's lane)
 *   market cap · P/E    → /api/research/[ticker] keyStats
 *   revenue (TTM)       → sum of the last four research quarters
 *   EPS (TTM)           → keyStats.epsTtm
 *   community sentiment → useClubRead (ticker_stances / community stats /
 *                         intel snapshots), same floor the club read uses
 *   + Watchlist         → family_watchlist (same row the /watchlist board reads)
 * A source that resolved to NOTHING renders nothing (wells are filtered, the
 * sentiment card needs the split floor); a source that hasn't answered renders
 * its own loading shape.
 *
 * SEMANTIC TOKENS ONLY: green/red are --color-price-up/-down (the mockup's
 * candle + sentiment hues ARE those tokens' club values), the CTA is volt
 * brand orange, planes are card/sand/ink/soft — so the dark club theme comes
 * out of the tokens with no `dark:` variants.
 */

/* ── ranges ────────────────────────────────────────────────────────────────
   The mockup draws 1D · 1W · 1M · 3M · 1Y · 5Y. The daily feed tops out at
   two years, so the last pill is labelled ALL and IS that 2y series — a pill
   that says 5Y over 2y of data would lie. (Same honesty call the family
   canvas already made.) */
type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";
const RANGE_KEYS = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;
const RANGES: Record<RangeKey, { tf: string | null; windowMs: number }> = {
  "1D": { tf: "15m", windowMs: 0 },
  "1W": { tf: "1h", windowMs: 7 * 864e5 },
  "1M": { tf: null, windowMs: 31 * 864e5 },
  "3M": { tf: null, windowMs: 92 * 864e5 },
  "1Y": { tf: null, windowMs: 366 * 864e5 },
  ALL: { tf: null, windowMs: 0 },
};

/** The intraday tf path returns OHLCV; the daily path returns closes only.
 *  One shape covers both — o/h/l absent means "closes-only, draw the line". */
interface OhlcBar {
  t: number;
  o?: number;
  h?: number;
  l?: number;
  c: number;
  v?: number;
}

/* Copied floor (ClubRead.SPLIT_FLOOR is not exported; rules say copy small
   patterns locally): the split only draws once this many members positioned —
   a "100% Bullish" bar built from one person is an anecdote, not a read. */
const SPLIT_FLOOR = 4;

function money(v: number | null | undefined, dp = 2): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

/* ── the chart ─────────────────────────────────────────────────────────────
   The mockup's plot is CANDLES over a soft green wash with a dotted grid, a
   right-hand price axis and session stamps underneath. Candles need OHLC,
   which only the intraday tf feed carries — so 1D/1W draw true candles and
   the daily windows draw the area line (the honest rendering of a
   closes-only series). */
function ClubChart({
  bars,
  loading,
  range,
}: {
  bars: OhlcBar[];
  loading: boolean;
  range: RangeKey;
}) {
  const gid = `csh-${useId().replace(/:/g, "")}`;

  if (loading && bars.length === 0) {
    return (
      <div className="mt-3 h-[184px] rounded-[16px] border border-sand bg-card motion-safe:animate-pulse">
        <span className="sr-only">Loading the price series</span>
      </div>
    );
  }
  if (bars.length < 2) {
    return (
      <div className="mt-3 flex h-[184px] items-center justify-center rounded-[16px] border border-sand bg-card px-5">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
          No price series for this window
        </p>
      </div>
    );
  }

  const candle = bars.filter((b) => b.o != null && b.h != null && b.l != null).length >= bars.length * 0.9;

  const W = 354;
  const H = 148;
  const padY = 8;
  const lows = bars.map((b) => (candle ? (b.l as number) : b.c));
  const highs = bars.map((b) => (candle ? (b.h as number) : b.c));
  const lo = Math.min(...lows);
  const hi = Math.max(...highs);
  const span = hi - lo || 1;
  const y = (v: number) => padY + (H - padY * 2) * (1 - (v - lo) / span);
  const n = bars.length;
  const step = W / n;

  const closes = bars.map((b) => b.c);
  const up = closes[closes.length - 1] >= closes[0];
  const stroke = up ? "var(--color-price-up)" : "var(--color-price-down)";

  const linePts = bars
    .map((b, i) => `${(i * step + step / 2).toFixed(1)},${y(b.c).toFixed(1)}`)
    .join(" ");
  const area = `${(step / 2).toFixed(1)},${H} ${linePts} ${(W - step / 2).toFixed(1)},${H}`;

  // Right-hand price axis — four values from the drawn range, like the
  // mockup's 186 · 182 · 178 · 174 rail. fmtBound keeps small caps readable.
  const axis = [hi, lo + (span * 2) / 3, lo + span / 3, lo];

  // Session stamps: first, interior thirds, last — read off the bars drawn.
  const at = (i: number) => bars[Math.min(n - 1, Math.max(0, i))].t;
  const stamp = (t: number) =>
    range === "1D" || range === "1W"
      ? new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
  const ticks = [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1];

  const bodyW = Math.max(1.4, step * 0.55);
  const wickW = Math.max(0.7, step * 0.16);

  return (
    <>
      <div className="mt-3 flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-[160px] w-full"
            aria-hidden
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* dotted grid — the mockup's faint horizontals */}
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1="0"
                x2={W}
                y1={padY + (H - padY * 2) * f}
                y2={padY + (H - padY * 2) * f}
                stroke="var(--color-sand)"
                strokeWidth="1"
                strokeDasharray="1 5"
              />
            ))}

            {/* the wash under the closes */}
            <polygon points={area} fill={`url(#${gid})`} />

            {candle ? (
              bars.map((b, i) => {
                const cUp = b.c >= (b.o as number);
                const col = cUp ? "var(--color-price-up)" : "var(--color-price-down)";
                const cx = i * step + step / 2;
                const top = y(Math.max(b.o as number, b.c));
                const bot = y(Math.min(b.o as number, b.c));
                return (
                  <g key={b.t}>
                    <line
                      x1={cx}
                      x2={cx}
                      y1={y(b.h as number)}
                      y2={y(b.l as number)}
                      stroke={col}
                      strokeWidth={wickW}
                    />
                    <rect
                      x={cx - bodyW / 2}
                      y={top}
                      width={bodyW}
                      height={Math.max(1, bot - top)}
                      fill={col}
                      rx={bodyW * 0.2}
                    />
                  </g>
                );
              })
            ) : (
              <polyline
                points={linePts}
                fill="none"
                stroke={stroke}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        </div>

        {/* the price rail on the right, as drawn */}
        <div
          className="flex shrink-0 flex-col justify-between py-1 text-right font-mono text-[9.5px] tabular-nums text-soft"
          aria-hidden
        >
          {axis.map((v, i) => (
            <span key={i}>{fmtBound(v)}</span>
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex justify-between pr-9 font-mono text-[9.5px] tabular-nums text-soft">
        {ticks.map((i, k) => (
          <span key={k}>{stamp(at(i))}</span>
        ))}
      </div>
    </>
  );
}

/* ── the range pills — mockup state: resting pills quiet, the ACTIVE pill
   green-tinted with a green figure (the mockup draws 1D in the up-tone; the
   tint is mixed from the price-up token so it stays semantic and flips with
   the theme). */
function ClubRangePills({
  active,
  onSelect,
}: {
  active: RangeKey;
  onSelect: (k: RangeKey) => void;
}) {
  return (
    <div
      className="club2-track -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1"
      role="group"
      aria-label="Chart range"
    >
      {RANGE_KEYS.map((r) => {
        const on = r === active;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(r)}
            className={`f0-focus shrink-0 rounded-[10px] border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              on
                ? "font-bold text-price-up"
                : "border-sand bg-card font-semibold text-soft hover:text-ink"
            }`}
            style={
              on
                ? {
                    background:
                      "color-mix(in srgb, var(--color-price-up) 10%, var(--color-card))",
                    borderColor:
                      "color-mix(in srgb, var(--color-price-up) 45%, var(--color-sand))",
                  }
                : undefined
            }
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}

/* ── the stat wells — label over figure, horizontally scrollable, exactly the
   mockup's Market Cap · P/E (TTM) · Revenue (TTM) · EPS (TTM) row. A well
   with no resolved figure is FILTERED, not dashed — the mockup never draws an
   empty well. */
function StatWell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[96px] shrink-0 rounded-[14px] border border-sand bg-card px-3.5 py-2.5 text-center shadow-soft">
      <p className="font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.1em] text-soft">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-[15px] font-semibold tabular-nums leading-none text-ink">
        {value}
      </p>
    </div>
  );
}

export default function ClubStockHead({
  ticker,
  companyName,
  quote,
  research,
  researchResolved,
  dailyBars,
  barsResolved,
  supabase,
  back,
  familyId,
  userId,
  club,
  isKid,
  canAlert,
  levels,
}: {
  ticker: string;
  companyName: string;
  quote: MarketQuote | null;
  research: ResearchPayload | null;
  /** true once the aggregate read has ANSWERED (success or failure) — a failed
   *  read renders no wells, never a permanent skeleton. */
  researchResolved: boolean;
  /** the 2y daily close series the page already loads (slices the long ranges) */
  dailyBars: MarketBar[];
  barsResolved: boolean;
  supabase: SupabaseClient;
  back: { href: string; label: string };
  familyId: string | null;
  userId: string;
  /** the ONE club read the page already makes — the sentiment card counts it */
  club: ClubReadData;
  /** kid wall — sentiment is an adults+teens surface everywhere in the club */
  isKid: boolean;
  /** alert bell gate (kids/teens never see the alert builder) */
  canAlert: boolean;
  levels: AlertLevel[];
}) {
  const [range, setRange] = useState<RangeKey>("1D");
  const [intraday, setIntraday] = useState<Record<string, OhlcBar[]>>({});
  const [shared, setShared] = useState(false);
  const asked = useRef<Set<string>>(new Set());

  /* Intraday OHLC windows (candles). Daily ranges slice `dailyBars`, which the
     page already owns, so tabbing 1M↔ALL never hits the network. Same lane
     pattern as the family canvas: absent key = in flight, failed fetch writes
     an empty array. */
  useEffect(() => {
    const cfg = RANGES[range];
    if (!cfg.tf) return;
    const key = cfg.tf;
    if (asked.current.has(key)) return;
    asked.current.add(key);
    let on = true;
    fetch(`/api/market/bars?symbol=${encodeURIComponent(ticker)}&tf=${key}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on) return;
        setIntraday((prev) => ({ ...prev, [key]: (d?.bars as OhlcBar[]) ?? [] }));
      })
      .catch(() => {
        if (on) setIntraday((prev) => ({ ...prev, [key]: [] }));
      });
    return () => {
      on = false;
    };
  }, [ticker, range]);

  /* Window slice, anchored to the newest bar in the feed (never the wall
     clock — over a weekend a wall-clock cut claims the data is missing when
     it is simply older than "now"). */
  const visible = useMemo(() => {
    const cfg = RANGES[range];
    const series: OhlcBar[] = cfg.tf ? intraday[cfg.tf] ?? [] : dailyBars;
    if (series.length === 0) return [];
    const newest = series[series.length - 1].t;
    if (range === "1D") {
      const lastDay = new Date(newest).toDateString();
      return series.filter((b) => new Date(b.t).toDateString() === lastDay);
    }
    if (cfg.windowMs === 0) return series;
    const win = series.filter((b) => b.t >= newest - cfg.windowMs);
    return win.length >= 2 ? win : series;
  }, [range, intraday, dailyBars]);

  const rangeTf = RANGES[range].tf;
  const chartLoading = rangeTf ? intraday[rangeTf] === undefined : dailyBars.length === 0 && !barsResolved;

  /* ── the watchlist toggle ("+ Watchlist") — bound to the same
     family_watchlist row the /watchlist board reads (pattern copied from the
     family canvas; membership resolved on mount so the state means what it
     says, failure reported rather than swallowed). */
  const [watch, setWatch] = useState<{ for: string; row: { id: string } | null } | null>(null);
  const [watchBusy, setWatchBusy] = useState(false);
  const [watchErr, setWatchErr] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    let on = true;
    supabase
      .from("family_watchlist")
      .select("id")
      .eq("family_id", familyId)
      .eq("ticker", ticker)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (on) setWatch({ for: ticker, row: (data as { id: string } | null) ?? null });
        },
        () => {
          if (on) setWatch({ for: ticker, row: null });
        }
      );
    return () => {
      on = false;
    };
  }, [supabase, familyId, ticker]);

  const watchKnown = watch?.for === ticker;
  const watching = watchKnown && watch?.row != null;

  const toggleWatch = useCallback(async () => {
    if (!familyId || watchBusy || watch?.for !== ticker) return;
    setWatchBusy(true);
    setWatchErr(false);
    const current = watch.row;
    if (current) {
      const { error } = await supabase.from("family_watchlist").delete().eq("id", current.id);
      setWatchBusy(false);
      if (error) {
        setWatchErr(true);
        return;
      }
      setWatch({ for: ticker, row: null });
      return;
    }
    const { data, error } = await supabase
      .from("family_watchlist")
      .insert({
        family_id: familyId,
        ticker,
        company_name: companyName,
        status: "watch",
        champion_id: userId || null,
        snapshot_price: quote?.price ?? null,
        snapshot_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    setWatchBusy(false);
    if (error || !data) {
      setWatchErr(true);
      return;
    }
    setWatch({ for: ticker, row: data as { id: string } });
  }, [supabase, familyId, ticker, companyName, userId, quote?.price, watch, watchBusy]);

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: `${ticker} on Cheat Code`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      /* dismissed / unsupported */
    }
  }

  /* ── the mark. Same three-state contract as the family canvas: resolved
     with a price prints it, resolved with nothing falls back to the last
     daily close (labelled), not-yet-answered draws a loading shape. */
  const lastClose = dailyBars.length > 0 ? dailyBars[dailyBars.length - 1].c : null;
  const quoteResolved = quote != null || barsResolved;
  const price = quote?.price ?? null;
  const shownPrice = price ?? (quoteResolved ? lastClose : null);
  const priceIsClose = price == null && shownPrice != null;
  const chg = quote?.change ?? null;
  const chgPct = quote?.changePercent ?? null;
  const up = (chgPct ?? 0) >= 0;
  const exchange = research?.company.exchange ? formatExchange(research.company.exchange) : null;

  /* Freshness — "Today" only when the quote's own stamp says today; otherwise
     the day it actually printed. (The mockup's After-Hours line has no source
     in the quote feed, so this true line holds its slot.) */
  const mountedAt = useClientNow();
  const freshness = useMemo(() => {
    const t = quote?.updated ?? null;
    if (t == null || mountedAt == null) {
      return { move: "Today", feed: quote?.delayed === false ? "Real time" : "Delayed ~15 min" };
    }
    const stamped = new Date(t);
    const sameDay = new Date(mountedAt).toDateString() === stamped.toDateString();
    if (sameDay) {
      return { move: "Today", feed: quote?.delayed === false ? "Real time" : "Delayed ~15 min" };
    }
    const day = stamped.toLocaleDateString(undefined, { weekday: "long" });
    return { move: `at ${day}'s close`, feed: `${day}'s close · market closed` };
  }, [quote?.updated, quote?.delayed, mountedAt]);

  /* ── the wells. Revenue (TTM) is the sum of the last four research
     quarters — only when all four report revenue; a partial sum labelled TTM
     would be a lie. Wells with no resolved figure are filtered out. */
  const revenueTtm = useMemo(() => {
    const q = research?.charts.quarterly ?? [];
    if (q.length < 4) return null;
    const last4 = q.slice(-4).map((r) => r.revenue);
    if (last4.some((v) => v == null || !Number.isFinite(v))) return null;
    return (last4 as number[]).reduce((a, b) => a + b, 0);
  }, [research]);

  const wells = useMemo(() => {
    const k = research?.keyStats;
    const out: { label: string; value: string }[] = [];
    const mcap = k?.marketCapText ?? (k?.marketCap != null ? fmtMcap(k.marketCap) : null);
    if (mcap) out.push({ label: "Market Cap", value: mcap });
    if (k?.pe != null && Number.isFinite(k.pe)) out.push({ label: "P/E (TTM)", value: k.pe.toFixed(1) });
    if (revenueTtm != null) out.push({ label: "Revenue (TTM)", value: fmtMcap(revenueTtm) });
    if (k?.epsTtm != null && Number.isFinite(k.epsTtm))
      out.push({ label: "EPS (TTM)", value: k.epsTtm.toFixed(2) });
    return out;
  }, [research, revenueTtm]);

  /* ── community sentiment — the page's one club read, floored exactly like
     the club-read block so the two can never disagree. Below the floor (or
     behind the kid wall) the card is simply not drawn. */
  const positioned = club.positioned;
  const hasSplit = !isKid && club.resolved && positioned >= SPLIT_FLOOR;
  const bullPct = hasSplit ? Math.round((club.bull / positioned) * 100) : 0;
  const neutralPct = hasSplit ? Math.round((club.neutral / positioned) * 100) : 0;
  const bearPct = hasSplit ? Math.max(0, 100 - bullPct - neutralPct) : 0;

  return (
    <div>
      {/* ── header row — ← · logo · name / TICKER · EXCHANGE · 🔔 ★ ↗ ─────── */}
      <div className="flex items-center gap-3 pt-3">
        <Link
          href={back.href}
          aria-label={`Back to ${back.label}`}
          className="f0-focus shrink-0 rounded-full p-1 text-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <CompanyLogo symbol={ticker} name={companyName} size={40} rounded="rounded-[11px]" />

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[17px] font-extrabold leading-tight tracking-tight text-ink">
            {companyName}
          </h1>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-soft">
            {ticker}
            {exchange ? <> &middot; {exchange}</> : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {canAlert && (
            <SetAlertButton
              ticker={ticker}
              surface="research"
              defaultKind="price_cross"
              seedPrice={quote?.price ?? null}
              levels={levels}
              variant="icon"
              stopPropagation={false}
              className="!rounded-full !border-0 !bg-transparent !p-1"
            />
          )}
          {familyId ? (
            <button
              type="button"
              onClick={toggleWatch}
              disabled={!watchKnown || watchBusy}
              aria-pressed={watching}
              aria-label={
                watching ? `Remove ${ticker} from your watchlist` : `Add ${ticker} to your watchlist`
              }
              className={`f0-focus rounded-full p-1 transition-colors disabled:opacity-45 ${
                watching ? "text-gold-700 hover:text-gold-600" : "text-soft hover:text-gold-700"
              }`}
            >
              <Star
                className="h-[18px] w-[18px]"
                fill={watching ? "currentColor" : "none"}
                strokeWidth={watching ? 1.5 : 2}
              />
            </button>
          ) : (
            <Link
              href="/watchlist"
              aria-label="Your watchlist"
              className="f0-focus rounded-full p-1 text-soft transition-colors hover:text-gold-700"
            >
              <Star className="h-[18px] w-[18px]" fill="none" strokeWidth={2} />
            </Link>
          )}
          <button
            type="button"
            onClick={onShare}
            aria-label={shared ? "Link copied" : "Share this page"}
            className="f0-focus rounded-full p-1 text-soft transition-colors hover:text-ink"
          >
            {shared ? (
              <Check className="h-[18px] w-[18px] text-gold-700" />
            ) : (
              <Share2 className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
      </div>

      {/* ── the mark ──────────────────────────────────────────────────────── */}
      <div className="mt-4">
        {shownPrice != null ? (
          <p className="font-mono text-[34px] font-bold leading-none tracking-tight tabular-nums text-ink">
            {money(shownPrice)}
          </p>
        ) : quoteResolved ? (
          <p className="font-display text-[34px] font-extrabold leading-none text-soft/50">—</p>
        ) : (
          <span
            className="block h-[34px] w-[160px] rounded-md bg-ink/10 motion-safe:animate-pulse"
            aria-hidden
          />
        )}
        {chgPct != null && (
          <p className="mt-2 font-mono text-[13px] font-semibold tabular-nums">
            <span className={up ? "text-price-up" : "text-price-down"}>
              {up ? "+" : "−"}
              {chg != null ? ` ${Math.abs(chg).toFixed(2)}` : ""} ({up ? "+" : "−"}
              {Math.abs(chgPct).toFixed(2)}%)
            </span>{" "}
            <span className="font-normal text-soft">{freshness.move}</span>
          </p>
        )}
        <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-soft/80">
          {priceIsClose ? "Last daily close" : freshness.feed}
        </p>
      </div>

      {/* ── range pills, ABOVE the chart as drawn ─────────────────────────── */}
      <ClubRangePills active={range} onSelect={setRange} />

      {/* ── the chart ─────────────────────────────────────────────────────── */}
      <ClubChart bars={visible} loading={chartLoading} range={range} />

      {/* ── the stat wells ─────────────────────────────────────────────────── */}
      {research == null && !researchResolved ? (
        <div className="mt-4 flex gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[58px] min-w-[96px] flex-1 rounded-[14px] border border-sand bg-card motion-safe:animate-pulse"
            />
          ))}
        </div>
      ) : wells.length > 0 ? (
        <div className="club2-track -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {wells.map((w) => (
            <StatWell key={w.label} label={w.label} value={w.value} />
          ))}
        </div>
      ) : null}

      {/* ── Community Sentiment — the mockup's card, drawn only when the club
          actually has a read (split floor) and never for kids. The bar is the
          split itself: bull green · neutral quiet · bear red. */}
      {hasSplit && (
        <Card radius="md" className="mt-5 px-4 py-3.5">
          <p className="text-[13px] font-bold text-ink">Community Sentiment</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <p className="text-[20px] font-extrabold leading-none tracking-tight">
              <span className="font-mono font-bold tabular-nums text-ink">{bullPct}%</span>{" "}
              <span className="font-display text-price-up">Bullish</span>
            </p>
            <p className="text-[11px] font-semibold text-soft">
              <span className="font-mono tabular-nums">{bearPct}%</span> Bearish
            </p>
          </div>
          <div
            className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-sand"
            role="img"
            aria-label={`${bullPct}% bullish, ${neutralPct}% neutral, ${bearPct}% bearish — ${positioned.toLocaleString()} positioned members`}
          >
            {bullPct > 0 && <span className="h-full bg-price-up" style={{ width: `${bullPct}%` }} />}
            {neutralPct > 0 && (
              <span className="h-full bg-sand" style={{ width: `${neutralPct}%` }} />
            )}
            {bearPct > 0 && <span className="h-full bg-price-down" style={{ width: `${bearPct}%` }} />}
          </div>
        </Card>
      )}

      {/* ── the action row — + Watchlist · Create Opinion ─────────────────── */}
      <div className="mt-5 flex items-center gap-2.5">
        {familyId ? (
          <button
            type="button"
            onClick={toggleWatch}
            disabled={!watchKnown || watchBusy}
            aria-pressed={watching}
            className="f0-focus flex flex-[2] items-center justify-center gap-1.5 rounded-full border border-sand bg-card py-3 text-[13px] font-bold text-ink shadow-soft transition-colors hover:border-volt-300 disabled:opacity-45"
          >
            {watching ? (
              <>
                <Check className="h-4 w-4 text-gold-700" /> Watching
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Watchlist
              </>
            )}
          </button>
        ) : (
          <Link
            href="/watchlist"
            className="f0-focus flex flex-[2] items-center justify-center gap-1.5 rounded-full border border-sand bg-card py-3 text-[13px] font-bold text-ink shadow-soft transition-colors hover:border-volt-300"
          >
            <Plus className="h-4 w-4" /> Watchlist
          </Link>
        )}

        {/* The mockup's orange CTA. The structured composer route
            (/community/compose) is retired and redirects to /community, so
            the CTA goes straight to the chat — the way a member posts now. */}
        <Link
          href="/community"
          className="f0-focus flex flex-[3] items-center justify-center rounded-full bg-volt-500 py-3 text-[13px] font-extrabold text-[#1A1614] transition-colors hover:bg-volt-600"
        >
          Create Opinion
        </Link>
      </div>
      {watchErr && (
        <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
          Couldn&apos;t save the watchlist change
        </p>
      )}
    </div>
  );
}
