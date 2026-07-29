"use client";

/**
 * ScreenerSurfaceV2 — the full-universe stock screener, rebuilt on the v2 CC
 * CANVAS (design-project-v2, board 15). This is the styling twin of
 * `ScreenerSurface.tsx`: every hook, data read, filter, saved-screen write, NL
 * parse, sort, preset, tier gate and pagination path is preserved BYTE-FOR-BYTE
 * in behaviour — only the presentation is swapped from the warm-gold "board"
 * primitives (BoardCard / BoardChip / f0-*) to the dark cc canvas
 * (`--cc-*` tokens, Card / TickerBadge / Kicker / ScriptTitle).
 *
 * It renders ONLY when `designV2Enabled()` is on; both mounts (the standalone
 * `/screener` route and the Discover "Screener" tab) branch to it there and to
 * the v1 surface otherwise, so production stays byte-identical.
 *
 * FEATURE PARITY (nothing new fetched, no number invented):
 *   · full ~11.5k-row universe load (count → paged .range() stream, first page
 *     paints immediately)                                      — identical
 *   · keyword search · plain-English NL screen builder         — identical
 *   · quick-start presets (toggle on/off)                      — identical
 *   · every filter (Universe / Price+movement / Advanced-FTA)  — identical keys
 *   · sector + subsector chips                                 — identical
 *   · saved screens (read / save-upsert / apply / delete, 20 cap, free meter)
 *   · sort menu (Club signal default) + founding-state fallback
 *   · free-tier metering (advanced group + save-screen withheld)
 *   · kid handling (advanced upsell hidden, RLS/redirect upstream)
 *   · client pagination (100/page)
 *   · add-to-family / suggest-to-community / set-alert row actions
 *   · club tail (most bullish/bearish + trending), non-embedded only
 *
 * The row sparkline is reconstructed from the row's OWN real 3m/1m/5d/1d
 * readings (see `seriesFor`) — no per-row network call, exactly as v1.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Telescope,
  Search,
  ChevronDown,
  ArrowRight,
  Plus,
  Users2,
  Check,
  SlidersHorizontal,
  Info,
  Lock,
  X,
  Sparkles,
  CornerDownLeft,
  Bookmark,
} from "lucide-react";

import V2Surface from "@/components/clubhome/v2/V2Surface";
import { Kicker, ScriptTitle, Card, TickerBadge } from "@/components/cc/ui";
import { SubTabs } from "@/components/cc/interactive";

import type { TrendingResponse, TrendingRow } from "@/lib/clubhome/contract";
import { createClient } from "@/lib/supabase/client";
import { parseScreenerQuery } from "@/lib/screener-nl";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { fetchQuote } from "@/lib/market/client";
import SetAlertButton from "@/components/alerts/SetAlertButton";
import UnlockLine from "@/components/entitlements/UnlockLine";
import { wallFor } from "@/lib/entitlements/paywall";
import {
  useNewMemberHints,
  HintDismiss,
} from "@/components/hints/useNewMemberHints";
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
import { SECTORS, SUBSECTORS, type Sector } from "@/lib/screener-sectors";
import { formatExchange } from "@/lib/market/exchange";

const PAGE_SIZE = 100;
const METRIC_COLS =
  "ticker, name, sector, exchange, type, mcap, price, chg_1d, chg_5d, chg_1m, chg_3m, vol, avg_vol_20, vol_ratio, dist_52w_high, dist_52w_low, rsi14, ema20_state, ema50_state, gap_pct, like_count, updated_at";

function researchHref(ticker: string): string {
  return `/research/${encodeURIComponent(ticker)}?from=screener`;
}

/* ---------- formatting (mono; `—` is a first-class value) ---------- */
function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}
/** COLOUR LAW: green/red belong to PRICE. `--cc-up` / `--cc-down`, soft otherwise. */
function pctColor(v: number | null | undefined): string {
  if (v == null || v === 0) return "var(--cc-soft)";
  return v > 0 ? "var(--cc-up)" : "var(--cc-down)";
}
const fmtRatio = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1)}×`);
const fmtRsi = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(0));

const MONO = "font-[family-name:var(--font-plex-mono)]";

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
  | "rsi14"
  | "like_count";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "like_count", label: "Club signal" },
  { key: "mcap", label: "Market cap" },
  { key: "price", label: "Price" },
  { key: "chg_1d", label: "1-day move" },
  { key: "chg_5d", label: "5-day move" },
  { key: "chg_1m", label: "1-month move" },
  { key: "chg_3m", label: "3-month move" },
  { key: "vol_ratio", label: "Relative volume" },
  { key: "rsi14", label: "RSI" },
  { key: "ticker", label: "Ticker" },
];

/* ---------- club heat chip ---------- */
function HeatChip({ n }: { n: number | null | undefined }) {
  if (!n || n <= 0) return null;
  return (
    <span
      className={`shrink-0 rounded-lg px-1.5 py-[3px] ${MONO} text-[10px] font-semibold tabular-nums`}
      style={{
        background: "color-mix(in srgb, var(--cc-up) 14%, transparent)",
        color: "var(--cc-up)",
      }}
    >
      {n}
    </span>
  );
}

/* ---------- the row sparkline (reconstructed from the row's own readings) ---------- */
function seriesFor(r: ScreenerRow): number[] | null {
  const p = r.price;
  if (p == null) return null;
  const at = (chg: number | null | undefined) =>
    chg == null ? null : p / (1 + chg / 100);
  const pts = [at(r.chg_3m), at(r.chg_1m), at(r.chg_5d), at(r.chg_1d), p].filter(
    (v): v is number => v != null && Number.isFinite(v) && v > 0
  );
  return pts.length >= 3 ? pts : null;
}

/** Inline cc sparkline — no network call, no invented curve. */
function CcSpark({
  points,
  width = 52,
  height = 18,
}: {
  points: number[] | null;
  width?: number;
  height?: number;
}) {
  if (!points || points.length < 2) {
    return <span aria-hidden className="inline-block" style={{ width, height }} />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const up = points[points.length - 1] >= points[0];
  const d = points
    .map(
      (p, i) =>
        `${(i / (points.length - 1)) * width},${height - ((p - min) / span) * height}`
    )
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      aria-hidden
    >
      <polyline
        points={d}
        fill="none"
        stroke={up ? "var(--cc-up)" : "var(--cc-down)"}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface Meta {
  last_trading_day: string | null;
  universe_count: number | null;
  common_count: number | null;
  etf_count: number | null;
  mcap_count: number | null;
  history_days: number | null;
}

const SAVED_SCREEN_LIMIT = 20;
const SAVED_SCREENS_FREE_LINE =
  "Saved screens are how members keep a scan and re-run it tomorrow. The Club opens them, alongside the full screener and AI search.";

interface SavedScreen {
  id: string;
  name: string;
  filters: CustomFilters;
  sort_key: SortKey;
  sort_dir: SortDir;
}

type Tab = "foryou" | "screener" | "trending";

/* ── cc chips ────────────────────────────────────────────────────────────── */
/** Board 15's filter chip on cc tokens: quiet outline, or lit orange (accent). */
function CcChip({
  tone = "quiet",
  className = "",
  children,
  ...rest
}: {
  tone?: "quiet" | "accent";
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const accent = tone === "accent";
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 ${MONO} text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${className}`}
      style={{
        borderColor: accent ? "var(--cc-orange)" : "var(--cc-line)",
        background: accent
          ? "color-mix(in srgb, var(--cc-orange) 12%, transparent)"
          : "var(--cc-card)",
        color: accent ? "var(--cc-orange-ink)" : "var(--cc-soft)",
      }}
    >
      {children}
    </button>
  );
}

