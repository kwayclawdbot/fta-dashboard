"use client";

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
import { SegmentedRail, type SegmentedOption } from "@/components/canvas2";
import { createClient } from "@/lib/supabase/client";
import { parseScreenerQuery } from "@/lib/screener-nl";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { fetchQuote } from "@/lib/market/client";
import CompanyLogo from "@/components/fic/CompanyLogo";
import SetAlertButton from "@/components/alerts/SetAlertButton";
import LockedState from "@/components/dashboard/LockedState";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";
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

/** Every row deep-links to the ticker's research page; `?from=screener` makes
 *  the D1 research breadcrumb read "← Stock Finder". */
function researchHref(ticker: string): string {
  return `/research/${encodeURIComponent(ticker)}?from=screener`;
}

/* ---------- formatting ----------
   Every market number on this surface is MONO. `—` is a first-class value: a
   metric the feed didn't supply renders a dash, never a zero or a guess. */
function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}
/** COLOUR LAW: green/red belong to PRICE. Nothing else on this surface uses them. */
function pctTone(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-soft";
  return v > 0 ? "text-price-up" : "text-price-down";
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
  | "rsi14"
  | "like_count";

/** The ledger's numeric columns (desktop). `width` is shared by the header and
 *  the row so the hairline rules line up down the whole page. */
const LEDGER_COLS: {
  key: SortKey;
  label: string;
  width: string;
  render: (r: ScreenerRow) => string;
  tone?: (r: ScreenerRow) => string;
}[] = [
  { key: "price", label: "Price", width: "w-[76px]", render: (r) => fmtPrice(r.price) },
  { key: "chg_1d", label: "1d", width: "w-[58px]", render: (r) => fmtPct(r.chg_1d), tone: (r) => pctTone(r.chg_1d) },
  { key: "chg_1m", label: "1m", width: "w-[58px]", render: (r) => fmtPct(r.chg_1m), tone: (r) => pctTone(r.chg_1m) },
  { key: "chg_3m", label: "3m", width: "w-[58px]", render: (r) => fmtPct(r.chg_3m), tone: (r) => pctTone(r.chg_3m) },
  { key: "vol_ratio", label: "Vol", width: "w-[52px]", render: (r) => fmtRatio(r.vol_ratio) },
  { key: "mcap", label: "Cap", width: "w-[64px]", render: (r) => fmtMcap(r.mcap) },
  { key: "rsi14", label: "RSI", width: "w-[42px]", render: (r) => fmtRsi(r.rsi14) },
];

/** The sort menu — club heat first, because that is where the surface opens. */
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "like_count", label: "Club heat" },
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

/** The quick-start presets as rail options. Labels only: the preset's icon
 *  carried no information the label doesn't, and five distinct glyphs in a row
 *  read as five competing objects rather than one control. */
const PRESET_OPTIONS: SegmentedOption<string>[] = PRESETS.map((p) => ({
  id: p.id,
  label: p.label,
}));

/* The ledger's vertical hairlines. --sand is lifted globally in dark by the
   foundation, so a plain border-sand is correct in both themes now. */
const RULE = "border-sand";

/* ---------- club heat ----------
   COLOUR LAW: heat is COMMUNITY SENTIMENT, so it takes the canonical sentiment
   ramp — never the red heart it used to be (red belongs to price, and a red
   heart next to a red 1d% made the two read as the same signal). The token
   carries both theme steps itself, which is why there is no dark: variant here
   and why the hand-written `bg-lime-400` it replaced was a defect waiting to
   happen. The mark is a physical bar scaled against the hottest name on the
   page plus the mono count, so "hot" is legible before the number is read. */
