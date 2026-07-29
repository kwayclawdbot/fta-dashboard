"use client";

/**
 * TICKER RESEARCH — DESIGN v2 CANVAS (Phase 1 Lane B, boards 03/12/13/14).
 *
 * This is the v2 twin of ResearchClientV1. It renders THE SAME DATA from the
 * same hooks, endpoints and props — nothing new is fetched and nothing is
 * invented — re-organised into the canvas's four ticker subpages as cc SubTabs:
 *
 *   Overview (03)     · script header + real quote/chart + RAW SENTIMENT ring +
 *                       stance stats + Top Voices + stance control + discussion +
 *                       theses + on-the-board + about + news
 *   Technicals (12)   · the real price tape + the existing indicator battery
 *   Fundamentals (13) · the existing grades / financials, real values only
 *   Kai (14)          · the existing kai_reports surface, verdict-less (Kai issues
 *                       no directive), a COVERAGE ring (a fact about the artefact,
 *                       never a confidence figure the product doesn't publish)
 *
 * HONEST-DATA LAWS (DESIGN-UX-SPEC §6, CONVERSION-PLAN §1):
 *   • the sentiment ring is RAW SENTIMENT (bull share of positioned members),
 *     labelled as such — never a fabricated weighted signal;
 *   • options-flow / short-interest chips are omitted (no feed);
 *   • "watching now" only appears above the real floor;
 *   • no fake gauges/levels; the Kai coverage ring is a real computed field, and
 *     the confidence ring is OMITTED because kai_reports has no confidence field;
 *   • belt colours would need real belt data (the faces carry none), so Top
 *     Voices render as neutral avatars with a green/pink SIDE dot (market truth),
 *     never a belt ring guessed from nothing.
 *
 * The genuinely heavy interior data panels — the indicator battery
 * (PriceTechnicals, board 12), the grades/financials (Fundamentals, board 13),
 * the long written Kai body (KaiReportSection) and the structured social objects
 * — are CONSUMED as-is inside cc frames so ZERO functionality is lost; they are
 * shared with other routes and honest by construction. Everything the honest-data
 * laws touch (the header, the rings, the stat rows, the Kai verdict framing, the
 * discussion) is rebuilt in cc primitives.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Check,
  Eye,
  FileText,
  GraduationCap,
  Newspaper,
  Share2,
  Sparkles,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import {
  fetchQuote,
  fetchNews,
  fetchBars,
  type MarketQuote,
  type MarketBar,
  type NewsHeadline,
} from "@/lib/market/client";
import { formatExchange } from "@/lib/market/exchange";
import { fmtMcap, fmtVol } from "@/lib/screener";
import { checkClean, PROFANITY_MESSAGE } from "@/lib/profanity";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";
import type { KaiReport } from "@/lib/kai/report";
import SetAlertButton, { type AlertLevel } from "@/components/alerts/SetAlertButton";
import FundamentalsV2 from "@/components/research/FundamentalsV2";
import PriceTechnicalsV2 from "@/components/research/PriceTechnicalsV2";
import KaiReportSectionV2 from "@/components/kai/KaiReportSectionV2";
import { useKaiSheet } from "@/components/kai/KaiSheetProvider";
import ContinuePath from "@/components/learn/ContinuePath";
import {
  CompanyProfileCard,
  NewsList,
} from "@/components/research/ResearchSections";
import { fetchResearch, type ResearchPayload } from "@/lib/research/types";
import { proseName } from "@/lib/research/labels";
import { fetchClubNewsForTicker } from "@/lib/news/client";
import { KindChip } from "@/components/news/NewsCard";
import { timeAgo as newsTimeAgo, type NewsCardData } from "@/lib/news/types";
import { CONTRIBUTION_TYPES, contributionMeta, type ContributionType } from "@/lib/research/social";
import ChangedMyMind from "@/components/social/ChangedMyMind";
import FirstWinSpotlight from "@/components/first-run/FirstWinSpotlight";
import ResearchObjectCard from "@/components/social/ResearchObjectCard";
import ResearchObjectCompose from "@/components/social/ResearchObjectCompose";
import Gated from "@/components/entitlements/Gated";
import ContextualWall from "@/components/entitlements/ContextualWall";
import { fetchTickerTheses, type ResearchObjectCard as ThesisCard } from "@/lib/social/research-object";
import {
  pctSinceAdded,
  formatPct,
  pctTone,
  toParagraphs as toProse,
  COMMUNITY_DISCLAIMER,
  type CommunityEntry,
} from "@/lib/community-watchlist";
import V2Surface from "@/components/clubhome/v2/V2Surface";
import {
  Kicker,
  Card,
  Ring,
  Delta,
  StatRow,
} from "@/components/cc/ui";
import { SubTabs, ZoneChart } from "@/components/cc/interactive";
import { useClubRead, type Portrait, type ClubReadData } from "./ClubRead";
import type { ResearchClientProps } from "./ResearchClient";

/* ── the four canvas subpages ──────────────────────────────────────────────── */
type V2Tab = "overview" | "technicals" | "fundamentals" | "kai";
const V2_TABS = [
  { id: "overview" as const, label: "Overview" },
  { id: "technicals" as const, label: "Technicals" },
  { id: "fundamentals" as const, label: "Fundamentals" },
  { id: "kai" as const, label: "Kai" },
];

const SPLIT_FLOOR = 4;
const WATCHERS_FLOOR = 3;
const COMMENT_SELECT =
  "id, ticker, user_id, body, contribution_type, created_at, author:profiles(display_name, avatar_url, age_group, username)";

/* back-breadcrumb — same map/logic as v1, kept local so nothing shared changes. */
type BackTarget = { href: string; label: string };
const BACK_MAP: Record<string, BackTarget> = {
  dashboard: { href: "/dashboard", label: "Home" },
  home: { href: "/dashboard", label: "Home" },
  screener: { href: "/screener", label: "Stock Finder" },
  community: { href: "/watchlist/community", label: "Community Watchlist" },
  watchlist: { href: "/watchlist", label: "My Watchlist" },
  discover: { href: "/discover", label: "Discover" },
  news: { href: "/news", label: "Newsroom" },
  alerts: { href: "/alerts", label: "Alerts" },
  leaderboard: { href: "/leaderboard", label: "Leaderboard" },
};
const BACK_DEFAULT: BackTarget = BACK_MAP.dashboard;

function backFromReferrer(): BackTarget | null {
  try {
    const from = new URLSearchParams(window.location.search).get("from");
    if (from && BACK_MAP[from]) return BACK_MAP[from];
    if (!document.referrer) return null;
    const ref = new URL(document.referrer);
    if (ref.origin !== window.location.origin) return null;
    const p = ref.pathname;
    if (p.startsWith("/dashboard")) return BACK_MAP.dashboard;
    if (p.startsWith("/screener")) return BACK_MAP.screener;
    if (p.startsWith("/watchlist/community")) return BACK_MAP.community;
    if (p.startsWith("/watchlist")) return BACK_MAP.watchlist;
    if (p.startsWith("/discover")) return BACK_MAP.discover;
    if (p.startsWith("/news")) return BACK_MAP.news;
    if (p.startsWith("/alerts")) return BACK_MAP.alerts;
    if (p.startsWith("/leaderboard")) return BACK_MAP.leaderboard;
    if (p.startsWith("/community")) return { href: "/community", label: "Community" };
  } catch {
    /* ignore */
  }
  return null;
}

interface ThreadComment {
  id: string;
  ticker: string;
  user_id: string | null;
  body: string;
  contribution_type: string;
  created_at: string;
  author: {
    display_name: string | null;
    avatar_url: string | null;
    age_group: string | null;
    username?: string | null;
  } | null;
}

function normComment(r: unknown): ThreadComment {
  const row = r as ThreadComment & { author: ThreadComment["author"] | ThreadComment["author"][] };
  const a = row.author;
  return {
    id: row.id,
    ticker: row.ticker,
    user_id: row.user_id,
    body: row.body,
    contribution_type: row.contribution_type || "note",
    created_at: row.created_at,
    author: Array.isArray(a) ? a[0] ?? null : a,
  };
}

function researchLevels(
  price: number | null,
  keyStats: { week52Low: number | null; week52High: number | null } | null
): AlertLevel[] {
  const out: AlertLevel[] = [];
  if (keyStats?.week52High && keyStats.week52High > 0) {
    out.push({ label: "52w high", price: keyStats.week52High, op: "above" });
  }
  if (keyStats?.week52Low && keyStats.week52Low > 0) {
    out.push({ label: "52w low", price: keyStats.week52Low, op: "below" });
  }
  if (price != null && price > 0) {
    out.push({ label: "Current", price, op: "above" });
  }
  return out;
}

/** COVERAGE — the one honest source for the Kai ring (fact about the artefact,
 *  copied from KaiReportPanel; NOT a confidence figure). */
