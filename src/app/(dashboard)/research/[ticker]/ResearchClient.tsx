"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { m } from "@/lib/motion";
import {
  ArrowLeft,
  Send,
  MessageCircle,
  ShieldCheck,
  Users2,
  LineChart,
  Sparkles,
  Trash2,
  StickyNote,
  Lightbulb,
  TriangleAlert,
  Newspaper,
  HelpCircle,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { fetchQuote, fetchNews, fetchBars, type MarketQuote, type MarketBar, type NewsHeadline } from "@/lib/market/client";
import { checkClean, PROFANITY_MESSAGE } from "@/lib/profanity";
import CompanyLogo from "@/components/fic/CompanyLogo";
import LivePrice from "@/components/fic/LivePrice";
import AgeBadge from "@/components/community/AgeBadge";
import UpsellCard from "@/components/dashboard/UpsellCard";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import KaiReportSection from "@/components/kai/KaiReportSection";
import type { KaiReport } from "@/lib/kai/report";
import SocialBar from "@/components/research/SocialBar";
import SetAlertButton, { type AlertLevel } from "@/components/alerts/SetAlertButton";
import Scorecard from "@/components/research/Scorecard";
import PriceTechnicals from "@/components/research/PriceTechnicals";
import ResearchTabBar, { type ResearchTabKey, type ResearchTabDef } from "@/components/research/ResearchTabs";
import {
  KeyStatsGrid,
  CompanyProfileCard,
  NewsList,
  FinancialsSection,
} from "@/components/research/ResearchSections";
import { fetchResearch, type ResearchPayload } from "@/lib/research/types";
import { fetchClubNewsForTicker } from "@/lib/news/client";
import { KindChip } from "@/components/news/NewsCard";
import { timeAgo as newsTimeAgo, type NewsCardData } from "@/lib/news/types";
import {
  CONTRIBUTION_TYPES,
  contributionMeta,
  type ContributionType,
} from "@/lib/research/social";
import {
  pctSinceAdded,
  formatPct,
  pctTone,
  toParagraphs,
  COMMUNITY_DISCLAIMER,
  type CommunityEntry,
} from "@/lib/community-watchlist";

const COMMENT_SELECT =
  "id, ticker, user_id, body, contribution_type, created_at, author:profiles(display_name, avatar_url, age_group, username)";

const SESSION_TAB_KEY = "fic-research-tab";
const VALID_TABS: readonly ResearchTabKey[] = [
  "overview",
  "charts",
  "financials",
  "news",
  "kai",
  "community",
];

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

const CONTRIB_ICON: Record<string, React.ElementType> = {
  StickyNote,
  Lightbulb,
  TriangleAlert,
  Newspaper,
  LineChart,
  HelpCircle,
};

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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function Avatar({ name, url, size = 28 }: { name?: string | null; url?: string | null; size?: number }) {
  const dim = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name || "Member"} style={dim} className="shrink-0 rounded-full object-cover" />;
  }
  const initials = (name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div style={dim} className="flex shrink-0 items-center justify-center rounded-full bg-chip-amber text-[10px] font-bold text-gold-700">
      {initials}
    </div>
  );
}