function HeatMark({ n, max }: { n: number | null | undefined; max: number }) {
  if (!n || n <= 0) return <span className="font-mono text-[12px] text-soft/60">—</span>;
  const w = 6 + Math.round((Math.min(n, max) / Math.max(max, 1)) * 26);
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span className="h-[7px] rounded-full bg-sentiment-fill" style={{ width: w }} aria-hidden />
      <span className="font-mono text-[12px] font-semibold tabular-nums text-ink">{n}</span>
    </span>
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

/* ---------- saved screens (migration 194) ----------
   Canvas board 15 draws "Save screen" on the results header. It is backed by
   `screener_saved_screens`: own-row RLS, kid-walled through the same
   viewer_is_kid() definer the screener universe uses, capped at 20 per member
   by a trigger. `filters` is the CustomFilters blob verbatim, so a re-applied
   screen and a hand-built one are the same object. */
const SAVED_SCREEN_LIMIT = 20;

interface SavedScreen {
  id: string;
  name: string;
  filters: CustomFilters;
  sort_key: SortKey;
  sort_dir: SortDir;
}

/**
 * ScreenerSurface — the full-universe stock screener (formerly the whole
 * /screener page). Extracted into a shared client component so it can render
 * both as the standalone /screener route AND embedded as the "Screener" tab on
 * the Discover research hub. `embedded` only trims the outer page chrome
 * (padding / max width) so it sits cleanly inside the hub's tab panel — the
 * data, filters, full-universe load and free-tier gating are identical in both
 * placements.
 */
export default function ScreenerSurface({ embedded = false }: { embedded?: boolean }) {
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
  // CLUB HEAT is the default sort of the surface: the screener opens on the
  // names the club is actually engaging with, not on the biggest companies in
  // the index. Market cap is one selection away in the sort menu.
  const [sortKey, setSortKey] = useState<SortKey>("like_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [nlInput, setNlInput] = useState("");
  const [nlNote, setNlNote] = useState<string | null>(null);

  // (The club-heat default used to be applied by an effect once the app mode
  // resolved, which meant the first paint sorted by market cap and then jumped.
  // It is now the initial state above — one sort, no reshuffle.)
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [explainerOpen, setExplainerOpen] = useState(false);
  // The "how to use a screener" explainer auto-opens for members still inside
  // the new-member window; the toggle button doubles as the reopen affordance
  // for everyone else (Lane 7A).
  const howToHint = useNewMemberHints("screener-howto");
  useEffect(() => {
    if (howToHint.show) setExplainerOpen(true);
  }, [howToHint.show]);

  const [added, setAdded] = useState<Record<string, "family" | "community">>({});
  const [busy, setBusy] = useState<string | null>(null);

  // SAVED SCREENS. `null` = the member's screens have not been read yet, which
  // is NOT the same as "no saved screens" — the rail renders nothing at all
  // while null and only takes its founding branch once an empty array lands.
  const [saved, setSaved] = useState<SavedScreen[] | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [savingScreen, setSavingScreen] = useState(false);
  const [screenName, setScreenName] = useState("");
  const [appliedScreenId, setAppliedScreenId] = useState<string | null>(null);

  const isFTA = tier === "fta";

  /** Whole-row deep-link into the ticker's research page (fix: clickable rows). */
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

    // Full universe (~10k) — PostgREST caps a page at 1000, so fetch the count
    // then pull all pages via .range() calls. Every filter / sort / search then
    // runs client-side → instant. To keep FIRST PAINT fast under a throttled
    // connection we don't block on the whole universe: fetch page 1 (the top
    // 1000 by mcap — exactly what the default mcap-desc view shows first) plus
    // count + meta, render immediately, then stream the remaining pages in the
    // background and append. The visible first page is correct from page 1
    // alone; full-universe filtering lights up a beat later as the rest lands.
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
    setLoading(false); // paint the top-of-universe page now

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

  /* ── saved screens: read ────────────────────────────────────────────────
     Fails soft to an empty list — a screener whose universe loaded must never
     be blocked by a personalisation read. */
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

  /** Persist the CURRENT view — filters + sort — under a member-chosen name.
   *  The unique(user_id, name) constraint makes re-saving under an existing
   *  name an UPDATE, which is what "Save screen" means when the name is taken. */
  async function saveScreen() {
    const name = screenName.trim();
    if (!name || !userId || savingScreen) return;
    setSavingScreen(true);
    setSavedError(null);
    // `q` is a free-text search, not a filter — it is deliberately NOT saved:
    // a screen is a shape ("mid-cap semis breaking out"), and baking one
    // company's name into it makes it un-reusable.
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
      setSavedError(
        (saved?.length ?? 0) >= SAVED_SCREEN_LIMIT
          ? `You can keep ${SAVED_SCREEN_LIMIT} screens — delete one to save this.`
          : "Couldn't save that screen. Try again."
      );
    } else {
      setScreenName("");
      await loadSaved();
    }
    setSavingScreen(false);
  }

  /** Re-apply a saved screen and bump its recency so the rail self-orders. */
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
  /** Heat is scaled against the hottest name ON THIS PAGE, so the bars stay
   *  readable whether the top row has 3 hearts or 300. */
  const maxHeat = useMemo(
    () => pageRows.reduce((mx, r) => Math.max(mx, r.like_count ?? 0), 0),
    [pageRows]
  );

  function applyPreset(p: ScreenerPreset) {
    setAppliedScreenId(null);
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

  // "Screen in plain English" — parse deterministically, apply as real filters.
  // Graceful degrade: if nothing is recognised, fall back to keyword search.
  function runNL(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const parsed = parseScreenerQuery(text);
    setActivePresetId(null);
    if (parsed.matched.length > 0) {
      setCustom({ ...parsed.filters, q: parsed.leftover || null });
      setNlNote(`Understood: ${parsed.matched.join(" · ")}`);
    } else {
      // Nothing structured — treat the whole phrase as a name/ticker search.
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
      // Clearing a sector also drops any subsector chosen under it.
      if (key === "sector") delete next.subsector;
      return next;
    });
  }
  function clearAll() {
    setActivePresetId(null);
    setAppliedScreenId(null);
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

  if (loading || !tierResolved) return <ScreenerSkeleton embedded={embedded} />;

  if (tier === "free") {
    return (
      <div className={embedded ? "" : "mx-auto max-w-6xl px-4 py-6 sm:px-6"}>
        <LockedState
          icon={Telescope}
          eyebrow="Members discover here"
          title="The Stock Screener"
          body="Search every stock on the NYSE, Nasdaq and AMEX and filter the whole market down to companies worth studying — by size, sector, momentum, volume and more. It opens the moment you join."
          cta={{ label: "Unlock the screener — join the Club", href: FIC_CHECKOUT_URL, external: true }}
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
    <div
      className={
        embedded
          ? "space-y-4"
          : "mx-auto max-w-6xl space-y-4 px-4 pb-24 sm:px-6"
      }
    >
      {/* ── Masthead — display type, no icon-chip, no card ──────────────────
          One dominant voice per surface: the headline is the object here, and
          every number under it is mono so the page reads as a market document
          rather than as a dashboard of tiles. */}
      <header className={embedded ? "" : "pt-2"}>
        <p className="font-mono text-eyebrow font-bold uppercase text-gold-700">
          Screener
        </p>
        <h1 className="mt-2.5 font-display text-display-2 font-extrabold text-ink">
          The whole US market,
          <br className="hidden sm:block" /> filtered down to a short list.
        </h1>
        <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-soft">
          Every common stock and ETF on the NYSE, Nasdaq and AMEX. Candidates to{" "}
          <em>research</em> — never a list of things to buy.
        </p>
        <p className="mt-4 border-t border-sand pt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
          Delayed ~15 min
          {meta?.last_trading_day ? ` · ${meta.last_trading_day}` : ""}
          {meta?.universe_count ? ` · ${meta.universe_count.toLocaleString()} securities` : ""}
          {coverage != null ? ` · mkt cap on ${coverage}% of stocks` : ""}
          {meta?.history_days ? ` · ${meta.history_days}d window` : ""}
        </p>
      </header>

      {/* Search — a ruled input line, not a floating pill */}
      <div className="relative border-b border-sand">
        <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
        <input
          value={custom.q ?? ""}
          onChange={(e) => setCustom((c) => ({ ...c, q: e.target.value || null }))}
          placeholder="Search 10,000+ stocks by ticker or company name…"
          className="w-full bg-transparent py-3 pl-7 pr-8 font-display text-[15px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-soft/70"
        />
        {custom.q && (
          <button
            onClick={() => setCustom((c) => ({ ...c, q: null }))}
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-soft hover:text-ink"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Screen in plain English ─────────────────────────────────────────
          A KAI object, so it wears Kai blue and is allowed its own field — this
          is the one AI affordance on the surface, not a generic card. The parse
          is deterministic (src/lib/screener-nl.ts): it only ever produces
          filters the panel below can also produce, so a parsed screen and a
          hand-built one are indistinguishable, and the active-filter chips
          narrate exactly what it understood. Nothing recognised → honest
          keyword fallback. */}
      <div className="relative overflow-hidden rounded-xl border-l-[3px] border-kai-500 bg-kai-500/8 py-3 pl-4 pr-3 dark:border-kai-400 dark:bg-kai-500/14">
        <div className="mb-2 flex items-center gap-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-kai-600 dark:text-kai-300">
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
            className="w-full border-b border-kai-500/25 bg-transparent py-2 pr-10 font-display text-[14px] font-semibold text-ink outline-none transition placeholder:font-normal placeholder:text-soft/70 focus:border-kai-500 dark:border-kai-400/30 dark:focus:border-kai-300"
          />
          <button
            onClick={() => runNL(nlInput)}
            disabled={!nlInput.trim()}
            aria-label="Run plain-English screen"
            className="absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg bg-kai-500 px-2 py-1.5 text-[11px] font-bold text-white transition disabled:opacity-40 dark:bg-kai-400"
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
          </button>
        </div>
        {nlNote && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
            {nlNote}
          </p>
        )}
      </div>

      {/* ── Quick start ─────────────────────────────────────────────────────
          Was a row of five bordered pills with an icon in each — pill soup by
          the register's own definition, and five icons encoding nothing the
          label doesn't already say. It is now the shared <SegmentedRail />:
          the system's single answer to "pick one of N", so this control has
          the same keyboard model, the same focus ring and the same 3px
          indicator as every other one-of-N in the app. The bar rides
          `bg-accent` because choosing a screen is an ACTION (orange by law),
          and re-selecting the current preset clears it — the toggle-off
          behaviour the pills had, preserved. */}
      <div>
        <p className="mb-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-soft/70">
          Quick start
        </p>
        <SegmentedRail
          options={PRESET_OPTIONS}
          value={activePresetId as string | null}
          onChange={(id) => {
            const p = PRESETS.find((x) => x.id === id);
            if (p) applyPreset(p);
          }}
          ariaLabel="Quick-start screens"
          barClassName="bg-accent"
          size="sm"
        />
      </div>
      {activePresetId && (
        <div className="border-l-[3px] border-accent py-1 pl-3.5">
          {(() => {
            const ap = getPreset(activePresetId)!;
            return (
              <>
                <p className="text-[13px] leading-snug text-ink/80">
                  {ap.blurb} These filters are applied below — tweak any of them.
                </p>
                {!isKid && (
                  <div className="f0-rule-top mt-2 flex items-center justify-between gap-2 pt-2">
                    <span className="text-[12px] font-medium text-soft">
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
        </div>
      )}

      {/* ── Your screens (canvas 15 · "Save screen") ────────────────────────
          Real persistence, not a UI gesture: every chip here is a row in
          screener_saved_screens. Rendered only once the read has landed —
          `saved === null` is "not read yet", which must never take the
          founding branch (§0.4). */}
      {saved !== null && saved.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-soft/70">
            Your screens
          </p>
          <div className="club2-track -m-1 flex gap-2 overflow-x-auto p-1">
            {saved.map((s) => {
              const on = appliedScreenId === s.id;
              return (
                <span
                  key={s.id}
                  className={`f0-chip shrink-0 px-2.5 py-1 ${on ? "f0-chip-on" : "text-soft"}`}
                >
                  <button
                    type="button"
                    onClick={() => applyScreen(s)}
                    className="f0-focus f0-press rounded font-mono text-[11px] font-bold uppercase tracking-[0.08em]"
                  >
                    {s.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteScreen(s.id)}
                    aria-label={`Delete the ${s.name} screen`}
                    className="f0-focus rounded opacity-60 transition-opacity hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter panel — a ruled disclosure, not a bordered card */}
      <div className="border-y border-sand">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 py-3 text-left"
        >
          <span className="flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-ink">
            <SlidersHorizontal className="h-4 w-4 text-gold-600" />
            Filters
            {chips.length > 0 && (
              <span className="font-mono text-[11px] font-bold text-gold-700">
                {chips.length}
              </span>
            )}
          </span>
          <ChevronDown className={`h-4 w-4 text-soft transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {filtersOpen && (
            <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pb-1">
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
      </div>

      {/* Active filter chips — the canvas's own orange-outlined "Tech ✕" row,
          built on the shared .f0-chip so it cannot drift from the selection
          chips inside the filter panel. --f0-chip-line is the one hook the
          primitive exposes for a charged outline. */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => clearFilter(c.key)}
              style={{ "--f0-chip-line": "var(--accent-solid)" } as React.CSSProperties}
              className="f0-chip f0-press f0-focus px-2.5 py-1 text-[11px] font-semibold text-gold-700"
            >
              {c.label}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            onClick={clearAll}
            className="f0-focus ml-1 rounded text-[11px] font-semibold text-soft underline hover:text-ink"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Result count · save · sort · how-to */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-ink">
          {results.length.toLocaleString()} {results.length === 1 ? "result" : "results"}
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* SAVE SCREEN — canvas 15 draws it right here. It writes a real row
              (migration 194) and only appears once there is a screen worth
              keeping, so it never invites a member to save the empty view. */}
          {userId && !filtersEmpty(custom) && (
            <SaveScreenControl
              name={screenName}
              onName={setScreenName}
              onSave={saveScreen}
              saving={savingScreen}
              error={savedError}
              count={saved?.length ?? 0}
            />
          )}
          {/* The sort is a stated fact, not a hidden default: the surface opens
              on CLUB HEAT — what the club is actually engaging with — and says
              so, with the change one tap away on every breakpoint. */}
          <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
            Sorted by
            <select
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey);
                setSortDir(e.target.value === "ticker" ? "asc" : "desc");
                setAppliedScreenId(null);
              }}
              className="f0-focus rounded bg-transparent font-display text-[12px] font-bold uppercase tracking-normal text-ink outline-none"
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
            className="f0-focus inline-flex items-center gap-1 rounded font-mono text-[10px] uppercase tracking-[0.14em] text-soft hover:text-ink"
          >
            <Info className="h-3.5 w-3.5" />
            How to use this
          </button>
        </div>
      </div>

      {/* FOUNDING STATE (§0.5). The surface opens on CLUB HEAT, and a club of
          nine tickers with one or two participants each has no heat to sort by
          — so the default sort would silently degrade to an arbitrary order
          with a column of dashes beside it. Say so instead, and hand over the
          one-tap fix. Distinct from loading: the universe has already landed by
          the time this can render. */}
      {sortKey === "like_count" && results.length > 0 && maxHeat === 0 && (
        <p className="border-l-2 border-accent py-1 pl-3.5 text-[12.5px] leading-relaxed text-soft">
          The Club hasn&apos;t warmed any of these names yet, so this list is in
          no meaningful order. Like a ticker on its research page to start its
          heat — or{" "}
          <button
            type="button"
            onClick={() => {
              setSortKey("mcap");
              setSortDir("desc");
            }}
            className="f0-focus rounded font-semibold text-gold-700 underline decoration-1 underline-offset-2"
          >
            sort by size
          </button>{" "}
          for now.
        </p>
      )}
      <AnimatePresence initial={false}>
        {explainerOpen && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex items-start gap-2 border-l-[3px] border-sand py-1 pl-3.5">
              <p className="text-[13px] leading-relaxed text-soft">
                A screener filters thousands of stocks down to a short list that shares one trait — trading near a high, surging in volume, or looking oversold. It is a tool for finding candidates to <em>research</em>, never a list of things to buy. Combine a few filters, sort the columns, then dig into any company that catches your eye.
              </p>
              <HintDismiss
                onClick={() => {
                  setExplainerOpen(false);
                  howToHint.dismiss();
                }}
              />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Results — ONE hairline ledger, at every breakpoint ───────────────
          Not a table in a bordered card on desktop and a stack of cards on
          mobile: the same ruled ledger both times, shedding columns as the
          viewport narrows. Rules do the separating; nothing is boxed. */}
      {results.length === 0 ? (
        <div className="f0-rule-top f0-rule-bottom py-14">
          <Telescope className="mb-3 h-7 w-7 text-gold-600" />
          <h3 className="font-display text-display-3 font-extrabold text-ink">Nothing matches</h3>
          <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-soft">
            Loosen a filter or clear your search — the market shifts every day, so this list changes
            with it.
          </p>
        </div>
      ) : (
        <>
          {/* Column header — mono labels over a hairline, sortable. The gap and
              the per-cell box model (transparent left border + pl-3) mirror the
              row exactly, so every rule in the ledger runs straight down the
              page instead of drifting a pixel per column. */}
          <div className="hidden items-center gap-3.5 border-b border-sand pb-2 md:flex">
            <button
              onClick={() => toggleSort("ticker")}
              className={`flex-1 text-left font-mono text-[9px] font-bold uppercase tracking-[0.16em] ${
                sortKey === "ticker" ? "text-gold-700" : "text-soft hover:text-ink"
              }`}
            >
              Company {sortKey === "ticker" && (sortDir === "asc" ? "↑" : "↓")}
            </button>
            {LEDGER_COLS.map((c) => (
              <button
                key={c.key}
                onClick={() => toggleSort(c.key)}
                className={`${c.width} shrink-0 border-l border-transparent pl-3 text-right font-mono text-[9px] font-bold uppercase tracking-[0.16em] ${
                  sortKey === c.key ? "text-gold-700" : "text-soft hover:text-ink"
                }`}
              >
                {c.label} {sortKey === c.key && (sortDir === "asc" ? "↑" : "↓")}
              </button>
            ))}
            <button
              onClick={() => toggleSort("like_count")}
              className={`w-[86px] shrink-0 border-l border-transparent pl-3 text-right font-mono text-[9px] font-bold uppercase tracking-[0.16em] ${
                sortKey === "like_count" ? "text-gold-700" : "text-soft hover:text-ink"
              }`}
            >
              Heat {sortKey === "like_count" && (sortDir === "asc" ? "↑" : "↓")}
            </button>
            <span className="ml-1 w-[96px] shrink-0" aria-hidden />
          </div>

          <div className="f0-ledger">
            {pageRows.map((r) => (
              <LedgerRow
                key={r.ticker}
                r={r}
                maxHeat={maxHeat}
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

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-4 border-t border-sand pt-3">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft transition-colors hover:text-ink disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="font-mono text-[11px] tabular-nums text-soft">
                {page + 1} / {pageCount}
              </span>
              <button
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft transition-colors hover:text-ink disabled:opacity-30"
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
 * SCREENER SKELETON — the route's own furniture, not a generic list skeleton.
 *
 * Both the /screener route shell and this component's in-flight branch used
 * DashboardSkeleton, which draws a stack of rounded CARDS — a shape that exists
 * nowhere on the finished surface, so every screener open flashed the old
 * design for the length of a ~10k-row universe fetch and then swapped to a
 * hairline ledger. This is the finished page furniture with only the parts that
 * genuinely depend on data left blank: the masthead is real type, the ledger is
 * ruled rows, and the rules land where the real rules will land.
 *
 * Exported so the route shell (app/(dashboard)/screener/loading.tsx) renders
 * the identical thing and navigation does not shift.
 * ==========================================================================*/
export function ScreenerSkeleton({ embedded = false }: { embedded?: boolean }) {
  return (
    <div
      className={
        embedded ? "space-y-4" : "mx-auto max-w-6xl space-y-4 px-4 pb-24 sm:px-6"
      }
      aria-busy="true"
    >
      <header className={embedded ? "" : "pt-2"}>
        <p className="font-mono text-eyebrow font-bold uppercase text-gold-700">Screener</p>
        <h1 className="mt-2.5 font-display text-display-2 font-extrabold text-ink">
          The whole US market,
          <br className="hidden sm:block" /> filtered down to a short list.
        </h1>
        <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-soft">
          Every common stock and ETF on the NYSE, Nasdaq and AMEX. Candidates to{" "}
          <em>research</em> — never a list of things to buy.
        </p>
        <div className="f0-rule-top mt-4 pt-2.5">
          <div className="h-2.5 w-64 max-w-full animate-pulse rounded bg-sand" />
        </div>
      </header>

      <div className="f0-rule-bottom py-3">
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-sand/70" />
      </div>

      <div className="f0-rule-bottom flex gap-6 pb-3">
        {[64, 88, 72, 96, 80].map((w, i) => (
          <div key={i} className="h-2.5 animate-pulse rounded bg-sand" style={{ width: w }} />
        ))}
      </div>

      <div className="f0-ledger">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="f0-ledger-row">
            <div className="h-[34px] w-[34px] shrink-0 animate-pulse rounded-lg bg-sand" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-sand" />
              <div className="h-2.5 w-40 max-w-full animate-pulse rounded bg-sand/60" />
            </div>
            <div className="h-3 w-16 shrink-0 animate-pulse rounded bg-sand/70" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading the market universe</span>
    </div>
  );
}

/* ============================================================================
 * SAVE SCREEN — canvas board 15's "Save screen", with a table behind it.
 *
 * Closed it is one orange word on the results header, the same weight as the
 * "How to use this" affordance beside it. Open it becomes a ruled name field
 * and a commit — no dialog, no modal, no boxed popover: the control expands in
 * place the way every other disclosure on this surface does.
 * ==========================================================================*/
function SaveScreenControl({
  name,
  onName,
  onSave,
  saving,
  error,
  count,
}: {
  name: string;
  onName: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  count: number;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="f0-focus f0-press inline-flex items-center gap-1 rounded font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-gold-700 transition-colors hover:text-gold-600"
      >
        <Bookmark className="h-3.5 w-3.5" />
        Save screen
      </button>
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
          className="w-40 border-b border-sand bg-transparent py-1 font-display text-[13px] font-semibold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-soft/70 hover:border-gold-400 focus:border-accent"
        />
      </label>
      <button
        type="button"
        onClick={onSave}
        disabled={!name.trim() || saving}
        className="f0-focus f0-press rounded font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-gold-700 disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Cancel saving this screen"
        className="f0-focus rounded text-soft hover:text-ink"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {error ? (
        <span className="w-full font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
          {error}
        </span>
      ) : (
        <span className="w-full font-mono text-[10px] uppercase tracking-[0.12em] text-soft/70">
          {count} of {SAVED_SCREEN_LIMIT} saved · reusing a name replaces it
        </span>
      )}
    </span>
  );
}

/* ============================================================================
 * LEDGER ROW — one result, one ruled line.
 *
 * The same component at every breakpoint. Desktop hangs the numeric cells off
 * hairline vertical rules; below `md` those cells collapse into a mono strip
 * under the company name and the price moves to the right edge. There is no
 * card variant, because a card grid is exactly what the register bans — the
 * separation is a rule, and the row's own type carries the hierarchy.
 * ==========================================================================*/
function LedgerRow({
  r,
  maxHeat,
  busy,
  added,
  canAct,
  onOpen,
  onAddFamily,
  onSuggest,
  allowAlert = true,
}: {
  r: ScreenerRow;
  maxHeat: number;
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
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="f0-ledger-row f0-focus group cursor-pointer"
    >
      {/* identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CompanyLogo symbol={r.ticker} name={r.name} size={34} rounded="rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-[14px] font-extrabold tracking-tight text-ink">
              {r.ticker}
            </span>
            {r.type === "etf" && (
              <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-soft">
                ETF
              </span>
            )}
            {r.exchange && (
              <span className="hidden font-mono text-[8.5px] uppercase tracking-[0.14em] text-soft/70 sm:inline">
                {formatExchange(r.exchange)}
              </span>
            )}
          </div>
          <p className="truncate text-[11.5px] leading-snug text-soft">{r.name || "—"}</p>

          {/* sub-md: the numeric cells become one mono strip */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[10.5px] tabular-nums text-soft md:hidden">
            <span>
              1m <span className={pctTone(r.chg_1m)}>{fmtPct(r.chg_1m)}</span>
            </span>
            <span>
              3m <span className={pctTone(r.chg_3m)}>{fmtPct(r.chg_3m)}</span>
            </span>
            <span>
              Vol <span className="text-ink">{fmtRatio(r.vol_ratio)}</span>
            </span>
            <span>
              Cap <span className="text-ink">{fmtMcap(r.mcap)}</span>
            </span>
            {r.like_count != null && r.like_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="h-[6px] w-[6px] rounded-full bg-sentiment-fill" aria-hidden />
                <span className="text-ink">{r.like_count}</span>
              </span>
            )}
          </div>

          {/* sub-md: the row actions can't hide behind hover, so they sit on
              their own line rather than being lost on touch. */}
          <div className="mt-2 flex md:hidden" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      </div>

      {/* sub-md: the mark, right-aligned */}
      <div className="shrink-0 text-right md:hidden">
        <div className="font-mono text-[14px] font-semibold tabular-nums text-ink">
          {fmtPrice(r.price)}
        </div>
        <div className={`font-mono text-[11.5px] font-semibold tabular-nums ${pctTone(r.chg_1d)}`}>
          {fmtPct(r.chg_1d)}
        </div>
      </div>

      {/* md+: hairline-ruled numeric cells */}
      {LEDGER_COLS.map((c) => (
        <div
          key={c.key}
          className={`hidden shrink-0 border-l pl-3 text-right font-mono text-[12.5px] tabular-nums md:block ${RULE} ${c.width} ${
            c.tone?.(r) ?? "text-ink"
          }`}
        >
          {c.render(r)}
        </div>
      ))}
      <div className={`hidden w-[86px] shrink-0 border-l pl-3 text-right md:block ${RULE}`}>
        <HeatMark n={r.like_count} max={maxHeat} />
      </div>

      {/* actions — quiet until the row is reached */}
      <div
        className="ml-1 hidden w-[96px] shrink-0 justify-end transition-opacity md:flex md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
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
      </div>
    </div>
  );
}

/* ============================================================================
 * Row actions (shared by table + card). Rendered inside a clickable row, so
 * each control stops click propagation (the wrapping cell/card also stops it)
 * to keep row-navigation from firing when a member adds/suggests/alerts.
 * ==========================================================================*/
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
    // Confirmation is a COMMUNITY act, so it wears the sentiment ramp — not
    // green (price). `text-sentiment` carries both theme steps, which is why
    // the `dark:` variant this used to hand-write is gone.
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-sentiment">
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
        className="f0-chip f0-press f0-focus px-2 py-1 text-[11px] font-semibold text-soft hover:text-gold-700 disabled:opacity-50"
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
        className="f0-chip f0-press f0-focus px-2 py-1 text-[11px] font-semibold text-soft hover:text-gold-700 disabled:opacity-50"
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
        className="f0-focus inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-gold-700 hover:underline"
      >
        Research
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/** Price levels prefilled into a screener-row alert (52-week high/low touches). */
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
 * FILTER PANEL — ruled field groups, not a grid of boxes.
 *
 * The previous pass restyled the RESULTS into a hairline ledger but left the
 * filters as `grid-cols-2 sm:grid-cols-4` blocks of bordered inputs, which made
 * the dominant block on the surface the one thing still reading as the old app.
 * It is now built from the same vocabulary as everything below it: a section
 * rule per group, and one hairline-ruled row per filter — label and its plain-
 * English hint on the left, the control itself on the right. Nothing is boxed;
 * the controls are underlined fields and pill chips, so the panel reads as a
 * form on paper rather than as a grid of cards.
 *
 * Every filter that existed still exists and still writes the SAME key on
 * CustomFilters, so the preset buttons, the active-filter chips and the
 * plain-English parser (src/lib/screener-nl.ts) all keep working untouched —
 * a screen built here and a screen parsed from a sentence stay identical.
 *
 * Tiers: advanced technical filters stay FTA-only; kids never see the upsell.
 * ==========================================================================*/
const MCAP_STEPS: { label: string; value: number }[] = [
  { label: "$50M+", value: 50_000_000 },
  { label: "$300M+", value: 300_000_000 },
  { label: "$2B+", value: 2_000_000_000 },
  { label: "$10B+", value: 10_000_000_000 },
  { label: "$50B+", value: 50_000_000_000 },
];

/** The four "minimum move" windows — one row, four inline mono fields. */
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
      {/* ── What to look at ─────────────────────────────────────────────── */}
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
            /* Changing the sector clears any subsector chosen under the old one. */
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
          <Chip active={value.minMcap == null} onClick={() => patch({ minMcap: null })}>
            Any
          </Chip>
          {MCAP_STEPS.map((s) => (
            <Chip
              key={s.label}
              active={value.minMcap === s.value}
              onClick={() => patch({ minMcap: s.value })}
            >
              {s.label}
            </Chip>
          ))}
        </FieldRow>
      </FieldGroup>

      {/* ── How it is trading ───────────────────────────────────────────── */}
      <FieldGroup label="Price and movement">
        <FieldRow label="Share price" hint="Leave either side blank for no limit">
          <NumField
            ariaLabel="Minimum price"
            prefix="$"
            value={value.minPrice}
            onChange={(v) => patch({ minPrice: v })}
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft">to</span>
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

      {/* ── Advanced (FTA) ──────────────────────────────────────────────── */}
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
            <Chip
              active={!!value.nearHigh}
              onClick={() => patch({ nearHigh: value.nearHigh ? null : true })}
            >
              Near the high
            </Chip>
            <Chip
              active={!!value.nearLow}
              onClick={() => patch({ nearLow: value.nearLow ? null : true })}
            >
              Near the low
            </Chip>
          </FieldRow>
        </FieldGroup>
      ) : (
        !isKid && (
          <div className="f0-rule-top mt-5 flex items-start gap-2 pt-3 text-[12.5px] leading-snug text-soft">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
            <span>
              Advanced technical filters — RSI, moving-average trend, gap and 52-week
              highs and lows — are part of the Family Trading Academy.{" "}
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

/* ── Field group ───────────────────────────────────────────────────────────
   A section rule (charged tick + label + hairline to the edge) over a ledger
   of filter rows. Replaces the bordered block of inputs. */
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="pt-5 first:pt-1">
      <h3 className="f0-section-rule font-display text-eyebrow font-bold uppercase text-soft">
        <span className="shrink-0 whitespace-nowrap">{label}</span>
      </h3>
      <div className="f0-ledger">{children}</div>
    </section>
  );
}

/* ── Field row ─────────────────────────────────────────────────────────────
   One filter per ruled line. NOTE: `.f0-ledger-row` is UNLAYERED css, so it
   beats Tailwind's `items-*` utilities — a wrapping row therefore aligns its
   children with `self-start`, never with `items-start` on the row. */
function FieldRow({
  label,
  hint,
  wrap = false,
  children,
}: {
  label: string;
  hint?: string;
  /** Control side wraps to several lines (chips, multi-field rows). */
  wrap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="f0-ledger-row justify-between gap-4">
      <div className={`min-w-0 ${wrap ? "self-start pt-1" : ""}`}>
        <p className="font-display text-[13.5px] font-bold text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-soft">{hint}</p>}
      </div>
      <div
        className={`flex min-w-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-2 ${
          wrap ? "self-start" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Underlined select ─────────────────────────────────────────────────────
   The same control idiom as the "Sorted by" select at the top of the surface:
   type on a hairline, no box, no chrome. */
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
      className="f0-focus max-w-[16rem] cursor-pointer truncate border-b border-sand bg-transparent py-1 text-right font-display text-[13px] font-bold text-ink outline-none transition-colors hover:border-gold-400 focus:border-accent disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </select>
  );
}

/* ── Underlined number field ───────────────────────────────────────────────
   Every screener input is a market number, so it is MONO and tabular. The
   affix carries the unit ($, %, ×, the window) so the field itself stays a
   bare number; an unset filter shows the honest em-dash placeholder. */
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
    <label className="inline-flex items-baseline gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-soft">
      {prefix && <span aria-hidden>{prefix}</span>}
      <input
        type="number"
        aria-label={ariaLabel}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder="—"
        className={`f0-focus ${width} border-b border-sand bg-transparent py-1 text-right font-mono text-[13px] font-semibold tabular-nums tracking-normal text-ink outline-none transition-colors placeholder:text-soft/60 hover:border-gold-400 focus:border-accent`}
      />
      {suffix && <span aria-hidden>{suffix}</span>}
    </label>
  );
}

/* A selection toggle, on the shared .f0-chip / .f0-chip-on primitive.
   Previously a bespoke amber-tinted pill; the primitive exists precisely so
   the filter panel, the active-filter row and the canvas's stance/post-type
   controls cannot each invent their own selected state. .f0-chip-on inverts
   to a solid field (and flips in dark), so the choice survives with colour
   stripped — it is a value change, not a hue change. */
function Chip({
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
      className={`f0-chip f0-press f0-focus px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] ${
        active ? "f0-chip-on" : "text-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