function coverage(report: KaiReport): number {
  const s = report.sections;
  const parts: boolean[] = [
    !!s.headline,
    !!s.sector_tagline,
    !!s.business_plain,
    !!s.the_numbers,
    !!s.moat,
    !!s.thesis,
    (s.risks?.length ?? 0) > 0,
    !!s.kids_explainer,
    (s.discussion_questions?.length ?? 0) > 0,
    (report.data?.bars?.length ?? 0) > 1,
    (report.data?.financials?.length ?? 0) > 1,
  ];
  return Math.round((parts.filter(Boolean).length / parts.length) * 100);
}

function money(v: number | null | undefined, dp = 2): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

interface ScreenerVolume {
  vol: number | null;
  avg_vol_20: number | null;
  mcap: number | null;
}

/* ── small cc chrome helpers (v2 tokens only) ──────────────────────────────── */

/** Brand-orange mono section mark with an optional quiet suffix + right action. */
function Mark({
  children,
  suffix,
  action,
  id,
}: {
  children: React.ReactNode;
  suffix?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="min-w-0">
        <Kicker>
          {children}
          {suffix && (
            <span
              className="ml-1.5 normal-case tracking-normal"
              style={{ color: "var(--cc-soft)", letterSpacing: "normal" }}
            >
              · {suffix}
            </span>
          )}
        </Kicker>
      </h2>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** A single mono stat cell in the four-up measure row. */
function StatCell({
  value,
  label,
  tone = "ink",
  loading = false,
}: {
  value: React.ReactNode;
  label: string;
  tone?: "ink" | "up" | "down" | "orange";
  loading?: boolean;
}) {
  const color =
    tone === "up"
      ? "var(--cc-up)"
      : tone === "down"
        ? "var(--cc-down)"
        : tone === "orange"
          ? "var(--cc-orange-ink)"
          : "var(--cc-ink)";
  return (
    <div
      className="min-w-0 flex-1 rounded-xl border px-1.5 py-2.5 text-center"
      style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)" }}
    >
      {loading ? (
        <span
          className="mx-auto block h-3.5 w-10 rounded-full motion-safe:animate-pulse"
          style={{ background: "color-mix(in srgb, var(--cc-ink) 12%, transparent)" }}
          aria-hidden
        />
      ) : (
        <span
          className="block font-[family-name:var(--font-plex-mono)] text-[13px] font-semibold tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
      )}
      <span className="mt-1 block text-[9px] leading-tight" style={{ color: "var(--cc-soft)" }}>
        {label}
      </span>
    </div>
  );
}

/** Kai-blue mono kicker (Kicker has no colour override, and blue is Kai-only). */
function KaiKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="cc-mono" style={{ color: "var(--cc-blue)" }}>
      {children}
    </div>
  );
}

/** Compliance floor line — mono, dim, verbatim words from the caller (§6.5). */
function ComplianceFoot({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-5 border-t pt-3.5 text-center font-[family-name:var(--font-plex-mono)] text-[10.5px] leading-relaxed"
      style={{ borderColor: "var(--cc-line)", color: "var(--cc-dim)" }}
    >
      {children}
    </p>
  );
}

/** The free-tier door, v2-inline. Same "watchlist" context copy as the shared
 *  UpsellCard (verbatim), re-skinned into a cc card so no v1 warm-gold chrome
 *  (LockedState) renders inside the v2 frame. Links to the FIC checkout. */
function WatchlistUpsellV2() {
  return (
    <a
      href={FIC_CHECKOUT_URL}
      className="relative flex items-center gap-3.5 overflow-hidden rounded-[18px] px-4 py-4 text-left transition-transform active:scale-[0.995]"
      style={{
        border: "1px solid color-mix(in srgb, var(--cc-orange) 42%, transparent)",
        background:
          "linear-gradient(120deg, color-mix(in srgb, var(--cc-orange) 14%, var(--cc-card)) 0%, var(--cc-card) 72%)",
      }}
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
        style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
        aria-hidden
      >
        <Eye className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--cc-orange-ink)" }}
        >
          Members research here
        </span>
        <span className="mt-1 block cc-display text-[16px]" style={{ color: "var(--cc-ink)" }}>
          The family watchlist
        </span>
        <span className="mt-1 block text-[12px] leading-snug" style={{ color: "var(--cc-soft)" }}>
          Build a shared watchlist your whole family studies together — track the companies you use
          every day, write down why you&apos;re watching, and share your thinking in the club.
        </span>
        <span
          className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-extrabold"
          style={{ color: "var(--cc-orange-ink)" }}
        >
          Unlock the watchlist — join the Club <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </span>
    </a>
  );
}

/* ── The v2 surface ────────────────────────────────────────────────────────── */

