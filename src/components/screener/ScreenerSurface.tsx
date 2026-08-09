"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Bone, BoardCard, FoundingLine } from "@/components/discover/board";
import { sparkPath } from "@/components/clubhome/MarketPulse";
import type { TrendingResponse, TrendingRow } from "@/lib/clubhome/contract";
import { createClient } from "@/lib/supabase/client";
import { parseScreenerQuery } from "@/lib/screener-nl";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { fetchQuote } from "@/lib/market/client";
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
   The terminal anatomy hangs a REAL line sparkline off every ticker row, drawn
   by the shared bars-fetch pattern (clubhome/MarketPulse's exported sparkPath,
   fed by the same GET /api/market/bars?range=1m read its useBarSeries makes —
   real daily closes, never a reconstruction). One adaptation for a 100-row
   page: the fetch is deferred until the row scrolls into view and deduplicated
   through a module promise cache, so opening the screener is never a hundred
   simultaneous network calls (the same discipline discover/board's TickerSpark
   documents for its own row strips). Month drift colors the CURVE; the day
   move colors the % beside it — the two may disagree, and that's correct.
   No bars → no line; the slot holds its height so rows never reflow. */
const rowBarCache = new Map<string, Promise<number[]>>();

function rowCloses(symbol: string): Promise<number[]> {
  const key = symbol.toUpperCase();
  let p = rowBarCache.get(key);
  if (!p) {
    p = fetch(`/api/market/bars?symbol=${encodeURIComponent(key)}&range=1m`, {
      headers: { accept: "application/json" },
    })
      .then((res) =>
        res.ok ? (res.json() as Promise<{ bars?: { t: number; c: number }[] }>) : null
      )
      .then((json) =>
        (json?.bars ?? []).map((b) => b.c).filter((c) => Number.isFinite(c))
      )
      .catch(() => []);
    rowBarCache.set(key, p);
  }
  return p;
}

