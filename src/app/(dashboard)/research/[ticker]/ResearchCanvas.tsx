"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Sparkles, Star } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import CompanyLogo from "@/components/fic/CompanyLogo";
import { fetchBars, type MarketBar, type MarketQuote } from "@/lib/market/client";
import { formatExchange } from "@/lib/market/exchange";
import { fmtMcap, fmtVol } from "@/lib/screener";
import type { ResearchPayload } from "@/lib/research/types";
import { fmtBound } from "@/lib/research/labels";
import { useClientNow } from "@/lib/research/clock";
import { Card, RangePills, StatCard } from "@/components/research/board";
import type { Portrait } from "./ClubRead";

/**
 * THE TICKER HEAD — board 03 ("03 Ticker · NVDA") of the owner's mockup,
 * rebuilt object-for-object.
 *
 *   ←                                                     ★   ↗
 *   [logo]  NVIDIA                              ( #1 in the Club › )
 *   $173.42  ▲ 4.72% today
 *                                          (••• )  826 watching now
 *   ┌ chart card — green wash, member marks on the line ──────────┐
 *   9:30 AM        12:00 PM        2:30 PM          4:00 PM
 *   [1D] [1W] [1M] [3M] [1Y] [ALL]
 *   ┌ fundamentals: four stat cards ──────────────────────────────┐
 *
 * A previous pass rebuilt this as hairline columns and an un-boxed plot; the
 * owner rejected that reading. The card, the wash, the member marks and the
 * filled range pills are all drawn on the board, so they all ship.
 *
 * REAL DATA ONLY, and every object states its own source:
 *   price / move       → /api/market/quote (delayed ~15 min)
 *   the line           → /api/market/bars (intraday for 1D/1W, the 2y daily
 *                        series sliced for everything longer)
 *   market cap · P/E   → /api/research/[ticker] aggregate
 *   volume             → screener_metrics (the nightly grouped-daily cron)
 *   52-week range      → the daily series, with the aggregate as a fallback
 *   the marks + count  → feed_posts / ticker_intel_snapshots (via useClubRead)
 *   the club-rank pill → ticker_intel_snapshots.rank
 * A source that RESOLVED to nothing renders "—". A source that has not
 * answered renders its own loading shape. Nothing is invented to fill a card.
 *
 * COLOUR LAW: green/red is price (the move, the stroke, the wash); orange is
 * brand + action (the active range pill, the club-rank pill); Kai blue is the
 * Ask-Kai band and nothing else.
 */

/* ── ranges ────────────────────────────────────────────────────────────────
   The board draws 1D · 1W · 1M · 3M · 1Y · ALL. Only the windows the market
   API can genuinely serve are wired: the daily path tops out at 2y, so "ALL"
   IS that 2y series and is labelled honestly in the caption under the plot. */
type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

const RANGE_KEYS = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;

const RANGES: Record<RangeKey, { tf: string | null; windowMs: number }> = {
  "1D": { tf: "15m", windowMs: 0 }, // 0 → "the last session present"
  "1W": { tf: "1h", windowMs: 7 * 864e5 },
  "1M": { tf: null, windowMs: 31 * 864e5 },
  "3M": { tf: null, windowMs: 92 * 864e5 },
  "1Y": { tf: null, windowMs: 366 * 864e5 },
  ALL: { tf: null, windowMs: 0 },
};

const RANGE_CAPTION: Record<RangeKey, string> = {
  "1D": "Last session · 15-minute bars",
  "1W": "Past week · hourly bars",
  "1M": "Past month · daily closes",
  "3M": "Past three months · daily closes",
  "1Y": "Past year · daily closes",
  ALL: "Past two years · daily closes",
};

interface ScreenerVolume {
  vol: number | null;
  avg_vol_20: number | null;
  mcap: number | null;
}

function money(v: number | null | undefined, dp = 2): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

/* ── The plot ──────────────────────────────────────────────────────────────
   Board 03 draws the price inside a rounded card with a soft wash under the
   line and MEMBER MARKS sitting on it — small ringed initials where a club
   member posted a position on this name. The marks are real: they come from
   the same feed_posts rows the sentiment ring counts, and they are only placed
   when a post's timestamp falls inside the window on screen. No post in the
   window → no marks, never a decorative one. */