export default function ResearchClientV2({
  initialResearch = null,
  initialReport = null,
  reportSeeded = false,
}: ResearchClientProps) {
  const supabase = createClient();
  const router = useRouter();
  const { openKai } = useKaiSheet();
  const params = useParams<{ ticker: string }>();
  const ticker = (params?.ticker || "").toString().toUpperCase();

  const club = useClubRead(supabase, ticker);

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [tierResolved, setTierResolved] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("parent");
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [entries, setEntries] = useState<CommunityEntry[]>([]);
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [commentsResolved, setCommentsResolved] = useState(false);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [report, setReport] = useState<KaiReport | null>(initialReport);
  const [reportResolved, setReportResolved] = useState(reportSeeded);
  const [research, setResearch] = useState<ResearchPayload | null>(initialResearch);
  const [researchResolved, setResearchResolved] = useState(initialResearch != null);
  const [bars, setBars] = useState<MarketBar[]>([]);
  const [barsState, setBarsState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [news, setNews] = useState<NewsHeadline[]>([]);
  const [clubNews, setClubNews] = useState<NewsCardData[]>([]);
  const [newsState, setNewsState] = useState<"idle" | "loading" | "done">("idle");
  const [theses, setTheses] = useState<ThesisCard[]>([]);
  const [thesesResolved, setThesesResolved] = useState(false);
  const [screener, setScreener] = useState<ScreenerVolume | null>(null);
  const [screenerResolved, setScreenerResolved] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<ContributionType>("note");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  const [tab, setTab] = useState<V2Tab>("overview");
  const [back, setBack] = useState<BackTarget>(BACK_DEFAULT);
  const barsReq = useRef(false);
  const newsReq = useRef(false);
  const initRef = useRef(false);

  const ensureBars = useCallback(
    (force = false) => {
      if (barsReq.current && !force) return;
      barsReq.current = true;
      setBarsState("loading");
      fetchBars(ticker, "2y").then(
        (b) => {
          setBars(b);
          setBarsState(b.length >= 2 ? "done" : "error");
        },
        () => setBarsState("error")
      );
    },
    [ticker]
  );

  const ensureNews = useCallback(() => {
    if (newsReq.current) return;
    newsReq.current = true;
    setNewsState("loading");
    Promise.all([fetchNews(ticker, 6), fetchClubNewsForTicker(supabase, ticker, 4)]).then(
      ([n, c]) => {
        setNews(n);
        setClubNews(c);
        setNewsState("done");
      }
    );
  }, [ticker, supabase]);

  const load = useCallback(async () => {
    let user: { id: string } | null = null;
    try {
      const res = await supabase.auth.getUser();
      user = res.data.user;
    } catch {
      /* signed-out below */
    }
    if (!user) {
      setLoading(false);
      setTierResolved(true);
      return;
    }
    setUserId(user.id);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id, role, age_group")
        .eq("id", user.id)
        .maybeSingle();
      setRole(profile?.role || "parent");
      setAgeGroup(profile?.age_group ?? null);
      setFamilyId(profile?.family_id ?? null);
      const t = await getClubTier(supabase, profile?.family_id);
      setTier(t);
    } catch {
      /* keep defaults */
    } finally {
      setTierResolved(true);
      setLoading(false);
    }

    const swallow = () => {};
    supabase.rpc("get_community_board").then(({ data: board }) => {
      const all = ((board || {}) as { entries?: CommunityEntry[] }).entries || [];
      setEntries(all.filter((e) => e.ticker.toUpperCase() === ticker));
    }, swallow);

    supabase
      .from("community_ticker_comments")
      .select(COMMENT_SELECT)
      .eq("ticker", ticker)
      .order("created_at", { ascending: true })
      .then(
        ({ data: rows }) => {
          setComments((rows || []).map(normComment));
          setCommentsResolved(true);
        },
        () => setCommentsResolved(true)
      );

    supabase.rpc("get_latest_kai_report", { p_ticker: ticker }).then(
      ({ data: rep }) => {
        setReport((rep as KaiReport) ?? null);
        setReportResolved(true);
      },
      () => setReportResolved(true)
    );

    fetchTickerTheses(supabase, ticker).then(
      (t) => {
        setTheses(t);
        setThesesResolved(true);
      },
      () => setThesesResolved(true)
    );

    supabase
      .from("screener_metrics")
      .select("vol, avg_vol_20, mcap")
      .eq("ticker", ticker)
      .maybeSingle()
      .then(
        ({ data }) => {
          setScreener((data as ScreenerVolume) ?? null);
          setScreenerResolved(true);
        },
        () => setScreenerResolved(true)
      );

    fetchQuote(ticker).then(setQuote, swallow);
    fetchResearch(ticker).then(
      (r) => {
        setResearch((prev) => (r?.partial && prev && !prev.partial ? prev : r ?? prev));
        setResearchResolved(true);
      },
      () => setResearchResolved(true)
    );
  }, [supabase, ticker]);

  /* the partial settles itself — exactly one retry, same as v1. */
  const partial = research?.partial === true;
  const retriedPartial = useRef(false);
  useEffect(() => {
    if (!partial || retriedPartial.current) return;
    retriedPartial.current = true;
    const t = setTimeout(() => {
      fetchResearch(ticker).then((r) => {
        if (r && !r.partial) setResearch(r);
      }, () => {});
    }, 6000);
    return () => clearTimeout(t);
  }, [partial, ticker]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const next = backFromReferrer();
    if (next) setBack(next);
  }, []);

  // Deep-link a tab (?tab= / #). News folds into Overview here (v2 has 4 tabs).
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const raw = (sp.get("tab") || window.location.hash.replace("#", "")).toLowerCase();
      if (raw === "technicals" || raw === "fundamentals" || raw === "kai" || raw === "overview") {
        setTab(raw as V2Tab);
      }
    } catch {
      /* stay on Overview */
    }
  }, []);

  useEffect(() => {
    if (loading || !tierResolved || initRef.current) return;
    initRef.current = true;
    ensureBars();
    ensureNews();
  }, [loading, tierResolved, ensureBars, ensureNews]);

  const selectTab = useCallback((k: V2Tab) => {
    setTab(k);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", k);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* history unavailable */
    }
  }, []);

  const companyName = useMemo(
    () => research?.company.name || entries.find((e) => e.company_name)?.company_name || ticker,
    [research, entries, ticker]
  );
  const shortName = useMemo(() => proseName(companyName, ticker), [companyName, ticker]);

  const isKid = ageGroup === "kids";
  const locked = !tierResolved || (tier === "free" && !isKid);
  const canVote = tierResolved && tier !== "free";

  const week52 = useMemo(() => {
    if (bars.length < 20) return null;
    const closes = bars.slice(-252).map((b) => b.c);
    return { low: Math.min(...closes), high: Math.max(...closes) };
  }, [bars]);

  const keyStats = useMemo(() => {
    if (!research) return null;
    return {
      ...research.keyStats,
      week52Low: week52?.low ?? research.keyStats.week52Low,
      week52High: week52?.high ?? research.keyStats.week52High,
    };
  }, [research, week52]);

  async function post() {
    const body = draft.trim();
    if (!body || posting) return;
    setErr("");
    const clean = checkClean(body);
    if (!clean.ok) {
      setErr(PROFANITY_MESSAGE);
      return;
    }
    setPosting(true);
    const { data, error } = await supabase
      .from("community_ticker_comments")
      .insert({ ticker, user_id: userId, body, contribution_type: draftType })
      .select(COMMENT_SELECT)
      .single();
    setPosting(false);
    if (!error && data) {
      setComments((prev) => [...prev, normComment(data)]);
      setDraft("");
      setDraftType("note");
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("community_ticker_comments").delete().eq("id", id);
    if (!error) setComments((prev) => prev.filter((c) => c.id !== id));
  }

  const adminEntry = entries.find((e) => e.kind === "admin") || null;

  // First honest paint: hold a skeleton only when there's genuinely nothing.
  if ((loading || !tierResolved) && !research) {
    return (
      <V2Surface className="min-h-screen">
        <div className="mx-auto w-full max-w-2xl px-4 py-10">
          <div className="space-y-4" aria-busy="true">
            <div
              className="h-8 w-40 rounded-md motion-safe:animate-pulse"
              style={{ background: "color-mix(in srgb, var(--cc-ink) 10%, transparent)" }}
            />
            <Card className="h-[128px] motion-safe:animate-pulse">{null}</Card>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i} className="h-[68px] flex-1 motion-safe:animate-pulse">{null}</Card>
              ))}
            </div>
          </div>
        </div>
      </V2Surface>
    );
  }

  return (
    <V2Surface className="min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 sm:px-6">
        {/* ── BOARD 03 HEAD ──────────────────────────────────────────────── */}
        <TickerHead
          ticker={ticker}
          companyName={companyName}
          quote={quote}
          research={research}
          bars={bars}
          barsResolved={barsState === "done" || barsState === "error"}
          screener={screener}
          screenerResolved={screenerResolved}
          week52={week52}
          supabase={supabase}
          familyId={familyId}
          userId={userId}
          back={back}
          clubRank={club.rank}
          watchers={club.watchers}
          faces={club.faces}
          onAskKai={() =>
            openKai({ chip: ticker, query: `What should I know about ${ticker} right now?` })
          }
        />

        {/* ── 3 compact actions ──────────────────────────────────────────── */}
        <TickerActions
          ticker={ticker}
          canAlert={ageGroup !== "kids" && ageGroup !== "teens"}
          seedPrice={quote?.price ?? null}
          levels={researchLevels(quote?.price ?? null, keyStats)}
        />

        {/* ── SUBTABS ────────────────────────────────────────────────────── */}
        <div className="mt-8">
          <SubTabs tabs={V2_TABS} value={tab} onChange={selectTab} />
        </div>

        <div className="mt-7">
          <div className="min-w-0">
            {tab === "overview" && (
              <OverviewPanel
                supabase={supabase}
                ticker={ticker}
                shortName={shortName}
                companyName={companyName}
                research={research}
                researchResolved={researchResolved}
                partial={partial}
                report={report}
                adminEntry={adminEntry}
                entries={entries}
                quote={quote}
                isKid={isKid}
                canVote={canVote}
                userId={userId}
                theses={theses}
                thesesResolved={thesesResolved}
                showCompose={showCompose}
                setShowCompose={setShowCompose}
                onPublished={(id) => {
                  setShowCompose(false);
                  fetchTickerTheses(supabase, ticker).then(setTheses, () => {});
                  router.push(`/research/thesis/${id}`);
                }}
                news={news}
                clubNews={clubNews}
                newsState={newsState}
                onOpenKai={() => selectTab("kai")}
              />
            )}

            {tab === "technicals" && (
              <TechnicalsPanel
                ticker={ticker}
                shortName={shortName}
                research={research}
                bars={bars}
                barsState={barsState}
                isKid={isKid}
                onRetry={() => ensureBars(true)}
              />
            )}

            {tab === "fundamentals" && (
              <FundamentalsPanel
                research={research}
                companyName={companyName}
                shortName={shortName}
                locked={locked}
              />
            )}

            {tab === "kai" && (
              <KaiPanel
                ticker={ticker}
                companyName={companyName}
                shortName={shortName}
                report={report}
                resolved={reportResolved && tierResolved}
                locked={locked}
                onAskKai={() =>
                  openKai({ chip: ticker, query: `What should I know about ${ticker} right now?` })
                }
              />
            )}

            {/* Practice — ticker-relevant lesson, outside the tabs (always resolves). */}
            <div id="practice" className="mt-12 scroll-mt-20">
              <ContinuePath pickup={null} ticker={ticker} />
            </div>
          </div>

          {/* ── THE CLUB RAIL — sentiment ring + Top Voices + discussion ──── */}
          <aside className="mt-12 min-w-0">
            <div className="space-y-8">
              <ClubReadV2
                data={club}
                showSentiment={!isKid}
                stance={
                  !isKid ? (
                    <Suspense fallback={null}>
                      <FirstWinSpotlight>
                        <ChangedMyMind
                          supabase={supabase}
                          ticker={ticker}
                          userId={userId}
                          canFlip={canVote && !isKid}
                        />
                      </FirstWinSpotlight>
                    </Suspense>
                  ) : null
                }
              />

              <DiscussionV2
                ticker={ticker}
                companyName={shortName}
                comments={comments}
                commentsResolved={commentsResolved}
                userId={userId}
                role={role}
                canPost={canVote}
                entitlementsResolved={tierResolved}
                draft={draft}
                draftType={draftType}
                posting={posting}
                err={err}
                onDraft={(v) => {
                  setDraft(v);
                  if (err) setErr("");
                }}
                onDraftType={setDraftType}
                onPost={post}
                onRemove={remove}
              />
            </div>
          </aside>
        </div>

        <footer
          className="mt-12 border-t pt-5"
          style={{ borderColor: "var(--cc-line)" }}
        >
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--cc-dim)" }}>
            {COMMUNITY_DISCLAIMER}
          </p>
        </footer>
      </div>
    </V2Surface>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOARD 03 — TICKER HEAD (cc)
   ═══════════════════════════════════════════════════════════════════════════ */

