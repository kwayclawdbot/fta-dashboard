"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Info, Minus, Plus } from "lucide-react";

import CompanyLogo from "@/components/fic/CompanyLogo";
import {
  fetchBars,
  fetchQuotes,
  formatPrice,
  formatChangePct,
  type MarketBar,
  type MarketQuote,
} from "@/lib/market/client";
import { moveToneClass } from "@/lib/format-move";
import {
  getEquity,
  loadPortfolio,
  type PortfolioState,
} from "@/lib/simulator/portfolio-manager";
import type { WatchlistItem, WatchStatus } from "@/lib/watchlist";

/**
 * CLUB-MODE WATCHLIST + PORTFOLIO — the owner's dark terminal board
 * ("ChatGPT Image Aug 7 2026, 10_07_23 AM"), rebuilt object-for-object for
 * `mode === "club"` ONLY. Family / kid keep the ladder board byte-for-byte —
 * the branch lives in the watchlist page, not here.
 *
 * BOARD, WATCHLIST PHONE (bottom row, 3rd phone):
 *   MY WATCHLIST                                   Edit
 *   [All ˅]                    Price   Change   My Signal
 *   [logo] NVIDIA    $184.59  +4.82%  [Bullish]
 *          NVDA
 *   [logo] Apple     $193.42  +2.11%  [Bullish]
 *   [logo] Tesla     $176.21  -1.23%  [Watching]
 *   [logo] SoFi        $7.82  +6.41%  [Bullish]
 *   [logo] Amazon    $176.21  -0.65%  [Bearish]
 *   [logo] Palantir   $23.41  +4.21%  [Bullish]
 *   [        + Add Ticker        ]
 *
 * BOARD, PORTFOLIO PHONE (bottom row, 5th phone):
 *   MY PORTFOLIO ˅                              Today ˅
 *   ┌ Total Value ⓘ
 *   │ $24,158.63
 *   │ + $1,234.56 (5.39%)
 *   │ [violet value line, dot markers, gradient wash,
 *   │  $26K/$23K/$20K left axis, May 1…May 29 below]  ┐
 *   1D  [1W]  1M  3M  1Y  All
 *   Top Holdings
 *   [logo] NVDA  30.25%  $7,310.82  +4.82%   ◔ (allocation
 *   [logo] AAPL  18.40%  $4,447.12  +2.11%      donut, one
 *   [logo] MSFT  14.10%  $3,405.31  +1.32%      colour per
 *   [logo] AMZN  12.20%  $2,946.25  -0.65%      holding)
 *   View All Holdings >                    (violet link)
 *
 * The two phones share one header slot with a chevron — built here as the
 * dropdown that chevron draws, switching MY WATCHLIST ↔ MY PORTFOLIO.
 *
 * REAL DATA ONLY — every object states its source:
 *   watchlist rows      → family_watchlist via the page's board RPC (props)
 *   price / change      → /api/market/quote batch (props, delayed ~15 min)
 *   My Signal           → the row's status-ladder verdict. The club register
 *                         speaks trader: favorite → Bullish, avoid → Bearish,
 *                         study → Studying, watch → Watching. Tapping the pill
 *                         opens the SAME research gate — a verdict still
 *                         unlocks only after the homework.
 *   portfolio value     → sim_portfolios / sim_positions (the practice-floor
 *                         engine, loadPortfolio()) marked with live quotes —
 *                         getEquity(), the engine's own definition.
 *   value chart         → /api/market/bars daily closes per held symbol,
 *                         re-priced against the CURRENT position book + cash
 *                         (an approximation over the window — noted onscreen
 *                         as "current holdings at daily closes").
 *   allocation donut    → position market value per symbol + cash.
 *   View All Holdings   → /simulator, where the full book lives.
 * A member with no practice portfolio sees the layout state itself honestly
 * (no fabricated $0.00 equity curve); the board's $24,158.63 / +$1,234.56
 * figures are illustrations and appear nowhere here.
 *
 * FREE TIER — METERS, NEVER WALLS (unchanged from the family board): every
 * saved name renders with its real price; a name past the monitored cap wears
 * "Monitoring paused" on itself, and + Add Ticker routes through the page's
 * openAdd(), which opens the limit moment when the free board is full.
 *
 * SEMANTIC TOKENS ONLY: green/red are --price-up/--price-down (the club-dark
 * values ARE the board's hues), the violet is --kai-blue (the board's violet
 * per globals.css), planes are card/sand/ink/soft — no dark: variants.
 */

