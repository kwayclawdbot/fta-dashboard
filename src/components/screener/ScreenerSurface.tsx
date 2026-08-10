"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "@/lib/motion";
// The filter sheet drags to dismiss; `drag` is not in the diet bundle, so the
// sheet imports the full primitive the way MobileTabBar's More sheet does.
import { motion, type PanInfo } from "framer-motion";
import {
  Telescope,
  Search,
  ChevronDown,
  ArrowRight,
  SlidersHorizontal,
  Info,
  Lock,
  X,
  Sparkles,
  Bookmark,
  Star,
} from "lucide-react";
import { Bone, BoardCard, FoundingLine, TickerSpark } from "@/components/discover/board";
import type { TrendingResponse, TrendingRow } from "@/lib/clubhome/contract";
import { createClient } from "@/lib/supabase/client";
import { parseScreenerQuery } from "@/lib/screener-nl";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { fetchBars, fetchQuote, type MarketBar } from "@/lib/market/client";
import { fmtBound } from "@/lib/research/labels";
import { useKaiSheet } from "@/components/kai/KaiSheetProvider";
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
/** PostgREST caps a page at 1000 rows; this is that cap, named. */
const UNIVERSE_PAGE = 1000;
/**
 * How much of the universe loads without being asked. Sorted by market cap
 * descending, the first 4,000 rows are every company with a market cap the data
 * set knows about plus a deep tail of small caps — more than any default view
 * shows and more than a filtered screen normally reaches. The remainder (mostly
 * micro-caps and unpriced listings) is one click away and is ANNOUNCED rather
 * than silently missing. See the long note in `load` for why this is not simply
 * "fetch everything".
 */
const AUTO_UNIVERSE_ROWS = 4000;

/** A Postgres/PostgREST failure, said in a sentence a member can act on. */
function readErrorLine(err: { code?: string; message?: string } | null): string {
  if (err?.code === "57014") {
    return "The market data took too long to come back. Some of the universe is missing from this screen.";
  }
  return err?.message
    ? `Couldn't load part of the universe (${err.message}).`
    : "Couldn't load part of the universe.";
}

const METRIC_COLS =
  "ticker, name, sector, exchange, type, mcap, price, chg_1d, chg_5d, chg_1m, chg_3m, vol, avg_vol_20, vol_ratio, dist_52w_high, dist_52w_low, rsi14, ema20_state, ema50_state, gap_pct, like_count, updated_at";

/** The deep link into a ticker's research page — carried by the expanded
 *  row's "Open research →" action (rows themselves expand in place now);
 *  `?from=screener` makes the D1 research breadcrumb read "← Stock Finder". */
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
 *  The board states the current sort in its results header rather than hanging
 *  a sortable column bar over the rows, so the menu IS the sort control. */
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

/* ---------- terminal primitives (style law — semantic tokens only) ----------
   Section labels are WHITE BOLD CAPS ~13px on the ink token. Chip-row prefixes
   are the board's KAI-INTERPRETATION register: small soft-caps INLINE before
   the chips, never a stacked form label. Choice chips are RAISED WELLS on
   --m800; the active one takes the brand-accent pill. Tabs underline in Kai's
   violet. Nothing here hardcodes a surface hex, so family-light stays coherent
   without a mode branch. */
function SectionLabel({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className={`text-[13px] font-bold uppercase tracking-[0.06em] text-ink ${className}`}
    >
      {children}
    </h2>
  );
}

/** The board's inline chip-row prefix — soft caps, in the flow, never stacked. */
function InlinePrefix({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="mr-0.5 shrink-0 text-[10.5px] font-bold uppercase tracking-[0.1em] text-soft"
    >
      {children}
    </span>
  );
}