export default function ScreenerSurfaceV2({ embedded = false }: { embedded?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

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
  const [sortKey, setSortKey] = useState<SortKey>("like_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [nlInput, setNlInput] = useState("");
  const [nlNote, setNlNote] = useState<string | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const howToHint = useNewMemberHints("screener-howto");
  useEffect(() => {
    if (howToHint.show) setExplainerOpen(true);
  }, [howToHint.show]);

  const [added, setAdded] = useState<Record<string, "family" | "community">>({});
  const [busy, setBusy] = useState<string | null>(null);

  const [saved, setSaved] = useState<SavedScreen[] | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [savingScreen, setSavingScreen] = useState(false);
  const [screenName, setScreenName] = useState("");
  const [appliedScreenId, setAppliedScreenId] = useState<string | null>(null);

  const isFTA = tier === "fta";
  const isFree = tier === "free";

  const [clubLedger, setClubLedger] = useState<TrendingResponse | null>(null);
  useEffect(() => {
    if (embedded) return;
    const ctrl = new AbortController();
    fetch("/api/club/trending", {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    })
      .then((res) => (res.ok ? (res.json() as Promise<TrendingResponse>) : null))
      .then((d) => d && setClubLedger(d))
      .catch(() => {});
    return () => ctrl.abort();
  }, [embedded]);

  const openResearch = useCallback(
    (ticker: string) => router.push(researchHref(ticker)),
    [router]
  );

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
    getClubTier(supabase, p.family_id ?? null).then((t) => {
      setTier(t);
      setTierResolved(true);
    });

    const pageQuery = (i: number) =>
      supabase
        .from("screener_metrics")
        .select(METRIC_COLS)
        .not("price", "is", null)
        .order("mcap", { ascending: false, nullsFirst: false })
        .order("ticker", { ascending: true })
        .range(i * 1000, i * 1000 + 999);

    const [countRes, metaRes, firstRes] = await Promise.all([
      supabase
        .from("screener_metrics")
        .select("ticker", { count: "exact", head: true })
        .not("price", "is", null),
      supabase
        .from("screener_meta")
        .select("last_trading_day, universe_count, common_count, etf_count, mcap_count, history_days")
        .eq("id", true)
        .maybeSingle(),
      pageQuery(0),
    ]);

    setMeta((metaRes.data as Meta) ?? null);
    setRows((firstRes.data as ScreenerRow[]) ?? []);
    setLoading(false);

    const total = countRes.count ?? 0;
    const pages = Math.max(1, Math.ceil(total / 1000));
    if (pages > 1) {
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) => pageQuery(i + 1))
      );
      setRows((prev) => {
        const all = [...prev];
        for (const r of rest) if (r.data) all.push(...(r.data as ScreenerRow[]));
        return all;
      });
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const loadSaved = useCallback(async () => {
    const { data, error } = await supabase
      .from("screener_saved_screens")
      .select("id, name, filters, sort_key, sort_dir")
      .order("used_at", { ascending: false });
    if (error) {
      setSaved([]);
      return;
    }
    setSaved((data as SavedScreen[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSaved();
  }, [userId, loadSaved]);

  async function saveScreen() {
    const name = screenName.trim();
    if (!name || !userId || savingScreen) return;
    if (isFree) {
      setSavedError(SAVED_SCREENS_FREE_LINE);
      return;
    }
    setSavingScreen(true);
    setSavedError(null);
    const filters: CustomFilters = { ...custom };
    delete filters.q;
    const { error } = await supabase
      .from("screener_saved_screens")
      .upsert(
        {
          user_id: userId,
          name,
          filters,
          sort_key: sortKey,
          sort_dir: sortDir,
          used_at: new Date().toISOString(),
        },
        { onConflict: "user_id,name" }
      );
    if (error) {
      const refusedByPolicy =
        error.code === "42501" ||
        /row-level security|policy/i.test(error.message ?? "");
      setSavedError(
        refusedByPolicy
          ? SAVED_SCREENS_FREE_LINE
          : (saved?.length ?? 0) >= SAVED_SCREEN_LIMIT
            ? `You can keep ${SAVED_SCREEN_LIMIT} screens — delete one to save this.`
            : "Couldn't save that screen. Try again."
      );
    } else {
      setScreenName("");
      await loadSaved();
    }
    setSavingScreen(false);
  }

  async function applyScreen(s: SavedScreen) {
    setActivePresetId(null);
    setAppliedScreenId(s.id);
    setCustom((c) => ({ ...s.filters, q: c.q ?? null }));
    setSortKey(s.sort_key);
    setSortDir(s.sort_dir);
    setNlNote(null);
    await supabase
      .from("screener_saved_screens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", s.id);
  }

  async function deleteScreen(id: string) {
    setSaved((prev) => (prev ?? []).filter((s) => s.id !== id));
    if (appliedScreenId === id) setAppliedScreenId(null);
    await supabase.from("screener_saved_screens").delete().eq("id", id);
  }

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
  const maxHeat = useMemo(
    () => pageRows.reduce((mx, r) => Math.max(mx, r.like_count ?? 0), 0),
    [pageRows]
  );

  function applyPreset(p: ScreenerPreset) {
    setAppliedScreenId(null);
    if (activePresetId === p.id) {
      setActivePresetId(null);
      setCustom((c) => ({ q: c.q }));
      return;
    }
    setActivePresetId(p.id);
    setCustom((c) => ({ q: c.q, ...p.filters }));
    setSortKey(p.sort.key as SortKey);
    setSortDir(p.sort.dir);
  }

  function runNL(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const parsed = parseScreenerQuery(text);
    setActivePresetId(null);
    if (parsed.matched.length > 0) {
      setCustom({ ...parsed.filters, q: parsed.leftover || null });
      setNlNote(`Understood: ${parsed.matched.join(" · ")}`);
    } else {
      setCustom({ q: text });
      setNlNote("No filters matched — searching by name instead.");
    }
  }
  function patchFilter(patch: Partial<CustomFilters>) {
    setActivePresetId(null);
    setAppliedScreenId(null);
    setCustom((c) => ({ ...c, ...patch }));
  }
  function clearFilter(key: keyof CustomFilters) {
    setActivePresetId(null);
    setAppliedScreenId(null);
    setCustom((c) => {
      const next = { ...c };
      delete next[key];
      if (key === "sector") delete next.subsector;
      return next;
    });
  }
  function clearAll() {
    setActivePresetId(null);
    setAppliedScreenId(null);
    setCustom((c) => ({ q: c.q }));
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

  const chips = activeChips(custom);
  const coverage =
    meta?.mcap_count != null && meta?.common_count
      ? Math.round((meta.mcap_count / meta.common_count) * 100)
      : null;

  /* ── the panel body (shared by embedded + standalone) ───────────────────── */
  const body =
    loading || !tierResolved ? (
      <ScreenerSkeletonV2 />
    ) : (
      <div className="space-y-4">
        {/* Search */}
        <Card className="flex items-center gap-2.5 px-3.5 py-2.5">
          <Search className="h-4 w-4 shrink-0" style={{ color: "var(--cc-soft)" }} aria-hidden />
          <input
            value={custom.q ?? ""}
            onChange={(e) => setCustom((c) => ({ ...c, q: e.target.value || null }))}
            placeholder="Search by ticker or company name…"
            aria-label="Search the universe"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold outline-none placeholder:font-normal"
            style={{ color: "var(--cc-ink)" }}
          />
          {custom.q && (
            <button
              onClick={() => setCustom((c) => ({ ...c, q: null }))}
              className="shrink-0 rounded-full p-1"
              style={{ color: "var(--cc-soft)" }}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </Card>

        {/* Screen in plain English — the surface's one AI affordance (Kai blue) */}
        <Card className="px-3.5 py-3" style={{ borderColor: "color-mix(in srgb, var(--cc-blue) 40%, var(--cc-line))" }}>
          <div className={`mb-1.5 flex items-center gap-1.5 ${MONO} text-[9px] font-semibold uppercase tracking-[0.16em]`} style={{ color: "var(--cc-blue)" }}>
            <Sparkles className="h-3 w-3" />
            Screen in plain English
          </div>
          <div className="relative">
            <input
              value={nlInput}
              onChange={(e) => {
                setNlInput(e.target.value);
                if (nlNote) setNlNote(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") runNL(nlInput);
              }}
              placeholder="e.g. Semis under $60 with rising volume"
              className="w-full bg-transparent py-1 pr-10 text-[14px] font-semibold outline-none placeholder:font-normal"
              style={{ color: "var(--cc-ink)" }}
            />
            <button
              onClick={() => runNL(nlInput)}
              disabled={!nlInput.trim()}
              aria-label="Run plain-English screen"
              className="absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center rounded-full px-2 py-1.5 transition disabled:opacity-40"
              style={{ background: "var(--cc-blue)", color: "#fff" }}
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
            </button>
          </div>
          {nlNote && (
            <p className={`mt-1.5 ${MONO} text-[9.5px] uppercase tracking-[0.12em]`} style={{ color: "var(--cc-soft)" }}>
              {nlNote}
            </p>
          )}
        </Card>

        {/* Quick start — preset chips */}
        <div>
          <Kicker className="!text-[9px] !tracking-[0.16em]">Quick start</Kicker>
          <div className="no-scrollbar -mx-1 mt-1.5 flex gap-[7px] overflow-x-auto px-1">
            {PRESETS.map((p) => (
              <CcChip
                key={p.id}
                tone={activePresetId === p.id ? "accent" : "quiet"}
                aria-pressed={activePresetId === p.id}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </CcChip>
            ))}
          </div>
        </div>

        {activePresetId && (
          <Card className="px-3.5 py-3">
            {(() => {
              const ap = getPreset(activePresetId)!;
              return (
                <>
                  <p className="text-[12.5px] leading-snug" style={{ color: "var(--cc-ink)" }}>
                    {ap.blurb} These filters are applied below — tweak any of them.
                  </p>
                  {!isKid && (
                    <div
                      className="mt-2.5 flex items-center justify-between gap-2 pt-2.5"
                      style={{ borderTop: "1px solid var(--cc-line)" }}
                    >
                      <span className="text-[11.5px] font-medium" style={{ color: "var(--cc-soft)" }}>
                        Want a heads-up when new names enter this screen?
                      </span>
                      <SetAlertButton
                        ticker={null}
                        surface="screener"
                        defaultKind="preset_match"
                        presetId={ap.id}
                        presetLabel={ap.label}
                        variant="chip"
                        stopPropagation={false}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </Card>
        )}

        {/* Your screens */}
        {saved !== null && saved.length > 0 && (
          <div>
            <Kicker className="!text-[9px] !tracking-[0.16em]">Your screens</Kicker>
            <div className="no-scrollbar -mx-1 mt-1.5 flex gap-[7px] overflow-x-auto px-1">
              {saved.map((s) => {
                const on = appliedScreenId === s.id;
                return (
                  <CcChip key={s.id} tone={on ? "accent" : "quiet"} onClick={() => applyScreen(s)}>
                    {s.name}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteScreen(s.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          deleteScreen(s.id);
                        }
                      }}
                      aria-label={`Delete the ${s.name} screen`}
                      className="rounded opacity-60 transition-opacity hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </CcChip>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter panel — a carded disclosure */}
        <Card className="overflow-hidden">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
          >
            <span className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--cc-ink)" }}>
              <SlidersHorizontal className="h-4 w-4" style={{ color: "var(--cc-orange-ink)" }} />
              Filters
              {chips.length > 0 && (
                <span className={`${MONO} text-[11px] font-bold`} style={{ color: "var(--cc-orange-ink)" }}>
                  {chips.length}
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
              style={{ color: "var(--cc-soft)" }}
            />
          </button>
          <AnimatePresence initial={false}>
            {filtersOpen && (
              <m.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3.5" style={{ borderTop: "1px solid var(--cc-line)" }}>
                  <FilterPanel
                    isFTA={isFTA}
                    isKid={isKid}
                    exchanges={exchanges}
                    value={custom}
                    patch={patchFilter}
                  />
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Active filter chips */}
        <div className="-m-1 flex flex-wrap items-center gap-[7px] p-1">
          {chips.map((c) => (
            <CcChip
              key={c.key}
              tone="accent"
              onClick={() => clearFilter(c.key)}
              aria-label={`Remove the ${c.label} filter`}
            >
              {c.label}
              <X className="h-3 w-3" />
            </CcChip>
          ))}
          <CcChip tone="quiet" onClick={() => setFiltersOpen(true)}>
            + Filter
          </CcChip>
          {chips.length > 0 && (
            <button
              onClick={clearAll}
              className="ml-1 rounded text-[10.5px] font-semibold underline"
              style={{ color: "var(--cc-soft)" }}
            >
              Clear all
            </button>
          )}
        </div>

        {/* Results header */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <span className={`${MONO} text-[9px] uppercase tracking-[0.06em]`} style={{ color: "var(--cc-soft)" }}>
            {results.length.toLocaleString()}{" "}
            {results.length === 1 ? "MATCH" : "MATCHES"} · SORTED BY{" "}
            {(SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "").toUpperCase()}
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {userId && !filtersEmpty(custom) && (
              <SaveScreenControl
                name={screenName}
                onName={setScreenName}
                onSave={saveScreen}
                saving={savingScreen}
                error={savedError}
                count={saved?.length ?? 0}
                locked={isFree}
              />
            )}
            <label className={`flex items-center gap-1.5 ${MONO} text-[9.5px] uppercase tracking-[0.14em]`} style={{ color: "var(--cc-soft)" }}>
              Sort
              <select
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value as SortKey);
                  setSortDir(e.target.value === "ticker" ? "asc" : "desc");
                  setAppliedScreenId(null);
                }}
                className="rounded bg-transparent text-[11.5px] font-bold uppercase tracking-normal outline-none"
                style={{ color: "var(--cc-ink)" }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => setExplainerOpen((v) => !v)}
              aria-expanded={explainerOpen}
              className={`inline-flex items-center gap-1 rounded ${MONO} text-[9.5px] uppercase tracking-[0.14em]`}
              style={{ color: "var(--cc-soft)" }}
            >
              <Info className="h-3.5 w-3.5" />
              How to use this
            </button>
          </div>
        </div>

        {/* Founding state — club signal with no heat yet */}
        {sortKey === "like_count" && results.length > 0 && maxHeat === 0 && (
          <p
            className="max-w-[56ch] pl-3.5 text-[12.5px] leading-relaxed"
            style={{ borderLeft: "2px solid var(--cc-orange)", color: "var(--cc-soft)" }}
          >
            The Club hasn&apos;t warmed any of these names yet, so this list is in
            no meaningful order. Like a ticker on its research page to start its
            signal — or{" "}
            <button
              type="button"
              onClick={() => {
                setSortKey("mcap");
                setSortDir("desc");
              }}
              className="rounded font-semibold underline decoration-1 underline-offset-2"
              style={{ color: "var(--cc-orange-ink)" }}
            >
              sort by size
            </button>{" "}
            for now.
          </p>
        )}

        <AnimatePresence initial={false}>
          {explainerOpen && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Card className="flex items-start gap-2 px-3.5 py-3">
                <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
                  A screener filters thousands of stocks down to a short list that shares one trait — trading near a high, surging in volume, or looking oversold. It is a tool for finding candidates to <em>research</em>, never a list of things to buy. Combine a few filters, change the sort, then dig into any company that catches your eye.
                </p>
                <HintDismiss
                  onClick={() => {
                    setExplainerOpen(false);
                    howToHint.dismiss();
                  }}
                />
              </Card>
            </m.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {results.length === 0 ? (
          <Card className="px-5 py-12">
            <Telescope className="mb-3 h-7 w-7" style={{ color: "var(--cc-orange-ink)" }} />
            <h3 className="cc-display text-[21px] font-extrabold tracking-[-0.02em]" style={{ color: "var(--cc-ink)" }}>
              Nothing matches
            </h3>
            <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
              Loosen a filter or clear your search — the market shifts every day,
              so this list changes with it.
            </p>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-[7px]">
              {pageRows.map((r) => (
                <ResultCard
                  key={r.ticker}
                  r={r}
                  busy={busy === r.ticker}
                  added={added[r.ticker]}
                  canAct={!!familyId}
                  onOpen={() => openResearch(r.ticker)}
                  onAddFamily={() => addToFamily(r, false)}
                  onSuggest={() => addToFamily(r, true)}
                  allowAlert={!isKid}
                />
              ))}
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className={`rounded ${MONO} text-[10.5px] uppercase tracking-[0.14em] transition-colors disabled:opacity-30`}
                  style={{ color: "var(--cc-soft)" }}
                >
                  ← Prev
                </button>
                <span className={`${MONO} text-[10.5px] tabular-nums`} style={{ color: "var(--cc-soft)" }}>
                  {page + 1} / {pageCount}
                </span>
                <button
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  className={`rounded ${MONO} text-[10.5px] uppercase tracking-[0.14em] transition-colors disabled:opacity-30`}
                  style={{ color: "var(--cc-soft)" }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {!embedded && <ClubTail ledger={clubLedger} />}
      </div>
    );

  if (embedded) return body;

  return (
    <V2Surface className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        <header>
          <ScriptTitle>discover</ScriptTitle>
          <p className="mt-[5px] text-[12px]" style={{ color: "var(--cc-soft)" }}>
            Screen the whole market on your own terms
          </p>
        </header>
        <div className="mt-4">
          <SubTabs
            tabs={[
              { id: "foryou", label: "For you" },
              { id: "screener", label: "Screener" },
              { id: "trending", label: "Trending" },
            ]}
            value={"screener" as Tab}
            onChange={(k: Tab) => {
              if (k !== "screener") router.push("/discover");
            }}
          />
        </div>
        {!loading && (
          <p className={`mt-3 ${MONO} text-[9.5px] uppercase tracking-[0.14em]`} style={{ color: "var(--cc-dim)" }}>
            Delayed ~15 min
            {meta?.last_trading_day ? ` · ${meta.last_trading_day}` : ""}
            {meta?.universe_count ? ` · ${meta.universe_count.toLocaleString()} securities` : ""}
            {coverage != null ? ` · mkt cap on ${coverage}% of stocks` : ""}
            {meta?.history_days ? ` · ${meta.history_days}d window` : ""}
          </p>
        )}
        <div
          role="tabpanel"
          aria-label="Discover · screener"
          className="mt-6"
        >
          {body}
        </div>
      </div>
    </V2Surface>
  );
}

/* ============================================================================
 * CLUB TAIL — most bullish / most bearish + trending chips (non-embedded).
 * ==========================================================================*/
function ClubTail({ ledger }: { ledger: TrendingResponse | null }) {
  const rows = ledger?.rows ?? [];
  const stanced = rows.filter((r) => r.sentiment?.bullPct != null);
  const bullish = [...stanced]
    .sort((a, b) => (b.sentiment!.bullPct ?? 0) - (a.sentiment!.bullPct ?? 0))
    .slice(0, 3);
  const bearish = [...stanced]
    .sort((a, b) => (a.sentiment!.bullPct ?? 0) - (b.sentiment!.bullPct ?? 0))
    .slice(0, 3);
  const trending = rows.filter((r) => r.changePct != null).slice(0, 6);

  if (stanced.length === 0 && trending.length === 0) return null;

  return (
    <div className="space-y-4 pt-2">
      {stanced.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <ConvictionCard title="Club's most bullish" rows={bullish} tone="bull" />
          <ConvictionCard title="Club's most bearish" rows={bearish} tone="bear" />
        </div>
      )}

      {trending.length > 0 && (
        <div>
          <Kicker className="!text-[9.5px] !tracking-[0.16em]">Trending in the Club</Kicker>
          <div className="mt-2.5 flex flex-wrap gap-[7px]">
            {trending.map((r) => (
              <Link key={r.ticker} href={researchHref(r.ticker)} className="rounded-full">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${MONO} text-[11px]`}
                  style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)", color: "var(--cc-ink)" }}
                >
                  {r.ticker.toUpperCase()}{" "}
                  <span style={{ color: pctColor(r.changePct) }}>{fmtPct(r.changePct)}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConvictionCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: TrendingRow[];
  tone: "bull" | "bear";
}) {
  if (rows.length === 0) return null;
  const edge = tone === "bull" ? "var(--cc-up)" : "var(--cc-down)";
  return (
    <Card className="px-3.5 py-[13px]" style={{ borderLeft: `3px solid ${edge}` }}>
      <p className={`${MONO} text-[8.5px] font-semibold uppercase tracking-[0.14em]`} style={{ color: edge }}>
        {title}
      </p>
      <div className="mt-2.5 flex flex-col gap-2">
        {rows.map((r) => (
          <Link
            key={r.ticker}
            href={`/research/${encodeURIComponent(r.ticker)}?tab=community`}
            className="flex items-center justify-between rounded"
          >
            <span className={`${MONO} text-[11px] font-semibold`} style={{ color: "var(--cc-ink)" }}>
              {r.ticker.toUpperCase()}
            </span>
            <span className={`${MONO} text-[10.5px] tabular-nums`} style={{ color: edge }}>
              {tone === "bull"
                ? `${r.sentiment!.bullPct}%`
                : `${100 - (r.sentiment!.bullPct ?? 0)}%`}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================================
 * SKELETON — cc canvas furniture.
 * ==========================================================================*/
function Bone({ w, h, className = "" }: { w: number | string; h: number; className?: string }) {
  return (
    <span
      className={`block animate-pulse rounded ${className}`}
      style={{ width: w, height: h, background: "var(--cc-card2)" }}
    />
  );
}

export function ScreenerSkeletonV2({ embedded = false }: { embedded?: boolean }) {
  const inner = (
    <div className="space-y-4" aria-busy="true">
      <Card className="px-3.5 py-3">
        <Bone w="60%" h={12} />
      </Card>
      <Card className="space-y-2 px-3.5 py-3">
        <Bone w={150} h={8} />
        <Bone w="70%" h={12} />
      </Card>
      <div className="flex gap-[7px]">
        {[72, 88, 64, 96].map((w, i) => (
          <Bone key={i} w={w} h={26} className="!rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-[7px]">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="px-[11px] py-[9px]">
            <div className="flex items-center gap-2.5">
              <Bone w={26} h={26} className="!rounded-lg" />
              <Bone w={44} h={9} />
              <Bone w={52} h={12} className="hidden sm:block" />
              <Bone w={64} h={9} className="ml-auto" />
              <Bone w={38} h={9} />
            </div>
            <div className="mt-2 pl-[36px]">
              <Bone w="55%" h={8} />
            </div>
          </Card>
        ))}
      </div>
      <span className="sr-only">Loading the market universe</span>
    </div>
  );

  if (embedded) return inner;
  return (
    <V2Surface className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        <ScriptTitle>discover</ScriptTitle>
        <p className="mt-[5px] text-[12px]" style={{ color: "var(--cc-soft)" }}>
          Screen the whole market on your own terms
        </p>
        <div className="mt-6">{inner}</div>
      </div>
    </V2Surface>
  );
}

/* ============================================================================
 * SAVE SCREEN — cc-tokened "Save screen" control (real row, migration 194).
 * ==========================================================================*/
function SaveScreenControl({
  name,
  onName,
  onSave,
  saving,
  error,
  count,
  locked = false,
}: {
  name: string;
  onName: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  count: number;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded ${MONO} text-[10px] font-bold uppercase tracking-[0.14em] transition-colors`}
        style={{ color: "var(--cc-orange-ink)" }}
      >
        <Bookmark className="h-3.5 w-3.5" />
        Save screen
      </button>
    );
  }

  if (locked) {
    return (
      <span className="w-full">
        <UnlockLine rule={false} className="mt-0" cta={wallFor("screener_full").cta}>
          {SAVED_SCREENS_FREE_LINE}
        </UnlockLine>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-1.5">
        <span className="sr-only">Name this screen</span>
        <input
          autoFocus
          value={name}
          maxLength={48}
          onChange={(e) => onName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Name this screen"
          className="w-40 bg-transparent py-1 text-[13px] font-semibold outline-none placeholder:font-normal"
          style={{ color: "var(--cc-ink)", borderBottom: "1px solid var(--cc-line)" }}
        />
      </label>
      <button
        type="button"
        onClick={onSave}
        disabled={!name.trim() || saving}
        className={`rounded ${MONO} text-[10px] font-bold uppercase tracking-[0.14em] disabled:opacity-40`}
        style={{ color: "var(--cc-orange-ink)" }}
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Cancel saving this screen"
        className="rounded"
        style={{ color: "var(--cc-soft)" }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {error ? (
        <span className={`w-full ${MONO} text-[10px] uppercase tracking-[0.12em]`} style={{ color: "var(--cc-soft)" }}>
          {error}
        </span>
      ) : (
        <span className={`w-full ${MONO} text-[10px] uppercase tracking-[0.12em]`} style={{ color: "var(--cc-dim)" }}>
          {count} of {SAVED_SCREEN_LIMIT} saved · reusing a name replaces it
        </span>
      )}
    </span>
  );
}

/* ============================================================================
 * RESULT CARD — board 15's result row on the cc canvas.
 *   [26px badge] TICKER  [52×18 spark]      $173.42   ▲4.7%   [78]
 * with the company name + longer windows + cap + RSI + actions on line two.
 * ==========================================================================*/
function ResultCard({
  r,
  busy,
  added,
  canAct,
  onOpen,
  onAddFamily,
  onSuggest,
  allowAlert = true,
}: {
  r: ScreenerRow;
  busy: boolean;
  added?: "family" | "community";
  canAct: boolean;
  onOpen: () => void;
  onAddFamily: () => void;
  onSuggest: () => void;
  allowAlert?: boolean;
}) {
  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open ${r.ticker} research`}
      onClick={onOpen}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer rounded-2xl border px-[11px] py-[9px] transition-colors hover:border-[var(--cc-orange)]"
      style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)" }}
    >
      <div className="flex items-center gap-2.5">
        <TickerBadge symbol={r.ticker} size={26} />
        <span className={`w-[46px] shrink-0 ${MONO} text-[11px] font-semibold`} style={{ color: "var(--cc-ink)" }}>
          {r.ticker}
        </span>
        <span className="hidden w-[52px] shrink-0 sm:block">
          <CcSpark points={seriesFor(r)} width={52} height={18} />
        </span>
        <span className={`flex-1 truncate text-right ${MONO} text-[10.5px] tabular-nums`} style={{ color: "var(--cc-ink)" }}>
          {fmtPrice(r.price)}
        </span>
        <span className={`w-[46px] shrink-0 text-right ${MONO} text-[10px] tabular-nums`} style={{ color: pctColor(r.chg_1d) }}>
          {fmtPct(r.chg_1d)}
        </span>
        <HeatChip n={r.like_count} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-[36px]">
        <span className="min-w-0 max-w-[22ch] truncate text-[11px] leading-snug" style={{ color: "var(--cc-soft)" }}>
          {r.name || "—"}
        </span>
        {r.type === "etf" && (
          <span className={`${MONO} text-[8.5px] font-bold uppercase tracking-[0.14em]`} style={{ color: "var(--cc-soft)" }}>
            ETF
          </span>
        )}
        {r.exchange && (
          <span className={`hidden ${MONO} text-[8.5px] uppercase tracking-[0.14em] sm:inline`} style={{ color: "var(--cc-dim)" }}>
            {formatExchange(r.exchange)}
          </span>
        )}
        <span className={`${MONO} text-[10px] tabular-nums`} style={{ color: "var(--cc-soft)" }}>
          1m <span style={{ color: pctColor(r.chg_1m) }}>{fmtPct(r.chg_1m)}</span>
        </span>
        <span className={`${MONO} text-[10px] tabular-nums`} style={{ color: "var(--cc-soft)" }}>
          3m <span style={{ color: pctColor(r.chg_3m) }}>{fmtPct(r.chg_3m)}</span>
        </span>
        <span className={`${MONO} text-[10px] tabular-nums`} style={{ color: "var(--cc-soft)" }}>
          Vol <span style={{ color: "var(--cc-ink)" }}>{fmtRatio(r.vol_ratio)}</span>
        </span>
        <span className={`${MONO} text-[10px] tabular-nums`} style={{ color: "var(--cc-soft)" }}>
          Cap <span style={{ color: "var(--cc-ink)" }}>{fmtMcap(r.mcap)}</span>
        </span>
        <span className={`${MONO} text-[10px] tabular-nums`} style={{ color: "var(--cc-soft)" }}>
          RSI <span style={{ color: "var(--cc-ink)" }}>{fmtRsi(r.rsi14)}</span>
        </span>

        <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
          <RowActions
            r={r}
            busy={busy}
            added={added}
            canAct={canAct}
            onAddFamily={onAddFamily}
            onSuggest={onSuggest}
            allowAlert={allowAlert}
            compact
          />
        </span>
      </div>
    </div>
  );
}

/* ── Row actions ──────────────────────────────────────────────────────────── */
function RowActions({
  r,
  busy,
  added,
  canAct,
  onAddFamily,
  onSuggest,
  compact,
  allowAlert = true,
}: {
  r: ScreenerRow;
  busy: boolean;
  added?: "family" | "community";
  canAct: boolean;
  onAddFamily: () => void;
  onSuggest: () => void;
  compact?: boolean;
  allowAlert?: boolean;
}) {
  if (added) {
    return (
      <span className={`inline-flex items-center gap-1 whitespace-nowrap ${MONO} text-[10px] font-bold uppercase tracking-[0.12em]`} style={{ color: "var(--cc-up)" }}>
        <Check className="h-3 w-3" />
        {added === "community" ? "On the board" : "Watching"}
      </span>
    );
  }
  return (
    <div className={`inline-flex items-center gap-1.5 ${compact ? "" : "flex-wrap"}`}>
      <button
        disabled={!canAct || busy}
        onClick={(e) => {
          e.stopPropagation();
          onAddFamily();
        }}
        title="Add to family watchlist"
        className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
        style={{ borderColor: "var(--cc-line)", color: "var(--cc-soft)" }}
      >
        <Plus className="h-3.5 w-3.5" />
        {compact ? "" : "Add to family watchlist"}
      </button>
      <button
        disabled={!canAct || busy}
        onClick={(e) => {
          e.stopPropagation();
          onSuggest();
        }}
        title="Suggest to community"
        className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
        style={{ borderColor: "var(--cc-line)", color: "var(--cc-soft)" }}
      >
        <Users2 className="h-3.5 w-3.5" />
        {compact ? "" : "Suggest to community"}
      </button>
      {allowAlert && (
        <SetAlertButton
          ticker={r.ticker}
          surface="screener"
          defaultKind="price_cross"
          seedPrice={r.price}
          levels={impliedLevels(r)}
          variant={compact ? "icon" : "chip"}
          stopPropagation
        />
      )}
      <Link
        href={researchHref(r.ticker)}
        onClick={(e) => e.stopPropagation()}
        title="Research"
        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-semibold hover:underline"
        style={{ color: "var(--cc-orange-ink)" }}
      >
        Research
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function impliedLevels(r: ScreenerRow): { label: string; price: number; op?: "above" | "below" }[] {
  const out: { label: string; price: number; op?: "above" | "below" }[] = [];
  if (r.price != null && r.dist_52w_high != null) {
    const high = r.price / (1 + r.dist_52w_high / 100);
    if (high > 0) out.push({ label: "52w high", price: high, op: "above" });
  }
  if (r.price != null && r.dist_52w_low != null) {
    const low = r.price / (1 + r.dist_52w_low / 100);
    if (low > 0) out.push({ label: "52w low", price: low, op: "below" });
  }
  return out;
}

/* ============================================================================
 * Active-filter chip descriptors.
 * ==========================================================================*/
function activeChips(f: CustomFilters): { key: keyof CustomFilters; label: string }[] {
  const out: { key: keyof CustomFilters; label: string }[] = [];
  const cap = (v: number) => fmtMcap(v);
  if (f.exchange) out.push({ key: "exchange", label: formatExchange(f.exchange) ?? f.exchange });
  if (f.type) out.push({ key: "type", label: f.type === "etf" ? "ETFs" : "Common stocks" });
  if (f.sector) out.push({ key: "sector", label: f.sector });
  if (f.subsector) out.push({ key: "subsector", label: f.subsector });
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
 * FILTER PANEL — ruled field groups on the cc canvas.
 * ==========================================================================*/
const MCAP_STEPS: { label: string; value: number }[] = [
  { label: "$50M+", value: 50_000_000 },
  { label: "$300M+", value: 300_000_000 },
  { label: "$2B+", value: 2_000_000_000 },
  { label: "$10B+", value: 10_000_000_000 },
  { label: "$50B+", value: 50_000_000_000 },
];

const MOVE_FIELDS: { key: "minChg1d" | "minChg5d" | "minChg1m" | "minChg3m"; label: string }[] = [
  { key: "minChg1d", label: "1d" },
  { key: "minChg5d", label: "5d" },
  { key: "minChg1m", label: "1m" },
  { key: "minChg3m", label: "3m" },
];

function FilterPanel({
  isFTA,
  isKid,
  exchanges,
  value,
  patch,
}: {
  isFTA: boolean;
  isKid: boolean;
  exchanges: string[];
  value: CustomFilters;
  patch: (p: Partial<CustomFilters>) => void;
}) {
  const selectedSector = (value.sector as Sector | null) ?? null;
  const subsectorOptions = selectedSector ? SUBSECTORS[selectedSector] : [];

  return (
    <div className="pb-4">
      <FieldGroup label="Universe">
        <FieldRow label="Exchange">
          <FieldSelect
            ariaLabel="Exchange"
            value={value.exchange ?? ""}
            onChange={(v) => patch({ exchange: v || null })}
          >
            <option value="">Any exchange</option>
            {exchanges.map((e) => (
              <option key={e} value={e}>
                {formatExchange(e)}
              </option>
            ))}
          </FieldSelect>
        </FieldRow>

        <FieldRow label="Security type">
          <FieldSelect
            ariaLabel="Security type"
            value={value.type ?? ""}
            onChange={(v) => patch({ type: (v as CustomFilters["type"]) || null })}
          >
            <option value="">Stocks + ETFs</option>
            <option value="common">Common stocks</option>
            <option value="etf">ETFs</option>
          </FieldSelect>
        </FieldRow>

        <FieldRow label="Sector">
          <FieldSelect
            ariaLabel="Sector"
            value={value.sector ?? ""}
            onChange={(v) => patch({ sector: v || null, subsector: null })}
          >
            <option value="">Any sector</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FieldSelect>
        </FieldRow>

        <FieldRow
          label="Subsector"
          hint={selectedSector ? undefined : "Choose a sector first"}
        >
          <FieldSelect
            ariaLabel="Subsector"
            value={value.subsector ?? ""}
            onChange={(v) => patch({ subsector: v || null })}
            disabled={!selectedSector}
          >
            <option value="">{selectedSector ? "Any subsector" : "—"}</option>
            {subsectorOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FieldSelect>
        </FieldRow>

        <FieldRow label="Company size" hint="Smallest market cap you'll look at" wrap>
          <FilterChip active={value.minMcap == null} onClick={() => patch({ minMcap: null })}>
            Any
          </FilterChip>
          {MCAP_STEPS.map((s) => (
            <FilterChip
              key={s.label}
              active={value.minMcap === s.value}
              onClick={() => patch({ minMcap: s.value })}
            >
              {s.label}
            </FilterChip>
          ))}
        </FieldRow>
      </FieldGroup>

      <FieldGroup label="Price and movement">
        <FieldRow label="Share price" hint="Leave either side blank for no limit">
          <NumField
            ariaLabel="Minimum price"
            prefix="$"
            value={value.minPrice}
            onChange={(v) => patch({ minPrice: v })}
          />
          <span className={`${MONO} text-[11px] uppercase tracking-[0.14em]`} style={{ color: "var(--cc-soft)" }}>to</span>
          <NumField
            ariaLabel="Maximum price"
            prefix="$"
            value={value.maxPrice}
            onChange={(v) => patch({ maxPrice: v })}
          />
        </FieldRow>

        <FieldRow label="Minimum move" hint="Percent gained over each window" wrap>
          {MOVE_FIELDS.map((f) => (
            <NumField
              key={f.key}
              ariaLabel={`Minimum ${f.label} move percent`}
              prefix={f.label}
              suffix="%"
              width="w-14"
              value={value[f.key]}
              onChange={(v) => patch({ [f.key]: v } as Partial<CustomFilters>)}
            />
          ))}
        </FieldRow>

        <FieldRow label="Relative volume" hint="Times its own 20-day average">
          <NumField
            ariaLabel="Minimum relative volume"
            prefix="≥"
            suffix="×"
            value={value.minVolRatio}
            onChange={(v) => patch({ minVolRatio: v })}
          />
        </FieldRow>
      </FieldGroup>

      {isFTA ? (
        <FieldGroup label="Advanced — Academy">
          <FieldRow label="RSI" hint="Low reads oversold, high reads strong">
            <NumField
              ariaLabel="RSI at or below"
              prefix="≤"
              width="w-12"
              value={value.rsiMax}
              onChange={(v) => patch({ rsiMax: v })}
            />
            <NumField
              ariaLabel="RSI at or above"
              prefix="≥"
              width="w-12"
              value={value.rsiMin}
              onChange={(v) => patch({ rsiMin: v })}
            />
          </FieldRow>

          <FieldRow label="Opening gap" hint="Percent away from yesterday's close">
            <NumField
              ariaLabel="Gap up at or above percent"
              prefix="Up ≥"
              suffix="%"
              width="w-14"
              value={value.minGap}
              onChange={(v) => patch({ minGap: v })}
            />
            <NumField
              ariaLabel="Gap down at or below percent"
              prefix="Down ≤"
              suffix="%"
              width="w-14"
              value={value.maxGap}
              onChange={(v) => patch({ maxGap: v })}
            />
          </FieldRow>

          <FieldRow label="Moving-average trend">
            <FieldSelect
              ariaLabel="Moving-average trend"
              value={value.emaTrend ?? ""}
              onChange={(v) => patch({ emaTrend: (v as CustomFilters["emaTrend"]) || null })}
            >
              <option value="">Any trend</option>
              <option value="above20">Above 20-day average</option>
              <option value="below20">Below 20-day average</option>
              <option value="above50">Above 50-day average</option>
              <option value="below50">Below 50-day average</option>
              <option value="above2050">Above both averages</option>
            </FieldSelect>
          </FieldRow>

          <FieldRow label="52-week position" hint="Where it sits in its own year" wrap>
            <FilterChip
              active={!!value.nearHigh}
              onClick={() => patch({ nearHigh: value.nearHigh ? null : true })}
            >
              Near the high
            </FilterChip>
            <FilterChip
              active={!!value.nearLow}
              onClick={() => patch({ nearLow: value.nearLow ? null : true })}
            >
              Near the low
            </FilterChip>
          </FieldRow>
        </FieldGroup>
      ) : (
        !isKid && (
          <div
            className="mt-5 flex items-start gap-2 pt-3 text-[12.5px] leading-snug"
            style={{ borderTop: "1px solid var(--cc-line)", color: "var(--cc-soft)" }}
          >
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--cc-orange-ink)" }} />
            <span>
              Advanced technical filters — RSI, moving-average trend, gap and 52-week
              highs and lows — are part of the Family Trading Academy.{" "}
              <Link href="/upgrade" className="font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
                Explore FTA →
              </Link>
            </span>
          </div>
        )
      )}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="pt-4 first:pt-3">
      <Kicker className="!text-[9px] !tracking-[0.16em]">{label}</Kicker>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function FieldRow({
  label,
  hint,
  wrap = false,
  children,
}: {
  label: string;
  hint?: string;
  wrap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-2.5"
      style={{ borderBottom: "1px solid var(--cc-line)" }}
    >
      <div className={`min-w-0 ${wrap ? "self-start pt-1" : ""}`}>
        <p className="text-[13.5px] font-bold" style={{ color: "var(--cc-ink)" }}>{label}</p>
        {hint && <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: "var(--cc-soft)" }}>{hint}</p>}
      </div>
      <div className={`flex min-w-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-2 ${wrap ? "self-start" : ""}`}>
        {children}
      </div>
    </div>
  );
}

function FieldSelect({
  value,
  onChange,
  children,
  disabled = false,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="max-w-[16rem] cursor-pointer truncate bg-transparent py-1 text-right text-[13px] font-bold outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-45"
      style={{ color: "var(--cc-ink)", borderBottom: "1px solid var(--cc-line)" }}
    >
      {children}
    </select>
  );
}

function NumField({
  value,
  onChange,
  prefix,
  suffix,
  width = "w-16",
  ariaLabel,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  prefix?: string;
  suffix?: string;
  width?: string;
  ariaLabel: string;
}) {
  return (
    <label className={`inline-flex items-baseline gap-1 ${MONO} text-[11px] uppercase tracking-[0.1em]`} style={{ color: "var(--cc-soft)" }}>
      {prefix && <span aria-hidden>{prefix}</span>}
      <input
        type="number"
        aria-label={ariaLabel}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder="—"
        className={`${width} bg-transparent py-1 text-right ${MONO} text-[13px] font-semibold tabular-nums tracking-normal outline-none`}
        style={{ color: "var(--cc-ink)", borderBottom: "1px solid var(--cc-line)" }}
      />
      {suffix && <span aria-hidden>{suffix}</span>}
    </label>
  );
}

/** Selection toggle chip for the filter panel. */
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 ${MONO} text-[11px] font-bold uppercase tracking-[0.08em] transition-colors`}
      style={{
        borderColor: active ? "var(--cc-orange)" : "var(--cc-line)",
        background: active ? "var(--cc-orange)" : "var(--cc-card)",
        color: active ? "var(--cc-orange-deep)" : "var(--cc-soft)",
      }}
    >
      {children}
    </button>
  );
}