type RangeKey = "1M" | "3M" | "6M" | "1Y" | "ALL";
const RANGE_DAYS: Record<RangeKey, number> = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252, ALL: Infinity };
const RANGE_KEYS: RangeKey[] = ["1M", "3M", "6M", "1Y", "ALL"];

function TickerHead({
  ticker,
  companyName,
  quote,
  research,
  bars,
  barsResolved,
  screener,
  screenerResolved,
  week52,
  supabase,
  familyId,
  userId,
  back,
  clubRank,
  watchers,
  faces,
  onAskKai,
}: {
  ticker: string;
  companyName: string;
  quote: MarketQuote | null;
  research: ResearchPayload | null;
  bars: MarketBar[];
  barsResolved: boolean;
  screener: ScreenerVolume | null;
  screenerResolved: boolean;
  week52: { low: number; high: number } | null;
  supabase: ReturnType<typeof createClient>;
  familyId: string | null;
  userId: string;
  back: BackTarget;
  clubRank: number | null;
  watchers: number;
  faces: Portrait[];
  onAskKai: () => void;
}) {
  const [range, setRange] = useState<RangeKey>("1Y");
  const [shared, setShared] = useState(false);

  // Watchlist toggle — same table + logic as v1's ResearchCanvas.
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
      if (error) return setWatchErr(true);
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
    if (error || !data) return setWatchErr(true);
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
      /* dismissed */
    }
  }

  const closes = bars.map((b) => b.c);
  const visible = useMemo(() => {
    const n = RANGE_DAYS[range];
    return n === Infinity ? closes : closes.slice(-n);
  }, [closes, range]);
  const windowPct = useMemo(() => {
    if (visible.length < 2) return null;
    const a = visible[0];
    const b = visible[visible.length - 1];
    if (!a) return null;
    return ((b - a) / a) * 100;
  }, [visible]);

  const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;
  const quoteResolved = quote != null || barsResolved;
  const price = quote?.price ?? null;
  const shownPrice = price ?? (quoteResolved ? lastClose : null);
  const priceIsClose = price == null && shownPrice != null;
  const chgPct = quote?.changePercent ?? null;
  const exchange = research?.company.exchange ? formatExchange(research.company.exchange) : null;
  const feed = quote?.delayed === false ? "Real time" : "Delayed ~15 min";

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
      ready: research != null || screenerResolved,
    },
    {
      label: "P/E",
      value:
        research?.keyStats.pe != null && Number.isFinite(research.keyStats.pe)
          ? `${research.keyStats.pe.toFixed(1)}×`
          : null,
      ready: research != null,
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
      label: "52-week range",
      value: week52 ? `${money(week52.low)}–${money(week52.high)}` : null,
      ready: week52 != null || (research != null && barsResolved),
    },
  ];

  return (
    <div>
      {/* top row — back · watch · share */}
      <div className="flex items-center justify-between pt-3">
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.16em] transition-colors"
          style={{ color: "var(--cc-soft)" }}
        >
          <ArrowLeft className="h-4 w-4" /> {back.label}
        </Link>
        <div className="flex items-center gap-2.5">
          {watchErr && (
            <span className="font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-soft)" }}>
              Couldn&apos;t save
            </span>
          )}
          {watching && !watchErr && (
            <span className="font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-orange-ink)" }}>
              Watching
            </span>
          )}
          {familyId ? (
            <button
              type="button"
              onClick={toggleWatch}
              disabled={!watchKnown || watchBusy}
              aria-pressed={watching}
              aria-label={watching ? `Remove ${ticker} from your watchlist` : `Add ${ticker} to your watchlist`}
              className="rounded-full p-1 transition-colors disabled:opacity-45"
              style={{ color: watching ? "var(--cc-orange-ink)" : "var(--cc-soft)" }}
            >
              <Star className="h-[18px] w-[18px]" fill={watching ? "currentColor" : "none"} strokeWidth={watching ? 1.5 : 2} />
            </button>
          ) : (
            <Link href="/watchlist" aria-label="Your watchlist" className="rounded-full p-1" style={{ color: "var(--cc-soft)" }}>
              <Star className="h-[18px] w-[18px]" fill="none" strokeWidth={2} />
            </Link>
          )}
          <button
            type="button"
            onClick={onShare}
            aria-label={shared ? "Link copied" : "Share this page"}
            className="rounded-full p-1 transition-colors"
            style={{ color: shared ? "var(--cc-orange-ink)" : "var(--cc-soft)" }}
          >
            <ArrowUpRight className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* identity — script name + club-rank pill */}
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CompanyLogo symbol={ticker} name={companyName} size={40} rounded="rounded-[11px]" />
          <div className="min-w-0">
            <Kicker tone="soft" className="mb-0.5">{ticker}</Kicker>
            <h1 className="truncate text-[21px] font-extrabold leading-none tracking-[-0.01em]" style={{ color: "var(--cc-ink)" }}>
              {companyName}
            </h1>
          </div>
        </div>
        {clubRank != null && (
          <Link
            href="/discover"
            className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-colors"
            style={{
              border: "1px solid color-mix(in srgb, var(--cc-orange) 45%, transparent)",
              background: "color-mix(in srgb, var(--cc-orange) 12%, transparent)",
              color: "var(--cc-orange-ink)",
            }}
          >
            #{clubRank} in the Club ›
          </Link>
        )}
      </div>

      {/* the mark — price + move */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        {shownPrice != null ? (
          <span className="font-[family-name:var(--font-plex-mono)] text-[28px] font-semibold leading-none tabular-nums" style={{ color: "var(--cc-ink)" }}>
            {money(shownPrice)}
          </span>
        ) : quoteResolved ? (
          <span className="font-[family-name:var(--font-plex-mono)] text-[28px] font-semibold leading-none" style={{ color: "var(--cc-dim)" }}>—</span>
        ) : (
          <span className="block h-[28px] w-[132px] rounded-md motion-safe:animate-pulse" style={{ background: "color-mix(in srgb, var(--cc-ink) 10%, transparent)" }} aria-hidden />
        )}
        {chgPct != null && <Delta pct={chgPct} className="!text-[13px]" />}
      </div>
      <p className="mt-1.5 font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.16em]" style={{ color: "var(--cc-dim)" }}>
        {priceIsClose ? "Last daily close" : feed}
        {exchange ? ` · ${exchange}` : ""}
        {research?.company.sector ? ` · ${research.company.sector}` : ""}
      </p>

      {/* who else is here */}
      {watchers >= WATCHERS_FLOOR && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <span className="flex">
            {faces.slice(0, 3).map((f, i) => (
              <span
                key={f.id}
                title={f.name}
                className={`grid h-4 w-4 place-items-center overflow-hidden rounded-full ${i > 0 ? "-ml-1.5" : ""}`}
                style={{ background: "var(--cc-card2)", boxShadow: "0 0 0 1.5px var(--cc-bg)" }}
              >
                {f.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.avatar} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
            ))}
          </span>
          <span className="text-[9.5px]" style={{ color: "var(--cc-soft)" }}>
            {watchers.toLocaleString()} watching now
          </span>
        </div>
      )}

      {/* the plot — a plain price line, NO invented zones (honest) */}
      <div className="mt-3">
        {bars.length >= 2 ? (
          <ZoneChart series={visible.length >= 2 ? visible : closes} height={128} />
        ) : barsResolved ? (
          <Card className="flex h-[128px] items-center justify-center px-5">
            <p className="text-center font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-soft)" }}>
              No price series for this window
            </p>
          </Card>
        ) : (
          <Card className="h-[128px] motion-safe:animate-pulse">{null}</Card>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Chart range">
          {RANGE_KEYS.map((r) => {
            const on = r === range;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => setRange(r)}
                className="shrink-0 rounded-lg px-2.5 py-1 font-[family-name:var(--font-plex-mono)] text-[10.5px] font-semibold transition-colors"
                style={
                  on
                    ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
                    : { border: "1px solid var(--cc-line)", background: "var(--cc-card2)", color: "var(--cc-soft)" }
                }
              >
                {r}
              </button>
            );
          })}
        </div>
        {windowPct != null && (
          <span
            className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold tabular-nums"
            style={{ color: windowPct >= 0 ? "var(--cc-up)" : "var(--cc-down)" }}
          >
            {windowPct >= 0 ? "+" : "−"}
            {Math.abs(windowPct).toFixed(2)}%
          </span>
        )}
      </div>
      <p className="mt-1.5 font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-dim)" }}>
        Daily closes · {range === "ALL" ? "up to two years" : range}
      </p>

      {/* the numbers — four cards */}
      <div className="mt-4 flex gap-2">
        {cards.map((c) => (
          <StatCell key={c.label} value={c.value ?? "—"} label={c.label} loading={!c.ready} />
        ))}
      </div>

      {/* Ask Kai band — blue is reserved for Kai (colour law) */}
      <button
        type="button"
        onClick={onAskKai}
        className="relative mt-5 flex w-full items-center justify-between gap-4 overflow-hidden rounded-[18px] px-5 py-4 text-left transition-transform active:scale-[0.995]"
        style={{
          border: "1px solid color-mix(in srgb, var(--cc-blue) 40%, transparent)",
          background: "linear-gradient(120deg, color-mix(in srgb, var(--cc-blue) 16%, var(--cc-card)) 0%, var(--cc-card) 72%)",
        }}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--cc-blue)" }}>
            <Sparkles className="h-3 w-3" aria-hidden /> Kai
          </span>
          <span className="mt-1.5 block cc-display text-[18px]" style={{ color: "var(--cc-ink)" }}>
            Ask Kai about ${ticker}
          </span>
          <span className="mt-1 block text-[12px] leading-snug" style={{ color: "var(--cc-soft)" }}>
            What&apos;s moving it, what the numbers say, what to watch next.
          </span>
        </span>
        <ArrowUpRight className="h-5 w-5 shrink-0" style={{ color: "var(--cc-blue)" }} aria-hidden />
      </button>
    </div>
  );
}