function RowSpark({ symbol }: { symbol: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const [closes, setCloses] = useState<number[] | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      // No observer (old browsers, jsdom): load anyway, from a callback so a
      // synchronous setState never cascades a render on every mount.
      const id = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    let live = true;
    rowCloses(symbol).then((c) => {
      if (live && c.length >= 2) setCloses(c);
    });
    return () => {
      live = false;
    };
  }, [seen, symbol]);

  const path = closes ? sparkPath(closes) : null;
  const net = closes ? closes[closes.length - 1] - closes[0] : 0;
  const stroke =
    net > 0 ? "var(--price-up)" : net < 0 ? "var(--price-down)" : "var(--soft)";
  return (
    <span ref={host} aria-hidden className="block h-[20px] w-full">
      {path && (
        <svg
          viewBox="0 0 90 24"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <path
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </span>
  );
}

/* ---------- terminal primitives (style law — semantic tokens only) ----------
   Section labels are WHITE BOLD CAPS ~13px on the ink token (charcoal on the
   family paper, white on the club terminal — same class, no branch). Choice
   chips are RAISED WELLS on --m800 (a light-sand well on family/club-light, a
   raised cool well on club-dark); the active one takes the brand-accent pill.
   Tabs underline in Kai's violet. Nothing here hardcodes a surface hex, so
   family-light stays coherent without a mode branch. */
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
 * ScreenerSurface — the full-universe stock screener, restyled to the ratified
 * CLUB TERMINAL STYLE law (.planning/CLUB-TERMINAL-STYLE.md). It is SHARED by
 * the club Discover Screens tab, the standalone /screener route and every
 * family placement, so the whole restyle is SEMANTIC TOKENS ONLY — the same
 * classes render the dark terminal in club-dark and stay coherent on the
 * family/club-light paper; there is no mode branch anywhere in this file.
 *
 * THE ANATOMY, TOP TO BOTTOM:
 *   masthead        "DISCOVER" caps wordmark · Sora headline · mono coverage
 *                   line (the screener is filed as a TAB of Discover)
 *   tabs            For you · Screener · Trending — violet (--kai-blue) 2px
 *                   underline on the live tab
 *   search / NL     rounded 14px cards, 15px interior padding; the plain-
 *                   English field wears Kai's violet hairline
 *   chips           every one-of-N choice is a RAISED WELL (--m800) chip;
 *                   the live one takes the brand-accent pill
 *   results header  "14 MATCHES · SORTED BY CLUB SIGNAL" in mono caps, with
 *                   "Save screen" as the solid orange pill CTA
 *   results         quiet rounded ticker rows: 32px logo tile · bold Sora
 *                   ticker · real-closes line sparkline · mono price ·
 *                   green/red day move · signal chip
 *   conviction      two cards side by side — "Club's most bullish" on a
 *                   sentiment hairline, "most bearish" on the plain one
 *   trending        "TRENDING IN THE CLUB" — a wrap of raised-well chips
 *
 * `embedded` renders it as the Screens tab inside Discover, so the masthead,
 * the tab row and the two tail blocks are dropped — the host already carries
 * all three. The data, filters, full-universe load, saved screens and
 * free-tier gating are identical in both placements.
 *
 * `nlSeed` / `seedScreenId` — the CLUB-mode Discover composition (CheatCodeDoors
 * redesign) owns the "Plain English in" query bar and the Saved-screens tab, so
 * it hands the query / the chosen screen down here rather than duplicating the
 * screener. Both are optional and INERT when absent — every family/kid placement
 * passes neither, so nothing changes for them — and both run through the same
 * deterministic parse / apply paths the in-surface controls use.
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

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [tierResolved, setTierResolved] = useState(false);
  const [isKid, setIsKid] = useState(false);
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

    /* ── HOW MUCH UNIVERSE TO PULL, AND HOW ──────────────────────────────
       WHAT WAS BROKEN. This used to compute `pages` from the row count (~11,500
       → 12 pages) and fire EVERY page at once inside one `Promise.all`. Each of
       those is a 1,000-row, 22-column read that the planner answers with a seq
       scan and an ON-DISK merge sort (~270ms of server time each, verified on
       the production table), so a single visit asked Postgres for a dozen
       simultaneous disk sorts. Predictably some of them died on the statement
       timeout — 57014, on `offset=3000` and `offset=7000` every load — and the
       result was DISCARDED IN SILENCE by `if (r.data)`. The member was left
       with whichever pages survived, roughly 4,000 rows, while the results
       header said "4,000 MATCHES" as though that were the market.

       WHAT HAPPENS NOW. Pages are fetched ONE AT A TIME, so the database is
       never asked for more than one sort at once, and only up to
       AUTO_UNIVERSE_ROWS of them load on their own. That window is the whole of
       what any default view can show (sorted by market cap, the visible table
       never reaches past it) and it covers every company a member is likely to
       screen for. The rest of the tail loads when it is asked for — see
       `loadMoreUniverse` — and until it does the surface SAYS SO next to the
       match count. A page that fails now sets `universeError` and stops;
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
          wears Discover's terminal head — caps wordmark, Sora headline, mono
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
        {/* Search — one rounded terminal card, proper interior padding */}
        <BoardCard
          radius={14}
          className="flex items-center gap-2.5 px-[15px] py-[11px]"
        >
          <Search className="h-4 w-4 shrink-0 text-soft" aria-hidden />
          <input
            value={custom.q ?? ""}
            onChange={(e) => setCustom((c) => ({ ...c, q: e.target.value || null }))}
            placeholder="Search by ticker or company name…"
            aria-label="Search the universe"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-soft/80"
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
            The surface's one AI affordance, so it wears Kai's violet — the
            same card-with-a-kai-hairline anatomy as Discover's KAI
            INTERPRETATION card. The parse is deterministic
            (src/lib/screener-nl.ts): it only ever produces filters the panel
            below can also produce, so a parsed screen and a hand-built one
            are indistinguishable. Nothing recognised → honest keyword
            fallback. */}
        <BoardCard
          radius={14}
          className="mt-2.5 px-[15px] py-[13px]"
          style={{
            borderColor: "color-mix(in srgb, var(--kai-blue) 40%, var(--sand))",
          }}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-kai-600 dark:text-kai-300">
            <Sparkles className="h-3 w-3" />
            Screen in plain English
          </div>
          <div className="relative mt-1.5">
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
              className="w-full bg-transparent py-1 pr-10 text-[13px] text-ink outline-none placeholder:text-soft/80"
            />
            <button
              onClick={() => runNL(nlInput)}
              disabled={!nlInput.trim()}
              aria-label="Run plain-English screen"
              className="f0-focus f0-press absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center rounded-full px-2 py-1.5 text-white transition disabled:opacity-40"
              style={{ backgroundColor: "var(--kai-blue)" }}
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
            </button>
          </div>
          {nlNote && (
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
              {nlNote}
            </p>
          )}
        </BoardCard>

        {/* ── Quick start — preset chips as raised wells ────────────────────
            Every one-of-N choice on this surface is a chip in a raised dark
            well; the live one takes the accent pill, and re-selecting it
            clears it. */}
        <div className="mt-6">
          <SectionLabel>Quick start</SectionLabel>
          <ScrollRow className="-m-1 mt-2 flex gap-[7px] p-1">
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

        {/* ── Your screens (board 15 · "Save screen") ───────────────────────
            Real persistence, not a UI gesture: every chip here is a row in
            screener_saved_screens. Rendered only once the read has landed —
            `saved === null` is "not read yet", which must never take the
            founding branch. */}
        {saved !== null && saved.length > 0 && (
          <div className="mt-6">
            <SectionLabel>Your screens</SectionLabel>
            <ScrollRow className="-m-1 mt-2 flex gap-[7px] p-1">
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

        {/* Filter panel — a carded disclosure. White-caps label, 15px interior
            padding, hairline-ruled ledger inside (never cards-in-cards). */}
        <BoardCard radius={16} className="mt-6 overflow-hidden">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="f0-focus flex w-full items-center justify-between gap-2 px-[15px] py-3 text-left"
          >
            <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
              <SlidersHorizontal className="h-4 w-4 text-soft" />
              Filters
              {chips.length > 0 && (
                <span className="font-mono text-[11px] font-bold tabular-nums text-gold-700">
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
                <div className="border-t border-sand px-[15px]">
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

        {/* Active filter chips — one accent pill per live filter ("Tech ✕"),
            with a quiet raised-well "+ Filter" that opens the panel above. */}
        <div className="mt-3">
          <div className="club2-track -m-1 flex flex-wrap items-center gap-[7px] p-1">
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
            <WellChip
              as="button"
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="f0-focus f0-press"
            >
              + Filter
            </WellChip>
            {chips.length > 0 && (
              <button
                onClick={clearAll}
                className="f0-focus ml-1 rounded text-[10.5px] font-semibold text-soft underline hover:text-ink"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

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
                — and the line above says so. */}
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
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
              className="f0-focus inline-flex items-center gap-1 rounded font-mono text-[10px] uppercase tracking-[0.14em] text-soft hover:text-ink"
            >
              <Info className="h-3.5 w-3.5" />
              How to use this
            </button>
          </div>
        </div>

        {/* ── WHAT WAS ACTUALLY SCREENED ───────────────────────────────────
            The universe used to fail in silence: deep pages timed out, their
            results were dropped, and nothing on the surface admitted it. Both
            states are now stated — a partial window with the way to complete
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
            so the default sort would silently degrade to an arbitrary order
            with a column of dashes beside it. Say so, and hand over the one-tap
            fix. Distinct from loading: the universe has already landed by the
            time this can render. */}
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

        {/* ── Results — the established ticker-row anatomy, at every
            breakpoint: real logo tile · bold Sora ticker · line sparkline
            (real 1m closes; month drift colors the curve) · mono price ·
            green/red day move · signal chip. The extra readings the terminal
            keeps (1m/3m/vol/cap/RSI) sit as mono type on a second line inside
            the same row, with the row's actions — never ruled cells. */}
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
            <div className="mt-3 flex flex-col gap-2">
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
              <div className="mt-4 flex items-center justify-center gap-4">
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
 * SCREENER SKELETON — the route's own furniture, not a generic list skeleton.
 *
 * The finished page furniture with only the parts that genuinely depend on
 * data left blank: the masthead and headline are real type, the tab rule sits
 * where the real tabs land, and the bones trace the ticker-row anatomy (logo
 * tile · two-line identity · sparkline slot · price stack) so the universe
 * fetch resolves without a layout swap.
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

      {/* Search + Kai field + chips — real geometry, empty of data. */}
      <div className={embedded ? "" : "mt-5"}>
        <BoardCard radius={14} className="px-[15px] py-[13px]">
          <Bone w="60%" h={12} />
        </BoardCard>
        <BoardCard radius={14} className="mt-2.5 space-y-2 px-[15px] py-[13px]">
          <Bone w={150} h={8} />
          <Bone w="70%" h={12} />
        </BoardCard>
        <div className="mt-6 flex gap-[7px]">
          {[72, 88, 64, 96].map((w, i) => (
            <Bone key={i} w={w} h={28} className="!rounded-full" />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <BoardCard key={i} radius={14} className="px-3.5 py-3">
              <div className="flex items-center gap-3">
                <Bone w={32} h={32} className="!rounded-[9px]" />
                <span className="min-w-0 flex-1">
                  <Bone w={48} h={10} />
                  <Bone w={92} h={8} className="mt-1.5" />
                </span>
                <Bone w={64} h={12} className="hidden sm:block" />
                <span>
                  <Bone w={54} h={10} className="ml-auto" />
                  <Bone w={38} h={8} className="ml-auto mt-1.5" />
                </span>
              </div>
              <div className="mt-2.5 pl-[44px]">
                <Bone w="55%" h={8} />
              </div>
            </BoardCard>
          ))}
        </div>
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
          className="w-40 border-b border-sand bg-transparent py-1 font-display text-[13px] font-semibold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-soft/70 hover:border-gold-400 focus:border-accent"
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
 * RESULT ROW — one match, one quiet rounded row in the established ticker-row
 * anatomy (the same object MarketPulse / the watchlist movers draw):
 *
 *   [32px logo] TICKER (Sora bold)   [1m line sparkline]   $173.42   [78]
 *               Company name (soft)                         +4.7%
 *
 * The sparkline is REAL daily closes off /api/market/bars (see RowSpark); the
 * month's drift colors the curve while the day move colors the % — the two may
 * disagree, which is correct. The readings the terminal keeps beyond the
 * board's line (1m/3m/vol/cap/RSI) and the row's actions sit as mono type on a
 * second line inside the same row, so nothing the screener could do is lost.
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
      radius={14}
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
      className="f0-focus group cursor-pointer px-3.5 py-3 transition-colors hover:border-accent"
    >
      {/* the identity line */}
      <div className="flex items-center gap-3">
        <CompanyLogo symbol={r.ticker} name={r.name} size={32} rounded="rounded-[9px]" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-display text-[13.5px] font-bold leading-none text-ink">
              {r.ticker}
            </span>
            {r.type === "etf" && (
              <span className="shrink-0 font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-soft">
                ETF
              </span>
            )}
          </span>
          <span className="mt-[4px] block truncate text-[11px] leading-none text-soft">
            {r.name || "—"}
          </span>
        </span>
        {/* the line sparkline — real 1m closes, month drift colors the curve */}
        <span className="hidden w-[64px] shrink-0 sm:block">
          <RowSpark symbol={r.ticker} />
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-[13px] font-semibold leading-none tabular-nums text-ink">
            {fmtPrice(r.price)}
          </span>
          <span
            className={`mt-[4px] block font-mono text-[11px] font-semibold leading-none tabular-nums ${pctTone(r.chg_1d)}`}
          >
            {fmtPct(r.chg_1d)}
          </span>
        </span>
        <HeatChip n={r.like_count} />
      </div>

      {/* everything the identity line has no room for — mono readings */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[44px]">
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
   A white-caps section label (the terminal register — never a tiny gray mono
   mark) over a run of hairline-ruled filter rows, INSIDE the filter card. A
   rule between rows of one card is the established idiom; a card per filter
   would be cards inside cards. */
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="pt-4 first:pt-3.5">
      <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink">
        {label}
      </h3>
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

/* A selection toggle — the law's raised-well chip: a quiet --m800 well at
   rest (light sand on the family paper, a raised cool well on the club
   terminal), the accent pill when selected. Same tokens as WellChip, in the
   filter panel's mono register. */
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
      className={`f0-press f0-focus inline-flex shrink-0 items-center rounded-full border px-3 py-[6px] font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
        active
          ? "border-accent/60 bg-accent/12 text-gold-700"
          : "border-sand bg-midnight-800 text-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
