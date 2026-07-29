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
import {
  Bone,
  BoardCard,
  BoardChip,
  BoardHead,
  FoundingLine,
  PillTabs,
  SectionMark,
  Spark,
} from "@/components/discover/board";
import type { TrendingResponse, TrendingRow } from "@/lib/clubhome/contract";
import { createClient } from "@/lib/supabase/client";
import { parseScreenerQuery } from "@/lib/screener-nl";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { fetchQuote, fetchQuotes } from "@/lib/market/client";
import { STARTER_MARKET_TICKERS, STARTER_MARKET_UNIVERSE } from "@/lib/market/starter-universe";
import CompanyLogo from "@/components/fic/CompanyLogo";
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
import ScrollRow from "@/components/canvas2/ScrollRow";

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

/** The sort menu — Club signal first, because that is where the surface opens.
 *  Board 15 states the current sort in its results header rather than hanging a
 *  sortable column bar over the rows, so the menu IS the sort control now. */
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

/* ---------- club heat ----------
   COLOUR LAW: heat is COMMUNITY SENTIMENT, so it takes the canonical sentiment
   ramp — never the red heart it used to be (red belongs to price, and a red
   heart next to a red 1d% made the two read as the same signal). The token
   carries both theme steps itself, which is why there is no dark: variant here.

   Board 15 draws this slot as a tinted signal CHIP at the right end of the row
   ("78%", `rgba(74,227,131,.12)` ground). Same object here, carrying the honest
   number the app actually has — the count of members who have warmed the name —
   rather than a percentage the screener's data cannot support. */
function HeatChip({ n }: { n: number | null | undefined }) {
  // NOTHING, not a dash. Heat is a POSITIVE signal — "members have warmed this
  // name" — so its absence is already carried by the chip not being there. A
  // dash is the honest form of "we measured and got no reading"; here we
  // measured and got zero, and printing it turned the last column of a
  // founding-club result list into a stack of dashes on every single row.
  if (!n || n <= 0) return null;
  return (
    <span className="shrink-0 rounded-[8px] bg-sentiment-fill/12 px-[7px] py-[3px] font-mono text-[10px] font-semibold tabular-nums text-sentiment">
      {n}
    </span>
  );
}

/* ---------- the row sparkline ----------
   Board 15 hangs a 52×18 sparkline off every result row. A network call per
   row is not payable at 100 rows a page — but the row ALREADY carries four real
   readings of its own past (3m, 1m, 5d, 1d) plus the live mark, so the line is
   reconstructed from those: p_then = p_now / (1 + chg/100). Every point is a
   real price the feed supplied; nothing is interpolated or smoothed, and a row
   missing its history simply draws no line. */
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

/**
 * What a free member reads when they reach for a saved screen. A saved screen
 * is the Club half of "Screener / Stock Finder — free: Basic filters"
 * (PRICING_MATRIX): running a scan is free, KEEPING one is the membership. The
 * rail still renders and existing screens still load and delete — nothing a
 * lapsed member saved is ever taken away — only the new write is withheld.
 */
const SAVED_SCREENS_FREE_LINE =
  "Saved screens are how members keep a scan and re-run it tomorrow. The Club opens them, alongside the full screener and AI search.";

interface SavedScreen {
  id: string;
  name: string;
  filters: CustomFilters;
  sort_key: SortKey;
  sort_dir: SortDir;
}

/**
 * ScreenerSurface — the full-universe stock screener, rebuilt to the owner's
 * mockup BOARD 15 (`15 Discover Screener`, tiles `light-r2-*` / `dark-r2-*`;
 * markup in `.planning/design-project-v2/Cheat Code App Light.dc.html`).
 *
 * WHAT THE BOARD DRAWS, TOP TO BOTTOM:
 *   masthead        "discover" — the board files the screener as a TAB of
 *                   Discover, not as its own titled page
 *   tabs            FOR YOU · SCREENER · TRENDING, SCREENER lit as an orange pill
 *   filter chips    white, 1px ORANGE outline, "Tech ✕" — one per active filter,
 *                   with a quiet "+ Filter" at the end
 *   results header  "14 MATCHES · SORTED BY CLUB SIGNAL"  ·  "Save screen"
 *   results         white ROW CARDS: 26px mark · ticker · 52×18 sparkline ·
 *                   price · day move · signal chip
 *   conviction      two cards side by side — "Club's most bullish" on a green
 *                   hairline, "Club's most bearish" on a pink one
 *   trending        "TRENDING IN THE CLUB" — a wrap of outlined chips
 *
 * The previous pass drew all of this as a hairline ledger with a sortable
 * desktop column header and no cards anywhere. None of it remains: the results
 * are cards, the chips are the board's chips, and the copy on the results
 * header is the board's copy verbatim.
 *
 * `embedded` renders it as the SCREENER tab inside Discover, so the masthead,
 * the tab row and the two board-15 tail blocks are dropped — the host already
 * carries all three. The data, filters, full-universe load, saved screens and
 * free-tier gating are identical in both placements.
 */