function WellChip({
  as: Tag = "span",
  active = false,
  className = "",
  children,
  ...rest
}: {
  as?: React.ElementType;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
  /* ButtonHTMLAttributes so a chip rendered `as "button"` can declare
     `type="button"` — without it a chip inside a form would submit it. */
} & React.ButtonHTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-[11px] py-[6px] text-[11.5px] font-semibold transition-colors ${
        active
          ? "border-accent/60 bg-accent/12 text-gold-700"
          : "border-sand bg-midnight-800 text-soft hover:text-ink"
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** The law's tab anatomy: violet (--kai-blue) 2px underline on the live tab. */
function UnderlineTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  panelId,
  className = "",
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
  ariaLabel: string;
  idPrefix: string;
  panelId: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`club2-track flex gap-5 overflow-x-auto border-b border-sand ${className}`}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            id={`${idPrefix}-${o.key}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={panelId}
            onClick={() => onChange(o.key)}
            className={`f0-focus -mb-px shrink-0 border-b-2 border-transparent pb-2.5 text-[13px] font-semibold transition-colors ${
              on ? "text-kai-600 dark:text-kai-300" : "text-soft hover:text-ink"
            }`}
            style={on ? { borderBottomColor: "var(--kai-blue)" } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
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
   "Save screen" on the results header is backed by `screener_saved_screens`:
   own-row RLS, kid-walled through the same viewer_is_kid() definer the
   screener universe uses, capped at 20 per member by a trigger. `filters` is
   the CustomFilters blob verbatim, so a re-applied screen and a hand-built
   one are the same object. */
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
 * ScreenerSurface — the full-universe stock screener, designed AS IF it were a
 * screen of the owner's mockup board (.planning/CLUB-TERMINAL-STYLE.md, DISCOVER
 * phone of `ChatGPT Image Aug 7 … 10_07_23 AM.png`). There is no filter-panel
 * phone on the board, so this surface borrows the DISCOVER phone's complete
 * vocabulary rather than restyling a form:
 *
 *   head          display headline · ONE plain-English ask bar (the board's
 *                 query-bar anatomy: rounded card, sentence placeholder, run
 *                 arrow in the right slot)
 *   chips         active filters as removable accent chips flowing under the
 *                 bar (the KAI INTERPRETATION register), led by ONE compact
 *                 "Filters · N" trigger
 *   sheet         the FULL filter set lives in a bottom sheet (phones) /
 *                 side panel (desktop) — grouped, roomy, the board's
 *                 pill/well vocabulary; the More-sheet pattern from
 *                 MobileTabBar, copied
 *   results       rows EXACTLY per the board's discover result anatomy:
 *                 40px round logo · bold display-face name · soft mono meta
 *                 line · green "% Bullish" dot line (only when the ledger
 *                 really carries a read) · mono ticker · bold mono price ·
 *                 real-closes sparkline · gold watchlist star
 *
 * It is SHARED by the club Discover Screens tab, the standalone /screener
 * route and every family placement, so the whole composition is SEMANTIC
 * TOKENS ONLY — the same classes render the dark terminal in club-dark and
 * stay coherent on the family/club-light paper; no mode branch in this file.
 * Fonts ride `font-display` (Inter under the club remap, Sora on family) and
 * mono is strictly numbers/data.
 *
 * BEHAVIOR IS PRESERVED: the universe load discipline, deterministic NL parse
 * (src/lib/screener-nl.ts), presets, saved screens + the 20 cap, the free
 * meter on saving, the FTA gate on Academy filters, the kid walls, sort and
 * pagination are all the same code paths as before the recomposition.
 *
 * `embedded` renders it as the Screens tab inside Discover, so the masthead,
 * the tab row and the two tail blocks are dropped — the host already carries
 * all three. `nlSeed` / `seedScreenId` — the club Discover host hands its ask /
 * chosen screen down here; both are optional and INERT when absent, and both
 * run through the same parse / apply paths the in-surface controls use.
 */
export default function ScreenerSurface({
  embedded = false,
  nlSeed,
  seedScreenId,
}: {
  embedded?: boolean;
  /** A plain-English query to parse and apply on arrival (club Discover). */
  nlSeed?: string;
  /** A screener_saved_screens id to re-apply on arrival (club Discover). */
  seedScreenId?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const { openKai } = useKaiSheet();

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [tierResolved, setTierResolved] = useState(false);
  const [isKid, setIsKid] = useState(false);
  /** Per-ticker alerts wear research's kid/teen gate (ResearchClient's
   *  `canAlert` — kids AND teens never meet the button); the preset alert in
   *  the quick-start card keeps its own original `!isKid` gate untouched. */
  const [canAlert, setCanAlert] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  /** How many rows exist upstream — the honest denominator for the match line. */
  const [universeTotal, setUniverseTotal] = useState<number | null>(null);
  /** A universe page that FAILED. Stated, never swallowed. */
  const [universeError, setUniverseError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // `loadMoreUniverse` resumes from wherever the rows currently end without
  // re-subscribing to `rows` (which would rebuild the callback on every append).
  const rowsRef = useRef<ScreenerRow[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

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

  // The full filter set lives in the SHEET now — closed until asked for. The
  // "Filters · N" trigger under the ask bar is the one way in.
  const [sheetOpen, setSheetOpen] = useState(false);
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
  /** The ONE expanded result row (accordion — a second tap, or another row's
   *  tap, closes it). Keyed by ticker, so a row that pages/sorts/filters away
   *  simply stops rendering its panel — no cleanup effect needed. */
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  // SAVED SCREENS. `null` = the member's screens have not been read yet, which
  // is NOT the same as "no saved screens" — the rail renders nothing at all
  // while null and only takes its founding branch once an empty array lands.
  const [saved, setSaved] = useState<SavedScreen[] | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [savingScreen, setSavingScreen] = useState(false);
  const [screenName, setScreenName] = useState("");
  const [appliedScreenId, setAppliedScreenId] = useState<string | null>(null);

  /* ── seeds from the club Discover host ──────────────────────────────────
     Each seed is applied EXACTLY ONCE per distinct value (the refs), through
     the same state the surface's own controls write — a seeded screen and a
     hand-built one are indistinguishable, which is the whole contract. */
  /* eslint-disable react-hooks/set-state-in-effect -- applying a host-supplied
     seed IS an external-input sync; both effects are ref-guarded one-shots. */
  const nlSeedRef = useRef<string | null>(null);
  useEffect(() => {
    const text = nlSeed?.trim();
    if (!text || nlSeedRef.current === nlSeed) return;
    nlSeedRef.current = nlSeed ?? null;
    setNlInput(text);
    setActivePresetId(null);
    setAppliedScreenId(null);
    const parsed = parseScreenerQuery(text);
    if (parsed.matched.length > 0) {
      setCustom({ ...parsed.filters, q: parsed.leftover || null });
      setNlNote(`Understood: ${parsed.matched.join(" · ")}`);
    } else {
      setCustom({ q: text });
      setNlNote("No filters matched — searching by name instead.");
    }
  }, [nlSeed]);

  const screenSeedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!seedScreenId || !saved || screenSeedRef.current === seedScreenId) return;
    const s = saved.find((x) => x.id === seedScreenId);
    if (!s) return;
    screenSeedRef.current = seedScreenId;
    setActivePresetId(null);
    setAppliedScreenId(s.id);
    setCustom((c) => ({ ...s.filters, q: c.q ?? null }));
    setSortKey(s.sort_key);
    setSortDir(s.sort_dir);
    setNlNote(null);
  }, [seedScreenId, saved]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isFTA = tier === "fta";
  // Free is a METER on this surface, not a door: the basic groups and the
  // results run, and only the two things the Club actually buys — the Academy
  // group (already FTA-gated below) and saving a screen — are held.
  const isFree = tier === "free";

  /* The community ledger — the same ranked attention read Discover makes, so
     the two surfaces can never disagree about who the Club is bullish on. It
     feeds BOTH the result rows' "% Bullish" line (the board's line 3 — drawn
     only when a real read exists for that ticker) and, on the standalone
     route, the conviction/trending tail. Fails soft to null: no line, no tail. */
  const [clubLedger, setClubLedger] = useState<TrendingResponse | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/club/trending", {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    })
      .then((res) => (res.ok ? (res.json() as Promise<TrendingResponse>) : null))
      .then((d) => d && setClubLedger(d))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  /** ticker → ledger row, for the green "% Bullish" line on result rows. */
  const intel = useMemo(() => {
    const map = new Map<string, TrendingRow>();
    for (const r of clubLedger?.rows ?? []) map.set(r.ticker.toUpperCase(), r);
    return map;
  }, [clubLedger]);

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
    const kid = p.age_group === "kids" || p.role === "child";
    setIsKid(kid);
    setCanAlert(!kid && p.age_group !== "teens");
    getClubTier(supabase, p.family_id ?? null).then((t) => {
      setTier(t);
      setTierResolved(true);
    });

    /* ── HOW MUCH UNIVERSE TO PULL, AND HOW ──────────────────────────────
       Pages are fetched ONE AT A TIME, so the database is never asked for
       more than one on-disk sort at once (a 1,000-row, 22-column read is a
       seq scan + merge sort, ~270ms server time each; a dozen at once used
       to die on the statement timeout and be dropped IN SILENCE). Only up to
       AUTO_UNIVERSE_ROWS load on their own — the whole of what any default
       view can show — and the rest of the tail loads when it is asked for
       (see `loadMoreUniverse`); until it does the surface SAYS SO next to
       the match count. A page that fails sets `universeError` and stops;
       nothing is dropped quietly. */
    const pageQuery = (i: number) =>
      supabase
        .from("screener_metrics")
        .select(METRIC_COLS)
        .not("price", "is", null)
        .order("mcap", { ascending: false, nullsFirst: false })
        .order("ticker", { ascending: true })
        .range(i * UNIVERSE_PAGE, i * UNIVERSE_PAGE + UNIVERSE_PAGE - 1);

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
    setUniverseTotal(countRes.count ?? null);
    if (firstRes.error) {
      setUniverseError(readErrorLine(firstRes.error));
      setRows([]);
    } else {
      setRows((firstRes.data as ScreenerRow[]) ?? []);
    }
    setLoading(false); // paint the top-of-universe page now
    if (firstRes.error) return;

    const total = countRes.count ?? 0;
    const autoPages = Math.min(
      Math.ceil(total / UNIVERSE_PAGE),
      Math.ceil(AUTO_UNIVERSE_ROWS / UNIVERSE_PAGE)
    );
    // Sequential on purpose — see the note above. One page in flight at a time.
    for (let i = 1; i < autoPages; i++) {
      const res = await pageQuery(i);
      if (res.error) {
        setUniverseError(readErrorLine(res.error));
        return;
      }
      const batch = (res.data as ScreenerRow[]) ?? [];
      setRows((prev) => [...prev, ...batch]);
      if (batch.length < UNIVERSE_PAGE) return; // ran out early — done
    }
  }, [supabase]);

  /**
   * Pull the rest of the tail, on request. Same one-page-at-a-time discipline;
   * the button that calls it reports progress and any failure rather than
   * leaving the member to guess how much of the market they just screened.
   */
  const loadMoreUniverse = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setUniverseError(null);
    const total = universeTotal ?? 0;
    let loaded = rowsRef.current.length;
    while (loaded < total) {
      const res = await supabase
        .from("screener_metrics")
        .select(METRIC_COLS)
        .not("price", "is", null)
        .order("mcap", { ascending: false, nullsFirst: false })
        .order("ticker", { ascending: true })
        .range(loaded, loaded + UNIVERSE_PAGE - 1);
      if (res.error) {
        setUniverseError(readErrorLine(res.error));
        break;
      }
      const batch = (res.data as ScreenerRow[]) ?? [];
      if (batch.length === 0) break;
      setRows((prev) => [...prev, ...batch]);
      loaded += batch.length;
      if (batch.length < UNIVERSE_PAGE) break;
    }
    setLoadingMore(false);
  }, [supabase, loadingMore, universeTotal]);

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
    setPage(0);
  }, [custom, sortKey, sortDir]);

  const pageRows = useMemo(
    () => results.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [results, page]
  );
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  /** Does the default Club-signal sort have anything to sort BY on this page? */
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
  function clearAsk() {
    setNlInput("");
    setNlNote(null);
    setCustom((c) => ({ ...c, q: null }));
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
  // Finder — free: Basic filters"). The Universe / Size / Price-and-movement
  // groups and the results run; the Academy group and saved screens are
  // metered inline where they live. The kid redirect / RLS wall is untouched
  // and still governs the universe read.

  const chips = activeChips(custom);
  /** Is every upstream row in hand? Drives what the match count claims. */
  const universeComplete = universeTotal == null || rows.length >= universeTotal;
  const coverage =
    meta?.mcap_count != null && meta?.common_count
      ? Math.round((meta.mcap_count / meta.common_count) * 100)
      : null;

  return (
    <div className={embedded ? "" : "mx-auto max-w-3xl px-4 pb-24 sm:px-6"}>
      {/* ── Masthead + tabs ────────────────────────────────────────────────
          The screener is filed as a TAB of Discover, so the standalone route
          wears Discover's terminal head — caps wordmark, display headline, mono
          coverage line, violet-underline tabs with SCREENER live. Embedded
          inside Discover the host already draws all of it. */}
      {!embedded && (
        <>
          <span className="font-display text-[13px] font-bold uppercase tracking-[0.24em] text-ink">
            Discover
          </span>
          <h1 className="mt-3 font-display text-[24px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
            Screen the whole market
          </h1>
          {/* Coverage is DATA, so it's mono — delayed feed, stated plainly. */}
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
            Delayed ~15 min
            {meta?.last_trading_day ? ` · ${meta.last_trading_day}` : ""}
            {meta?.universe_count ? ` · ${meta.universe_count.toLocaleString()} securities` : ""}
            {coverage != null ? ` · mkt cap on ${coverage}% of stocks` : ""}
            {meta?.history_days ? ` · ${meta.history_days}d window` : ""}
          </p>
          <UnderlineTabs
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
          className="mt-5"
          />
        </>
      )}

      {/* Rhythm is UNEVEN by design: ~10px inside a thought, 24px between
          sections — never a uniform space-y stack. */}
      <div
        id="screener-panel"
        role={embedded ? undefined : "tabpanel"}
        aria-labelledby={embedded ? undefined : "screener-tab-screener"}
        className={embedded ? "" : "mt-5"}
      >
        {/* ── THE ASK BAR — the board's query-bar anatomy, whole ────────────
            One rounded card, one sentence, the run arrow in the right slot.
            It replaces the old keyword-input + NL-card pair: the parse is the
            same deterministic src/lib/screener-nl.ts, and a phrase nothing
            recognises degrades to the same name/ticker search the keyword
            field used to run — one bar, both jobs. The violet spark marks it
            as the surface's one AI affordance (Kai's color, never accent). */}
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            runNL(nlInput);
          }}
        >
          <div className="flex items-center gap-2.5 rounded-[16px] border border-sand bg-card px-[15px] py-[13px] transition-colors focus-within:border-[color-mix(in_srgb,var(--kai-blue)_40%,var(--sand))]">
            <Sparkles
              className="h-4 w-4 shrink-0 text-kai-600 dark:text-kai-300"
              aria-hidden
            />
            <input
              value={nlInput}
              onChange={(e) => {
                setNlInput(e.target.value);
                if (nlNote) setNlNote(null);
              }}
              placeholder="Show me semis under $60 with rising volume…"
              aria-label="Search a ticker, or describe a screen in plain English"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-soft/80"
            />
            {(nlInput || custom.q) && (
              <button
                type="button"
                onClick={clearAsk}
                aria-label="Clear the ask"
                className="f0-focus shrink-0 rounded-full p-1 text-soft transition-colors hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {nlInput.trim() ? (
              <button
                type="submit"
                aria-label="Run it"
                className="f0-focus f0-press shrink-0 rounded-full p-1 text-gold-700"
              >
                <ArrowRight className="h-[17px] w-[17px]" />
              </button>
            ) : (
              <Search className="h-4 w-4 shrink-0 text-soft" aria-hidden />
            )}
          </div>
        </form>
        {/* The parse echo is a SENTENCE, so it reads in the body face —
            mono is for values, never for prose. */}
        {nlNote && (
          <p className="mt-1.5 text-[11.5px] leading-snug text-soft">{nlNote}</p>
        )}

        {/* ── ACTIVE FILTERS — the KAI INTERPRETATION register ──────────────
            One compact "Filters · N" trigger into the sheet, then one accent
            pill per live filter, each removable in place. This row IS the
            standing record of the screen — there is no Apply anywhere. */}
        <div className="club2-track -m-1 mt-3 flex flex-wrap items-center gap-[7px] p-1">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            className="f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sand bg-midnight-800 px-[11px] py-[6px] text-[11.5px] font-semibold text-ink transition-colors hover:border-accent"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-soft" aria-hidden />
            Filters
            {chips.length > 0 && (
              <span className="font-mono text-[11px] font-bold tabular-nums text-gold-700">
                {chips.length}
              </span>
            )}
          </button>
          {chips.map((c) => (
            <WellChip
              key={c.key}
              as="button"
              type="button"
              active
              onClick={() => clearFilter(c.key)}
              className="f0-focus f0-press"
              aria-label={`Remove the ${c.label} filter`}
            >
              {c.label}
              <X className="h-3 w-3" />
            </WellChip>
          ))}
          {chips.length > 0 && (
            <button
              onClick={clearAll}
              className="f0-focus ml-1 rounded text-[10.5px] font-semibold text-soft underline hover:text-ink"
            >
              Clear all
            </button>
          )}
        </div>

        {/* ── Quick start — preset chips behind the board's inline prefix ── */}
        <div
          role="group"
          aria-label="Quick start screens"
          className="mt-6"
        >
          <ScrollRow className="-m-1 flex items-center gap-[7px] p-1">
            <InlinePrefix>Quick start</InlinePrefix>
            {PRESETS.map((p) => (
              <WellChip
                key={p.id}
                as="button"
                type="button"
                active={activePresetId === p.id}
                aria-pressed={activePresetId === p.id}
                onClick={() => applyPreset(p)}
                className="f0-focus f0-press"
              >
                {p.label}
              </WellChip>
            ))}
          </ScrollRow>
        </div>

        {activePresetId && (
          <BoardCard radius={14} className="mt-3 px-[15px] py-[13px]">
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

        {/* ── Your screens — real persistence, not a UI gesture: every chip
            here is a row in screener_saved_screens. Rendered only once the
            read has landed — `saved === null` is "not read yet", which must
            never take the founding branch. */}
        {saved !== null && saved.length > 0 && (
          <div role="group" aria-label="Your saved screens" className="mt-4">
            <ScrollRow className="-m-1 flex items-center gap-[7px] p-1">
              <InlinePrefix>Your screens</InlinePrefix>
              {saved.map((s) => {
                const on = appliedScreenId === s.id;
                return (
                  <WellChip key={s.id} active={on}>
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
                  </WellChip>
                );
              })}
            </ScrollRow>
          </div>
        )}

        {/* Results header — the terminal line:
            "14 MATCHES · SORTED BY CLUB SIGNAL"   ·   "Save screen" */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* THE COUNT AND WHAT IT COUNTED. A match count is only meaningful
              against the set it searched, so when the tail of the universe
              isn't loaded the line says how many rows were actually screened
              instead of implying the whole market. */}
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
            {results.length.toLocaleString()}{" "}
            {results.length === 1 ? "MATCH" : "MATCHES"}
            {universeComplete || results.length === rows.length
              ? ""
              : ` OF ${rows.length.toLocaleString()} SCREENED`}{" "}
            · SORTED BY{" "}
            {(SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "").toUpperCase()}
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* SAVE SCREEN — the row's one primary act, so it takes the solid
                orange pill. It writes a real row (migration 194) and only
                appears once there is a screen worth keeping, so it never
                invites a member to save the empty view. */}
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
                — and the line above says so. The menu sits in the same raised
                --m800 well as every other control on the surface. */}
            <label className="relative inline-flex items-center gap-1.5 rounded-full border border-sand bg-midnight-800 py-[5px] pl-3 pr-7 transition-colors focus-within:border-accent">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-soft">
                Sort
              </span>
              <select
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value as SortKey);
                  setSortDir(e.target.value === "ticker" ? "asc" : "desc");
                  setAppliedScreenId(null);
                }}
                className="f0-focus cursor-pointer appearance-none bg-transparent text-[12px] font-semibold text-ink outline-none"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden
                className="pointer-events-none absolute right-2.5 h-3 w-3 text-soft"
              />
            </label>
            <button
              onClick={() => setExplainerOpen((v) => !v)}
              aria-expanded={explainerOpen}
              className="f0-focus inline-flex items-center gap-1 rounded text-[11px] font-semibold uppercase tracking-[0.06em] text-soft transition-colors hover:text-ink"
            >
              <Info className="h-3.5 w-3.5" />
              How to use this
            </button>
          </div>
        </div>

        {/* ── WHAT WAS ACTUALLY SCREENED ───────────────────────────────────
            Both partial states are stated — a window with the way to complete
            it, and an outright failure with what went wrong. */}
        {universeError && (
          <p className="mt-3 text-[11px] leading-snug text-soft">
            {universeError}{" "}
            <button
              onClick={() => void loadMoreUniverse()}
              className="f0-focus rounded font-semibold text-gold-700 underline decoration-1 underline-offset-2"
            >
              Try again
            </button>
          </p>
        )}
        {!universeError && !universeComplete && (
          <p className="mt-3 text-[11px] leading-snug text-soft">
            Screening the top {rows.length.toLocaleString()} companies by market
            cap.{" "}
            {loadingMore ? (
              <span className="font-semibold text-ink">
                Loading the rest of the market…
              </span>
            ) : (
              <button
                onClick={() => void loadMoreUniverse()}
                className="f0-focus rounded font-semibold text-gold-700 underline decoration-1 underline-offset-2"
              >
                Include all {(universeTotal ?? 0).toLocaleString()}
              </button>
            )}
          </p>
        )}

        {/* FOUNDING STATE. The surface opens on CLUB SIGNAL, and a club of nine
            tickers with one or two participants each has no signal to sort by —
            so the default sort would silently degrade to an arbitrary order.
            Say so, and hand over the one-tap fix. Distinct from loading: the
            universe has already landed by the time this can render. */}
        {sortKey === "like_count" && results.length > 0 && maxHeat === 0 && (
          <FoundingLine className="mt-3">
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
              <BoardCard
                radius={14}
                className="mt-3 flex items-start gap-2 px-[15px] py-[13px]"
              >
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

        {/* ── Results — the board's discover result rows, verbatim anatomy:
            40px round logo · bold display name · soft mono meta · green
            "% Bullish" dot line (only when the ledger carries a real read) ·
            mono ticker · bold price · real-closes sparkline · gold star.
            A tap expands the row in place (see ScreenRow) — one at a time. */}
        {results.length === 0 ? (
          <BoardCard radius={16} className="mt-3 px-5 py-12">
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
            <div className="mt-3 flex flex-col gap-2.5">
              {pageRows.map((r) => (
                <ScreenRow
                  key={r.ticker}
                  r={r}
                  sortKey={sortKey}
                  bullPct={
                    intel.get(r.ticker.toUpperCase())?.sentiment?.bullPct ?? null
                  }
                  canStar={!!familyId}
                  starred={!!added[r.ticker]}
                  busy={busy === r.ticker}
                  onStar={() => addToFamily(r, false)}
                  expanded={expandedTicker === r.ticker}
                  onToggle={() =>
                    setExpandedTicker((cur) => (cur === r.ticker ? null : r.ticker))
                  }
                  canAlert={canAlert}
                  /* Kai is members-only (openKai no-ops on free), so a free
                     member gets NO pill rather than a dead control. */
                  showKai={!isFree}
                  onAskKai={() =>
                    openKai({
                      chip: r.ticker.toUpperCase(),
                      query: `What should I know about ${r.ticker.toUpperCase()} right now?`,
                    })
                  }
                />
              ))}
            </div>

            {/* Pagination — the same raised-well pills as every other control;
                the page count is a COUNT, so it stays mono tabular. */}
            {pageCount > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <WellChip
                  as="button"
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="f0-focus f0-press disabled:opacity-30"
                >
                  ← Prev
                </WellChip>
                <span className="font-mono text-[11px] font-semibold tabular-nums text-soft">
                  {page + 1} / {pageCount}
                </span>
                <WellChip
                  as="button"
                  type="button"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  className="f0-focus f0-press disabled:opacity-30"
                >
                  Next →
                </WellChip>
              </div>
            )}
          </>
        )}

        {/* ── The tail: conviction cards + trending chips ───────────────────
            Community data, off the shared attention ledger. Skipped when
            embedded (Discover's own Trending tab draws both) and skipped
            entirely when the Club has not formed a read — an empty pair of
            cards would be worse than no cards. */}
        {!embedded && <ClubTail ledger={clubLedger} />}
      </div>

      {/* ── THE FILTER SHEET — bottom sheet on phones, side panel on desktop.
          The full filter set lives here, grouped and roomy; every control
          writes CustomFilters live, so the accent chips above are already the
          record of what is applied by the time the sheet closes. */}
      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        matchCount={results.length}
        hasActive={chips.length > 0}
        onClearAll={clearAll}
        isFTA={isFTA}
        isKid={isKid}
        exchanges={exchanges}
        value={custom}
        patch={patchFilter}
      />
    </div>
  );
}

/* ============================================================================
 * THE TAIL — "Club's most bullish / most bearish" + "Trending in the Club"
 *
 * Both figures are COMMUNITY SENTIMENT, so the bull card takes the lime
 * sentiment ramp and the bear card an ink tint; only the trending chips carry
 * a real price move, and those keep green/red.
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
    <div className="mt-7">
      {stanced.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <ConvictionCard title="Club's most bullish" rows={bullish} tone="bull" />
          <ConvictionCard title="Club's most bearish" rows={bearish} tone="bear" />
        </div>
      )}

      {trending.length > 0 && (
        <div className={stanced.length > 0 ? "mt-6" : ""}>
          <SectionLabel>Trending in the Club</SectionLabel>
          <div className="mt-2.5 flex flex-wrap gap-[7px]">
            {trending.map((r) => (
              <Link
                key={r.ticker}
                href={researchHref(r.ticker)}
                className="f0-focus rounded-full"
              >
                <WellChip className="font-mono !text-[11px] !font-normal !text-ink">
                  {r.ticker.toUpperCase()}{" "}
                  <span className={pctTone(r.changePct)}>{fmtPct(r.changePct)}</span>
                </WellChip>
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
      className={`rounded-[16px] border bg-card px-[15px] py-[13px] ${
        tone === "bull" ? "border-sentiment/40" : "border-sand"
      }`}
    >
      {/* the terminal's white-caps label register, toned by the card */}
      <p
        className={`text-[11px] font-bold uppercase tracking-[0.08em] ${
          tone === "bull" ? "text-sentiment" : "text-ink"
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
 * RESULT ROW — one match, exactly as the board's DISCOVER phone draws it:
 *
 *   (40px round logo)  Name (display bold)            SOUN     $5.32
 *                      $7.2B · +12.4% 3m  (soft mono)      ~sparkline~  ⌄  ★
 *                      · 87% Bullish      (sentiment, only when real)
 *
 * The sparkline is TickerSpark — the discover rows' own component: real daily
 * closes off /api/market/bars, deferred until visible, deduplicated through a
 * module cache, tinted by their true sign. The "% Bullish" line is the
 * community ledger's real bull share for that ticker; absent = not drawn. The
 * gold star is the family-watchlist add; a member with no family gets NO star
 * rather than a dead control.
 *
 * TAPPING A ROW EXPANDS IT in place (accordion — one open at a time, the
 * chevron rotates, the same height discipline as the explainer disclosure):
 * a real one-month price chart in ClubStockHead's chart vocabulary (dotted
 * grid, right price rail — fetched on expand, cached, never fabricated), a
 * compact mono stat strip of the metrics the row actually carries, the
 * "% Bullish" read when the ledger has one, then the action row — + Watchlist
 * (the star's own write), Ask Kai (the contextual sheet, members only),
 * Set alert (kid/teen-gated) and "Open research →", which is where the
 * row-level deep link into /research/[ticker] now lives.
 * ==========================================================================*/

/** The board's soft mono line 2 — the cap, then the reading the CURRENT SORT
 *  is about, so a list sorted by RSI shows each row's RSI instead of making
 *  the member take the order on faith. Only readings the feed supplied. */
function rowMeta(r: ScreenerRow, sortKey: SortKey): string | null {
  const parts: string[] = [];
  if (r.mcap != null) parts.push(fmtMcap(r.mcap));
  switch (sortKey) {
    case "chg_1d":
      if (r.chg_1d != null) parts.push(`${fmtPct(r.chg_1d)} 1d`);
      break;
    case "chg_5d":
      if (r.chg_5d != null) parts.push(`${fmtPct(r.chg_5d)} 5d`);
      break;
    case "chg_1m":
      if (r.chg_1m != null) parts.push(`${fmtPct(r.chg_1m)} 1m`);
      break;
    case "vol_ratio":
      if (r.vol_ratio != null) parts.push(`${fmtRatio(r.vol_ratio)} vol`);
      break;
    case "rsi14":
      if (r.rsi14 != null) parts.push(`RSI ${fmtRsi(r.rsi14)}`);
      break;
    default:
      if (r.chg_3m != null) parts.push(`${fmtPct(r.chg_3m)} 3m`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function ScreenRow({
  r,
  sortKey,
  bullPct,
  canStar,
  starred,
  busy,
  onStar,
  expanded,
  onToggle,
  canAlert,
  showKai,
  onAskKai,
}: {
  r: ScreenerRow;
  sortKey: SortKey;
  bullPct: number | null;
  canStar: boolean;
  starred: boolean;
  busy: boolean;
  onStar: () => void;
  expanded: boolean;
  onToggle: () => void;
  canAlert: boolean;
  showKai: boolean;
  onAskKai: () => void;
}) {
  const t = r.ticker.toUpperCase();
  const sub = rowMeta(r, sortKey);
  const panelId = `screen-row-panel-${t}`;
  return (
    <div className="rounded-[16px] border border-sand bg-card transition-colors hover:border-accent">
      {/* The header keeps the board's collapsed anatomy verbatim; only the
          chevron is new, and the star keeps its exact old seat. */}
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`f0-focus flex w-full items-center gap-3 rounded-[16px] p-[13px] text-left ${
            canStar ? "pr-11" : ""
          }`}
        >
          <CompanyLogo
            symbol={r.ticker}
            name={r.name}
            size={40}
            rounded="rounded-full"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-display text-[14.5px] font-bold leading-tight text-ink">
                {r.name || t}
              </span>
              {r.type === "etf" && (
                <span className="shrink-0 font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-soft">
                  ETF
                </span>
              )}
            </span>
            {sub && (
              <span className="mt-[3px] block truncate font-mono text-[11px] text-soft">
                {sub}
              </span>
            )}
            {bullPct != null && (
              <span className="mt-[3px] flex items-center gap-1.5 text-[11.5px] font-semibold text-sentiment">
                <span
                  aria-hidden
                  className="h-[5px] w-[5px] shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--sentiment-fill)" }}
                />
                {bullPct}% Bullish
              </span>
            )}
          </span>
          <span className="shrink-0 text-right">
            <span className="flex items-baseline justify-end gap-2.5">
              <span className="font-mono text-[11px] uppercase text-soft">{t}</span>
              <span className="font-mono text-[14px] font-semibold tabular-nums text-ink">
                {fmtPrice(r.price)}
              </span>
            </span>
            <TickerSpark
              symbol={r.ticker}
              width={76}
              height={18}
              className="ml-auto mt-[7px] block w-[76px]"
            />
          </span>
          <ChevronDown
            aria-hidden
            className={`h-3.5 w-3.5 shrink-0 text-soft transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>
        {canStar && (
          <button
            type="button"
            disabled={starred || busy}
            onClick={onStar}
            aria-label={
              starred ? `${t} is on your watchlist` : `Add ${t} to your watchlist`
            }
            className="f0-focus f0-press absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5"
          >
            <Star
              aria-hidden
              className={`h-4 w-4 ${
                starred
                  ? "fill-current text-gold-700"
                  : "text-soft transition-colors hover:text-gold-700"
              }`}
            />
          </button>
        )}
      </div>

      {/* ── THE EXPANDED DETAIL — same height discipline as the explainer
          disclosure above; content mounts only while open, so the chart's
          bars fetch fires on first expand and never for a closed row. */}
      <AnimatePresence initial={false}>
        {expanded && (
          <m.div
            key="detail"
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-sand px-[13px] pb-[13px] pt-3">
              <DetailChart symbol={r.ticker} />

              {/* Stat strip — every figure MONO, and only the metrics the row
                  really carries; nothing is defaulted into existence. */}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {r.price != null && (
                  <DetailStat label="Price" value={fmtPrice(r.price)} />
                )}
                {r.chg_1d != null && (
                  <DetailStat label="1d" value={fmtPct(r.chg_1d)} tone={pctTone(r.chg_1d)} />
                )}
                {r.mcap != null && (
                  <DetailStat label="Mkt cap" value={fmtMcap(r.mcap)} />
                )}
                {r.chg_1m != null && (
                  <DetailStat label="1m" value={fmtPct(r.chg_1m)} tone={pctTone(r.chg_1m)} />
                )}
                {r.chg_3m != null && (
                  <DetailStat label="3m" value={fmtPct(r.chg_3m)} tone={pctTone(r.chg_3m)} />
                )}
                {r.vol_ratio != null && (
                  <DetailStat label="Rel vol" value={fmtRatio(r.vol_ratio)} />
                )}
                {r.rsi14 != null && (
                  <DetailStat label="RSI" value={fmtRsi(r.rsi14)} />
                )}
              </div>

              {/* The Club's read — drawn only when the ledger carries one. */}
              {bullPct != null && (
                <p className="mt-3 flex items-center gap-1.5 text-[11.5px] font-semibold text-sentiment">
                  <span
                    aria-hidden
                    className="h-[5px] w-[5px] shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--sentiment-fill)" }}
                  />
                  {bullPct}% Bullish
                </p>
              )}

              {/* ── ACTION ROW — the terminal's pill vocabulary ─────────────
                  + Watchlist is the star's own family_watchlist write; Ask Kai
                  opens the contextual sheet (members only — free gets no
                  pill); Set alert keeps research's kid/teen gate; Open
                  research carries the deep link the row used to be. */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                {canStar && (
                  <button
                    type="button"
                    disabled={starred || busy}
                    onClick={onStar}
                    className={`f0-focus f0-press inline-flex items-center gap-1.5 rounded-full border px-[11px] py-[6px] text-[11.5px] font-semibold transition-colors ${
                      starred
                        ? "border-accent/60 bg-accent/12 text-gold-700"
                        : "border-sand bg-midnight-800 text-ink hover:border-accent"
                    } disabled:cursor-default`}
                  >
                    <Star
                      aria-hidden
                      className={`h-3.5 w-3.5 ${
                        starred ? "fill-current text-gold-700" : "text-soft"
                      }`}
                    />
                    {starred ? "On watchlist" : busy ? "Adding…" : "+ Watchlist"}
                  </button>
                )}
                {showKai && (
                  <button
                    type="button"
                    onClick={onAskKai}
                    className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full border border-sand bg-midnight-800 px-[11px] py-[6px] text-[11.5px] font-semibold text-ink transition-colors hover:border-[color-mix(in_srgb,var(--kai-blue)_55%,var(--sand))]"
                  >
                    <Sparkles
                      aria-hidden
                      className="h-3.5 w-3.5 text-kai-600 dark:text-kai-300"
                    />
                    Ask Kai
                  </button>
                )}
                {canAlert && (
                  <SetAlertButton
                    ticker={r.ticker}
                    surface="screener"
                    seedPrice={r.price ?? null}
                    variant="chip"
                    stopPropagation={false}
                  />
                )}
                <Link
                  href={researchHref(r.ticker)}
                  className="f0-focus ml-auto inline-flex items-center gap-1 rounded text-[11.5px] font-bold text-gold-700"
                >
                  Open research
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One stat in the expanded strip: soft mono caps label over a mono figure. */
function DetailStat({
  label,
  value,
  tone = "text-ink",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <span className="flex flex-col gap-[3px]">
      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-soft">
        {label}
      </span>
      <span className={`font-mono text-[12.5px] font-semibold tabular-nums ${tone}`}>
        {value}
      </span>
    </span>
  );
}

/* ── the expanded row's chart ──────────────────────────────────────────────
   ClubStockHead's daily-window vocabulary, copied not imported: an area/line
   over REAL one-month closes from /api/market/bars, dotted grid horizontals,
   a right-hand price rail of four mono values, first/last session stamps.
   The fetch fires on expand only (the panel mounts its content lazily) and is
   deduplicated through a module promise cache, so re-opening a row — or the
   same ticker on another page — never refetches. NO BARS → NO CHART: the
   empty answer is a stated mono line, never a fabricated curve. */
const monthBarCache = new Map<string, Promise<MarketBar[]>>();

function loadMonthBars(symbol: string): Promise<MarketBar[]> {
  const key = symbol.toUpperCase();
  let p = monthBarCache.get(key);
  if (!p) {
    p = fetchBars(key, "1m").catch(() => []);
    monthBarCache.set(key, p);
  }
  return p;
}

function DetailChart({ symbol }: { symbol: string }) {
  const gid = `scr-${useId().replace(/:/g, "")}`;
  // null = still loading; [] = the feed had nothing for this window.
  const [bars, setBars] = useState<MarketBar[] | null>(null);

  useEffect(() => {
    let live = true;
    loadMonthBars(symbol).then((b) => {
      if (live) setBars(b);
    });
    return () => {
      live = false;
    };
  }, [symbol]);

  if (bars === null) {
    return (
      <div className="h-[140px] rounded-[12px] bg-midnight-800 motion-safe:animate-pulse">
        <span className="sr-only">Loading the price series</span>
      </div>
    );
  }
  if (bars.length < 2) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        No price series for this window
      </p>
    );
  }

  const W = 332;
  const H = 132;
  const padY = 8;
  const closes = bars.map((b) => b.c);
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const span = hi - lo || 1;
  const y = (v: number) => padY + (H - padY * 2) * (1 - (v - lo) / span);
  const n = bars.length;
  const step = W / n;

  const up = closes[closes.length - 1] >= closes[0];
  const stroke = up ? "var(--color-price-up)" : "var(--color-price-down)";

  const linePts = bars
    .map((b, i) => `${(i * step + step / 2).toFixed(1)},${y(b.c).toFixed(1)}`)
    .join(" ");
  const area = `${(step / 2).toFixed(1)},${H} ${linePts} ${(W - step / 2).toFixed(1)},${H}`;

  // The right-hand rail — four values off the drawn range, as the mockup rails.
  const axis = [hi, lo + (span * 2) / 3, lo + span / 3, lo];
  const stamp = (t: number) =>
    new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <>
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-[132px] w-full"
            role="img"
            aria-label={`${symbol.toUpperCase()} one-month price trend`}
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

            {/* the wash under the closes, then the line itself */}
            <polygon points={area} fill={`url(#${gid})`} />
            <polyline
              points={linePts}
              fill="none"
              stroke={stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
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
        <span>{stamp(bars[0].t)}</span>
        <span>{stamp(bars[n - 1].t)}</span>
      </div>
    </>
  );
}
/* ============================================================================
 * THE FILTER SHEET — there is no filter-panel phone on the board, so this is
 * the screener designed AS IF it were one: the full filter set in a BOTTOM
 * SHEET on phones (the MobileTabBar More-sheet pattern, copied — backdrop,
 * grabber, drag-to-dismiss) and a right-hand SIDE PANEL on desktop, grouped
 * and roomy in the board's pill/well vocabulary. Every control writes
 * CustomFilters LIVE — there is no Apply and never was — and the footer CTA
 * states the live match count on its way out.
 *
 * Every filter that existed still exists and still writes the SAME key on
 * CustomFilters, so the presets, the accent active-filter chips and the
 * plain-English parser (src/lib/screener-nl.ts) all keep working untouched —
 * a screen built here and a screen parsed from a sentence stay identical.
 * Tiers: Academy technical filters stay FTA-only; kids never see the upsell.
 * ==========================================================================*/
const MCAP_STEPS: { label: string; value: number }[] = [
  { label: "$50M+", value: 50_000_000 },
  { label: "$300M+", value: 300_000_000 },
  { label: "$2B+", value: 2_000_000_000 },
  { label: "$10B+", value: 10_000_000_000 },
  { label: "$50B+", value: 50_000_000_000 },
];

/** The four "minimum move" windows — inline mono fields. */
const MOVE_FIELDS: { key: "minChg1d" | "minChg5d" | "minChg1m" | "minChg3m"; label: string }[] = [
  { key: "minChg1d", label: "1d" },
  { key: "minChg5d", label: "5d" },
  { key: "minChg1m", label: "1m" },
  { key: "minChg3m", label: "3m" },
];

/** The moving-average trend, as pills — one per state the data feed knows. */
const EMA_OPTIONS: { value: NonNullable<CustomFilters["emaTrend"]>; label: string }[] = [
  { value: "above20", label: "Above 20-day average" },
  { value: "below20", label: "Below 20-day average" },
  { value: "above50", label: "Above 50-day average" },
  { value: "below50", label: "Below 50-day average" },
  { value: "above2050", label: "Above both averages" },
];

/** Which chrome the sheet wears — bottom sheet under md, side panel above.
 *  Resolved from the same 768px line Tailwind's `md:` uses, synced live. */
function useIsDesktop(): boolean {
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesk(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desk;
}

function FilterSheet({
  open,
  onClose,
  matchCount,
  hasActive,
  onClearAll,
  isFTA,
  isKid,
  exchanges,
  value,
  patch,
}: {
  open: boolean;
  onClose: () => void;
  matchCount: number;
  hasActive: boolean;
  onClearAll: () => void;
  isFTA: boolean;
  isKid: boolean;
  exchanges: string[];
  value: CustomFilters;
  patch: (p: Partial<CustomFilters>) => void;
}) {
  const desktop = useIsDesktop();
  const selectedSector = (value.sector as Sector | null) ?? null;
  const subsectorOptions = selectedSector ? SUBSECTORS[selectedSector] : [];

  // Lock background scroll while the sheet is open (More-sheet discipline).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function onSheetDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 90 || info.velocity.y > 600) onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="filter-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-stretch md:justify-end"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Screener filters"
            initial={desktop ? { x: "100%" } : { y: "100%" }}
            animate={desktop ? { x: 0 } : { y: 0 }}
            exit={desktop ? { x: "100%" } : { y: "100%" }}
            transition={{ type: "tween", duration: 0.22 }}
            drag={desktop ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={desktop ? undefined : onSheetDragEnd}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-sand bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.35)] md:h-full md:max-h-none md:w-[400px] md:rounded-none md:border-l md:border-t-0"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Grabber (phones) */}
            <div className="flex shrink-0 justify-center pb-1 pt-2.5 md:hidden">
              <span className="h-1.5 w-10 rounded-full bg-midnight-800" />
            </div>

            {/* Head — the terminal's white-caps register + close */}
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-2 md:pt-5">
              <SectionLabel>Filters</SectionLabel>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close filters"
                className="f0-focus rounded-full p-1 text-soft transition-colors hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* The groups — roomy, the board's pill/well vocabulary. Rhythm
                stays uneven: 10px label→chips, 22px between groups. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              <FilterGroup label="Universe">
                <PillSelect
                  ariaLabel="Exchange"
                  live={!!value.exchange}
                  value={value.exchange ?? ""}
                  onChange={(v) => patch({ exchange: v || null })}
                >
                  <option value="">Any exchange</option>
                  {exchanges.map((e) => (
                    <option key={e} value={e}>
                      {formatExchange(e)}
                    </option>
                  ))}
                </PillSelect>
                <PillSelect
                  ariaLabel="Sector"
                  live={!!value.sector}
                  value={value.sector ?? ""}
                  /* Changing the sector clears any subsector under the old one. */
                  onChange={(v) => patch({ sector: v || null, subsector: null })}
                >
                  <option value="">Any sector</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </PillSelect>
                <PillSelect
                  ariaLabel="Subsector"
                  live={!!value.subsector}
                  value={value.subsector ?? ""}
                  onChange={(v) => patch({ subsector: v || null })}
                  disabled={!selectedSector}
                >
                  {/* The disabled chip says why it's asleep. */}
                  <option value="">
                    {selectedSector ? "Any subsector" : "Pick a sector first"}
                  </option>
                  {subsectorOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </PillSelect>
                <Chip active={!value.type} onClick={() => patch({ type: null })}>
                  Stocks + ETFs
                </Chip>
                <Chip
                  active={value.type === "common"}
                  onClick={() => patch({ type: "common" })}
                >
                  Common stocks
                </Chip>
                <Chip active={value.type === "etf"} onClick={() => patch({ type: "etf" })}>
                  ETFs
                </Chip>
              </FilterGroup>

              <FilterGroup label="Size">
                <Chip active={value.minMcap == null} onClick={() => patch({ minMcap: null })}>
                  Any size
                </Chip>
                {MCAP_STEPS.map((s) => (
                  <Chip
                    key={s.label}
                    mono
                    active={value.minMcap === s.value}
                    onClick={() => patch({ minMcap: s.value })}
                  >
                    {s.label}
                  </Chip>
                ))}
              </FilterGroup>

              <FilterGroup label="Price + movement">
                <WellNum
                  ariaLabel="Minimum price"
                  prefix="$"
                  value={value.minPrice}
                  onChange={(v) => patch({ minPrice: v })}
                />
                <span className="text-[11px] text-soft">to</span>
                <WellNum
                  ariaLabel="Maximum price"
                  prefix="$"
                  value={value.maxPrice}
                  onChange={(v) => patch({ maxPrice: v })}
                />
                {MOVE_FIELDS.map((f) => (
                  <WellNum
                    key={f.key}
                    ariaLabel={`Minimum ${f.label} move percent`}
                    prefix={f.label}
                    suffix="%"
                    width="w-12"
                    value={value[f.key]}
                    onChange={(v) => patch({ [f.key]: v } as Partial<CustomFilters>)}
                  />
                ))}
                <WellNum
                  ariaLabel="Minimum relative volume"
                  prefix="vol ≥"
                  suffix="×"
                  value={value.minVolRatio}
                  onChange={(v) => patch({ minVolRatio: v })}
                />
              </FilterGroup>

              {isFTA ? (
                <FilterGroup label="Academy">
                  <WellNum
                    ariaLabel="RSI at or below"
                    prefix="rsi ≤"
                    width="w-10"
                    value={value.rsiMax}
                    onChange={(v) => patch({ rsiMax: v })}
                  />
                  <WellNum
                    ariaLabel="RSI at or above"
                    prefix="rsi ≥"
                    width="w-10"
                    value={value.rsiMin}
                    onChange={(v) => patch({ rsiMin: v })}
                  />
                  <WellNum
                    ariaLabel="Gap up at or above percent"
                    prefix="gap up ≥"
                    suffix="%"
                    width="w-12"
                    value={value.minGap}
                    onChange={(v) => patch({ minGap: v })}
                  />
                  <WellNum
                    ariaLabel="Gap down at or below percent"
                    prefix="gap down ≤"
                    suffix="%"
                    width="w-12"
                    value={value.maxGap}
                    onChange={(v) => patch({ maxGap: v })}
                  />
                  <Chip active={!value.emaTrend} onClick={() => patch({ emaTrend: null })}>
                    Any trend
                  </Chip>
                  {EMA_OPTIONS.map((o) => (
                    <Chip
                      key={o.value}
                      active={value.emaTrend === o.value}
                      onClick={() => patch({ emaTrend: o.value })}
                    >
                      {o.label}
                    </Chip>
                  ))}
                  <Chip
                    active={!!value.nearHigh}
                    onClick={() => patch({ nearHigh: value.nearHigh ? null : true })}
                  >
                    Near 52w high
                  </Chip>
                  <Chip
                    active={!!value.nearLow}
                    onClick={() => patch({ nearLow: value.nearLow ? null : true })}
                  >
                    Near 52w low
                  </Chip>
                </FilterGroup>
              ) : (
                !isKid && (
                  <div className="mt-[22px] flex items-start gap-2 text-[12.5px] leading-snug text-soft">
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

            {/* Footer — the one solid-accent CTA states the LIVE count (every
                control above already applied itself), plus the quiet reset. */}
            <div className="flex shrink-0 items-center gap-3 border-t border-sand px-5 py-3.5">
              <button
                type="button"
                onClick={onClose}
                className="f0-focus f0-press flex-1 rounded-full bg-accent px-4 py-2.5 text-[13px] font-bold text-night-950"
              >
                Show {matchCount.toLocaleString()}{" "}
                {matchCount === 1 ? "match" : "matches"}
              </button>
              {hasActive && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="f0-focus rounded text-[11.5px] font-semibold text-soft underline hover:text-ink"
                >
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** One filter group inside the sheet: white-caps label, then a roomy wrap of
 *  the board's pills and wells. 10px label→chips, 22px between groups. */
function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="mt-[22px] first:mt-1">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
        {label}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
/* ── Pill-triggered choice ─────────────────────────────────────────────────
   The long lists (exchange / sector / subsector) as a pill-wrapped native
   select: the closed state reads as one more pill in the flow — quiet --m800
   well while "Any", the accent-tinted pill once a choice is live — and
   tapping it opens the platform's own popover/sheet for free. */
function PillSelect({
  value,
  onChange,
  children,
  live,
  disabled = false,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  live: boolean;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <span
      className={`relative inline-flex max-w-full shrink-0 items-center rounded-full border transition-colors focus-within:border-accent ${
        live
          ? "border-accent/60 bg-accent/12"
          : "border-sand bg-midnight-800"
      } ${disabled ? "opacity-45" : ""}`}
    >
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`f0-focus max-w-[13rem] cursor-pointer appearance-none truncate rounded-full bg-transparent py-[6px] pl-3 pr-7 text-[11.5px] font-semibold outline-none disabled:cursor-not-allowed ${
          live ? "text-gold-700" : "text-soft"
        }`}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 h-3 w-3 text-soft"
      />
    </span>
  );
}

/* ── Mono pill-well ────────────────────────────────────────────────────────
   Every screener threshold is a market number, so it renders as a compact
   MONO pill-well in the chip flow: a rounded-full --m800 well, the mono
   soft-caps affix carrying the filter's identity and unit ($, the window,
   VOL ≥, RSI ≤) so the field itself stays a bare tabular number, and an
   unset filter shows the honest em-dash placeholder. Focus warms the
   hairline to accent, same as every pill around it. */
function WellNum({
  value,
  onChange,
  prefix,
  suffix,
  width = "w-14",
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
    <label className="inline-flex shrink-0 items-baseline gap-1.5 rounded-full border border-sand bg-midnight-800 px-3 py-[6px] transition-colors focus-within:border-accent">
      {prefix && (
        <span
          aria-hidden
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-soft"
        >
          {prefix}
        </span>
      )}
      <input
        type="number"
        aria-label={ariaLabel}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder="—"
        className={`${width} bg-transparent text-right font-mono text-[12.5px] font-semibold tabular-nums text-ink outline-none placeholder:text-soft/60`}
      />
      {suffix && (
        <span
          aria-hidden
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-soft"
        >
          {suffix}
        </span>
      )}
    </label>
  );
}

/* A selection toggle — the law's raised-well pill, same tokens and register
   as WellChip above: a quiet --m800 well at rest (light sand on the family
   paper, a raised cool well on the club terminal), the accent-tinted pill
   when live. `mono` puts a NUMERIC label ($50M+) in the data face; word
   labels stay in the body face — mono is for values, never for words. */
function Chip({
  active,
  onClick,
  mono = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`f0-press f0-focus inline-flex shrink-0 items-center rounded-full border px-3 py-[6px] transition-colors ${
        mono
          ? "font-mono text-[11px] font-bold tabular-nums"
          : "text-[11.5px] font-semibold"
      } ${
        active
          ? "border-accent/60 bg-accent/12 text-gold-700"
          : "border-sand bg-midnight-800 text-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ============================================================================
 * SAVE SCREEN — with a real table behind it.
 *
 * Closed it is one orange pill on the results header. Open it becomes a ruled
 * name field and a commit — no dialog, no modal: the control expands in place
 * the way every other disclosure on this surface does.
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
    // The primary CTA of the results line — the law's solid orange pill.
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-[6px] text-[11px] font-bold text-night-950"
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
          className="w-44 rounded-[10px] border border-sand bg-midnight-800 px-3 py-[7px] font-display text-[13px] font-semibold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-soft/70 focus:border-accent"
        />
      </label>
      <button
        type="button"
        onClick={onSave}
        disabled={!name.trim() || saving}
        className="f0-focus f0-press rounded-full bg-accent px-3 py-[5px] text-[11px] font-bold text-night-950 disabled:opacity-40"
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
      {/* Sentences read in the body face; only the COUNT is mono. */}
      {error ? (
        <span className="w-full text-[11.5px] leading-snug text-soft">{error}</span>
      ) : (
        <span className="w-full text-[11.5px] text-soft/80">
          <span className="font-mono text-[11px] font-semibold tabular-nums">
            {count} of {SAVED_SCREEN_LIMIT}
          </span>{" "}
          saved · reusing a name replaces it
        </span>
      )}
    </span>
  );
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
 * SCREENER SKELETON — the route's own furniture, not a generic list skeleton.
 *
 * The finished page furniture with only the parts that genuinely depend on
 * data left blank: the masthead and headline are real type, the ask bar and
 * chip row hold their geometry, and the bones trace the board's result-row
 * anatomy (40px round logo · two-line identity · ticker/price baseline ·
 * sparkline slot) so the universe fetch resolves without a layout swap.
 *
 * Exported so the route shell (app/(dashboard)/screener/loading.tsx) renders
 * the identical thing and navigation does not shift.
 * ==========================================================================*/
export function ScreenerSkeleton({ embedded = false }: { embedded?: boolean }) {
  return (
    <div
      className={embedded ? "" : "mx-auto max-w-3xl px-4 pb-24 sm:px-6"}
      aria-busy="true"
    >
      {!embedded && (
        <>
          <span className="font-display text-[13px] font-bold uppercase tracking-[0.24em] text-ink">
            Discover
          </span>
          <h1 className="mt-3 font-display text-[24px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
            Screen the whole market
          </h1>
          <Bone w={220} h={8} className="mt-2" />
          <div className="mt-5 flex items-end gap-5 border-b border-sand pb-2.5">
            <Bone w={52} h={10} />
            <Bone w={62} h={10} />
            <Bone w={58} h={10} />
          </div>
        </>
      )}

      {/* Ask bar + chip row — real geometry, empty of data. */}
      <div className={embedded ? "" : "mt-5"}>
        <div className="rounded-[16px] border border-sand bg-card px-[15px] py-[13px]">
          <Bone w="60%" h={12} />
        </div>
        <div className="mt-3 flex gap-[7px]">
          {[76, 88, 64, 96].map((w, i) => (
            <Bone key={i} w={w} h={28} className="!rounded-full" />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-[16px] border border-sand bg-card p-[13px]"
            >
              <Bone w={40} h={40} className="!rounded-full" />
              <span className="min-w-0 flex-1">
                <Bone w={130} h={11} />
                <Bone w={90} h={9} className="mt-2" />
              </span>
              <span>
                <Bone w={76} h={11} className="ml-auto" />
                <Bone w={76} h={9} className="ml-auto mt-2" />
              </span>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading the market universe</span>
    </div>
  );
}
