"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Telescope,
  ChevronDown,
  Trophy,
  TrendingUp,
  Rocket,
  Waves,
  BarChart3,
  ArrowUpDown,
  ArrowRight,
  Plus,
  Users2,
  Check,
  SlidersHorizontal,
  Info,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
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
  sortRows,
  fmtMcap,
  fmtVol,
  type ScreenerRow,
  type ScreenerPreset,
  type CustomFilters,
  type SortDir,
} from "@/lib/screener";

const ICONS: Record<string, LucideIcon> = {
  Trophy,
  TrendingUp,
  Rocket,
  Waves,
  BarChart3,
};

/* ---------- formatting ---------- */
function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(1)}%`;
}
function pctTone(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-soft";
  return v > 0 ? "text-emerald-600" : "text-rose-600";
}

type SortKey =
  | "mcap"
  | "price"
  | "chg_1d"
  | "chg_5d"
  | "chg_1m"
  | "chg_3m"
  | "vol_ratio"
  | "rsi14"
  | "ticker";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "mcap", label: "Market cap" },
  { key: "chg_1d", label: "Change (1d)" },
  { key: "chg_1m", label: "Change (1m)" },
  { key: "chg_3m", label: "Change (3m)" },
  { key: "vol_ratio", label: "Volume surge" },
  { key: "price", label: "Price" },
  { key: "rsi14", label: "RSI" },
  { key: "ticker", label: "Ticker A–Z" },
];

interface Meta {
  last_trading_day: string | null;
  universe_count: number | null;
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

  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [custom, setCustom] = useState<CustomFilters>({});
  const [sortKey, setSortKey] = useState<SortKey>("mcap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [explainerOpen, setExplainerOpen] = useState(false);

  // per-ticker row action state
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
    const p = (profile || {}) as {
      role?: string;
      age_group?: string;
      family_id?: string | null;
    };
    setFamilyId(p.family_id ?? null);
    setIsKid(p.age_group === "kids" || p.role === "child");
    getFamilyTier(supabase, p.family_id ?? null).then((t) => {
      setTier(t);
      setTierResolved(true);
    });

    // Direct table read — RLS lets any authenticated member SELECT the screen
    // surface; the cron owns all writes. One bounded round trip, then all
    // filtering/sorting happens client-side for instant preset switching.
    const [{ data: mrows }, { data: mrow }] = await Promise.all([
      withTimeout(
        supabase
          .from("screener_metrics")
          .select(
            "ticker, name, sector, mcap, price, chg_1d, chg_5d, chg_1m, chg_3m, vol, avg_vol_20, vol_ratio, dist_52w_high, dist_52w_low, rsi14, ema20_state, ema50_state, gap_pct, updated_at"
          )
          .order("mcap", { ascending: false, nullsFirst: false })
          .limit(2000),
        LOAD_TIMEOUT_MS,
        { data: [] } as { data: unknown }
      ),
      supabase
        .from("screener_meta")
        .select("last_trading_day, universe_count, history_days")
        .eq("id", true)
        .maybeSingle(),
    ]);
    setRows(((mrows as ScreenerRow[]) || []).filter((r) => r.price != null));
    setMeta((mrow as Meta) ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const activePreset: ScreenerPreset | null =
    mode === "preset" ? getPreset(presetId) : null;

  // Distinct sectors for the filter dropdown.
  const sectors = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.sector) s.add(r.sector);
    return Array.from(s).sort();
  }, [rows]);

  // Apply preset OR custom filter, then sort.
  const results = useMemo(() => {
    let out = rows;
    if (mode === "preset" && activePreset) {
      out = rows.filter(activePreset.match);
    } else if (mode === "custom") {
      out = rows.filter((r) => matchesCustom(r, custom));
    }
    return sortRows(out, sortKey, sortDir);
  }, [rows, mode, activePreset, custom, sortKey, sortDir]);

  // When a preset is chosen, adopt its default sort.
  function choosePreset(p: ScreenerPreset) {
    setMode("preset");
    setPresetId(p.id);
    setSortKey(p.sort.key as SortKey);
    setSortDir(p.sort.dir);
  }

  /* ---------- row actions ---------- */
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
      } else {
        setAdded((a) => ({ ...a, [r.ticker]: "family" }));
      }
    }
    setBusy(null);
  }

  /* ---------- gates ---------- */
  if (loading || !tierResolved) {
    return <DashboardSkeleton variant="list" />;
  }

  // Free tier: the members-only door.
  if (tier === "free") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <LockedState
          icon={Telescope}
          eyebrow="Members discover here"
          title="The Stock Screener"
          body="Scan the whole market for companies worth studying — big brands at new highs, steady climbers, unusual volume — with plain-English screens the whole family can read. It opens the moment you join."
          cta={{
            label: "Unlock the screener — join FIC",
            href: FIC_CHECKOUT_URL,
            external: true,
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 pb-20 sm:px-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-chip-amber text-gold-700">
            <Telescope className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              Stock Screener
            </h1>
            <p className="text-xs text-soft">
              Find companies worth researching — start with a screen below.
            </p>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-soft/80">
          Delayed data (~15 min)
          {meta?.last_trading_day ? ` · updated ${meta.last_trading_day}` : ""}
          {meta?.universe_count ? ` · ${meta.universe_count} companies` : ""}
          {meta?.history_days
            ? ` · trailing ${meta.history_days}-day window`
            : ""}
        </p>
      </div>

      {/* How to use — collapsed explainer (adult-first, 3 sentences) */}
      <div className="rounded-2xl border border-sand bg-paper/60">
        <button
          onClick={() => setExplainerOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Info className="h-4 w-4 text-gold-600" />
            How to use a screener
          </span>
          <ChevronDown
            className={`h-4 w-4 text-soft transition-transform ${
              explainerOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        <AnimatePresence initial={false}>
          {explainerOpen && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <p className="px-4 pb-4 text-[13px] leading-relaxed text-soft">
                A screener filters thousands of stocks down to a short list that
                shares one trait — trading near a high, surging in volume, or
                looking oversold. It is a tool for finding candidates to
                <em> research</em>, never a list of things to buy. Start with a
                preset, read what it looks for and why that matters, then dig
                into any company that catches your eye.
              </p>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Presets — first-class */}
      <div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const Icon = ICONS[p.icon] ?? Trophy;
            const active = mode === "preset" && presetId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => choosePreset(p)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
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
          {/* Custom filters entry */}
          <button
            onClick={() => setMode("custom")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
              mode === "custom"
                ? "border-gold-400 bg-chip-amber text-gold-700 shadow-soft"
                : "border-sand bg-paper text-soft hover:border-gold-300"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {isFTA ? "Custom filters" : "Basic filters"}
          </button>
        </div>

        {/* Active preset explanation (education-first, always visible) */}
        {mode === "preset" && activePreset && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-gold-300/40 bg-chip-amber/40 px-3.5 py-2.5 text-[13px] leading-snug text-ink/80">
            {(() => {
              const Icon = ICONS[activePreset.icon] ?? Trophy;
              return <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />;
            })()}
            <span>{activePreset.blurb}</span>
          </p>
        )}
      </div>

      {/* Custom / basic filter builder */}
      {mode === "custom" && (
        <FilterBuilder
          isFTA={isFTA}
          isKid={isKid}
          sectors={sectors}
          value={custom}
          onChange={setCustom}
        />
      )}

      {/* Sort bar */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-soft">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort
        </label>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-lg border border-sand bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="rounded-lg border border-sand bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink"
        >
          {sortDir === "asc" ? "Ascending ↑" : "Descending ↓"}
        </button>
        <span className="ml-auto text-xs text-soft">
          {results.length} {results.length === 1 ? "company" : "companies"}
        </span>
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand bg-paper/60 py-16 text-center">
          <Telescope className="mx-auto mb-3 h-10 w-10 text-gold-400/60" />
          <h3 className="font-display text-lg font-bold text-ink">
            No companies match yet
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-soft">
            Try another screen or loosen your filters — the market shifts every
            day, so this list changes with it.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {results.slice(0, 120).map((r) => (
            <ResultRow
              key={r.ticker}
              row={r}
              busy={busy === r.ticker}
              added={added[r.ticker]}
              canAct={!!familyId}
              onAddFamily={() => addToFamily(r, false)}
              onSuggest={() => addToFamily(r, true)}
            />
          ))}
          {results.length > 120 && (
            <p className="pt-2 text-center text-xs text-soft">
              Showing the top 120 — narrow the screen to see more.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * Result row — a self-contained card that reads cleanly at 390px.
 * ==========================================================================*/
function ResultRow({
  row: r,
  busy,
  added,
  canAct,
  onAddFamily,
  onSuggest,
}: {
  row: ScreenerRow;
  busy: boolean;
  added?: "family" | "community";
  canAct: boolean;
  onAddFamily: () => void;
  onSuggest: () => void;
}) {
  return (
    <div className="paper-card p-3.5 sm:p-4">
      {/* Line 1: identity + price */}
      <div className="flex items-center gap-3">
        <CompanyLogo symbol={r.ticker} name={r.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-sm font-bold text-ink">
              {r.ticker}
            </span>
            {r.sector && (
              <span className="truncate text-[11px] text-soft">{r.sector}</span>
            )}
          </div>
          <p className="truncate text-xs text-soft">{r.name || "—"}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-sm font-bold text-ink">
            {fmtPrice(r.price)}
          </div>
          <div className={`text-xs font-semibold ${pctTone(r.chg_1d)}`}>
            {fmtPct(r.chg_1d)}
          </div>
        </div>
      </div>

      {/* Line 2: metric chips */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-soft">
        <Metric label="5d" value={fmtPct(r.chg_5d)} tone={pctTone(r.chg_5d)} />
        <Metric label="1m" value={fmtPct(r.chg_1m)} tone={pctTone(r.chg_1m)} />
        <Metric label="3m" value={fmtPct(r.chg_3m)} tone={pctTone(r.chg_3m)} />
        <Metric
          label="Vol"
          value={r.vol_ratio != null ? `${r.vol_ratio.toFixed(1)}×` : "—"}
          tone={
            r.vol_ratio != null && r.vol_ratio >= 2
              ? "text-gold-700"
              : "text-ink"
          }
        />
        <Metric label="Mkt cap" value={fmtMcap(r.mcap)} tone="text-ink" />
        {r.rsi14 != null && (
          <Metric label="RSI" value={r.rsi14.toFixed(0)} tone="text-ink" />
        )}
      </div>

      {/* Line 3: actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {added ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            {added === "community" ? "On the club board" : "On your watchlist"}
          </span>
        ) : (
          <>
            <button
              disabled={!canAct || busy}
              onClick={onAddFamily}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sand bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-gold-300 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add to family watchlist
            </button>
            <button
              disabled={!canAct || busy}
              onClick={onSuggest}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sand bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-gold-300 disabled:opacity-50"
            >
              <Users2 className="h-3.5 w-3.5" />
              Suggest to community
            </button>
          </>
        )}
        <Link
          href={`/research/${encodeURIComponent(r.ticker)}`}
          className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:underline"
        >
          Research
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-soft/70">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </span>
  );
}

/* ============================================================================
 * Filter builder — FTA gets the full technical panel; FIC gets mcap + sector
 * plus a quiet FTA note (kids see no note). All education-first, no hype.
 * ==========================================================================*/
const MCAP_STEPS: { label: string; value: number }[] = [
  { label: "Any", value: 0 },
  { label: "$300M+", value: 300_000_000 },
  { label: "$2B+", value: 2_000_000_000 },
  { label: "$10B+", value: 10_000_000_000 },
  { label: "$50B+", value: 50_000_000_000 },
];

function FilterBuilder({
  isFTA,
  isKid,
  sectors,
  value,
  onChange,
}: {
  isFTA: boolean;
  isKid: boolean;
  sectors: string[];
  value: CustomFilters;
  onChange: (f: CustomFilters) => void;
}) {
  const set = (patch: Partial<CustomFilters>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4 rounded-2xl border border-sand bg-paper/60 p-4">
      {/* Market cap — both tiers */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink">
          Company size (market cap)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {MCAP_STEPS.map((s) => (
            <button
              key={s.label}
              onClick={() => set({ minMcap: s.value || null })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                (value.minMcap ?? 0) === s.value
                  ? "border-gold-400 bg-chip-amber text-gold-700"
                  : "border-sand bg-paper text-soft hover:border-gold-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sector — both tiers */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink">
          Sector
        </label>
        <select
          value={value.sector ?? ""}
          onChange={(e) => set({ sector: e.target.value || null })}
          className="w-full rounded-lg border border-sand bg-paper px-2.5 py-2 text-xs text-ink"
        >
          <option value="">Any sector</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isFTA ? (
        <div className="space-y-4 border-t border-sand pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-700">
            Advanced technical filters
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumberField
              label="Min price"
              value={value.minPrice}
              onChange={(v) => set({ minPrice: v })}
            />
            <NumberField
              label="Max price"
              value={value.maxPrice}
              onChange={(v) => set({ maxPrice: v })}
            />
            <NumberField
              label="Min 1d change %"
              value={value.minChg1d}
              onChange={(v) => set({ minChg1d: v })}
            />
            <NumberField
              label="Min 1m change %"
              value={value.minChg1m}
              onChange={(v) => set({ minChg1m: v })}
            />
            <NumberField
              label="Min volume ×"
              value={value.minVolRatio}
              onChange={(v) => set({ minVolRatio: v })}
            />
            <NumberField
              label="RSI below (oversold)"
              value={value.rsiMax}
              onChange={(v) => set({ rsiMax: v })}
            />
            <NumberField
              label="RSI above (strong)"
              value={value.rsiMin}
              onChange={(v) => set({ rsiMin: v })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink">
              Trend
            </label>
            <select
              value={value.emaTrend ?? ""}
              onChange={(e) =>
                set({
                  emaTrend:
                    (e.target.value as CustomFilters["emaTrend"]) || null,
                })
              }
              className="w-full rounded-lg border border-sand bg-paper px-2.5 py-2 text-xs text-ink sm:w-auto"
            >
              <option value="">Any trend</option>
              <option value="above20">Above 20-day average</option>
              <option value="above50">Above 50-day average</option>
              <option value="above2050">Above both averages</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink">
            <input
              type="checkbox"
              checked={!!value.nearHigh}
              onChange={(e) => set({ nearHigh: e.target.checked || null })}
            />
            Near its range high (within 3%)
          </label>
        </div>
      ) : (
        !isKid && (
          <div className="flex items-start gap-2 border-t border-sand pt-4 text-[12px] leading-snug text-soft">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
            <span>
              Advanced technical filters — RSI, moving-average trend, volume
              surge and price ranges — are part of the Family Trading Academy.{" "}
              <Link href="/upgrade" className="font-semibold text-gold-700">
                Explore FTA →
              </Link>
            </span>
          </div>
        )
      )}
    </div>
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
      <span className="mb-1 block text-[11px] font-medium text-soft">
        {label}
      </span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className="w-full rounded-lg border border-sand bg-paper px-2.5 py-1.5 text-xs text-ink"
      />
    </label>
  );
}