/** 52-week range position marker (WSZ hero device). */
function RangeBar({ low, high, price }: { low: number | null; high: number | null; price: number | null }) {
  if (low == null || high == null || price == null || high <= low) return null;
  const pos = Math.max(0, Math.min(1, (price - low) / (high - low)));
  return (
    <div className="mt-3">
      <div className="relative h-1.5 rounded-full bg-sand">
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-gold-500 shadow-soft"
          style={{ left: `calc(${(pos * 100).toFixed(1)}% - 6px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-soft">
        <span>52w low ${low.toFixed(2)}</span>
        <span>52w high ${high.toFixed(2)}</span>
      </div>
    </div>
  );
}

/** Key-level prefills for the research-page "Set alert" — the 52-week extremes
 *  the aggregate computed. Above the high / below the low are the levels members
 *  most often want a heads-up on. */
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

function resolveInitialTab(): ResearchTabKey {
  if (typeof window === "undefined") return "overview";
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(window.location.search).get("tab");
  } catch {
    /* ignore */
  }
  if (!raw) {
    try {
      raw = sessionStorage.getItem(SESSION_TAB_KEY);
    } catch {
      /* ignore */
    }
  }
  return raw && (VALID_TABS as readonly string[]).includes(raw)
    ? (raw as ResearchTabKey)
    : "overview";
}

export default function ResearchClient({
  initialResearch = null,
}: {
  /** Server-fetched aggregate for instant first paint (Lane 12C). May be null
   *  when the server couldn't compose it; the client then fetches/refreshes. */
  initialResearch?: ResearchPayload | null;
}) {
  const supabase = createClient();
  const params = useParams<{ ticker: string }>();
  const ticker = (params?.ticker || "").toString().toUpperCase();

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [tierResolved, setTierResolved] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("parent");
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [entries, setEntries] = useState<CommunityEntry[]>([]);
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [report, setReport] = useState<KaiReport | null>(null);
  // Seed from the server payload so the hero + scorecard paint on first paint
  // (no client round-trip). The client still refreshes below to pick up live
  // momentum / a warm cache.
  const [research, setResearch] = useState<ResearchPayload | null>(initialResearch);
  const [researchResolved, setResearchResolved] = useState(initialResearch != null);
  const [bars, setBars] = useState<MarketBar[]>([]);
  const [barsState, setBarsState] = useState<"idle" | "loading" | "done">("idle");
  const [news, setNews] = useState<NewsHeadline[]>([]);
  const [clubNews, setClubNews] = useState<NewsCardData[]>([]);
  const [newsState, setNewsState] = useState<"idle" | "loading" | "done">("idle");
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<ContributionType>("note");
  const [filter, setFilter] = useState<string>("all");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  const [activeTab, setActiveTab] = useState<ResearchTabKey>(() => resolveInitialTab());
  const barsReq = useRef(false);
  const newsReq = useRef(false);
  const initRef = useRef(false);

  const ensureTabData = useCallback(
    (tab: ResearchTabKey) => {
      if (tab === "charts" && !barsReq.current) {
        barsReq.current = true;
        setBarsState("loading");
        fetchBars(ticker, "2y").then((b) => {
          setBars(b);
          setBarsState("done");
        });
      }
      if (tab === "news" && !newsReq.current) {
        newsReq.current = true;
        setNewsState("loading");
        Promise.all([fetchNews(ticker, 6), fetchClubNewsForTicker(supabase, ticker, 4)]).then(
          ([n, c]) => {
            setNews(n);
            setClubNews(c);
            setNewsState("done");
          }
        );
      }
    },
    [ticker, supabase]
  );

  const selectTab = useCallback(
    (tab: ResearchTabKey) => {
      setActiveTab(tab);
      try {
        sessionStorage.setItem(SESSION_TAB_KEY, tab);
      } catch {
        /* ignore */
      }
      try {
        const url = new URL(window.location.href);
        if (tab === "overview") url.searchParams.delete("tab");
        else url.searchParams.set("tab", tab);
        window.history.replaceState(null, "", url.toString());
      } catch {
        /* ignore */
      }
      ensureTabData(tab);
    },
    [ensureTabData]
  );

  const load = useCallback(async () => {
    // FAIL-SOFT: every data source loads independently. A single failing query
    // must never leave the whole page stuck on the skeleton — so the gating
    // reads sit in their own try/catch and `loading`/`tierResolved` always clear
    // in `finally`. Each section then renders from whatever resolved (or its own
    // honest placeholder) rather than the page blanking out.
    let user: { id: string } | null = null;
    try {
      const res = await supabase.auth.getUser();
      user = res.data.user;
    } catch {
      /* auth read failed — treated as signed-out below */
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
      const t = await getClubTier(supabase, profile?.family_id);
      setTier(t);
    } catch {
      /* keep defaults (parent / fic) — page still renders, gating stays safe */
    } finally {
      setTierResolved(true);
      setLoading(false);
    }

    // Secondary reads — each isolated so one failure can't sink the others.
    // Supabase builders are PromiseLike (thenable, no .catch), so failures are
    // absorbed via the 2-arg then(onOk, onErr).
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
      .then(({ data: rows }) => setComments((rows || []).map(normComment)), swallow);

    supabase
      .rpc("get_latest_kai_report", { p_ticker: ticker })
      .then(({ data: rep }) => setReport((rep as KaiReport) ?? null), swallow);

    // Eager: hero + Overview data. Charts (bars) and News fetch lazily per-tab.
    // Both helpers already swallow errors (return null); mark research resolved
    // either way so the scorecard can show an honest state instead of pulsing.
    fetchQuote(ticker).then(setQuote, swallow);
    fetchResearch(ticker).then(
      (r) => {
        setResearch(r);
        setResearchResolved(true);
      },
      () => setResearchResolved(true)
    );
  }, [supabase, ticker]);

  useEffect(() => {
    // load() setStates only after awaits (data arrives async) — the initial
    // render is the skeleton; this fills it in once the session resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Once data is ready: correct an invalid deep-linked tab (e.g. ?tab=kai on a
  // ticker with no report) and kick off the active tab's lazy fetch. Runs once.
  useEffect(() => {
    if (loading || !tierResolved || initRef.current) return;
    initRef.current = true;
    let t = activeTab;
    if (t === "kai" && !report) t = "overview";
    if (t !== activeTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(t);
    }
    ensureTabData(t);
  }, [loading, tierResolved, activeTab, report, ensureTabData]);

  const companyName = useMemo(
    () => research?.company.name || entries.find((e) => e.company_name)?.company_name || ticker,
    [research, entries, ticker]
  );

  const isKid = ageGroup === "kids";
  // Default to LOCKED until the tier resolves, so a server-seeded first paint can
  // never briefly reveal premium detail to a free member before auth settles.
  // (The summary scorecard's gauge + rings don't depend on `locked`, so the LCP
  // content still paints immediately.)
  const locked = !tierResolved || (tier === "free" && !isKid);
  const canVote = tierResolved && tier !== "free";

  // True 52-week high/low from the last ~252 daily closes (accurate — the
  // screener's trailing-window distance is only an approximation). Falls back to
  // the payload until the Charts tab loads bars.
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

  const filteredComments = filter === "all" ? comments : comments.filter((c) => c.contribution_type === filter);
  const presentTypes = useMemo(() => {
    const set = new Set(comments.map((c) => c.contribution_type));
    return CONTRIBUTION_TYPES.filter((t) => set.has(t.key));
  }, [comments]);

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

  // Server-first: if we have a seeded payload, render immediately (hero +
  // scorecard) even while auth/tier resolve in the background. Only fall back to
  // the full skeleton when there's nothing to show yet.
  if ((loading || !tierResolved) && !research) {
    return <DashboardSkeleton variant="detail" title={ticker} />;
  }

  const adminEntry = entries.find((e) => e.kind === "admin") || null;
  const ungraded = !!research && research.insufficient && research.grades.overall.graded === 0;

  const tabDefs: ResearchTabDef[] = [
    { key: "overview", label: "Overview" },
    { key: "charts", label: "Charts & Technicals" },
    { key: "financials", label: "Financials" },
    { key: "news", label: "News" },
    ...(report ? [{ key: "kai" as ResearchTabKey, label: "Kai Report" }] : []),
    { key: "community", label: "Community" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <Link
        href="/watchlist/community"
        className="inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Community Watchlist
      </Link>

      {/* ── Permanent header (always above the tabs) ─────────────────────────
          Hero (logo / price / social bar) + scorecard summary (gauge + rings).
          Social-first: the social bar never gets buried in a tab. */}
      <div className="mt-4 mb-5 space-y-5">
        <m.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <CompanyLogo symbol={ticker} name={companyName} size={52} />
              <div className="min-w-0">
                <h1 className="truncate font-display text-2xl font-bold text-ink">{companyName}</h1>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-midnight-500">{ticker}</span>
                  {research?.company.exchange && (
                    <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-soft">
                      {research.company.exchange}
                    </span>
                  )}
                  <LivePrice quote={quote} size="md" showDelayed />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <Link
                href={`/chart?symbol=${encodeURIComponent(ticker)}`}
                className="inline-flex items-center gap-1 rounded-lg border border-sand px-2.5 py-1.5 text-xs font-semibold text-soft hover:bg-paper"
              >
                <LineChart className="h-3.5 w-3.5" /> Chart
              </Link>
              <Link
                href={`/kai?ticker=${encodeURIComponent(ticker)}`}
                className="inline-flex items-center gap-1 rounded-lg border border-gold-300/50 bg-chip-amber/30 px-2.5 py-1.5 text-xs font-semibold text-gold-700 hover:bg-chip-amber/50"
              >
                <Sparkles className="h-3.5 w-3.5" /> Ask Kai
              </Link>
              {ageGroup !== "kids" && ageGroup !== "teens" && (
                <SetAlertButton
                  ticker={ticker}
                  surface="research"
                  defaultKind="price_cross"
                  seedPrice={quote?.price ?? null}
                  levels={researchLevels(quote?.price ?? null, keyStats)}
                  variant="chip"
                  stopPropagation={false}
                />
              )}
            </div>
          </div>

          {keyStats && (
            <RangeBar
              low={keyStats.week52Low}
              high={keyStats.week52High}
              price={quote?.price ?? keyStats.week52High}
            />
          )}

          {/* Social bar — hero variant; comment count jumps to the Community tab */}
          <div className="mt-4 border-t border-sand pt-4">
            <SocialBar
              supabase={supabase}
              ticker={ticker}
              variant="hero"
              userId={userId}
              ageGroup={ageGroup}
              canVote={canVote}
              onCommentClick={() => selectTab("community")}
              commentActive={activeTab === "community"}
              showConsensus
            />
          </div>

          {/* R5 — community aggregation header. Hidden entirely when every count
              is below its sane threshold, so a cold ticker shows no sad zeros. */}
          <CommunityAggBar supabase={supabase} ticker={ticker} />
        </m.div>

        {/* Scorecard summary — gauge + rings, permanent anti-overload device.
            Three states: graded → Scorecard; ungraded/failed → honest note;
            still-loading → skeleton. Never a permanent pulse. */}
        {research ? (
          ungraded ? (
            <section className="rounded-2xl border border-sand bg-midnight-900 p-5 text-center shadow-soft">
              <p className="text-sm text-soft">
                We don&apos;t have enough published financials to grade {companyName} yet — many smaller
                companies and funds don&apos;t report the numbers our scorecard needs. The price chart,
                news, and community research still work in the tabs below.
              </p>
            </section>
          ) : (
            <Scorecard grades={research.grades} locked={locked} mode="summary" />
          )
        ) : researchResolved ? (
          <section className="rounded-2xl border border-sand bg-midnight-900 p-5 text-center shadow-soft">
            <p className="text-sm text-soft">
              The scorecard for {companyName} is updating and will be back shortly. The price,
              charts, news, and community research below still work.
            </p>
          </section>
        ) : (
          <div className="h-40 animate-pulse rounded-2xl bg-sand/40" />
        )}
      </div>

      {/* ── Sticky tab bar ───────────────────────────────────────────────────
          Rendered as a DIRECT child of the tall page container (not inside a
          short wrapper) so `sticky` stays pinned while the tab body scrolls —
          a wrapping div would confine the sticky to its own height. */}
      <ResearchTabBar tabs={tabDefs} active={activeTab} onSelect={selectTab} />

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div className="mt-5 space-y-5">
        {activeTab === "overview" && (
          <OverviewTab
            research={research}
            keyStats={keyStats}
            companyName={companyName}
            ungraded={ungraded}
            locked={locked}
            isKid={isKid}
            hasReport={!!report}
            onOpenKai={() => selectTab("kai")}
          />
        )}

        {activeTab === "charts" && (
          <section className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
            <h2 className="mb-4 font-display text-base font-bold text-ink">Price &amp; technicals</h2>
            {research && barsState === "done" ? (
              <PriceTechnicals symbol={ticker} momentum={research.momentum} bars={bars} />
            ) : (
              <div className="space-y-4">
                <div className="h-8 w-48 animate-pulse rounded-lg bg-sand/40" />
                <div className="h-[240px] animate-pulse rounded-xl bg-sand/40" />
                <div className="h-20 animate-pulse rounded-xl bg-sand/40" />
              </div>
            )}
          </section>
        )}

        {activeTab === "financials" && (
          <section className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
            <h2 className="mb-4 font-display text-base font-bold text-ink">Financials</h2>
            {!research || !keyStats ? (
              <div className="h-64 animate-pulse rounded-xl bg-sand/40" />
            ) : research.insufficient ? (
              <p className="rounded-xl border border-dashed border-sand px-3 py-8 text-center text-sm text-soft">
                We don&apos;t have enough published financials for {companyName} to chart yet — many
                smaller companies and funds don&apos;t report the quarterly numbers these charts need.
              </p>
            ) : locked ? (
              <UpsellCard context="watchlist" />
            ) : (
              <FinancialsSection
                charts={research.charts}
                keyStats={keyStats}
                medians={research.sectorMedians}
              />
            )}
          </section>
        )}

        {activeTab === "news" && (
          <section className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
            <h2 className="mb-1 font-display text-base font-bold text-ink">News</h2>
            <p className="mb-4 text-xs text-soft">Club recaps + headlines from around the web</p>
            {newsState !== "done" ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-sand/40" />
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {clubNews.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-soft">
                      <Newspaper className="h-3.5 w-3.5" /> From the Club Newsroom
                    </h3>
                    <div className="space-y-2">
                      {clubNews.map((a) => (
                        <Link
                          key={a.slug}
                          href={`/news/${a.slug}`}
                          className="block rounded-xl border border-sand bg-paper px-3 py-2.5 transition-colors hover:border-gold-400"
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <KindChip kind={a.kind} />
                            <span className="text-[10px] text-soft">{newsTimeAgo(a.generated_at)}</span>
                          </div>
                          <p className="text-sm font-semibold leading-snug text-ink">{a.title}</p>
                          {a.dek && <p className="mt-0.5 line-clamp-1 text-xs text-soft">{a.dek}</p>}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  {clubNews.length > 0 && (
                    <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-soft">
                      Around the web
                    </h3>
                  )}
                  <NewsList news={news} />
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "kai" && report && (
          locked ? (
            <UpsellCard context="watchlist" />
          ) : (
            <KaiReportSection report={report} ticker={ticker} companyName={companyName} quote={quote} />
          )
        )}

        {activeTab === "community" && (
          <div className="space-y-5">
            {/* Admin thesis (if this is an "our research" pick) */}
            {adminEntry && (adminEntry.headline || adminEntry.thesis) && (
              <section className="rounded-2xl border border-gold-300/40 bg-chip-amber/20 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-gold-700" />
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-gold-700">
                    Our research
                  </span>
                </div>
                {adminEntry.headline && (
                  <h2 className="font-display text-lg font-bold text-ink">{adminEntry.headline}</h2>
                )}
                <div className="mt-2 space-y-3">
                  {toParagraphs(adminEntry.thesis).map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-midnight-200">
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* On the board */}
            {entries.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">On the board</h2>
                {entries.map((e) => {
                  const pct = pctSinceAdded(e.snapshot_price, quote?.price ?? e.latest_close);
                  const tone = pctTone(pct);
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-sand bg-midnight-900 p-3">
                      <div className="flex min-w-0 items-center gap-2 text-sm">
                        {e.kind === "admin" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-bold text-gold-700">
                            <ShieldCheck className="h-3 w-3" /> Our research
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-soft">
                            <Users2 className="h-3.5 w-3.5 text-gold-600" />
                            <span className="truncate font-semibold text-ink">{e.family_name || "A family"}</span>
                            {e.promoter_age_group && <AgeBadge ageGroup={e.promoter_age_group} />}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-soft">
                        {e.snapshot_price != null && <span>added ${e.snapshot_price.toFixed(2)}</span>}
                        <span className={`font-bold ${tone === "up" ? "text-green-600" : tone === "down" ? "text-red-600" : "text-soft"}`}>
                          {formatPct(pct)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {/* Research notes thread (typed contributions) */}
            <section id="research-notes" className="scroll-mt-20 space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-gold-600" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
                  Research notes ({comments.length})
                </h2>
              </div>
              <p className="text-xs text-soft">
                Study {companyName} together — what it makes, how it earns, what could go right or wrong.
                Tag your note so the club can find theses, risks, and questions at a glance.
              </p>

              {/* type filter chips */}
              {presentTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
                  {presentTypes.map((t) => (
                    <FilterChip key={t.key} label={t.label} active={filter === t.key} onClick={() => setFilter(t.key)} chip={t.chip} />
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {filteredComments.map((c) => {
                  const meta = contributionMeta(c.contribution_type);
                  const Icon = CONTRIB_ICON[meta.icon] ?? StickyNote;
                  return (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <Avatar name={c.author?.display_name} url={c.author?.avatar_url} />
                      <div className="min-w-0 flex-1 rounded-xl border border-sand bg-midnight-900 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.author?.username ? (
                            <Link href={`/u/${c.author.username}`} className="text-[13px] font-semibold text-ink hover:text-gold-700">
                              {c.author?.display_name || "Member"}
                            </Link>
                          ) : (
                            <span className="text-[13px] font-semibold text-ink">{c.author?.display_name || "Member"}</span>
                          )}
                          <AgeBadge ageGroup={c.author?.age_group} />
                          {c.contribution_type !== "note" && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.chip}`}>
                              <Icon className="h-2.5 w-2.5" />
                              {meta.label}
                            </span>
                          )}
                          <span className="text-[10px] text-midnight-500">· {timeAgo(c.created_at)}</span>
                          {(c.user_id === userId || role === "admin") && (
                            <button onClick={() => remove(c.id)} className="ml-auto text-midnight-500 hover:text-red-600" aria-label="Delete note">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-snug text-midnight-200">{c.body}</p>
                      </div>
                    </div>
                  );
                })}
                {filteredComments.length === 0 && (
                  <p className="rounded-xl border border-dashed border-sand px-3 py-6 text-center text-sm text-midnight-500">
                    {comments.length === 0
                      ? "No research notes yet — be the first to share what you found."
                      : "No notes of this type yet."}
                  </p>
                )}
              </div>

              {/* Composer with type picker — members only (free tier reads only) */}
              {!canVote ? (
                <p className="rounded-xl border border-dashed border-sand px-3 py-4 text-center text-sm text-soft">
                  Join the Family Investing Club to add your own research notes.
                </p>
              ) : (
                <div className="rounded-xl border border-sand bg-midnight-900 p-3">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {CONTRIBUTION_TYPES.map((t) => {
                      const Icon = CONTRIB_ICON[t.icon] ?? StickyNote;
                      return (
                        <button
                          key={t.key}
                          onClick={() => setDraftType(t.key)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${
                            draftType === t.key ? t.chip : "border border-sand text-soft hover:bg-paper"
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      if (err) setErr("");
                    }}
                    rows={2}
                    placeholder={`Add a ${contributionMeta(draftType).label.toLowerCase()} about ${companyName}…`}
                    className="w-full resize-none rounded-lg border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
                  />
                  {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
                  <div className="mt-2 flex justify-end">
                    <button onClick={post} disabled={posting || !draft.trim()} className="cta-button inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm disabled:opacity-60">
                      <Send className="h-4 w-4" />
                      {posting ? "Posting…" : "Post note"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <footer className="mt-8 border-t border-sand pt-5">
        <p className="text-[11px] leading-relaxed text-soft">{COMMUNITY_DISCLAIMER}</p>
      </footer>
    </div>
  );
}

/* ─────────────────────────────── Overview tab ──────────────────────────── */

function OverviewTab({
  research,
  keyStats,
  companyName,
  ungraded,
  locked,
  isKid,
  hasReport,
  onOpenKai,
}: {
  research: ResearchPayload | null;
  keyStats: ResearchPayload["keyStats"] | null;
  companyName: string;
  ungraded: boolean;
  locked: boolean;
  isKid: boolean;
  hasReport: boolean;
  onOpenKai: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Strengths & weaknesses */}
      {research && !ungraded && (
        <section className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
          <h2 className="mb-3 font-display text-base font-bold text-ink">Strengths &amp; weaknesses</h2>
          <Scorecard
            grades={research.grades}
            locked={locked}
            upsell={<UpsellCard context="watchlist" />}
            mode="detail"
          />
        </section>
      )}

      {/* Key stats */}
      {keyStats && (
        <section className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
          <h2 className="mb-3 font-display text-base font-bold text-ink">Key stats</h2>
          <KeyStatsGrid k={keyStats} />
        </section>
      )}

      {/* About */}
      {research?.company.description && (
        <section className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
          <h2 className="mb-3 font-display text-base font-bold text-ink">About {companyName}</h2>
          <CompanyProfileCard company={research.company} kidsMode={isKid} />
        </section>
      )}

      {/* Kai report teaser → its own tab */}
      {hasReport && (
        <button
          type="button"
          onClick={onOpenKai}
          className="flex w-full items-center gap-3 rounded-2xl border border-gold-300/50 bg-chip-amber/20 p-5 text-left transition-colors hover:bg-chip-amber/40"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-gold-700" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold text-ink">Kai Research Report available</p>
            <p className="mt-0.5 text-xs text-soft">
              A deep-dive on {companyName} — the business, the numbers, the thesis, and how to explain
              it to your kids. Open the Kai Report tab.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-gold-700" />
        </button>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  chip,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  chip?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        active ? chip || "bg-gold-500 text-white" : "border border-sand text-soft hover:bg-paper"
      }`}
    >
      {label}
    </button>
  );
}

// R5 — ticker community aggregation header. One RPC (get_ticker_community_stats).
// Counts hide below sane thresholds; the whole strip hides when nothing qualifies
// so a cold ticker never shows sad zeros.
interface CommunityStats {
  watching: number;
  discussions_week: number;
  bull: number;
  neutral: number;
  bear: number;
  positioned: number;
}
function CommunityAggBar({ supabase, ticker }: { supabase: SupabaseClient; ticker: string }) {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  useEffect(() => {
    let on = true;
    supabase
      .rpc("get_ticker_community_stats", { p_ticker: ticker })
      .then(({ data }) => {
        if (!on) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (row) setStats(row as CommunityStats);
      });
    return () => {
      on = false;
    };
  }, [supabase, ticker]);
  if (!stats) return null;

  const showWatching = stats.watching >= 3;
  const showDiscussions = stats.discussions_week >= 1;
  const showBullish = stats.positioned >= 4;
  const bullishPct = showBullish ? Math.round((stats.bull / stats.positioned) * 100) : 0;
  if (!showWatching && !showDiscussions && !showBullish) return null;

  const items: { icon: React.ElementType; text: React.ReactNode }[] = [];
  if (showWatching) items.push({ icon: Users2, text: <><span className="font-bold text-ink">{stats.watching}</span> watching</> });
  if (showDiscussions) items.push({ icon: MessageCircle, text: <><span className="font-bold text-ink">{stats.discussions_week}</span> {stats.discussions_week === 1 ? "discussion" : "discussions"} this week</> });
  if (showBullish) items.push({ icon: TrendingUp, text: <><span className="font-bold text-ink">{bullishPct}%</span> leaning bullish</> });

  return (
    <div className="mt-3 flex items-center gap-x-4 gap-y-1.5 flex-wrap rounded-xl bg-chip-amber/25 border border-gold-300/60 px-3 py-2">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs text-soft font-body">
            <Icon className="w-3.5 h-3.5 text-gold-600" />
            {it.text}
          </span>
        );
      })}
    </div>
  );
}