function PriceCard({
  bars,
  loading,
  marks,
  range,
}: {
  bars: MarketBar[];
  loading: boolean;
  marks: { p: Portrait; x: number; y: number }[];
  range: RangeKey;
}) {
  const gid = `rcg-${useId().replace(/:/g, "")}`;
  const H = 128;

  if (loading && bars.length === 0) {
    return (
      <Card radius="md" className="mt-3 h-[168px] motion-safe:animate-pulse">
        <span className="sr-only">Loading the price series</span>
      </Card>
    );
  }
  if (bars.length < 2) {
    return (
      <Card radius="md" className="mt-3 flex h-[168px] items-center justify-center px-5">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
          No price series for this window
        </p>
      </Card>
    );
  }

  const closes = bars.map((b) => b.c);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const W = 354;
  const padY = 10;
  const stepX = W / (bars.length - 1);
  const y = (v: number) => padY + (H - padY * 2) * (1 - (v - min) / span);
  const line = bars.map((b, i) => `${(i * stepX).toFixed(1)},${y(b.c).toFixed(1)}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const up = closes[closes.length - 1] >= closes[0];
  const stroke = up ? "var(--color-price-up)" : "var(--color-price-down)";

  // The session labels the board prints under the plot: first, two interior
  // thirds, last — read off the bars actually drawn, never off the wall clock.
  const at = (i: number) => bars[Math.min(bars.length - 1, Math.max(0, i))].t;
  const stamp = (t: number) =>
    range === "1D" || range === "1W"
      ? new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
  const ticks = [0, Math.round((bars.length - 1) / 3), Math.round(((bars.length - 1) * 2) / 3), bars.length - 1];

  return (
    <>
      <Card radius="md" className="relative mt-3 overflow-hidden">
        <div
          className="relative"
          style={{
            background: `linear-gradient(180deg, color-mix(in srgb, ${stroke} 8%, transparent), transparent)`,
          }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-[128px] w-full"
            aria-hidden
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.20" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#${gid})`} />
            <polyline
              points={line}
              fill="none"
              stroke={stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {marks.map((mk) => (
            <span
              key={mk.p.id}
              title={`${mk.p.name} posted ${mk.p.side === "bull" ? "bullish" : "bearish"}`}
              className="absolute grid h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-sand text-[8px] font-bold text-ink"
              style={{
                left: `${mk.x}%`,
                top: `${mk.y}%`,
                border: `2px solid ${
                  mk.p.side === "bull" ? "var(--color-price-up)" : "var(--color-price-down)"
                }`,
              }}
            >
              {mk.p.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mk.p.avatar}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                mk.p.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              )}
            </span>
          ))}
        </div>
      </Card>
      <div className="mt-1.5 flex justify-between px-1 font-mono text-[9px] tabular-nums text-soft">
        {ticks.map((i, n) => (
          <span key={n}>{stamp(at(i))}</span>
        ))}
      </div>
    </>
  );
}