/* ── 3 compact actions ─────────────────────────────────────────────────────── */
function TickerActions({
  ticker,
  canAlert,
  seedPrice,
  levels,
}: {
  ticker: string;
  canAlert: boolean;
  seedPrice: number | null;
  levels: AlertLevel[];
}) {
  const [shared, setShared] = useState(false);

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) return void (await navigator.share({ title: `${ticker} on Cheat Code`, url }));
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      /* dismissed */
    }
  }
  function onPractice() {
    document.getElementById("practice")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const cell =
    "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[12.5px] font-bold transition-colors";
  const cellStyle = {
    border: "1px solid var(--cc-line)",
    background: "var(--cc-card)",
    color: "var(--cc-ink)",
  } as const;

  return (
    <div className="mt-5 flex gap-2">
      {canAlert && (
        <div className="flex flex-1 items-center justify-center rounded-full" style={cellStyle}>
          <SetAlertButton
            ticker={ticker}
            surface="research"
            defaultKind="price_cross"
            seedPrice={seedPrice}
            levels={levels}
            variant="chip"
            stopPropagation={false}
            className="!w-full !justify-center !border-0 !bg-transparent !py-2.5 !text-[12.5px] !font-bold"
          />
        </div>
      )}
      <button type="button" onClick={onPractice} className={cell} style={cellStyle}>
        <GraduationCap className="h-4 w-4" /> Practice
      </button>
      <button type="button" onClick={onShare} className={cell} style={cellStyle}>
        {shared ? <Check className="h-4 w-4" style={{ color: "var(--cc-orange-ink)" }} /> : <Share2 className="h-4 w-4" />}
        {shared ? "Copied" : "Share"}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW PANEL (board 03 body)
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewPanel({
  supabase,
  ticker,
  shortName,
  companyName,
  research,
  researchResolved,
  partial,
  report,
  adminEntry,
  entries,
  quote,
  isKid,
  canVote,
  userId,
  theses,
  thesesResolved,
  showCompose,
  setShowCompose,
  onPublished,
  news,
  clubNews,
  newsState,
  onOpenKai,
}: {
  supabase: ReturnType<typeof createClient>;
  ticker: string;
  shortName: string;
  companyName: string;
  research: ResearchPayload | null;
  researchResolved: boolean;
  partial: boolean;
  report: KaiReport | null;
  adminEntry: CommunityEntry | null;
  entries: CommunityEntry[];
  quote: MarketQuote | null;
  isKid: boolean;
  canVote: boolean;
  userId: string;
  theses: ThesisCard[];
  thesesResolved: boolean;
  showCompose: boolean;
  setShowCompose: (v: boolean) => void;
  onPublished: (id: string) => void;
  news: NewsHeadline[];
  clubNews: NewsCardData[];
  newsState: "idle" | "loading" | "done";
  onOpenKai: () => void;
}) {
  const ungraded = !!research && research.insufficient && research.grades.overall.graded === 0;

  return (
    <div className="space-y-10">
      {/* scorecard pointer — grade lives on the Fundamentals subpage */}
      {research ? (
        partial ? (
          <Card className="px-4 py-3.5" aria-busy="true">
            <Kicker tone="soft">Scorecard</Kicker>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
              We&apos;re pulling {shortName}&apos;s filings in now — this is the first time the club has
              opened this name. The price, chart and news are live already; the scorecard lands in a moment.
            </p>
          </Card>
        ) : ungraded ? (
          <Card className="px-4 py-3.5">
            <Kicker tone="soft">Scorecard</Kicker>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
              We don&apos;t have enough published financials to grade {shortName} yet — many smaller
              companies and funds don&apos;t report the numbers our scorecard needs. The price chart,
              news, and community research still work.
            </p>
          </Card>
        ) : (
          <Card className="flex items-center gap-3.5 px-4 py-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[18px] font-extrabold tracking-[-0.01em]" style={{ background: "var(--cc-card2)", color: "var(--cc-orange-ink)" }} aria-hidden>
              {research.grades.overall.letter ?? "—"}
            </span>
            <span className="min-w-0 flex-1">
              <Kicker tone="soft">Financial health</Kicker>
              <span className="mt-1 block text-[16px] font-extrabold tracking-[-0.01em]" style={{ color: "var(--cc-ink)" }}>
                {research.grades.overall.label ?? "Not enough data"}
              </span>
              <span className="mt-0.5 block text-[10.5px]" style={{ color: "var(--cc-soft)" }}>
                {research.grades.overall.graded} of 4 areas graded — see Fundamentals
              </span>
            </span>
          </Card>
        )
      ) : researchResolved ? (
        <Card className="px-4 py-3.5">
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            The scorecard for {shortName} is updating and will be back shortly. The price, charts, news,
            and community research still work.
          </p>
        </Card>
      ) : (
        <Card className="h-[84px] motion-safe:animate-pulse">{null}</Card>
      )}

      {/* Kai pointer — only when a report actually exists */}
      {report && (
        <button type="button" onClick={onOpenKai} className="block w-full text-left">
          <Card
            className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderColor: "color-mix(in srgb, var(--cc-blue) 30%, var(--cc-line))" }}
          >
            <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--cc-blue)" }} aria-hidden />
            <span className="min-w-0 flex-1">
              <KaiKicker>Kai research report</KaiKicker>
              <span className="mt-1 block truncate text-[13.5px] font-semibold" style={{ color: "var(--cc-ink)" }}>
                {report.sections.headline || `Kai's read on ${companyName}`}
              </span>
            </span>
            <span className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--cc-blue)" }}>
              Read ›
            </span>
          </Card>
        </button>
      )}

      {/* admin thesis */}
      {adminEntry && (adminEntry.headline || adminEntry.thesis) && (
        <Card
          className="px-4 py-3.5"
          style={{ borderColor: "color-mix(in srgb, var(--cc-orange) 30%, var(--cc-line))" }}
        >
          <Kicker>Our research</Kicker>
          {adminEntry.headline && (
            <h2 className="mt-2 cc-display text-[17px]" style={{ color: "var(--cc-ink)" }}>
              {adminEntry.headline}
            </h2>
          )}
          <div className="mt-2.5 space-y-3">
            {toProse(adminEntry.thesis).map((p, i) => (
              <p key={i} className="text-[13px] leading-relaxed" style={{ color: "var(--cc-ink)" }}>
                {p}
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* theses (structured social objects) + gated publish */}
      <section>
        <Mark
          action={
            canVote && !isKid && !showCompose ? (
              <button
                onClick={() => setShowCompose(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors"
                style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
              >
                <FileText className="h-3.5 w-3.5" /> Publish a thesis
              </button>
            ) : undefined
          }
        >
          Theses on {ticker}
        </Mark>
        <div className="mt-3.5">
          {showCompose && (
            <Gated feature="publish_thesis" fallback={<ContextualWall feature="publish_thesis" variant="band" />}>
              <ResearchObjectCompose
                ticker={ticker}
                companyName={companyName}
                onCancel={() => setShowCompose(false)}
                onPublished={onPublished}
              />
            </Gated>
          )}
          {theses.length > 0 ? (
            <div className="space-y-2.5">
              {theses.map((t) => (
                <ResearchObjectCard key={t.id} obj={t} currentPrice={quote?.price ?? null} />
              ))}
            </div>
          ) : !thesesResolved ? (
            <div className="h-3.5 w-56 max-w-full rounded-full motion-safe:animate-pulse" style={{ background: "color-mix(in srgb, var(--cc-ink) 10%, transparent)" }} aria-hidden />
          ) : (
            !showCompose && (
              <p className="text-[13px]" style={{ color: "var(--cc-soft)" }}>
                No published theses yet
                {canVote && !isKid ? " — publish the first structured thesis for the club." : "."}
              </p>
            )
          )}
        </div>
      </section>

      {/* per-ticker debate — OMITTED from the v2 path per audit recommendation
          (legacy mechanic, pending owner ratification). v1 path keeps it. */}

      {/* on the board */}
      {entries.length > 0 && (
        <section>
          <Mark>On the board</Mark>
          <Card className="mt-3 px-4 py-1">
            {entries.map((e) => {
              const pct = pctSinceAdded(e.snapshot_price, quote?.price ?? e.latest_close);
              const tone = pctTone(pct);
              return (
                <div key={e.id} className="flex items-center gap-3 border-b py-3 last:border-b-0" style={{ borderColor: "var(--cc-line)" }}>
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    {e.kind === "admin" ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "color-mix(in srgb, var(--cc-orange) 15%, transparent)", color: "var(--cc-orange-ink)" }}>
                        Our research
                      </span>
                    ) : (
                      <span className="inline-flex min-w-0 items-center gap-1.5" style={{ color: "var(--cc-soft)" }}>
                        <span className="truncate font-semibold" style={{ color: "var(--cc-ink)" }}>
                          {e.family_name || "A family"}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 font-[family-name:var(--font-plex-mono)] text-[11px] tabular-nums" style={{ color: "var(--cc-soft)" }}>
                    {e.snapshot_price != null && <span>added {e.snapshot_price.toFixed(2)}</span>}
                    <span className="font-semibold" style={{ color: tone === "up" ? "var(--cc-up)" : tone === "down" ? "var(--cc-down)" : "var(--cc-soft)" }}>
                      {formatPct(pct)}
                    </span>
                  </div>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {/* about */}
      {research?.company.description && (
        <section>
          <Mark>About {shortName}</Mark>
          <Card className="mt-3 px-4 py-3.5">
            <CompanyProfileCard company={research.company} kidsMode={isKid} />
          </Card>
        </section>
      )}

      {/* news — folded into Overview (v2 has 4 tabs; no dedicated News board) */}
      <section>
        <Mark suffix="From the newsroom + the web">
          <span className="inline-flex items-center gap-1.5">
            <Newspaper className="h-3 w-3" aria-hidden /> News
          </span>
        </Mark>
        {newsState !== "done" ? (
          <div className="mt-3 space-y-2.5" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="h-16 motion-safe:animate-pulse">{null}</Card>
            ))}
          </div>
        ) : (
          <div className="mt-3 space-y-5">
            {clubNews.length > 0 && (
              <div className="space-y-2.5">
                {clubNews.map((a) => (
                  <Link key={a.slug} href={`/news/${a.slug}`} className="block">
                    <Card className="px-4 py-3">
                      <span className="mb-1.5 flex items-center gap-2">
                        <KindChip kind={a.kind} />
                        <span className="font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-soft)" }}>
                          {newsTimeAgo(a.generated_at)}
                        </span>
                      </span>
                      <span className="block text-[13.5px] font-semibold leading-snug" style={{ color: "var(--cc-ink)" }}>
                        {a.title}
                      </span>
                      {a.dek && (
                        <span className="mt-1 block line-clamp-1 text-[11.5px]" style={{ color: "var(--cc-soft)" }}>
                          {a.dek}
                        </span>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
            <Card className="px-4 py-1">
              <NewsList news={news} />
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TECHNICALS PANEL (board 12) — the real tape + the existing indicator battery
   ═══════════════════════════════════════════════════════════════════════════ */

function TechnicalsPanel({
  ticker,
  shortName,
  research,
  bars,
  barsState,
  isKid,
  onRetry,
}: {
  ticker: string;
  shortName: string;
  research: ResearchPayload | null;
  bars: MarketBar[];
  barsState: "idle" | "loading" | "done" | "error";
  isKid: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-6">
      {barsState === "done" ? (
        <PriceTechnicalsV2 symbol={ticker} momentum={research?.momentum} bars={bars} barsOwned />
      ) : barsState === "error" ? (
        <Card className="px-5 py-8">
          <Kicker tone="soft">Price history</Kicker>
          <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            We couldn&apos;t load {shortName}&apos;s price history, so there is nothing honest to draw
            here. Everything on this page that doesn&apos;t depend on the daily series still works.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-full px-4 py-2 text-[12.5px] font-bold transition-colors"
            style={{ border: "1px solid var(--cc-line)", background: "var(--cc-card)", color: "var(--cc-ink)" }}
          >
            Try again
          </button>
        </Card>
      ) : (
        <div className="space-y-3" aria-busy="true">
          <Card className="h-[104px] motion-safe:animate-pulse">{null}</Card>
          <div className="flex gap-2.5">
            <Card className="h-[92px] flex-1 motion-safe:animate-pulse">{null}</Card>
            <Card className="h-[92px] flex-1 motion-safe:animate-pulse">{null}</Card>
          </div>
          <Card className="h-[188px] motion-safe:animate-pulse">{null}</Card>
        </div>
      )}

      <ComplianceFoot>
        Indicators describe what already happened — not investment advice, not a recommendation, not a
        prediction. Market data is delayed ~15 minutes.
      </ComplianceFoot>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FUNDAMENTALS PANEL (board 13) — the existing grades/financials, real values
   ═══════════════════════════════════════════════════════════════════════════ */

function FundamentalsPanel({
  research,
  companyName,
  shortName,
  locked,
}: {
  research: ResearchPayload | null;
  companyName: string;
  shortName: string;
  locked: boolean;
}) {
  return (
    <div className="space-y-6">
      {research ? (
        <FundamentalsV2
          research={research}
          companyName={companyName}
          locked={locked}
          upsell={<WatchlistUpsellV2 />}
        />
      ) : (
        <div className="space-y-3" aria-busy="true">
          <Card className="h-[104px] motion-safe:animate-pulse">{null}</Card>
          <Card className="h-[150px] motion-safe:animate-pulse">{null}</Card>
        </div>
      )}
      {research?.insufficient && (
        <Card className="px-4 py-8">
          <p className="text-center text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            We don&apos;t have enough published financials for {shortName} to break down yet — many
            smaller companies and funds don&apos;t report the quarterly numbers this board needs.
          </p>
        </Card>
      )}
      <ComplianceFoot>
        Educational analysis of published filings — not investment advice, a recommendation, or a
        prediction. Always do your own research.
      </ComplianceFoot>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   KAI PANEL (board 14) — verdict-less; COVERAGE ring (no confidence field exists)
   ═══════════════════════════════════════════════════════════════════════════ */

function KaiDisc() {
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
      style={{
        background: "color-mix(in srgb, var(--cc-blue) 14%, var(--cc-card))",
        border: "1.5px solid color-mix(in srgb, var(--cc-blue) 42%, transparent)",
      }}
      aria-hidden
    >
      <Sparkles className="h-5 w-5" style={{ color: "var(--cc-blue)" }} />
    </span>
  );
}

function KaiActions({ ticker, onAskKai }: { ticker: string; onAskKai: () => void }) {
  return (
    <div className="mt-4 flex gap-2.5 border-t pt-3.5" style={{ borderColor: "var(--cc-line)" }}>
      <Link
        href="/alerts#kai-nl"
        className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[12.5px] font-extrabold transition-colors"
        style={{ background: "var(--cc-blue)", color: "var(--cc-orange-deep)" }}
      >
        <Bell className="h-4 w-4 shrink-0" aria-hidden /> Set Kai Watch
      </Link>
      <button
        type="button"
        onClick={onAskKai}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[12.5px] font-bold transition-colors"
        style={{ border: "1px solid var(--cc-line)", background: "var(--cc-card)", color: "var(--cc-ink)" }}
      >
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden /> Ask Kai about ${ticker}
      </button>
    </div>
  );
}

function KaiPanel({
  ticker,
  companyName,
  shortName,
  report,
  resolved,
  locked,
  onAskKai,
}: {
  ticker: string;
  companyName: string;
  shortName: string;
  report: KaiReport | null;
  resolved: boolean;
  locked: boolean;
  onAskKai: () => void;
}) {
  // loading — shaped, claims nothing
  if (!resolved) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Card className="h-[150px] motion-safe:animate-pulse">{null}</Card>
        {[0, 1, 2].map((i) => (
          <Card key={i} className="h-[76px] motion-safe:animate-pulse">{null}</Card>
        ))}
      </div>
    );
  }

  // founding — no report on this name yet
  if (!report) {
    return (
      <div>
        <Card className="p-4" style={{ background: "linear-gradient(140deg, color-mix(in srgb, var(--cc-blue) 12%, var(--cc-card)) 0%, var(--cc-card) 70%)", borderColor: "color-mix(in srgb, var(--cc-blue) 30%, var(--cc-line))" }}>
          <div className="flex items-center gap-3">
            <KaiDisc />
            <div className="min-w-0 flex-1">
              <KaiKicker>Kai research report</KaiKicker>
              <p className="mt-1.5 text-[20px] font-extrabold leading-tight tracking-[-0.01em]" style={{ color: "var(--cc-ink)" }}>
                Kai hasn&apos;t written up {shortName} yet.
              </p>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-[1.55]" style={{ color: "var(--cc-soft)" }}>
            Research reports are written one company at a time, for the names the club is actually
            working on — so this page stays empty rather than filling itself with something nobody read.
            When ${ticker} gets one, it lands here.
          </p>
        </Card>
        <Card className="mt-3 px-4 py-3.5">
          <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            Kai can still work on ${ticker} right now: ask a question with the whole page as context, or
            describe in plain English what you want watched and Kai will set it up.
          </p>
        </Card>
        <KaiActions ticker={ticker} onAskKai={onAskKai} />
      </div>
    );
  }

  // locked — the written report is the paid read
  if (locked) {
    return (
      <div>
        <Card className="p-4" style={{ background: "linear-gradient(140deg, color-mix(in srgb, var(--cc-blue) 12%, var(--cc-card)) 0%, var(--cc-card) 70%)", borderColor: "color-mix(in srgb, var(--cc-blue) 30%, var(--cc-line))" }}>
          <div className="flex items-center gap-3">
            <KaiDisc />
            <div className="min-w-0 flex-1">
              <KaiKicker>Kai research report</KaiKicker>
              <p className="mt-1.5 text-[20px] font-extrabold leading-tight tracking-[-0.01em]" style={{ color: "var(--cc-ink)" }}>
                {report.sections.headline || `Kai's read on ${companyName}`}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-[1.55]" style={{ color: "var(--cc-soft)" }}>
            Kai has written a full research report on {companyName} — the business in plain English, the
            numbers, the moat, the risks, and a version you can read to your kids.
          </p>
        </Card>
        <div className="mt-4">
          <WatchlistUpsellV2 />
        </div>
      </div>
    );
  }

  const s = report.sections;
  const cover = coverage(report);
  const updated = new Date(report.generated_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      {/* KAI'S READ — headline is the verdict (no directive), COVERAGE ring */}
      <Card
        className="p-4"
        style={{
          background: "linear-gradient(140deg, color-mix(in srgb, var(--cc-blue) 13%, var(--cc-card)) 0%, var(--cc-card) 70%)",
          borderColor: "color-mix(in srgb, var(--cc-blue) 32%, var(--cc-line))",
        }}
      >
        <div className="flex items-center gap-3">
          <KaiDisc />
          <div className="min-w-0 flex-1">
            <KaiKicker>Kai&apos;s read · updated {updated}</KaiKicker>
            <p className="mt-1.5 text-[20px] font-extrabold leading-tight tracking-[-0.01em]" style={{ color: "var(--cc-ink)" }}>
              {s.headline || `Kai's read on ${companyName}`}
            </p>
          </div>
          <Ring value={cover} size={58} stroke={6} color="var(--cc-blue)">
            <div className="text-center leading-none">
              <span className="block font-[family-name:var(--font-plex-mono)] text-[12px] font-semibold tabular-nums" style={{ color: "var(--cc-ink)" }}>
                {cover}%
              </span>
              <span className="mt-0.5 block font-[family-name:var(--font-plex-mono)] text-[6px] uppercase tracking-[0.08em]" style={{ color: "var(--cc-soft)" }}>
                Cover
              </span>
            </div>
          </Ring>
        </div>
        {s.sector_tagline && (
          <p className="mt-3 text-[12px] leading-[1.55]" style={{ color: "var(--cc-soft)" }}>
            {s.sector_tagline}
          </p>
        )}
      </Card>

      {/* the full written report — charts, moat, kids explainer, questions,
          sources, compliance — consumed verbatim (real data, honest). */}
      <div className="mt-4">
        <KaiReportSectionV2 report={report} showHead={false} />
      </div>

      <KaiActions ticker={ticker} onAskKai={onAskKai} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLUB READ (cc) — RAW SENTIMENT ring + real stance stats + Top Voices + stance
   ═══════════════════════════════════════════════════════════════════════════ */

function ClubReadV2({
  data,
  showSentiment,
  stance,
}: {
  data: ClubReadData;
  showSentiment: boolean;
  stance: React.ReactNode;
}) {
  const { resolved, bull, neutral, bear, positioned, watchers, discussions, faces } = data;
  const hasSplit = showSentiment && positioned >= SPLIT_FLOOR;
  const hasAttention = watchers >= WATCHERS_FLOOR || discussions >= 1;

  if (!resolved) {
    return (
      <section aria-busy="true" aria-label="Reading the club">
        <Mark>Where the club stands</Mark>
        <div className="mt-3 flex items-center justify-center">
          <div className="h-[116px] w-[116px] rounded-full motion-safe:animate-pulse" style={{ background: "color-mix(in srgb, var(--cc-ink) 7%, transparent)" }} />
        </div>
        <div className="mt-3.5 flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <StatCell key={i} value="" label="" loading />
          ))}
        </div>
      </section>
    );
  }

  if (!hasSplit && !hasAttention && positioned === 0 && !stance) return null;

  const bullPct = hasSplit ? Math.round((bull / positioned) * 100) : 0;
  const neutralPct = hasSplit ? Math.round((neutral / positioned) * 100) : 0;
  const bearPct = hasSplit ? Math.max(0, 100 - bullPct - neutralPct) : 0;

  const shift = data.sentimentShift24h;
  const bullFaces = faces.filter((f) => f.side === "bull").slice(0, 5);
  const bearFaces = faces.filter((f) => f.side === "bear").slice(0, 5);

  return (
    <section aria-labelledby="club-read">
      <Mark id="club-read" suffix="Raw sentiment">
        Where the club stands
      </Mark>

      {hasSplit ? (
        <>
          {/* RAW SENTIMENT ring — bull share of positioned members. Green ring,
              the split is the number; this is NOT a fabricated weighted signal. */}
          <div className="mt-4 flex items-center justify-center gap-5">
            <div className="text-center">
              <p className="text-[24px] font-extrabold leading-none tracking-[-0.02em]" style={{ color: "var(--cc-up)" }}>{bullPct}%</p>
              <p className="mt-1 font-[family-name:var(--font-plex-mono)] text-[8.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--cc-up)" }}>
                Bullish
              </p>
            </div>
            <Ring value={bullPct} size={116} stroke={9} color="var(--cc-up)">
              <div className="text-center leading-none">
                <span className="block text-[26px] font-extrabold leading-none tracking-[-0.02em]" style={{ color: "var(--cc-ink)" }}>{bullPct}%</span>
                <span className="mt-1 block font-[family-name:var(--font-plex-mono)] text-[7px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>
                  Raw
                  <br />
                  sentiment
                </span>
              </div>
            </Ring>
            <div className="text-center">
              <p className="text-[24px] font-extrabold leading-none tracking-[-0.02em]" style={{ color: "var(--cc-down)" }}>{bearPct}%</p>
              <p className="mt-1 font-[family-name:var(--font-plex-mono)] text-[8.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--cc-down)" }}>
                Bearish
              </p>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            {bullPct}% of {positioned.toLocaleString()} positioned members lean bullish, {neutralPct}% are
            neutral. This is the raw split — the weighted signal isn&apos;t built yet.
          </p>

          {/* real stance stats */}
          <div className="mt-3.5">
            <StatRow
              stats={[
                { label: "positioned", value: positioned.toLocaleString() },
                { label: "shift today", value: shift == null ? "—" : `${shift > 0 ? "+" : ""}${Math.round(shift)}`, tone: shift == null ? "ink" : shift > 0 ? "up" : shift < 0 ? "down" : "ink" },
                { label: "watching", value: watchers >= WATCHERS_FLOOR ? watchers.toLocaleString() : "—" },
                { label: "club rank", value: data.rank != null ? `#${data.rank}` : "—", tone: data.rank != null ? "orange" : "ink" },
              ]}
            />
          </div>

          {/* Top Voices — real positioned members; NO belt ring (no belt data),
              a green/pink SIDE dot instead (market truth, honest). */}
          {(bullFaces.length > 0 || bearFaces.length > 0) && (
            <div className="mt-5">
              <Kicker tone="soft">Top voices</Kicker>
              <div className="mt-2.5 space-y-2">
                {[...bullFaces, ...bearFaces].slice(0, 6).map((f) => (
                  <div key={f.id} className="flex items-center gap-2.5">
                    <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: "var(--cc-card2)", color: "var(--cc-ink)" }}>
                      {f.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold">
                          {f.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                        </span>
                      )}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
                        style={{ background: f.side === "bull" ? "var(--cc-up)" : "var(--cc-down)", border: "1.5px solid var(--cc-bg)" }}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: "var(--cc-ink)" }}>
                      {f.name}
                    </span>
                    <span className="font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.12em]" style={{ color: f.side === "bull" ? "var(--cc-up)" : "var(--cc-down)" }}>
                      {f.side === "bull" ? "Bull" : "Bear"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* pre-floor state — designed, counts down to the split floor */
        <Card className="mt-3 px-4 py-4">
          <div className="flex items-center gap-2.5" aria-hidden>
            {Array.from({ length: SPLIT_FLOOR }).map((_, i) => (
              <span
                key={i}
                className="h-[9px] flex-1 rounded-full"
                style={{ background: i < Math.min(positioned, SPLIT_FLOOR) ? "var(--cc-orange)" : "var(--cc-card2)" }}
              />
            ))}
          </div>
          <p className="mt-3 cc-display text-[15px]" style={{ color: "var(--cc-ink)" }}>
            {positioned > 0 ? (
              <>
                <span className="font-[family-name:var(--font-plex-mono)] tabular-nums not-italic">{positioned}</span> of{" "}
                <span className="font-[family-name:var(--font-plex-mono)] tabular-nums not-italic">{SPLIT_FLOOR}</span> members positioned
              </>
            ) : (
              <>Nobody has taken a side on this name yet</>
            )}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            {showSentiment
              ? `The club's read unlocks at ${SPLIT_FLOOR} — a split built from one or two people isn't a read, it's an anecdote.`
              : "The club's read on this name isn't published on your account."}
          </p>
          {(watchers >= WATCHERS_FLOOR || discussions >= 1) && (
            <p className="mt-2.5 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-soft)" }}>
              {[
                watchers >= WATCHERS_FLOOR ? `${watchers.toLocaleString()} watching` : null,
                discussions >= 1 ? `${discussions} ${discussions === 1 ? "discussion" : "discussions"} this week` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </Card>
      )}

      {/* the member's own stance — same question, answered by them */}
      {stance && (
        <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--cc-line)" }}>
          {stance}
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DISCUSSION (cc) — persistent community thread, composer-first
   ═══════════════════════════════════════════════════════════════════════════ */

const PREVIEW = 3;

function DiscussionV2({
  ticker,
  companyName,
  comments,
  commentsResolved,
  userId,
  role,
  canPost,
  entitlementsResolved,
  draft,
  draftType,
  posting,
  err,
  onDraft,
  onDraftType,
  onPost,
  onRemove,
}: {
  ticker: string;
  companyName: string;
  comments: ThreadComment[];
  commentsResolved: boolean;
  userId: string;
  role: string;
  canPost: boolean;
  entitlementsResolved: boolean;
  draft: string;
  draftType: ContributionType;
  posting: boolean;
  err: string;
  onDraft: (v: string) => void;
  onDraftType: (t: ContributionType) => void;
  onPost: () => void;
  onRemove: (id: string) => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);

  const filtered = filter === "all" ? comments : comments.filter((c) => c.contribution_type === filter);
  const presentTypes = useMemo(() => {
    const set = new Set(comments.map((c) => c.contribution_type));
    return CONTRIBUTION_TYPES.filter((t) => set.has(t.key));
  }, [comments]);
  const ordered = useMemo(() => [...filtered].reverse(), [filtered]);
  const shown = expanded ? ordered : ordered.slice(0, PREVIEW);
  const hidden = ordered.length - shown.length;

  return (
    <section id="research-notes" className="scroll-mt-20">
      <Mark>The discussion</Mark>

      {comments.length > 0 ? (
        <p className="mt-3 cc-display text-[24px]" style={{ color: "var(--cc-ink)" }}>
          <span className="font-[family-name:var(--font-plex-mono)] tabular-nums not-italic">{comments.length}</span>{" "}
          {comments.length === 1 ? "note" : "notes"} on ${ticker}
        </p>
      ) : (
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          No notes on ${ticker} yet — what it makes, how it earns, what could go right or wrong.
        </p>
      )}

      {/* composer first */}
      {!entitlementsResolved ? (
        <div className="mt-4 border-t pt-4" aria-busy="true" style={{ borderColor: "var(--cc-line)" }}>
          <div className="h-3.5 w-48 max-w-full rounded-full motion-safe:animate-pulse" style={{ background: "color-mix(in srgb, var(--cc-ink) 10%, transparent)" }} />
        </div>
      ) : !canPost ? (
        <p className="mt-4 border-t pt-4 text-[13px]" style={{ borderColor: "var(--cc-line)", color: "var(--cc-soft)" }}>
          Join the Club to add your own research notes.
        </p>
      ) : (
        <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--cc-line)" }}>
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {CONTRIBUTION_TYPES.map((t) => {
              const on = draftType === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => onDraftType(t.key)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors"
                  style={
                    on
                      ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
                      : { border: "1px solid var(--cc-line)", color: "var(--cc-soft)" }
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            rows={2}
            placeholder={`Add a ${contributionMeta(draftType).label.toLowerCase()} about ${companyName}…`}
            className="w-full resize-none border-b bg-transparent py-2 text-[14px] outline-none transition-colors"
            style={{ borderColor: "var(--cc-line)", color: "var(--cc-ink)" }}
          />
          {err && <p className="mt-1.5 text-xs" style={{ color: "var(--cc-down)" }}>{err}</p>}
          <div className="mt-2.5 flex justify-end">
            <button
              type="button"
              onClick={onPost}
              disabled={posting || !draft.trim()}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold disabled:opacity-60"
              style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
            >
              {posting ? "Posting…" : "Post note"}
            </button>
          </div>
        </div>
      )}

      {/* filter chips */}
      {presentTypes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[{ key: "all", label: "All" }, ...presentTypes].map((t) => {
            const on = filter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                style={
                  on
                    ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
                    : { border: "1px solid var(--cc-line)", color: "var(--cc-soft)" }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* the thread */}
      {shown.length > 0 ? (
        <div className="mt-3 space-y-3.5">
          {shown.map((c) => {
            const meta = contributionMeta(c.contribution_type);
            const initials = (c.author?.display_name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
            return (
              <div key={c.id} className="flex gap-2.5 border-b pb-3.5 last:border-b-0" style={{ borderColor: "var(--cc-line)" }}>
                <span className="grid h-7 w-7 shrink-0 place-items-center self-start overflow-hidden rounded-full" style={{ background: "var(--cc-card2)", color: "var(--cc-ink)" }}>
                  {c.author?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.author.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-[family-name:var(--font-plex-mono)] text-[10px] font-bold">{initials}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.author?.username ? (
                      <Link href={`/u/${c.author.username}`} className="text-[13px] font-semibold" style={{ color: "var(--cc-ink)" }}>
                        {c.author?.display_name || "Member"}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-semibold" style={{ color: "var(--cc-ink)" }}>
                        {c.author?.display_name || "Member"}
                      </span>
                    )}
                    {c.contribution_type !== "note" && (
                      <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--cc-card2)", color: "var(--cc-soft)" }}>
                        {meta.label}
                      </span>
                    )}
                    {(c.user_id === userId || role === "admin") && (
                      <button onClick={() => onRemove(c.id)} className="ml-auto transition-colors" style={{ color: "var(--cc-dim)" }} aria-label="Delete note">
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
                    {c.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : !commentsResolved && comments.length === 0 ? (
        <div className="mt-4 border-t pt-4" aria-busy="true" style={{ borderColor: "var(--cc-line)" }}>
          <div className="h-3.5 w-64 max-w-full rounded-full motion-safe:animate-pulse" style={{ background: "color-mix(in srgb, var(--cc-ink) 10%, transparent)" }} />
        </div>
      ) : (
        <p className="mt-4 border-t pt-4 text-[13px]" style={{ borderColor: "var(--cc-line)", color: "var(--cc-soft)" }}>
          {comments.length === 0
            ? "No research notes yet — be the first to share what you found."
            : "No notes of this type yet."}
        </p>
      )}

      {(hidden > 0 || expanded) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-0 w-full border-t pt-3 text-left font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.16em] transition-colors"
          style={{ borderColor: "var(--cc-line)", color: "var(--cc-orange-ink)" }}
        >
          {expanded ? "Show fewer notes" : `See all ${ordered.length} notes`}
        </button>
      )}
    </section>
  );
}