/* ── My Signal — the trader-register read of the status ladder ──────────── */

const SIGNAL_META: Record<
  WatchStatus,
  { label: string; pill: string }
> = {
  favorite: {
    label: "Bullish",
    pill: "border-price-up/35 bg-price-up/10 text-price-up",
  },
  avoid: {
    label: "Bearish",
    pill: "border-price-down/35 bg-price-down/10 text-price-down",
  },
  study: {
    label: "Studying",
    pill: "border-sand bg-midnight-800 text-midnight-200",
  },
  watch: {
    label: "Watching",
    pill: "border-sand bg-midnight-800 text-midnight-200",
  },
};

/** The [All ˅] chip's options — All plus each signal the register can show. */
const SIGNAL_FILTERS: { value: WatchStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "favorite", label: "Bullish" },
  { value: "study", label: "Studying" },
  { value: "watch", label: "Watching" },
  { value: "avoid", label: "Bearish" },
];

export interface ClubWatchlistBoardProps {
  items: WatchlistItem[];
  quotes: Record<string, MarketQuote>;
  isFree: boolean;
  activeFlags: Record<string, boolean>;
  canRemove: (item: WatchlistItem) => boolean;
  onAdd: () => void;
  onRemove: (item: WatchlistItem) => void;
  /** Opens the research/verdict flow for a row (the gate stays). */
  onOpenSignal: (item: WatchlistItem) => void;
}

type BoardView = "watchlist" | "portfolio";