export default function ResearchCanvas({
  ticker,
  companyName,
  quote,
  research,
  dailyBars,
  barsResolved = false,
  supabase,
  back,
  familyId,
  userId,
  onAskKai,
  clubRank,
  clubScore,
  watchers,
  bull,
  neutral,
  bear,
  positioned,
  discussions,
  sentimentShift24h,
  faces,
}: {
  ticker: string;
  companyName: string;
  quote: MarketQuote | null;
  research: ResearchPayload | null;
  /** the 2y daily close series the page already loads (slices the long ranges) */
  dailyBars: MarketBar[];
  /**
   * Whether the PAGE's bars lane has finished. Three components used to reach
   * for `/api/market/bars?range=2y` on mount — the page, this head, and the
   * technicals panel — because "I have no bars" and "nobody is fetching bars"
   * looked identical from inside each of them. The head only falls back to its
   * own fetch once the owner's lane has answered and come up empty.
   */
  barsResolved?: boolean;
  supabase: SupabaseClient;
  back: { href: string; label: string };
  /** the member's family — the watchlist this star writes to */
  familyId: string | null;
  userId: string;
  onAskKai: () => void;
  /** ticker_intel_snapshots.rank — the board's "#1 in the Club ›" pill. */
  clubRank: number | null;
  /** Bounded Club attention score from ticker_intel_snapshots. */
  clubScore: number | null;
  /** distinct members watching (floor-gated upstream); 0 → the row is dropped */
  watchers: number;
  bull: number;
  neutral: number;
  bear: number;
  positioned: number;
  discussions: number;
  sentimentShift24h: number | null;
  /** the positioned members whose posts the marks stand for */
  faces: Portrait[];
}) {
  const [range, setRange] = useState<RangeKey>("1D");
  const [intraday, setIntraday] = useState<Record<string, MarketBar[]>>({});
  const [screener, setScreener] = useState<ScreenerVolume | null>(null);
  const [screenerResolved, setScreenerResolved] = useState(false);
  const [shared, setShared] = useState(false);
  const asked = useRef<Set<string>>(new Set());

  /* ── THE WATCHLIST TOGGLE ────────────────────────────────────────────────
     The star in this row was a permanently-filled `<Link href="/watchlist">`:
     it looked like state, it read to a screen reader as state, and it was
     neither — every ticker in the club showed as watched, and tapping it left
     the page. It is now a real toggle bound to the row the /watchlist board
     actually reads (`family_watchlist`), with the membership resolved on mount
     so the fill means what it looks like. Failure is reported, never swallowed
     into a fill that isn't backed by a row. */
  // The read is STAMPED with the ticker it answered (the same pattern the other
  // lanes on this page use), so switching ticker invalidates it for free and no
  // effect body ever calls setState synchronously.
  const [watch, setWatch] = useState<{ for: string; row: { id: string } | null } | null>(
    null
  );
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

  const watchRow = watch?.for === ticker ? watch.row : null;
  const watchKnown = watch?.for === ticker;
  const watching = watchRow != null;

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

  /* Volume is not part of the research aggregate — it lives in screener_metrics
     (same nightly Polygon grouped-daily pull that powers the screener). One
     read, fails soft: no row → the volume card reports "—", never a guess. */
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
     already has, so tabbing 1M↔ALL never hits the network. */
  useEffect(() => {
    const cfg = RANGES[range];
    if (!cfg.tf) return;
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

  /* Fallback: if the page's own lane RESOLVED with no daily bars, pull the 2y
     series here rather than showing a permanently empty chart. Gated on
     `barsResolved` so this is a genuine last resort and not a third racing copy
     of the same request. */
  useEffect(() => {
    if (!barsResolved || dailyBars.length > 0 || asked.current.has("daily")) return;
    asked.current.add("daily");
    let on = true;
    fetchBars(ticker, "2y").then((b) => {
      if (on && b.length) setIntraday((prev) => ({ ...prev, daily: b }));
    });
    return () => {
      on = false;
    };
  }, [ticker, dailyBars.length, barsResolved]);

  const daily = useMemo(
    () => (dailyBars.length > 0 ? dailyBars : intraday.daily ?? []),
    [dailyBars, intraday.daily]
  );

  /* Windows are anchored to the NEWEST BAR IN THE FEED, not to the wall clock.
     Over a weekend (or when the feed lags) a wall-clock cut silently returns an
     empty series and the chart claims the data is missing when it is simply
     older than "now". Anchoring keeps the window honest and the render pure. */
  const visible = useMemo(() => {
    const cfg = RANGES[range];
    const series = cfg.tf ? intraday[cfg.tf] ?? [] : daily;
    if (series.length === 0) return [];
    const newest = series[series.length - 1].t;

    if (range === "1D") {
      const lastDay = new Date(newest).toDateString();
      return series.filter((b) => new Date(b.t).toDateString() === lastDay);
    }
    if (cfg.windowMs === 0) return series;
    const win = series.filter((b) => b.t >= newest - cfg.windowMs);
    // Never fall back to an unusable 1-point chart: show the full series instead.
    return win.length >= 2 ? win : series;
  }, [range, intraday, daily]);

  const rangeTf = RANGES[range].tf;
  const loading = rangeTf ? intraday[rangeTf] === undefined : daily.length === 0;

  /* Window delta.
     ── ONE DAY, ONE NUMBER ────────────────────────────────────────────────
     This used to be first-drawn-bar → last-drawn-bar unconditionally, which on
     1D measured from the first 15-minute bar the feed happened to include —
     often a pre-market print — while the header measured from the previous
     session's CLOSE. The result was a head reading "▼ 5.18% today" directly
     above a chart labelled "−6.17%" for the same day, with nothing on screen to
     say why. They are the same claim, so they are now the same arithmetic: on
     1D the window is anchored to `quote.prevClose`, exactly like the header,
     and falls back to the drawn series only when there is no quote to anchor to.
     Longer ranges are still first-to-last, which is what they mean. */
  const windowPct = useMemo(() => {
    if (visible.length < 2) return null;
    const last = visible[visible.length - 1].c;
    if (range === "1D") {
      if (quote?.changePercent != null) return quote.changePercent;
      const prev = quote?.prevClose ?? null;
      if (prev != null && prev > 0) return ((last - prev) / prev) * 100;
    }
    const a = visible[0].c;
    if (!a) return null;
    return ((last - a) / a) * 100;
  }, [visible, range, quote]);

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

  /* MEMBER MARKS. Up to three of the most recent positioned posts, placed at
     the bar whose timestamp is nearest the post — and ONLY when the post falls
     inside the window on screen. Posts have no price of their own, so the mark
     rides the LINE at that moment, which is the true statement: this is where
     the tape was when they said it. */
  const marks = useMemo(() => {
    if (visible.length < 2) return [];
    const t0 = visible[0].t;
    const t1 = visible[visible.length - 1].t;
    const closes = visible.map((b) => b.c);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const out: { p: Portrait; x: number; y: number }[] = [];
    for (const p of faces) {
      const posted = p.at;
      if (!posted || posted < t0 || posted > t1) continue;
      const i = Math.round(((posted - t0) / (t1 - t0 || 1)) * (visible.length - 1));
      out.push({
        p,
        x: (i / (visible.length - 1)) * 100,
        y: 8 + (1 - (visible[i].c - min) / span) * 78,
      });
      if (out.length === 3) break;
    }
    return out;
  }, [faces, visible]);

  /* THE MARK.
     `quote` is a source like any other, so it gets the same three-state contract
     the stat cards have: RESOLVED-WITH-A-PRICE prints the price, RESOLVED-WITH-
     NOTHING falls back to the last daily close (labelled as such), and NOT YET
     ANSWERED draws a loading shape. It used to print a bare grey "—" the moment
     the page rendered — the single largest element on the screen announcing that
     the company has no price — and then swap to the real number a beat later. */
  const lastClose = daily.length > 0 ? daily[daily.length - 1].c : null;
  const quoteResolved = quote != null || barsResolved;
  const price = quote?.price ?? null;
  const shownPrice = price ?? (quoteResolved ? lastClose : null);
  const priceIsClose = price == null && shownPrice != null;
  const chgPct = quote?.changePercent ?? null;
  const up = (chgPct ?? 0) >= 0;
  const exchange = research?.company.exchange ? formatExchange(research.company.exchange) : null;

  /* HOW OLD IS THIS NUMBER, REALLY.
     The head printed "▲ 4.72% today · DELAYED ~15 MIN" seven days a week. Read
     on a Sunday it says the market is open and this moved today, both false.
     The quote carries its own timestamp; the label is derived from it, and the
     wall clock is read ONCE after mount (never during render, which would
     desync server and client and re-introduce the same lie in a new form). */
  const mountedAt = useClientNow();

  const freshness = useMemo(() => {
    const t = quote?.updated ?? null;
    if (t == null || mountedAt == null) {
      return { move: "today", feed: quote?.delayed === false ? "Real time" : "Delayed ~15 min" };
    }
    const stamped = new Date(t);
    const sameDay = new Date(mountedAt).toDateString() === stamped.toDateString();
    if (sameDay) {
      return { move: "today", feed: quote?.delayed === false ? "Real time" : "Delayed ~15 min" };
    }
    const day = stamped.toLocaleDateString(undefined, { weekday: "long" });
    return { move: `at ${day}'s close`, feed: `${day}'s close · market closed` };
  }, [quote?.updated, quote?.delayed, mountedAt]);

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

  /* ── the fundamentals cards ─────────────────────────────────────────────
     `ready` is what keeps this honest: a card only appears once its SOURCE has
     answered. Answered-with-nothing renders "—"; hasn't-answered renders its
     loading shape. */
  const researchReady = research != null;
  const cards: { label: string; value: string | null; ready: boolean }[] = [
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
      /* PRECISION HAS TO SURVIVE THE PRICE. `toFixed(0)` reads fine on a $200
         name and annihilates a small cap: PLUG's genuine $1.40–$4.14 year
         printed as "1–4", a range that is both wrong and useless. The number of
         decimals now follows the size of the number. */
      label: "52-week range",
      value: week52 ? `${fmtBound(week52.low)}–${fmtBound(week52.high)}` : null,
      ready: week52 != null || (researchReady && barsResolved),
    },
  ];

  return (
    <div>
      <div className="mb-3">
        <p className="cc-app-signal text-[9px] font-semibold uppercase tracking-[.18em] text-[#FF7A1A]">Ticker research</p>
        <p className="mt-1 text-[11px] text-[#8F8894]">Deep dives with Club sentiment</p>
      </div>
      {/* ── TOP ROW — back · watch · share (board 03's ← ★ ↗) ─────────────── */}
      <div className="flex items-center justify-between">
        <Link
          href={back.href}
          className="f0-focus inline-flex items-center gap-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.16em] text-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> {back.label}
        </Link>
        <div className="flex items-center gap-2.5">
          {watchErr && (
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
              Couldn&apos;t save
            </span>
          )}
          {watching && !watchErr && (
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-gold-700">
              Watching
            </span>
          )}
          {familyId ? (
            <button
              type="button"
              onClick={toggleWatch}
              disabled={!watchKnown || watchBusy}
              aria-pressed={watching}
              aria-label={
                watching
                  ? `Remove ${ticker} from your watchlist`
                  : `Add ${ticker} to your watchlist`
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
            <ArrowUpRight className={`h-[18px] w-[18px] ${shared ? "text-gold-700" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── IDENTITY ──────────────────────────────────────────────────────── */}
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CompanyLogo symbol={ticker} name={companyName} size={40} rounded="rounded-[11px]" />
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-extrabold leading-tight text-ink">{companyName}</h1>
            <p className="cc-app-signal mt-1 truncate text-[9px] font-semibold text-[#8F8894]">{ticker} · {research?.company.name || companyName}</p>
          </div>
        </div>
        {clubRank != null && (
          <Link
            href="/discover"
            className="f0-focus shrink-0 rounded-full border border-volt-500/50 bg-volt-500/[0.12] px-2.5 py-1 text-[10.5px] font-bold text-gold-700 transition-colors hover:bg-volt-500/20"
          >
            #{clubRank} in the Club ›
          </Link>
        )}
      </div>

      {/* the mark */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        {shownPrice != null ? (
          <span className="font-mono text-[28px] font-semibold leading-none tabular-nums text-ink">
            {money(shownPrice)}
          </span>
        ) : quoteResolved ? (
          <span className="font-mono text-[28px] font-semibold leading-none text-soft/50">—</span>
        ) : (
          <span
            className="block h-[28px] w-[132px] rounded-md bg-ink/10 motion-safe:animate-pulse"
            aria-hidden
          />
        )}
        {chgPct != null && (
          <span
            className={`font-mono text-[12px] font-semibold tabular-nums ${
              up ? "text-price-up" : "text-price-down"
            }`}
          >
            {up ? "▲" : "▼"} {Math.abs(chgPct).toFixed(2)}% {freshness.move}
          </span>
        )}
      </div>
      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-soft/80">
        {priceIsClose ? "Last daily close" : freshness.feed}
        {exchange ? ` · ${exchange}` : ""}
        {research?.company.sector ? ` · ${research.company.sector}` : ""}
      </p>

      <div className="cc-app-card mt-3 grid grid-cols-4 divide-x divide-[#2A2530] px-1 py-3 text-center">
        <div className="px-1">
          <p className="cc-app-signal text-[13px] font-semibold text-[#F4F0EC]">{clubScore == null ? "—" : Math.round(clubScore)}</p>
          <p className="cc-app-signal mt-1 text-[6.5px] tracking-[.1em] text-[#6E6774]">CLUB SCORE</p>
        </div>
        <div className="px-1">
          <p className="cc-app-signal text-[13px] font-semibold text-[#F4F0EC]">{watchers > 0 ? watchers.toLocaleString() : "—"}</p>
          <p className="cc-app-signal mt-1 text-[6.5px] tracking-[.1em] text-[#6E6774]">WATCHING</p>
        </div>
        <div className="px-1">
          <p className={`cc-app-signal text-[13px] font-semibold ${positioned >= 4 && bull > bear ? "text-price-up" : positioned >= 4 && bear > bull ? "text-price-down" : "text-[#C8C2CE]"}`}>
            {positioned >= 4 ? `${Math.round((bull / Math.max(1, bull + neutral + bear)) * 100)}%` : "—"}
          </p>
          <p className="cc-app-signal mt-1 text-[6.5px] tracking-[.1em] text-[#6E6774]">BULLISH</p>
        </div>
        <div className="px-1">
          <p className="cc-app-signal text-[13px] font-semibold text-[#F4F0EC]">{discussions > 0 ? discussions.toLocaleString() : "—"}</p>
          <p className="cc-app-signal mt-1 text-[6.5px] tracking-[.1em] text-[#6E6774]">POSTS · 7D</p>
        </div>
      </div>

      {sentimentShift24h != null && (
        <p className="cc-app-signal mt-1.5 text-right text-[8px] text-[#8F8894]">Sentiment {sentimentShift24h >= 0 ? "+" : ""}{sentimentShift24h.toFixed(1)} pts today</p>
      )}

      {/* who else is here — board 03's avatar stack + count */}
      {watchers >= 3 && (
        <div className="mt-1.5 flex items-center justify-end gap-1.5">
          <span className="flex">
            {(faces.length > 0 ? faces.slice(0, 3) : []).map((f, i) => (
              <span
                key={f.id}
                className={`grid h-4 w-4 place-items-center overflow-hidden rounded-full bg-sand ring-[1.5px] ring-paper ${
                  i > 0 ? "-ml-1.5" : ""
                }`}
                title={f.name}
              >
                {f.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.avatar} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
            ))}
          </span>
          <span className="text-[9.5px] text-soft">
            {watchers.toLocaleString()} watching now
          </span>
        </div>
      )}

      {/* ── THE PLOT ──────────────────────────────────────────────────────── */}
      <PriceCard bars={visible} loading={loading} marks={marks} range={range} />

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <RangePills<RangeKey>
          ranges={RANGE_KEYS}
          active={range}
          onSelect={setRange}
          ariaLabel="Chart range"
        />
        {windowPct != null && (
          <span
            className={`shrink-0 font-mono text-[11px] font-semibold tabular-nums ${
              windowPct >= 0 ? "text-price-up" : "text-price-down"
            }`}
          >
            {windowPct >= 0 ? "+" : "−"}
            {Math.abs(windowPct).toFixed(2)}%
          </span>
        )}
      </div>
      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-soft/80">
        {RANGE_CAPTION[range]}
      </p>

      {/* ── THE NUMBERS — four cards, board 03's measure row ──────────────── */}
      <div className="mt-4 flex gap-2">
        {cards.map((c) => (
          <StatCard
            key={c.label}
            value={c.value ?? "—"}
            label={c.label}
            loading={!c.ready}
          />
        ))}
      </div>

      {/* ── ASK KAI ───────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onAskKai}
        className="relative mt-5 flex w-full items-center justify-between gap-4 overflow-hidden rounded-[16px] border border-[#1E3050] bg-[rgba(91,196,240,.06)] px-4 py-3.5 text-left transition-transform active:scale-[0.995]"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#5BC4F0]">
            <Sparkles className="h-3 w-3" aria-hidden /> Kai
          </span>
          <span className="mt-1.5 block text-[15px] font-bold leading-tight text-[#F4F0EC]">
            Ask Kai about ${ticker}
          </span>
          <span className="mt-1 block text-[11px] leading-snug text-[#8F8894]">
            What&apos;s moving it, what the numbers say, what to watch next.
          </span>
        </span>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-[#5BC4F0]" aria-hidden />
      </button>
    </div>
  );
}