export default function ScreenerSurface({
  embedded = false,
  initialQuery = "",
}: {
  embedded?: boolean;
  initialQuery?: string;
}) {
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
  const [usingStarterUniverse, setUsingStarterUniverse] = useState(false);

  const [custom, setCustom] = useState<CustomFilters>(() =>
    embedded
      ? {
          q: initialQuery || null,
          sector: "Technology",
          subsector: "Semiconductors",
          minMcap: 10_000_000_000,
        }
      : { q: initialQuery || null }
  );
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  // Free is a METER on this surface now, not a door: the basic groups and the
  // results table run, and only the two things the Club actually buys — the
  // Advanced group (already FTA-gated below) and saving a screen — are held.
  const isFree = tier === "free";

  /* Board 15's tail — "Club's most bullish / bearish" and "Trending in the
     Club" — is COMMUNITY data, which `screener_metrics` does not carry. It
     comes off the same ranked attention ledger Discover reads, so the two
     surfaces can never disagree about who the Club is bullish on. Fails soft to
     null: the blocks simply do not render. Skipped entirely when embedded,
     where the Discover host already draws them. */
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
    const firstRows = (firstRes.data as ScreenerRow[] | null) ?? [];
    if (firstRows.length > 0) {
      setRows(firstRows);
      setUsingStarterUniverse(false);
    } else {
      const quotes = await fetchQuotes(STARTER_MARKET_TICKERS);
      setRows(
        STARTER_MARKET_UNIVERSE.map((name) => {
          const quote = quotes[name.ticker];
          return {
            ticker: name.ticker,
            name: name.name,
            sector: name.sector,
            exchange: name.exchange,
            type: name.type,
            mcap: null,
            price: quote?.price ?? null,
            chg_1d: quote?.changePercent ?? null,
            chg_5d: null,
            chg_1m: null,
            chg_3m: null,
            vol: null,
            avg_vol_20: null,
            vol_ratio: null,
            dist_52w_high: null,
            dist_52w_low: null,
            rsi14: null,
            ema20_state: null,
            ema50_state: null,
            gap_pct: null,
            like_count: 0,
          } satisfies ScreenerRow;
        })
      );
      setUsingStarterUniverse(true);
      // The starter universe intentionally carries no manufactured market-cap
      // or subsector metrics. Drop the mockup's opening scan so the live quote
      // rows remain visible when the nightly universe has not populated yet.
      if (embedded) setCustom({ q: initialQuery || null });
      setSortKey("chg_1d");
      setSortDir("desc");
    }
    setLoading(false); // paint the top-of-universe page now

    const total = countRes.count ?? 0;
    const pages = Math.max(1, Math.ceil(total / 1000));
    if (firstRows.length > 0 && pages > 1) {
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) => pageQuery(i + 1))
      );
      setRows((prev) => {
        const all = [...prev];
        for (const r of rest) if (r.data) all.push(...(r.data as ScreenerRow[]));
        return all;
      });
    }
  }, [supabase, embedded, initialQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // Client half of the meter. The server half is the RLS insert policy on
    // screener_saved_screens (migration 204) — this return only spares a free
    // member a round trip to a row the database was going to refuse anyway.
    if (isFree) {
      setSavedError(SAVED_SCREENS_FREE_LINE);
      return;
    }
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
      // A row-level-security refusal is the SERVER meter talking (migration
      // 204). Say what it means in the surface's own words instead of leaking
      // "new row violates row-level security policy" at a member.
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // FREE = BASIC FILTERS, not a closed door (PRICING_MATRIX "Screener / Stock
  // Finder — free: Basic filters"). The full-page wall that used to stand here
  // is gone: the Universe and Price-and-movement groups and the results table
  // work, and the two things the Club actually buys — the Advanced group and
  // saved screens — are metered inline where they live. The kid redirect / RLS
  // wall is untouched and still governs the universe read.

  const chips = activeChips(custom);
  const coverage =
    meta?.mcap_count != null && meta?.common_count
      ? Math.round((meta.mcap_count / meta.common_count) * 100)
      : null;

  if (embedded) {
    return (
      <StandaloneScreenerBoard
        results={results}
        custom={custom}
        filtersOpen={filtersOpen}
        usingStarterUniverse={usingStarterUniverse}
        sortKey={sortKey}
        isKid={isKid}
        canAct={!!familyId}
        busy={busy}
        added={added}
        screenName={screenName}
        savingScreen={savingScreen}
        savedError={savedError}
        savedCount={saved?.length ?? 0}
        saveLocked={isFree}
        canSave={!!userId && !filtersEmpty(custom)}
        onQuery={(q) => setCustom((current) => ({ ...current, q: q || null }))}
        onPatch={patchFilter}
        onToggleFilters={() => setFiltersOpen((value) => !value)}
        onSort={(key) => {
          setSortKey(key);
          setSortDir(key === "ticker" ? "asc" : "desc");
        }}
        onScreenName={setScreenName}
        onSave={saveScreen}
        onOpen={(ticker) => openResearch(ticker)}
        onAdd={(row) => addToFamily(row, false)}
      />
    );
  }

  return (
    <div
      className={
        embedded ? "space-y-4" : "mx-auto max-w-3xl space-y-4 px-4 pb-24 sm:px-6"
      }
    >
      {/* ── Masthead + tabs (board 15) ──────────────────────────────────────
          The board files the screener as a TAB of Discover, so the standalone
          route wears Discover's head with SCREENER lit. Embedded inside
          Discover the host already draws both, so neither renders twice. */}
      {!embedded && (
        <>
          <BoardHead title="discover" sub="Screen the whole market on your own terms" />
          <PillTabs
            options={[
              { key: "foryou", label: "For you" },
              { key: "screener", label: "Screener" },
              { key: "trending", label: "Trending" },
            ]}
            value="screener"
            onChange={(k) => {
              if (k !== "screener") router.push("/discover");
            }}
            ariaLabel="Discover views"
            idPrefix="screener-tab"
            panelId="screener-panel"
          />
          <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft">
            Delayed ~15 min
            {meta?.last_trading_day ? ` · ${meta.last_trading_day}` : ""}
            {meta?.universe_count ? ` · ${meta.universe_count.toLocaleString()} securities` : ""}
            {coverage != null ? ` · mkt cap on ${coverage}% of stocks` : ""}
            {meta?.history_days ? ` · ${meta.history_days}d window` : ""}
          </p>
        </>
      )}

      <div
        id="screener-panel"
        role={embedded ? undefined : "tabpanel"}
        aria-labelledby={embedded ? undefined : "screener-tab-screener"}
        className="space-y-4"
      >
        {usingStarterUniverse && (
          <div className="cc-app-card border-[#3A2418] bg-[linear-gradient(120deg,#241009,#17141A_72%)] px-3.5 py-3">
            <p className="cc-app-signal text-[8.5px] font-semibold uppercase tracking-[0.14em] text-[#FF9A4D]">
              Live starter universe
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#8F8894]">
              Live prices and day moves are on. Full-universe technical filters will appear after the nightly screener refresh completes.
            </p>
          </div>
        )}
        {/* Search — the board's card, not a naked rule */}
        <BoardCard radius={14} className="flex items-center gap-2.5 px-3.5 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-soft" aria-hidden />
          <input
            value={custom.q ?? ""}
            onChange={(e) => setCustom((c) => ({ ...c, q: e.target.value || null }))}
            placeholder="Search by ticker or company name…"
            aria-label="Search the universe"
            className="min-w-0 flex-1 bg-transparent font-display text-[14px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-soft/70"
          />
          {custom.q && (
            <button
              onClick={() => setCustom((c) => ({ ...c, q: null }))}
              className="f0-focus shrink-0 rounded-full p-1 text-soft hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </BoardCard>

        {/* ── Screen in plain English ───────────────────────────────────────
            The surface's one AI affordance, so it keeps Kai blue — carried on
            the board's card with a Kai hairline rather than a bespoke tinted
            slab. The parse is deterministic (src/lib/screener-nl.ts): it only
            ever produces filters the panel below can also produce, so a parsed
            screen and a hand-built one are indistinguishable, and the chips
            narrate exactly what it understood. Nothing recognised → honest
            keyword fallback. */}
        <BoardCard radius={14} className="!border-kai-500/35 px-3.5 py-3">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-kai-600 dark:text-kai-300">
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
              className="w-full bg-transparent py-1 pr-10 font-display text-[14px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-soft/70"
            />
            <button
              onClick={() => runNL(nlInput)}
              disabled={!nlInput.trim()}
              aria-label="Run plain-English screen"
              className="f0-focus f0-press absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center rounded-full bg-kai-500 px-2 py-1.5 text-white transition disabled:opacity-40 dark:bg-kai-400"
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
            </button>
          </div>
          {nlNote && (
            <p className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-soft">
              {nlNote}
            </p>
          )}
        </BoardCard>

        {/* ── Quick start — the board's chip row ────────────────────────────
            Board 15 draws every one-of-N choice on this surface as a chip, so
            the presets are chips: the current one takes the ORANGE outline the
            board gives an active filter, and re-selecting it clears it. */}
        <div>
          <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-soft">
            Quick start
          </p>
          <ScrollRow className="-m-1 flex gap-[7px] p-1">
            {PRESETS.map((p) => (
              <BoardChip
                key={p.id}
                as="button"
                type="button"
                tone={activePresetId === p.id ? "accent" : "quiet"}
                aria-pressed={activePresetId === p.id}
                onClick={() => applyPreset(p)}
                className="f0-focus f0-press"
              >
                {p.label}
              </BoardChip>
            ))}
          </ScrollRow>
        </div>

        {activePresetId && (
          <BoardCard radius={14} className="px-3.5 py-3">
            {(() => {
              const ap = getPreset(activePresetId)!;
              return (
                <>
                  <p className="text-[12.5px] leading-snug text-ink/80">
                    {ap.blurb} These filters are applied below — tweak any of them.
                  </p>
                  {!isKid && (
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-sand pt-2.5">
                      <span className="text-[11.5px] font-medium text-soft">
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
          </BoardCard>
        )}

        {/* ── Your screens (board 15 · "Save screen") ───────────────────────
            Real persistence, not a UI gesture: every chip here is a row in
            screener_saved_screens. Rendered only once the read has landed —
            `saved === null` is "not read yet", which must never take the
            founding branch. */}
        {saved !== null && saved.length > 0 && (
          <div>
            <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-soft">
              Your screens
            </p>
            <ScrollRow className="-m-1 flex gap-[7px] p-1">
              {saved.map((s) => {
                const on = appliedScreenId === s.id;
                return (
                  <BoardChip key={s.id} tone={on ? "accent" : "quiet"}>
                    <button
                      type="button"
                      onClick={() => applyScreen(s)}
                      className="f0-focus f0-press rounded"
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
                  </BoardChip>
                );
              })}
            </ScrollRow>
          </div>
        )}

        {/* Filter panel — a carded disclosure */}
        <BoardCard radius={16} className="overflow-hidden">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="f0-focus flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
          >
            <span className="flex items-center gap-2 font-display text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink">
              <SlidersHorizontal className="h-4 w-4 text-gold-700" />
              Filters
              {chips.length > 0 && (
                <span className="font-mono text-[11px] font-bold text-gold-700">
                  {chips.length}
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-soft transition-transform ${filtersOpen ? "rotate-180" : ""}`}
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
                <div className="border-t border-sand px-3.5">
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
        </BoardCard>

        {/* Active filter chips — board 15's own "Tech ✕" row, verbatim: white
            fill, 1px ORANGE outline, orange label, with a quiet "+ Filter" at
            the end that opens the panel above. */}
        <div className="club2-track -m-1 flex flex-wrap items-center gap-[7px] p-1">
          {chips.map((c) => (
            <BoardChip
              key={c.key}
              as="button"
              type="button"
              tone="accent"
              onClick={() => clearFilter(c.key)}
              className="f0-focus f0-press"
              aria-label={`Remove the ${c.label} filter`}
            >
              {c.label}
              <X className="h-3 w-3" />
            </BoardChip>
          ))}
          <BoardChip
            as="button"
            type="button"
            tone="quiet"
            onClick={() => setFiltersOpen(true)}
            className="f0-focus f0-press"
          >
            + Filter
          </BoardChip>
          {chips.length > 0 && (
            <button
              onClick={clearAll}
              className="f0-focus ml-1 rounded text-[10.5px] font-semibold text-soft underline hover:text-ink"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Results header — board 15's line, verbatim shape:
            "14 MATCHES · SORTED BY CLUB SIGNAL"   ·   "Save screen" */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-soft">
            {results.length.toLocaleString()}{" "}
            {results.length === 1 ? "MATCH" : "MATCHES"} · SORTED BY{" "}
            {(SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "").toUpperCase()}
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* SAVE SCREEN — board 15 draws it right here. It writes a real row
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
                locked={isFree}
              />
            )}
            {/* The sort is a stated fact, not a hidden default: the surface
                opens on CLUB SIGNAL — what the Club is actually engaging with
                — and the line above says so. */}
            <label className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft">
              Sort
              <select
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value as SortKey);
                  setSortDir(e.target.value === "ticker" ? "asc" : "desc");
                  setAppliedScreenId(null);
                }}
                className="f0-focus rounded bg-transparent font-display text-[11.5px] font-bold uppercase tracking-normal text-ink outline-none"
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
              className="f0-focus inline-flex items-center gap-1 rounded font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft hover:text-ink"
            >
              <Info className="h-3.5 w-3.5" />
              How to use this
            </button>
          </div>
        </div>

        {/* FOUNDING STATE. The surface opens on CLUB SIGNAL, and a club of nine
            tickers with one or two participants each has no signal to sort by —
            so the default sort would silently degrade to an arbitrary order
            with a column of dashes beside it. Say so, and hand over the one-tap
            fix. Distinct from loading: the universe has already landed by the
            time this can render. */}
        {sortKey === "like_count" && results.length > 0 && maxHeat === 0 && (
          <FoundingLine>
            The Club hasn&apos;t warmed any of these names yet, so this list is in
            no meaningful order. Like a ticker on its research page to start its
            signal — or{" "}
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
          </FoundingLine>
        )}

        <AnimatePresence initial={false}>
          {explainerOpen && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <BoardCard radius={14} className="flex items-start gap-2 px-3.5 py-3">
                <p className="text-[12.5px] leading-relaxed text-soft">
                  A screener filters thousands of stocks down to a short list that shares one trait — trading near a high, surging in volume, or looking oversold. It is a tool for finding candidates to <em>research</em>, never a list of things to buy. Combine a few filters, change the sort, then dig into any company that catches your eye.
                </p>
                <HintDismiss
                  onClick={() => {
                    setExplainerOpen(false);
                    howToHint.dismiss();
                  }}
                />
              </BoardCard>
            </m.div>
          )}
        </AnimatePresence>

        {/* ── Results — board 15's ROW CARDS, at every breakpoint ───────────
            One white card per match: mark, ticker, sparkline, price, day move,
            signal chip. The extra columns the old ledger carried (1m/3m/vol/cap
            /RSI) drop below the identity line on small screens exactly as they
            did, but as type on the card rather than as ruled cells. */}
        {results.length === 0 ? (
          <BoardCard radius={18} className="px-5 py-12">
            <Telescope className="mb-3 h-7 w-7 text-gold-700" />
            <h3 className="font-display text-[21px] font-extrabold tracking-[-0.02em] text-ink">
              Nothing matches
            </h3>
            <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-soft">
              Loosen a filter or clear your search — the market shifts every day,
              so this list changes with it.
            </p>
          </BoardCard>
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

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="f0-focus rounded font-mono text-[10.5px] uppercase tracking-[0.14em] text-soft transition-colors hover:text-ink disabled:opacity-30"
                >
                  ← Prev
                </button>
                <span className="font-mono text-[10.5px] tabular-nums text-soft">
                  {page + 1} / {pageCount}
                </span>
                <button
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  className="f0-focus rounded font-mono text-[10.5px] uppercase tracking-[0.14em] text-soft transition-colors hover:text-ink disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Board 15's tail: conviction cards + trending chips ────────────
            Community data, off the shared attention ledger. Skipped when
            embedded (Discover's own Trending tab draws both) and skipped
            entirely when the Club has not formed a read — an empty pair of
            cards would be worse than no cards. */}
        {!embedded && <ClubTail ledger={clubLedger} />}
      </div>
    </div>
  );
}

function StandaloneScreenerBoard({
  results,
  custom,
  filtersOpen,
  usingStarterUniverse,
  sortKey,
  isKid,
  canAct,
  busy,
  added,
  screenName,
  savingScreen,
  savedError,
  savedCount,
  saveLocked,
  canSave,
  onQuery,
  onPatch,
  onToggleFilters,
  onSort,
  onScreenName,
  onSave,
  onOpen,
  onAdd,
}: {
  results: ScreenerRow[];
  custom: CustomFilters;
  filtersOpen: boolean;
  usingStarterUniverse: boolean;
  sortKey: SortKey;
  isKid: boolean;
  canAct: boolean;
  busy: string | null;
  added: Record<string, "family" | "community">;
  screenName: string;
  savingScreen: boolean;
  savedError: string | null;
  savedCount: number;
  saveLocked: boolean;
  canSave: boolean;
  onQuery: (value: string) => void;
  onPatch: (patch: Partial<CustomFilters>) => void;
  onToggleFilters: () => void;
  onSort: (key: SortKey) => void;
  onScreenName: (value: string) => void;
  onSave: () => void;
  onOpen: (ticker: string) => void;
  onAdd: (row: ScreenerRow) => void;
}) {
  const [signalFloor, setSignalFloor] = useState(70);
  const [risingOnly, setRisingOnly] = useState(true);
  const maxHeat = Math.max(0, ...results.map((row) => row.like_count ?? 0));
  const signalPct = (row: ScreenerRow) =>
    maxHeat > 0 ? Math.round(((row.like_count ?? 0) / maxHeat) * 100) : null;
  const displayed = results.filter((row) => {
    const signal = signalPct(row);
    if (signal != null && signal < signalFloor) return false;
    if (risingOnly && row.chg_5d != null && row.chg_5d <= 0) return false;
    return true;
  });
  const filterCount = activeChips(custom).length;
  const mcap = custom.minMcap ?? 0;
  const sectorOptions: Array<{ label: string; sector: Sector; subsector?: string }> = [
    { label: "Tech", sector: "Technology" },
    { label: "Semis", sector: "Technology", subsector: "Semiconductors" },
    { label: "Fintech", sector: "Financials", subsector: "Consumer Finance" },
    { label: "Health", sector: "Healthcare" },
    { label: "Energy", sector: "Energy" },
  ];

  return (
    <div>
      <header className="flex items-center gap-2.5">
        <h1 className="script-mark text-[34px] leading-none text-[#F4F0EC]">discover</h1>
        <span className="cc-app-signal ml-auto text-[9px] text-[#6E6774]">
          {displayed.length.toLocaleString()} MATCHES
        </span>
      </header>

      <nav className="mt-3 flex items-center gap-4" aria-label="Discover views">
        <Link href="/discover" className="text-[11px] font-semibold uppercase tracking-[.04em] text-[#8F8894]">For you</Link>
        <span className="rounded-full bg-[#FF7A1A] px-[13px] py-[5px] text-[10.5px] font-extrabold uppercase tracking-[.06em] text-[#0D0B0E]">Screener</span>
        <Link href="/discover?tab=trending" className="text-[11px] font-semibold uppercase tracking-[.04em] text-[#8F8894]">Trending</Link>
      </nav>

      <div className="mt-[13px] flex gap-2">
        <label className="cc-app-card flex min-w-0 flex-1 items-center gap-2 px-3 py-[9px]">
          <Search className="h-[13px] w-[13px] shrink-0 text-[#6E6774]" />
          <input
            value={custom.q ?? ""}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search ticker or theme…"
            className="min-w-0 flex-1 !border-0 !bg-transparent p-0 text-[11.5px] text-[#F4F0EC] outline-none placeholder:text-[#6E6774]"
          />
        </label>
        <button
          type="button"
          onClick={onToggleFilters}
          className="flex items-center gap-[7px] rounded-[14px] border-[1.5px] border-[#FF7A1A] bg-[rgba(255,122,26,.12)] px-[13px] py-[9px] shadow-[0_0_10px_rgba(255,122,26,.14)]"
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#FF9A4D]" />
          <span className="text-[11px] font-extrabold text-[#FF9A4D]">Filters</span>
          <span className="cc-app-signal rounded-full bg-[#FF7A1A] px-1.5 py-px text-[8.5px] font-bold text-[#0D0B0E]">{filterCount}</span>
        </button>
      </div>

      {filtersOpen && (
        <section className="mt-[9px] rounded-[18px] border-[1.5px] border-[#FF7A1A] bg-[#141118] px-[14px] py-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_8px_22px_rgba(0,0,0,.55)]">
          <div className="flex items-center gap-2">
            <span className="cc-app-signal text-[9px] font-semibold uppercase tracking-[.16em] text-[#FF9A4D]">Screen settings</span>
            <button type="button" onClick={() => onPatch({ sector: null, subsector: null, minMcap: null })} className="ml-auto text-[10px] font-semibold text-[#8F8894]">Reset all</button>
            <button type="button" onClick={onToggleFilters} className="text-[12px] text-[#6E6774]" aria-label="Collapse filters">⌃</button>
          </div>

          <p className="mt-[11px] text-[9px] font-semibold uppercase tracking-[.1em] text-[#8F8894]">Sector</p>
          <div className="mt-[7px] flex flex-wrap gap-1.5">
            {sectorOptions.map((option) => {
              const active = option.subsector
                ? custom.subsector === option.subsector
                : custom.sector === option.sector;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() =>
                    active
                      ? onPatch({ sector: null, subsector: null })
                      : onPatch({ sector: option.sector, subsector: option.subsector ?? null })
                  }
                  className={`rounded-full border px-[11px] py-[5px] text-[10px] font-bold ${active ? "border-[#FF7A1A] bg-[rgba(255,122,26,.12)] text-[#FF9A4D]" : "border-[#2A2530] bg-[#0D0B0E] text-[#8F8894]"}`}
                >
                  {option.label}{active ? " ✓" : ""}
                </button>
              );
            })}
            <button type="button" className="rounded-full border border-[#2A2530] bg-[#0D0B0E] px-[11px] py-[5px] text-[10px] font-semibold text-[#8F8894]">+6</button>
          </div>

          <div className="mt-3 flex gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#8F8894]">Market cap</p>
              <div className="mt-[7px] flex rounded-[11px] border border-[#2A2530] bg-[#0D0B0E] p-0.5">
                {[
                  { label: "Any", value: 0 },
                  { label: "2B", value: 2_000_000_000 },
                  { label: "10B+", value: 10_000_000_000 },
                  { label: "200B", value: 200_000_000_000 },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => onPatch({ minMcap: option.value || null })}
                    className={`cc-app-signal flex-1 rounded-[9px] py-[5px] text-[8.5px] ${mcap === option.value ? "bg-[#FF7A1A] font-bold text-[#0D0B0E]" : "text-[#8F8894]"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="min-w-0 flex-1">
              <span className="block text-[9px] font-semibold uppercase tracking-[.1em] text-[#8F8894]">Sort by</span>
              <span className="mt-[7px] flex items-center rounded-[11px] border border-[#2A2530] bg-[#0D0B0E] px-[11px] py-[7px]">
                <select value={sortKey} onChange={(event) => onSort(event.target.value as SortKey)} className="min-w-0 flex-1 !border-0 !bg-transparent p-0 text-[10.5px] font-bold text-[#F4F0EC] outline-none">
                  {SORT_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </span>
            </label>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline">
              <span className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#8F8894]">Club signal</span>
              <span className="cc-app-signal ml-auto text-[10px] font-semibold text-[#FF9A4D]">≥ {signalFloor}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={signalFloor}
              onChange={(event) => setSignalFloor(Number(event.target.value))}
              className="mt-2 h-1.5 w-full cursor-pointer accent-[#FF7A1A]"
              aria-label="Minimum normalized Club signal"
            />
            <div className="cc-app-signal mt-1 flex justify-between text-[8px] text-[#6E6774]"><span>0</span><span>100</span></div>
          </div>

          <button type="button" onClick={() => setRisingOnly((value) => !value)} className="mt-2 flex w-full items-center gap-2.5 border-t border-[#221E28] pt-2.5 text-left">
            <span aria-hidden>📈</span>
            <span className="flex-1 text-[11px] font-semibold text-[#F4F0EC]">Only rising conviction (7d)</span>
            <span className={`relative h-5 w-[34px] rounded-full ${risingOnly ? "bg-[#FF7A1A]" : "bg-[#2A2530]"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#0D0B0E] transition-[left] ${risingOnly ? "left-4" : "left-0.5"}`} />
            </span>
          </button>

          <div className="mt-[11px] flex gap-2">
            <span className="flex-1 rounded-[14px] border border-[#2A2530] bg-[#0D0B0E] px-2 py-[9px] text-center">
              {canSave ? (
                <SaveScreenControl name={screenName} onName={onScreenName} onSave={onSave} saving={savingScreen} error={savedError} count={savedCount} locked={saveLocked} />
              ) : (
                <span className="text-[11px] font-bold text-[#C8C2CE]">Save screen</span>
              )}
            </span>
            <button type="button" onClick={onToggleFilters} className="flex-[1.4] rounded-[14px] bg-[#FF7A1A] px-2 py-[9px] text-[11px] font-extrabold text-[#0D0B0E] shadow-[0_0_12px_rgba(255,122,26,.22)]">
              Show {displayed.length.toLocaleString()} matches
            </button>
          </div>
        </section>
      )}

      <div className="mt-[13px] flex items-baseline justify-between">
        <span className="cc-app-signal text-[9px] tracking-[.14em] text-[#6E6774]">RESULTS · SORTED BY {(SORT_OPTIONS.find((option) => option.key === sortKey)?.label ?? "").toUpperCase()}</span>
        <span className="text-[10px] font-bold text-[#FF9A4D]">See all {displayed.length.toLocaleString()} ›</span>
      </div>

      {usingStarterUniverse && (
        <p className="cc-app-signal mt-1 text-[8px] uppercase tracking-[.1em] text-[#6E6774]">Live quotes · full metrics refresh pending</p>
      )}

      <div className="mt-[9px] flex flex-col gap-[7px]">
        {displayed.length === 0 ? (
          <div className="cc-app-card px-4 py-8 text-center text-[11px] text-[#8F8894]">No live tickers match this screen. Reset a filter to widen it.</div>
        ) : displayed.slice(0, 3).map((row) => {
          const signal = signalPct(row);
          return (
            <div key={row.ticker} className="cc-app-card flex items-center gap-[9px] px-[11px] py-[9px]">
              <CompanyLogo symbol={row.ticker} name={row.name} size={28} rounded="rounded-[9px]" />
              <button type="button" onClick={() => onOpen(row.ticker)} className="min-w-0 flex-1 text-left">
                <span className="block text-[12px] font-extrabold text-[#F4F0EC]">{row.ticker}</span>
                <span className="cc-app-signal mt-0.5 block whitespace-nowrap text-[9px] text-[#8F8894]">
                  {fmtPrice(row.price)} <span className={pctTone(row.chg_1d)}>{fmtPct(row.chg_1d)}</span>
                </span>
              </button>
              <span className="w-10 shrink-0">
                <Spark points={seriesFor(row)} width={40} height={18} strokeWidth={1.6} className="block w-full" />
              </span>
              <span className={`cc-app-signal rounded-[8px] border px-[7px] py-[3px] text-[9px] font-semibold ${signal == null ? "border-[#2A2530] text-[#6E6774]" : "border-[rgba(74,227,131,.35)] bg-[rgba(74,227,131,.12)] text-[#4AE383]"}`}>
                {signal == null ? "—" : `${signal}%`}
              </span>
              {!isKid && (
                <SetAlertButton ticker={row.ticker} surface="screener" seedPrice={row.price} variant="icon" className="!h-7 !w-7 !rounded-[9px] !border-0 !bg-[#FF7A1A] !p-0 !text-[#0D0B0E]" />
              )}
              <button
                type="button"
                onClick={() => onAdd(row)}
                disabled={!canAct || busy === row.ticker}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-[9px] border border-[#2A2530] bg-[#0D0B0E] text-[13px] ${added[row.ticker] ? "text-[#FFC24B]" : "text-[#6E6774]"}`}
                aria-label={`Add ${row.ticker} to watchlist`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${added[row.ticker] ? "fill-current" : ""}`} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-[10px] flex items-center gap-[9px] rounded-[14px] border border-dashed border-[#3A3240] bg-[#17141A] px-[13px] py-[9px]">
        <span aria-hidden>🔔</span>
        <span className="flex-1 text-[10.5px] text-[#8F8894]">Alert every new match this screen finds</span>
        {!isKid && (
          <SetAlertButton ticker={null} surface="screener" defaultKind="preset_match" presetId="standalone-current" presetLabel="Current screen" variant="chip" className="!rounded-[11px] !border-[#2A2530] !bg-[#221E28] !px-[11px] !py-[5px] !text-[10px] !font-bold !text-[#C8C2CE]" />
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * BOARD 15 TAIL — "Club's most bullish / most bearish" + "Trending in the Club"
 *
 * The board draws the two conviction cards with a green and a pink hairline and
 * paints the percentages green/red. Both figures are COMMUNITY SENTIMENT, so
 * the bull card takes the lime sentiment ramp and the bear card an ink tint;
 * only the trending chips carry a real price move, and those keep green/red.
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
          <SectionMark label="Trending in the Club" />
          <div className="mt-2.5 flex flex-wrap gap-[7px]">
            {trending.map((r) => (
              <Link
                key={r.ticker}
                href={researchHref(r.ticker)}
                className="f0-focus rounded-full"
              >
                <BoardChip className="!font-mono !text-[11px] !text-ink">
                  {r.ticker.toUpperCase()}{" "}
                  <span className={pctTone(r.changePct)}>{fmtPct(r.changePct)}</span>
                </BoardChip>
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
  return (
    <div
      className={`rounded-[16px] border bg-card px-3.5 py-[13px] ${
        tone === "bull" ? "border-sentiment/40" : "border-sand"
      }`}
    >
      <p
        className={`font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] ${
          tone === "bull" ? "text-sentiment" : "text-soft"
        }`}
      >
        {title}
      </p>
      <div className="mt-2.5 flex flex-col gap-2">
        {rows.map((r) => (
          <Link
            key={r.ticker}
            href={`/research/${encodeURIComponent(r.ticker)}?tab=community`}
            className="f0-focus flex items-center justify-between rounded"
          >
            <span className="font-mono text-[11px] font-semibold text-ink">
              {r.ticker.toUpperCase()}
            </span>
            <span
              className={`font-mono text-[10.5px] tabular-nums ${
                tone === "bull" ? "text-sentiment" : "text-ink"
              }`}
            >
              {tone === "bull"
                ? `${r.sentiment!.bullPct}%`
                : `${100 - (r.sentiment!.bullPct ?? 0)}%`}
            </span>
          </Link>
        ))}
      </div>
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
  if (embedded) {
    return (
      <div aria-busy="true">
        <header className="flex items-center gap-2.5">
          <h1 className="script-mark text-[34px] leading-none text-[#F4F0EC]">discover</h1>
          <Bone w={62} h={8} className="ml-auto" />
        </header>
        <div className="mt-3 flex items-center gap-4">
          <span className="text-[11px] font-semibold uppercase text-[#8F8894]">For you</span>
          <span className="rounded-full bg-[#FF7A1A] px-[13px] py-[5px] text-[10.5px] font-extrabold uppercase text-[#0D0B0E]">Screener</span>
          <span className="text-[11px] font-semibold uppercase text-[#8F8894]">Trending</span>
        </div>
        <div className="mt-[13px] flex gap-2">
          <div className="cc-app-card flex-1 px-3 py-[11px]"><Bone w="65%" h={9} /></div>
          <div className="rounded-[14px] border-[1.5px] border-[#FF7A1A] bg-[rgba(255,122,26,.12)] px-[13px] py-[10px]"><Bone w={72} h={9} /></div>
        </div>
        <div className="mt-[9px] rounded-[18px] border-[1.5px] border-[#FF7A1A] bg-[#141118] px-[14px] py-[13px]">
          <Bone w={120} h={8} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[54, 62, 58, 56, 58].map((width, index) => <Bone key={index} w={width} h={25} className="!rounded-full" />)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3"><Bone w="100%" h={42} /><Bone w="100%" h={42} /></div>
          <Bone w="100%" h={38} className="mt-3" />
          <Bone w="100%" h={34} className="mt-3 !rounded-[14px]" />
        </div>
        <Bone w={190} h={8} className="mt-[13px]" />
        <div className="mt-[9px] flex flex-col gap-[7px]">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="cc-app-card flex items-center gap-[9px] px-[11px] py-[9px]">
              <Bone w={28} h={28} className="!rounded-[9px]" />
              <Bone w={52} h={18} />
              <Bone w={40} h={16} className="ml-auto" />
              <Bone w={34} h={20} />
              <Bone w={28} h={28} className="!rounded-[9px]" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading the market universe</span>
      </div>
    );
  }

  return (
    <div
      className={
        embedded ? "space-y-4" : "mx-auto max-w-3xl space-y-4 px-4 pb-24 sm:px-6"
      }
      aria-busy="true"
    >
      {!embedded && (
        <>
          <BoardHead title="discover" sub="Screen the whole market on your own terms" />
          <div className="flex items-center gap-4">
            <Bone w={62} h={10} />
            <Bone w={72} h={22} className="!rounded-full" />
            <Bone w={62} h={10} />
          </div>
          <Bone w={220} h={8} />
        </>
      )}

      {/* Search + Kai field + chips — real geometry, empty of data. */}
      <BoardCard radius={14} className="px-3.5 py-3">
        <Bone w="60%" h={12} />
      </BoardCard>
      <BoardCard radius={14} className="space-y-2 px-3.5 py-3">
        <Bone w={150} h={8} />
        <Bone w="70%" h={12} />
      </BoardCard>
      <div className="flex gap-[7px]">
        {[72, 88, 64, 96].map((w, i) => (
          <Bone key={i} w={w} h={26} className="!rounded-full" />
        ))}
      </div>

      <div className="flex flex-col gap-[7px]">
        {Array.from({ length: 9 }).map((_, i) => (
          <BoardCard key={i} radius={12} className="px-[11px] py-[9px]">
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
          </BoardCard>
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
  locked = false,
}: {
  name: string;
  onName: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  count: number;
  /** Free tier: the affordance stands, the last step is withheld. */
  locked?: boolean;
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

  /* THE WITHHELD LAST STEP. A free member reaches for "Save screen" and gets
     the real answer — what a saved screen is and who has them — in the same
     place the name field would have opened. Not a wall over the screener: the
     scan they just built is still on the page behind this line. */
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
 * RESULT CARD — one match, one white card. Board 15's result row, verbatim:
 *
 *   [26px mark] TICKER  [52×18 sparkline]      $173.42   ▲4.7%   [78%]
 *
 * The board's row is a single line; the numbers this app has and the board does
 * not draw (the company name, the longer windows, cap, and the row's actions)
 * sit on a SECOND line inside the same card, so nothing the screener could do
 * before is lost and the card still reads as the board's object.
 *
 * The sparkline is reconstructed from the row's own real 3m/1m/5d/1d readings
 * (see `seriesFor`) — no per-row network call, no invented curve.
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
    <BoardCard
      radius={12}
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
      className="f0-focus group cursor-pointer px-[11px] py-[9px] transition-colors hover:border-accent"
    >
      {/* the board's line */}
      <div className="flex items-center gap-2.5">
        <CompanyLogo symbol={r.ticker} name={r.name} size={26} rounded="rounded-[8px]" />
        <span className="w-[46px] shrink-0 font-mono text-[11px] font-semibold text-ink">
          {r.ticker}
        </span>
        <span className="hidden w-[52px] shrink-0 sm:block">
          <Spark
            points={seriesFor(r)}
            width={52}
            height={18}
            strokeWidth={1.6}
            className="block w-full"
          />
        </span>
        <span className="flex-1 truncate text-right font-mono text-[10.5px] tabular-nums text-ink">
          {fmtPrice(r.price)}
        </span>
        <span
          className={`w-[46px] shrink-0 text-right font-mono text-[10px] tabular-nums ${pctTone(r.chg_1d)}`}
        >
          {fmtPct(r.chg_1d)}
        </span>
        <HeatChip n={r.like_count} />
      </div>

      {/* everything the board's single line has no room for */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-[36px]">
        <span className="min-w-0 max-w-[22ch] truncate text-[11px] leading-snug text-soft">
          {r.name || "—"}
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
        <span className="font-mono text-[10px] tabular-nums text-soft">
          1m <span className={pctTone(r.chg_1m)}>{fmtPct(r.chg_1m)}</span>
        </span>
        <span className="font-mono text-[10px] tabular-nums text-soft">
          3m <span className={pctTone(r.chg_3m)}>{fmtPct(r.chg_3m)}</span>
        </span>
        <span className="font-mono text-[10px] tabular-nums text-soft">
          Vol <span className="text-ink">{fmtRatio(r.vol_ratio)}</span>
        </span>
        <span className="font-mono text-[10px] tabular-nums text-soft">
          Cap <span className="text-ink">{fmtMcap(r.mcap)}</span>
        </span>
        <span className="font-mono text-[10px] tabular-nums text-soft">
          RSI <span className="text-ink">{fmtRsi(r.rsi14)}</span>
        </span>

        {/* Actions can't hide behind hover on touch, so they sit on the line
            rather than appearing only on the desktop hover state. */}
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
    </BoardCard>
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
   The board's orange mono section mark over a run of filter rows, INSIDE the
   filter card. A rule between rows of one card is the board's own idiom
   (board 17's pick card separates its quote the same way); a card per filter
   would be cards inside cards. */
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="pt-4 first:pt-3">
      <SectionMark label={label} />
      <div className="f0-ledger mt-1">{children}</div>
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