export default function ClubWatchlistBoard(props: ClubWatchlistBoardProps) {
  const [view, setView] = useState<BoardView>("watchlist");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* ── Header slot — title + chevron (the board's screen switcher) ──── */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="f0-focus f0-press inline-flex items-center gap-1.5 text-[15px] font-bold uppercase tracking-[0.12em] text-ink"
          >
            {view === "watchlist" ? "My Watchlist" : "My Portfolio"}
            <ChevronDown
              className={`h-4 w-4 text-soft transition-transform ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-xl border border-sand bg-card shadow-lift"
            >
              {(
                [
                  ["watchlist", "My Watchlist"],
                  ["portfolio", "My Portfolio"],
                ] as [BoardView, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="menuitem"
                  onClick={() => {
                    setView(key);
                    setMenuOpen(false);
                    setEditMode(false);
                  }}
                  className={`f0-focus block w-full px-4 py-2.5 text-left text-[13px] font-semibold ${
                    view === key ? "bg-midnight-800 text-ink" : "text-soft hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {view === "watchlist" && props.items.length > 0 && (
          <button
            onClick={() => setEditMode((v) => !v)}
            className="f0-focus f0-press text-[13px] font-semibold text-ink"
          >
            {editMode ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {view === "watchlist" ? (
        <ClubWatchlist {...props} editMode={editMode} />
      ) : (
        <ClubPortfolio />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MY WATCHLIST — the row ledger
   ═══════════════════════════════════════════════════════════════════════ */

function ClubWatchlist({
  items,
  quotes,
  isFree,
  activeFlags,
  canRemove,
  onAdd,
  onRemove,
  onOpenSignal,
  editMode,
}: ClubWatchlistBoardProps & { editMode: boolean }) {
  const [filter, setFilter] = useState<WatchStatus | "all">("all");

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.status === filter)),
    [items, filter]
  );

  return (
    <>
      {/* ── Filter chip + column headers ─────────────────────────────────── */}
      <div className="mt-4 flex items-center gap-3">
        <div className="relative inline-flex items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as WatchStatus | "all")}
            aria-label="Filter by signal"
            className="f0-focus appearance-none rounded-full border border-sand bg-card py-1.5 pl-3.5 pr-8 text-[12px] font-semibold text-ink"
          >
            {SIGNAL_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-soft" />
        </div>
        <div className="ml-auto grid grid-cols-[5.5rem_4.5rem_5.5rem] gap-2 text-right text-[11px] text-soft">
          <span>Price</span>
          <span>Change</span>
          <span>My Signal</span>
        </div>
      </div>

      {/* ── The rows ─────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-[13px] text-soft">
          {items.length === 0
            ? "Nothing on the list yet — add a ticker to start watching."
            : "No names carry that signal yet."}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-sand">
          {filtered.map((item) => {
            const q = quotes[item.ticker];
            const pct = q?.changePercent ?? null;
            // Free tier only, and only when the server has spoken: this name
            // is saved but not being watched (migration 144's wl_active).
            const paused = isFree && activeFlags[item.id] === false;
            const signal = SIGNAL_META[item.status];
            const removable = canRemove(item);
            return (
              <li key={item.id} className={`py-3 ${paused ? "opacity-70" : ""}`}>
                <div className="flex items-center gap-3">
                  {editMode && (
                    <button
                      onClick={() => onRemove(item)}
                      disabled={!removable}
                      aria-label={`Remove ${item.company_name} from the watchlist`}
                      title={
                        removable
                          ? `Remove ${item.company_name}`
                          : "Only the member who added this (or a parent/admin) can remove it"
                      }
                      className="f0-focus f0-press flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-price-down/40 bg-price-down/10 text-price-down disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <Link
                    href={`/research/${encodeURIComponent(item.ticker)}`}
                    className="f0-focus flex min-w-0 flex-1 items-center gap-3"
                  >
                    <CompanyLogo
                      symbol={item.ticker}
                      name={item.company_name}
                      size={40}
                      rounded="rounded-xl"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-ink">
                        {item.company_name}
                      </span>
                      <span className="block text-[12px] text-soft">
                        {item.ticker}
                        {paused && (
                          <span className="ml-2 text-[11px] text-soft/80">
                            Monitoring paused
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>

                  <div className="grid shrink-0 grid-cols-[5.5rem_4.5rem_5.5rem] items-center gap-2 text-right">
                    <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">
                      {q?.price != null ? formatPrice(q.price) : "—"}
                    </span>
                    <span
                      className={`font-mono text-[12px] font-semibold tabular-nums ${moveToneClass(pct)}`}
                    >
                      {pct != null ? formatChangePct(pct) : "—"}
                    </span>
                    <span className="flex justify-end">
                      <button
                        onClick={() => onOpenSignal(item)}
                        title={
                          item.status === "favorite" || item.status === "avoid"
                            ? "Revisit the research behind this signal"
                            : "Do the research to unlock Bullish / Bearish"
                        }
                        className={`f0-focus f0-press rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${signal.pill}`}
                      >
                        {signal.label}
                      </button>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── + Add Ticker (routes through the page's limit-aware openAdd) ─── */}
      <button
        onClick={onAdd}
        className="f0-focus f0-press mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-sand bg-card py-3.5 text-[14px] font-semibold text-ink transition hover:bg-midnight-800"
      >
        <Plus className="h-4 w-4" />
        Add Ticker
      </button>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MY PORTFOLIO — the practice book, valued live
   ═══════════════════════════════════════════════════════════════════════ */

type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "All";
const RANGE_KEYS: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "All"];
/** Daily bars to keep per window (trading days). */
const RANGE_BARS: Record<RangeKey, number> = {
  "1D": 2,
  "1W": 6,
  "1M": 22,
  "3M": 64,
  "1Y": 253,
  All: Number.POSITIVE_INFINITY,
};
/** The header chip's read of the selected window ("Today ˅" on the board). */
const RANGE_CHIP: Record<RangeKey, string> = {
  "1D": "Today",
  "1W": "Past Week",
  "1M": "Past Month",
  "3M": "Past 3 Months",
  "1Y": "Past Year",
  All: "All Time",
};

/** Allocation donut palette — token-only, one slice colour per holding. */
const DONUT_COLORS = [
  "var(--color-teal-400)",
  "var(--kai-blue)",
  "var(--color-volt-500)",
  "var(--price-up)",
  "var(--price-down)",
  "var(--color-gold-400)",
  "var(--color-midnight-400)",
];
const CASH_COLOR = "var(--color-midnight-600)";

function money(v: number): string {
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function axisMoney(v: number): string {
  if (Math.abs(v) >= 10_000) return `$${Math.round(v / 1000)}K`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function dateLabel(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface Holding {
  symbol: string;
  quantity: number;
  value: number;
  pct: number;
  changePct: number | null;
}

function ClubPortfolio() {
  // undefined = loading · null = no practice portfolio yet.
  const [pf, setPf] = useState<PortfolioState | null | undefined>(undefined);
  const [pfQuotes, setPfQuotes] = useState<Record<string, MarketQuote>>({});
  const [barsMap, setBarsMap] = useState<Record<string, MarketBar[]>>({});
  const [range, setRange] = useState<RangeKey>("1W");

  useEffect(() => {
    let alive = true;
    loadPortfolio().then((state) => {
      if (!alive) return;
      setPf(state);
      const symbols = Array.from(
        new Set((state?.positions ?? []).map((p) => p.symbol))
      );
      if (symbols.length === 0) return;
      fetchQuotes(symbols).then((q) => {
        if (alive) setPfQuotes(q);
      });
      // One 1y daily-close series per held symbol; windows slice client-side.
      symbols.forEach((sym) => {
        fetchBars(sym, "1y").then((bars) => {
          if (alive) setBarsMap((prev) => ({ ...prev, [sym]: bars }));
        });
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  /* Quantity per symbol (positions aggregate; the engine allows several). */
  const qtyBySymbol = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of pf?.positions ?? []) {
      m[p.symbol] = (m[p.symbol] || 0) + p.quantity;
    }
    return m;
  }, [pf]);

  /* Live equity — the engine's own definition (balance + Σ qty·mark). */
  const equityNow = useMemo(() => {
    if (!pf) return null;
    const marked: PortfolioState = {
      ...pf,
      positions: pf.positions.map((p) => ({
        ...p,
        currentPrice: pfQuotes[p.symbol]?.price ?? p.currentPrice ?? p.entryPrice,
      })),
    };
    return getEquity(marked);
  }, [pf, pfQuotes]);

  /* The value series: CURRENT holdings re-priced at each daily close + cash.
     Honest approximation, labelled as such under the chart. Only draws when
     every held symbol answered with bars — a curve missing a holding lies. */
  const fullSeries = useMemo(() => {
    if (!pf || pf.positions.length === 0) return null;
    const symbols = Object.keys(qtyBySymbol);
    if (symbols.some((s) => (barsMap[s]?.length ?? 0) < 2)) return null;

    const allT = Array.from(
      new Set(symbols.flatMap((s) => barsMap[s].map((b) => b.t)))
    ).sort((a, b) => a - b);

    const closeAt: Record<string, Map<number, number>> = {};
    for (const s of symbols) {
      closeAt[s] = new Map(barsMap[s].map((b) => [b.t, b.c]));
    }

    const last: Record<string, number | null> = {};
    for (const s of symbols) last[s] = null;

    const out: { t: number; v: number }[] = [];
    for (const t of allT) {
      let ok = true;
      let v = pf.balance;
      for (const s of symbols) {
        const c = closeAt[s].get(t) ?? last[s];
        if (c == null) {
          ok = false;
          break;
        }
        last[s] = closeAt[s].get(t) ?? last[s];
        v += qtyBySymbol[s] * c;
      }
      // Skip dates before every holding has traded — no fabricated closes.
      if (ok) out.push({ t, v: Math.round(v * 100) / 100 });
      else {
        for (const s of symbols) {
          const c = closeAt[s].get(t);
          if (c != null) last[s] = c;
        }
      }
    }
    return out.length >= 2 ? out : null;
  }, [pf, qtyBySymbol, barsMap]);

  const series = useMemo(() => {
    if (!fullSeries) return null;
    const n = RANGE_BARS[range];
    return Number.isFinite(n) ? fullSeries.slice(-n) : fullSeries;
  }, [fullSeries, range]);

  /* Window change — Today from the live quote day-moves; longer windows from
     the series' own first point vs. live equity. */
  const change = useMemo(() => {
    if (!pf || equityNow == null) return null;
    if (range === "1D") {
      let c = 0;
      let any = false;
      for (const [sym, qty] of Object.entries(qtyBySymbol)) {
        const q = pfQuotes[sym];
        if (q?.change != null) {
          c += qty * q.change;
          any = true;
        }
      }
      return any || Object.keys(qtyBySymbol).length === 0
        ? Math.round(c * 100) / 100
        : null;
    }
    if (!series || series.length < 2) return null;
    return Math.round((equityNow - series[0].v) * 100) / 100;
  }, [pf, equityNow, range, qtyBySymbol, pfQuotes, series]);

  const changePct =
    change != null && equityNow != null && equityNow - change > 0
      ? (change / (equityNow - change)) * 100
      : null;

  /* Holdings, largest first, valued at the live mark. */
  const holdings = useMemo<Holding[]>(() => {
    if (!pf || equityNow == null || equityNow <= 0) return [];
    return Object.entries(qtyBySymbol)
      .map(([symbol, quantity]) => {
        const q = pfQuotes[symbol];
        const price =
          q?.price ??
          pf.positions.find((p) => p.symbol === symbol)?.entryPrice ??
          0;
        const value = quantity * price;
        return {
          symbol,
          quantity,
          value,
          pct: (value / equityNow) * 100,
          changePct: q?.changePercent ?? null,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [pf, qtyBySymbol, pfQuotes, equityNow]);

  /* ── Loading ──────────────────────────────────────────────────────────── */
  if (pf === undefined) {
    return (
      <div className="mt-4 space-y-3">
        <div className="h-56 animate-pulse rounded-2xl border border-sand bg-card" />
        <div className="h-24 animate-pulse rounded-2xl border border-sand bg-card" />
      </div>
    );
  }

  /* ── No practice portfolio yet — the layout states itself honestly ────── */
  if (pf === null) {
    return (
      <div className="mt-4 rounded-2xl border border-sand bg-card p-5">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-soft">
          Total Value <Info className="h-3.5 w-3.5" />
        </p>
        <p className="mt-3 text-[14px] font-semibold text-ink">
          No practice portfolio yet
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-soft">
          Your first trade on the practice floor opens the book — value, chart
          and holdings all draw from real trades at real prices.
        </p>
        <Link
          href="/simulator"
          className="f0-focus f0-press mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-kai-blue"
        >
          Open the Trading Floor
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const hasPositions = pf.positions.length > 0;

  return (
    <>
      {/* The board's right-hand chip — the window the numbers below read. */}
      <div className="-mt-6 flex justify-end">
        <span className="inline-flex items-center gap-1 rounded-full border border-sand bg-card px-3 py-1.5 text-[12px] font-semibold text-soft">
          {RANGE_CHIP[range]}
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* ── Total Value card ─────────────────────────────────────────────── */}
      <div className="mt-3 rounded-2xl border border-sand bg-card p-4 sm:p-5">
        <p
          className="flex items-center gap-1.5 text-[12px] font-semibold text-soft"
          title="Practice-floor equity: cash balance plus holdings at the latest (delayed ~15 min) prices."
        >
          Total Value <Info className="h-3.5 w-3.5" />
        </p>
        <p className="mt-1 font-display text-[32px] font-bold tabular-nums leading-none text-ink">
          {equityNow != null ? money(equityNow) : "—"}
        </p>
        {change != null && changePct != null ? (
          <p
            className={`mt-1.5 font-mono text-[13px] font-semibold tabular-nums ${moveToneClass(changePct)}`}
          >
            {change >= 0 ? "+ " : "− "}
            {money(Math.abs(change))} ({Math.abs(changePct).toFixed(2)}%)
          </p>
        ) : (
          <p className="mt-1.5 text-[12px] text-soft">
            {hasPositions ? "Marking the window…" : "No open positions"}
          </p>
        )}

        {hasPositions ? (
          series ? (
            <PortfolioValueChart series={series} />
          ) : (
            <div className="mt-4 flex h-36 items-center justify-center rounded-xl bg-paper/60">
              <span className="text-[11px] text-soft">chart loading…</span>
            </div>
          )
        ) : (
          <div className="mt-4 flex h-36 flex-col items-center justify-center gap-1 rounded-xl bg-paper/60">
            <span className="text-[12px] font-semibold text-soft">
              No holdings yet
            </span>
            <Link
              href="/simulator"
              className="f0-focus text-[12px] font-semibold text-kai-blue"
            >
              Make a practice trade →
            </Link>
          </div>
        )}
        {hasPositions && series && (
          <p className="mt-2 text-right text-[10px] text-soft/70">
            Current holdings at daily closes · delayed
          </p>
        )}
      </div>

      {/* ── Timeframe pills — 1D · 1W · 1M · 3M · 1Y · All ───────────────── */}
      <div className="mt-3 flex items-center justify-between px-1">
        {RANGE_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setRange(k)}
            aria-pressed={range === k}
            className={`f0-focus f0-press rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
              range === k ? "bg-midnight-800 text-ink" : "text-soft hover:text-ink"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* ── Top Holdings + allocation donut ──────────────────────────────── */}
      {holdings.length > 0 && equityNow != null && (
        <section className="mt-6">
          <h2 className="text-[13px] font-bold text-ink">Top Holdings</h2>
          <div className="mt-3 flex items-center gap-4">
            <ul className="min-w-0 flex-1 space-y-3">
              {holdings.slice(0, 4).map((h) => (
                <li key={h.symbol} className="flex items-center gap-2.5">
                  <CompanyLogo symbol={h.symbol} size={28} rounded="rounded-lg" />
                  <span className="w-14 shrink-0 text-[13px] font-bold text-ink">
                    {h.symbol}
                  </span>
                  <span className="w-14 shrink-0 font-mono text-[12px] tabular-nums text-soft">
                    {h.pct.toFixed(2)}%
                  </span>
                  <span className="ml-auto font-mono text-[13px] font-semibold tabular-nums text-ink">
                    {money(h.value)}
                  </span>
                  <span
                    className={`w-14 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums ${moveToneClass(h.changePct)}`}
                  >
                    {h.changePct != null ? formatChangePct(h.changePct) : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <AllocationDonut
              holdings={holdings}
              cash={pf.balance}
              total={equityNow}
            />
          </div>
          <Link
            href="/simulator"
            className="f0-focus f0-press mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-kai-blue"
          >
            View All Holdings
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      )}
    </>
  );
}

/* ── The violet value chart — line, dot markers, gradient wash, axes ─────── */

function PortfolioValueChart({ series }: { series: { t: number; v: number }[] }) {
  const W = 320;
  const H = 132;
  const padL = 34; // room for the $XXK axis
  const padR = 6;
  const padT = 8;
  const padB = 18; // room for the date stamps

  const vals = series.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;

  const stepX = (W - padL - padR) / (series.length - 1);
  const pts = series.map((p, i) => {
    const x = padL + i * stepX;
    const y = padT + (1 - (p.v - min) / span) * (H - padT - padB);
    return [x, y] as const;
  });
  const path = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${H - padB} L${padL},${H - padB} Z`;

  // Three axis reads: top, middle, bottom of the drawn window.
  const yTicks = [max, (max + min) / 2, min];
  // Up to five evenly spaced date stamps under the plot.
  const labelCount = Math.min(5, series.length);
  const labelIdx = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i * (series.length - 1)) / Math.max(1, labelCount - 1))
  );

  const violet = "var(--kai-blue)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-4 h-36 w-full"
      role="img"
      aria-label={`Portfolio value from ${dateLabel(series[0].t)} to ${dateLabel(series[series.length - 1].t)}, ${axisMoney(min)} to ${axisMoney(max)}`}
    >
      <defs>
        <linearGradient id="club-pf-wash" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor={`color-mix(in srgb, ${violet} 26%, transparent)`}
          />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>

      {/* faint horizontal grid at each axis read */}
      {yTicks.map((v, i) => {
        const y = padT + (1 - (v - min) / span) * (H - padT - padB);
        return (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              stroke="var(--sand)"
              strokeWidth={0.5}
              strokeDasharray="2 4"
            />
            <text
              x={padL - 5}
              y={y + 3}
              textAnchor="end"
              className="fill-soft"
              fontSize={8.5}
            >
              {axisMoney(v)}
            </text>
          </g>
        );
      })}

      <path d={area} fill="url(#club-pf-wash)" stroke="none" />
      <path
        d={path}
        fill="none"
        stroke={violet}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* dot markers on the vertices, as the board draws — only while the
          window is sparse enough for dots to read as dots */}
      {series.length <= 36 &&
        pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2} fill={violet} />
        ))}

      {labelIdx.map((idx) => (
        <text
          key={idx}
          x={pts[idx][0]}
          y={H - 5}
          textAnchor="middle"
          className="fill-soft"
          fontSize={8.5}
        >
          {dateLabel(series[idx].t)}
        </text>
      ))}
    </svg>
  );
}

/* ── The allocation donut — one slice per holding, cash closes the ring ──── */

function AllocationDonut({
  holdings,
  cash,
  total,
}: {
  holdings: Holding[];
  cash: number;
  total: number;
}) {
  const R = 34;
  const STROKE = 13;
  const C = 2 * Math.PI * R;

  const slices: { label: string; frac: number; color: string }[] = holdings
    .slice(0, DONUT_COLORS.length)
    .map((h, i) => ({
      label: h.symbol,
      frac: Math.max(0, h.value / total),
      color: DONUT_COLORS[i],
    }));
  const rest =
    holdings.slice(DONUT_COLORS.length).reduce((s, h) => s + h.value, 0) +
    Math.max(0, cash);
  if (rest > 0) {
    slices.push({ label: "Cash & other", frac: rest / total, color: CASH_COLOR });
  }

  // Precompute each slice's arc length and running start offset.
  const arcs = slices.reduce<{ s: (typeof slices)[number]; len: number; start: number }[]>(
    (acc, s) => {
      const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].len : 0;
      acc.push({ s, len: Math.max(0, Math.min(1, s.frac)) * C, start });
      return acc;
    },
    []
  );

  return (
    <svg
      viewBox="0 0 96 96"
      className="h-24 w-24 shrink-0 -rotate-90"
      role="img"
      aria-label={`Allocation: ${slices
        .map((s) => `${s.label} ${(s.frac * 100).toFixed(0)}%`)
        .join(", ")}`}
    >
      {arcs.map(({ s, len, start }) => (
        <circle
          key={s.label}
          cx={48}
          cy={48}
          r={R}
          fill="none"
          stroke={s.color}
          strokeWidth={STROKE}
          strokeDasharray={`${len} ${C - len}`}
          strokeDashoffset={-start}
        />
      ))}
    </svg>
  );
}
