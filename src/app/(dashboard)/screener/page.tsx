"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Telescope,
  Search,
  ChevronDown,
  Trophy,
  TrendingUp,
  Rocket,
  Waves,
  BarChart3,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Plus,
  Users2,
  Check,
  SlidersHorizontal,
  Info,
  Lock,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import { fetchQuote } from "@/lib/market/client";
import CompanyLogo from "@/components/fic/CompanyLogo";
import LockedState from "@/components/dashboard/LockedState";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";
import {
  PRESETS,
  getPreset,
  matchesCustom,
  filtersEmpty,
  fmtMcap,
  type ScreenerRow,
  type ScreenerPreset,
  type CustomFilters,
  type SortDir,
} from "@/lib/screener";

const ICONS: Record<string, LucideIcon> = { Trophy, TrendingUp, Rocket, Waves, BarChart3 };
const PAGE_SIZE = 100;
const METRIC_COLS =
  "ticker, name, sector, exchange, type, mcap, price, chg_1d, chg_5d, chg_1m, chg_3m, vol, avg_vol_20, vol_ratio, dist_52w_high, dist_52w_low, rsi14, ema20_state, ema50_state, gap_pct, updated_at";

/* ---------- formatting ---------- */
function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function pctTone(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-soft";
  return v > 0 ? "text-emerald-600" : "text-rose-600";
}
const fmtRatio = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1)}×`);
const fmtRsi = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(0));

/* ---------- sortable columns ---------- */
type SortKey =
  | "ticker"
  | "price"
  | "chg_1d"
  | "chg_5d"
  | "chg_1m"
  | "chg_3m"
  | "vol_ratio"
  | "mcap"
  | "rsi14";
interface Col {
  key: SortKey;
  label: string;
  align: "left" | "right";
  render: (r: ScreenerRow) => React.ReactNode;
  cls?: (r: ScreenerRow) => string;
}
const COLS: Col[] = [
  { key: "price", label: "Price", align: "right", render: (r) => fmtPrice(r.price) },
  { key: "chg_1d", label: "1d", align: "right", render: (r) => fmtPct(r.chg_1d), cls: (r) => pctTone(r.chg_1d) },
  { key: "chg_5d", label: "5d", align: "right", render: (r) => fmtPct(r.chg_5d), cls: (r) => pctTone(r.chg_5d) },
  { key: "chg_1m", label: "1m", align: "right", render: (r) => fmtPct(r.chg_1m), cls: (r) => pctTone(r.chg_1m) },
  { key: "chg_3m", label: "3m", align: "right", render: (r) => fmtPct(r.chg_3m), cls: (r) => pctTone(r.chg_3m) },
  { key: "vol_ratio", label: "Vol×", align: "right", render: (r) => fmtRatio(r.vol_ratio), cls: (r) => (r.vol_ratio != null && r.vol_ratio >= 2 ? "text-gold-700 font-bold" : "") },
  { key: "mcap", label: "Mkt cap", align: "right", render: (r) => fmtMcap(r.mcap) },
  { key: "rsi14", label: "RSI", align: "right", render: (r) => fmtRsi(r.rsi14) },
];

interface Meta {
  last_trading_day: string | null;
  universe_count: number | null;
  common_count: number | null;
  etf_count: number | null;
  mcap_count: number | null;
  history_days: number | null;
}

export default function ScreenerPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [tierResolved, setTierResolved] = useState(false);
  const [isKid, setIsKid] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);

  const [custom, setCustom] = useState<CustomFilters>({});
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("mcap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [explainerOpen, setExplainerOpen] = useState(false);

  const [added, setAdded] = useState<Record<string, "family" | "community">>({});
  const [busy, setBusy] = useState<string | null>(null);

  const isFTA = tier === "fta";

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      setTierResolved(true);
      return;
    }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, age_group, family_id")
      .eq("id", user.id)
      .maybeSingle();
    const p = (profile || {}) as { role?: string; age_group?: string; family_id?: string | null };
    setFamilyId(p.family_id ?? null);
    setIsKid(p.age_group === "kids" || p.role === "child");
    getFamilyTier(supabase, p.family_id ?? null).then((t) => {
      setTier(t);
      setTierResolved(true);
    });

    // Full universe (~10k) — PostgREST caps a page at 1000, so fetch the count
    // then pull all pages in parallel .range() calls. One burst on mount; from
    // then on every filter / sort / search runs client-side → instant.
    const { count } = await supabase
      .from("screener_metrics")
      .select("ticker", { count: "exact", head: true })
      .not("price", "is", null);
    const total = count ?? 0;
    const pages = Math.max(1, Math.ceil(total / 1000));
    const reqs = Array.from({ length: pages }, (_, i) =>
      supabase
        .from("screener_metrics")
        .select(METRIC_COLS)
        .not("price", "is", null)
        .order("mcap", { ascending: false, nullsFirst: false })
        .order("ticker", { ascending: true })
        .range(i * 1000, i * 1000 + 999)
    );
    const [metaRes, ...pageResults] = await Promise.all([
      supabase
        .from("screener_meta")
        .select("last_trading_day, universe_count, common_count, etf_count, mcap_count, history_days")
        .eq("id", true)
        .maybeSingle(),
      ...reqs,
    ]);
    const all: ScreenerRow[] = [];
    for (const r of pageResults) if (r.data) all.push(...(r.data as ScreenerRow[]));
    setRows(all);
    setMeta((metaRes.data as Meta) ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.sector) s.add(r.sector);
    return Array.from(s).sort();
  }, [rows]);
  const exchanges = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.exchange) s.add(r.exchange);
    return Array.from(s).sort();
  }, [rows]);

  const results = useMemo(() => {
    const filtered = filtersEmpty(custom) && !custom.q ? rows : rows.filter((r) => matchesCustom(r, custom));
    const sign = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
      return String(av).localeCompare(String(bv)) * sign;
    });
  }, [rows, custom, sortKey, sortDir]);

  useEffect(() => {
    setPage(0);
  }, [custom, sortKey, sortDir]);

  const pageRows = useMemo(
    () => results.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [results, page]
  );
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));

  function applyPreset(p: ScreenerPreset) {
    if (activePresetId === p.id) {
      // toggle off
      setActivePresetId(null);
      setCustom((c) => ({ q: c.q }));
      return;
    }
    setActivePresetId(p.id);
    setCustom((c) => ({ q: c.q, ...p.filters }));
    setSortKey(p.sort.key as SortKey);
    setSortDir(p.sort.dir);
  }
  function patchFilter(patch: Partial<CustomFilters>) {
    setActivePresetId(null);
    setCustom((c) => ({ ...c, ...patch }));
  }
  function clearFilter(key: keyof CustomFilters) {
    setActivePresetId(null);
    setCustom((c) => {
      const next = { ...c };
      delete next[key];
      return next;
    });
  }
  function clearAll() {
    setActivePresetId(null);
    setCustom((c) => ({ q: c.q }));
  }
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "ticker" ? "asc" : "desc");
    }
  }

  async function addToFamily(r: ScreenerRow, alsoPromote: boolean) {
    if (!familyId || !userId || busy) return;
    setBusy(r.ticker);
    const snap = await fetchQuote(r.ticker);
    const { data, error } = await supabase
      .from("family_watchlist")
      .insert({
        family_id: familyId,
        company_name: r.name || r.ticker,
        ticker: r.ticker,
        status: "watch",
        champion_id: userId,
        snapshot_price: snap?.price ?? r.price ?? null,
        snapshot_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (!error && data) {
      if (alsoPromote) {
        await supabase.rpc("promote_to_community", {
          p_watchlist_id: (data as { id: string }).id,
          p_snapshot_price: snap?.price ?? r.price ?? null,
        });
        setAdded((a) => ({ ...a, [r.ticker]: "community" }));
      } else setAdded((a) => ({ ...a, [r.ticker]: "family" }));
    }
    setBusy(null);
  }

  if (loading || !tierResolved) return <DashboardSkeleton variant="list" />;

  if (tier === "free") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <LockedState
          icon={Telescope}
          eyebrow="Members discover here"
          title="The Stock Screener"
          body="Search every stock on the NYSE, Nasdaq and AMEX and filter the whole market down to companies worth studying — by size, sector, momentum, volume and more. It opens the moment you join."
          cta={{ label: "Unlock the screener — join FIC", href: FIC_CHECKOUT_URL, external: true }}
        />
      </div>
    );
  }

  const chips = activeChips(custom);
  const coverage =
    meta?.mcap_count != null && meta?.common_count
      ? Math.round((meta.mcap_count / meta.common_count) * 100)
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pb-24 sm:px-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-chip-amber text-gold-700">
            <Telescope className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Stock Screener</h1>
            <p className="text-xs text-soft">Search and filter the entire US market.</p>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-soft/80">
          Delayed data (~15 min)
          {meta?.last_trading_day ? ` · ${meta.last_trading_day}` : ""}
          {meta?.universe_count ? ` · ${meta.universe_count.toLocaleString()} securities` : ""}
          {coverage != null ? ` · market cap on ${coverage}% of stocks` : ""}
          {meta?.history_days ? ` · ${meta.history_days}-day window` : ""}
        </p>
      </div>

      {/* Search — prominent, first-class */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-soft" />
        <input
          value={custom.q ?? ""}
          onChange={(e) => setCustom((c) => ({ ...c, q: e.target.value || null }))}
          placeholder="Search 10,000+ stocks by ticker or company name…"
          className="w-full rounded-2xl border border-sand bg-paper py-3 pl-11 pr-10 text-sm font-medium text-ink shadow-soft outline-none transition focus:border-gold-400"
        />
        {custom.q && (
          <button
            onClick={() => setCustom((c) => ({ ...c, q: null }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-soft hover:text-ink"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Preset quick-start chips */}
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-soft/70">
          Quick start
        </span>
        {PRESETS.map((p) => {
          const Icon = ICONS[p.icon] ?? Trophy;
          const active = activePresetId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              title={p.blurb}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                active
                  ? "border-gold-400 bg-chip-amber text-gold-700 shadow-soft"
                  : "border-sand bg-paper text-soft hover:border-gold-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {p.label}
            </button>
          );
        })}
      </div>
      {activePresetId && (
        <p className="flex items-start gap-2 rounded-xl border border-gold-300/40 bg-chip-amber/40 px-3.5 py-2.5 text-[13px] leading-snug text-ink/80">
          {(() => {
            const ap = getPreset(activePresetId)!;
            const Icon = ICONS[ap.icon] ?? Trophy;
            return (
              <>
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                <span>{ap.blurb} These filters are applied below — tweak any of them.</span>
              </>
            );
          })()}
        </p>
      )}

      {/* Filter panel — primary interface */}
      <div className="rounded-2xl border border-sand bg-paper/60">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <SlidersHorizontal className="h-4 w-4 text-gold-600" />
            Filters
            {chips.length > 0 && (
              <span className="rounded-full bg-chip-amber px-2 py-0.5 text-[11px] font-bold text-gold-700">
                {chips.length}
              </span>
            )}
          </span>
          <ChevronDown className={`h-4 w-4 text-soft transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {filtersOpen && (
            <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <FilterPanel
                isFTA={isFTA}
                isKid={isKid}
                sectors={sectors}
                exchanges={exchanges}
                value={custom}
                patch={patchFilter}
              />
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => clearFilter(c.key)}
              className="inline-flex items-center gap-1 rounded-full border border-gold-300/50 bg-chip-amber/60 px-2.5 py-1 text-[11px] font-semibold text-gold-700 hover:bg-chip-amber"
            >
              {c.label}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button onClick={clearAll} className="ml-1 text-[11px] font-semibold text-soft underline hover:text-ink">
            Clear all
          </button>
        </div>
      )}

      {/* Result count + how-to */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink">
          {results.length.toLocaleString()} {results.length === 1 ? "result" : "results"}
        </span>
        <button
          onClick={() => setExplainerOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-soft hover:text-ink"
        >
          <Info className="h-3.5 w-3.5" />
          How to use a screener
        </button>
      </div>
      <AnimatePresence initial={false}>
        {explainerOpen && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="rounded-xl border border-sand bg-paper/60 px-4 py-3 text-[13px] leading-relaxed text-soft">
              A screener filters thousands of stocks down to a short list that shares one trait — trading near a high, surging in volume, or looking oversold. It is a tool for finding candidates to <em>research</em>, never a list of things to buy. Combine a few filters, sort the columns, then dig into any company that catches your eye.
            </p>
          </m.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand bg-paper/60 py-16 text-center">
          <Telescope className="mx-auto mb-3 h-10 w-10 text-gold-400/60" />
          <h3 className="font-display text-lg font-bold text-ink">Nothing matches</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-soft">
            Loosen a filter or clear your search — the market shifts every day, so this list changes with it.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop dense table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-sand bg-paper md:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-sand text-[11px] uppercase tracking-wide text-soft">
                  <Th align="left" onClick={() => toggleSort("ticker")} active={sortKey === "ticker"} dir={sortDir}>
                    Company
                  </Th>
                  {COLS.map((c) => (
                    <Th key={c.key} align={c.align} onClick={() => toggleSort(c.key)} active={sortKey === c.key} dir={sortDir}>
                      {c.label}
                    </Th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-semibold" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.ticker} className="border-b border-sand/60 last:border-0 hover:bg-chip-amber/20">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <CompanyLogo symbol={r.ticker} name={r.name} size={30} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display text-[13px] font-bold text-ink">{r.ticker}</span>
                            {r.type === "etf" && (
                              <span className="rounded bg-sand px-1 py-px text-[9px] font-bold uppercase text-soft">ETF</span>
                            )}
                          </div>
                          <p className="max-w-[220px] truncate text-[11px] text-soft">{r.name || "—"}</p>
                        </div>
                      </div>
                    </td>
                    {COLS.map((c) => (
                      <td key={c.key} className={`px-3 py-2.5 text-right tabular-nums ${c.align === "right" ? "" : "text-left"} ${c.cls?.(r) ?? "text-ink"}`}>
                        {c.render(r)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <RowActions
                        r={r}
                        busy={busy === r.ticker}
                        added={added[r.ticker]}
                        canAct={!!familyId}
                        onAddFamily={() => addToFamily(r, false)}
                        onSuggest={() => addToFamily(r, true)}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / 390px card rows */}
          <div className="space-y-2.5 md:hidden">
            {pageRows.map((r) => (
              <CardRow
                key={r.ticker}
                r={r}
                busy={busy === r.ticker}
                added={added[r.ticker]}
                canAct={!!familyId}
                onAddFamily={() => addToFamily(r, false)}
                onSuggest={() => addToFamily(r, true)}
              />
            ))}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-sand bg-paper px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-xs text-soft">
                Page {page + 1} of {pageCount}
              </span>
              <button
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="rounded-lg border border-sand bg-paper px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================================
 * Sortable table header cell.
 * ==========================================================================*/
function Th({
  children,
  align,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  align: "left" | "right";
  onClick: () => void;
  active: boolean;
  dir: SortDir;
}) {
  return (
    <th className={`px-3 py-2.5 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""} ${active ? "text-gold-700" : "hover:text-ink"}`}
      >
        {children}
        {active && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

/* ============================================================================
 * Row actions (shared by table + card).
 * ==========================================================================*/
function RowActions({
  r,
  busy,
  added,
  canAct,
  onAddFamily,
  onSuggest,
  compact,
}: {
  r: ScreenerRow;
  busy: boolean;
  added?: "family" | "community";
  canAct: boolean;
  onAddFamily: () => void;
  onSuggest: () => void;
  compact?: boolean;
}) {
  if (added) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
        <Check className="h-3 w-3" />
        {added === "community" ? "On the board" : "On watchlist"}
      </span>
    );
  }
  return (
    <div className={`inline-flex items-center gap-1.5 ${compact ? "" : "flex-wrap"}`}>
      <button
        disabled={!canAct || busy}
        onClick={onAddFamily}
        title="Add to family watchlist"
        className="inline-flex items-center gap-1 rounded-lg border border-sand bg-paper px-2 py-1 text-[11px] font-semibold text-ink transition hover:border-gold-300 disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" />
        {compact ? "" : "Add to family watchlist"}
      </button>
      <button
        disabled={!canAct || busy}
        onClick={onSuggest}
        title="Suggest to community"
        className="inline-flex items-center gap-1 rounded-lg border border-sand bg-paper px-2 py-1 text-[11px] font-semibold text-ink transition hover:border-gold-300 disabled:opacity-50"
      >
        <Users2 className="h-3.5 w-3.5" />
        {compact ? "" : "Suggest to community"}
      </button>
      <Link
        href={`/research/${encodeURIComponent(r.ticker)}`}
        title="Research"
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-gold-700 hover:underline"
      >
        Research
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/* ============================================================================
 * 390px card row.
 * ==========================================================================*/
function CardRow({
  r,
  busy,
  added,
  canAct,
  onAddFamily,
  onSuggest,
}: {
  r: ScreenerRow;
  busy: boolean;
  added?: "family" | "community";
  canAct: boolean;
  onAddFamily: () => void;
  onSuggest: () => void;
}) {
  return (
    <div className="paper-card p-3.5">
      <div className="flex items-center gap-3">
        <CompanyLogo symbol={r.ticker} name={r.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-sm font-bold text-ink">{r.ticker}</span>
            {r.type === "etf" && (
              <span className="rounded bg-sand px-1 py-px text-[9px] font-bold uppercase text-soft">ETF</span>
            )}
            {r.exchange && <span className="text-[10px] text-soft/70">{r.exchange}</span>}
          </div>
          <p className="truncate text-xs text-soft">{r.name || "—"}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-sm font-bold text-ink tabular-nums">{fmtPrice(r.price)}</div>
          <div className={`text-xs font-semibold tabular-nums ${pctTone(r.chg_1d)}`}>{fmtPct(r.chg_1d)}</div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <Metric label="1m" value={fmtPct(r.chg_1m)} tone={pctTone(r.chg_1m)} />
        <Metric label="3m" value={fmtPct(r.chg_3m)} tone={pctTone(r.chg_3m)} />
        <Metric label="Vol" value={fmtRatio(r.vol_ratio)} tone={r.vol_ratio != null && r.vol_ratio >= 2 ? "text-gold-700" : "text-ink"} />
        <Metric label="Cap" value={fmtMcap(r.mcap)} tone="text-ink" />
        {r.rsi14 != null && <Metric label="RSI" value={fmtRsi(r.rsi14)} tone="text-ink" />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <RowActions r={r} busy={busy} added={added} canAct={canAct} onAddFamily={onAddFamily} onSuggest={onSuggest} />
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-soft/70">{label}</span>
      <span className={`font-semibold tabular-nums ${tone}`}>{value}</span>
    </span>
  );
}

/* ============================================================================
 * Active-filter chip descriptors.
 * ==========================================================================*/
function activeChips(f: CustomFilters): { key: keyof CustomFilters; label: string }[] {
  const out: { key: keyof CustomFilters; label: string }[] = [];
  const cap = (v: number) => fmtMcap(v);
  if (f.exchange) out.push({ key: "exchange", label: f.exchange });
  if (f.type) out.push({ key: "type", label: f.type === "etf" ? "ETFs" : "Common stocks" });
  if (f.sector) out.push({ key: "sector", label: f.sector });
  if (f.minMcap != null) out.push({ key: "minMcap", label: `Cap ≥ ${cap(f.minMcap)}` });
  if (f.maxMcap != null) out.push({ key: "maxMcap", label: `Cap ≤ ${cap(f.maxMcap)}` });
  if (f.minPrice != null) out.push({ key: "minPrice", label: `Price ≥ $${f.minPrice}` });
  if (f.maxPrice != null) out.push({ key: "maxPrice", label: `Price ≤ $${f.maxPrice}` });
  if (f.minChg1d != null) out.push({ key: "minChg1d", label: `1d ≥ ${f.minChg1d}%` });
  if (f.minChg5d != null) out.push({ key: "minChg5d", label: `5d ≥ ${f.minChg5d}%` });
  if (f.minChg1m != null) out.push({ key: "minChg1m", label: `1m ≥ ${f.minChg1m}%` });
  if (f.minChg3m != null) out.push({ key: "minChg3m", label: `3m ≥ ${f.minChg3m}%` });
  if (f.minVolRatio != null) out.push({ key: "minVolRatio", label: `Vol ≥ ${f.minVolRatio}×` });
  if (f.rsiMax != null) out.push({ key: "rsiMax", label: `RSI ≤ ${f.rsiMax}` });
  if (f.rsiMin != null) out.push({ key: "rsiMin", label: `RSI ≥ ${f.rsiMin}` });
  if (f.emaTrend) out.push({ key: "emaTrend", label: emaTrendLabel(f.emaTrend) });
  if (f.nearHigh) out.push({ key: "nearHigh", label: "Near 52w high" });
  if (f.nearLow) out.push({ key: "nearLow", label: "Near 52w low" });
  if (f.minGap != null) out.push({ key: "minGap", label: `Gap ≥ ${f.minGap}%` });
  if (f.maxGap != null) out.push({ key: "maxGap", label: `Gap ≤ ${f.maxGap}%` });
  return out;
}
function emaTrendLabel(t: NonNullable<CustomFilters["emaTrend"]>): string {
  return {
    above20: "Above 20-day",
    below20: "Below 20-day",
    above50: "Above 50-day",
    below50: "Below 50-day",
    above2050: "Above both averages",
  }[t];
}

/* ============================================================================
 * Filter panel — basic (all tiers) + advanced (FTA). Kids see no upsell note.
 * ==========================================================================*/
const MCAP_STEPS: { label: string; value: number }[] = [
  { label: "$50M+", value: 50_000_000 },
  { label: "$300M+", value: 300_000_000 },
  { label: "$2B+", value: 2_000_000_000 },
  { label: "$10B+", value: 10_000_000_000 },
  { label: "$50B+", value: 50_000_000_000 },
];

function FilterPanel({
  isFTA,
  isKid,
  sectors,
  exchanges,
  value,
  patch,
}: {
  isFTA: boolean;
  isKid: boolean;
  sectors: string[];
  exchanges: string[];
  value: CustomFilters;
  patch: (p: Partial<CustomFilters>) => void;
}) {
  return (
    <div className="space-y-4 px-4 pb-4">
      {/* Exchange + type + sector */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select label="Exchange" value={value.exchange ?? ""} onChange={(v) => patch({ exchange: v || null })}>
          <option value="">Any exchange</option>
          {exchanges.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </Select>
        <Select label="Type" value={value.type ?? ""} onChange={(v) => patch({ type: (v as CustomFilters["type"]) || null })}>
          <option value="">Stocks + ETFs</option>
          <option value="common">Common stocks</option>
          <option value="etf">ETFs</option>
        </Select>
        <Select label="Sector" value={value.sector ?? ""} onChange={(v) => patch({ sector: v || null })}>
          <option value="">Any sector</option>
          {sectors.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      {/* Market cap */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink">Company size (market cap)</label>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={value.minMcap == null} onClick={() => patch({ minMcap: null })}>
            Any
          </Chip>
          {MCAP_STEPS.map((s) => (
            <Chip key={s.label} active={value.minMcap === s.value} onClick={() => patch({ minMcap: s.value })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Price + change + volume */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Min price $" value={value.minPrice} onChange={(v) => patch({ minPrice: v })} />
        <NumberField label="Max price $" value={value.maxPrice} onChange={(v) => patch({ maxPrice: v })} />
        <NumberField label="Min 1d %" value={value.minChg1d} onChange={(v) => patch({ minChg1d: v })} />
        <NumberField label="Min 5d %" value={value.minChg5d} onChange={(v) => patch({ minChg5d: v })} />
        <NumberField label="Min 1m %" value={value.minChg1m} onChange={(v) => patch({ minChg1m: v })} />
        <NumberField label="Min 3m %" value={value.minChg3m} onChange={(v) => patch({ minChg3m: v })} />
        <NumberField label="Min volume ×" value={value.minVolRatio} onChange={(v) => patch({ minVolRatio: v })} />
      </div>

      {isFTA ? (
        <div className="space-y-4 border-t border-sand pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-700">Advanced technical filters</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumberField label="RSI below (oversold)" value={value.rsiMax} onChange={(v) => patch({ rsiMax: v })} />
            <NumberField label="RSI above (strong)" value={value.rsiMin} onChange={(v) => patch({ rsiMin: v })} />
            <NumberField label="Gap up ≥ %" value={value.minGap} onChange={(v) => patch({ minGap: v })} />
            <NumberField label="Gap down ≤ %" value={value.maxGap} onChange={(v) => patch({ maxGap: v })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Moving-average trend" value={value.emaTrend ?? ""} onChange={(v) => patch({ emaTrend: (v as CustomFilters["emaTrend"]) || null })}>
              <option value="">Any trend</option>
              <option value="above20">Above 20-day average</option>
              <option value="below20">Below 20-day average</option>
              <option value="above50">Above 50-day average</option>
              <option value="below50">Below 50-day average</option>
              <option value="above2050">Above both averages</option>
            </Select>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-ink">
                <input type="checkbox" checked={!!value.nearHigh} onChange={(e) => patch({ nearHigh: e.target.checked || null })} />
                Near 52w high
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-ink">
                <input type="checkbox" checked={!!value.nearLow} onChange={(e) => patch({ nearLow: e.target.checked || null })} />
                Near 52w low
              </label>
            </div>
          </div>
        </div>
      ) : (
        !isKid && (
          <div className="flex items-start gap-2 border-t border-sand pt-4 text-[12px] leading-snug text-soft">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
            <span>
              Advanced technical filters — RSI, moving-average trend, gap and 52-week highs/lows — are part of the Family Trading Academy.{" "}
              <Link href="/upgrade" className="font-semibold text-gold-700">Explore FTA →</Link>
            </span>
          </div>
        )
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-ink">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-sand bg-paper px-2.5 py-2 text-xs text-ink"
      >
        {children}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-soft">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full rounded-lg border border-sand bg-paper px-2.5 py-1.5 text-xs text-ink"
      />
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active ? "border-gold-400 bg-chip-amber text-gold-700" : "border-sand bg-paper text-soft hover:border-gold-300"
      }`}
    >
      {children}
    </button>
  );
}
