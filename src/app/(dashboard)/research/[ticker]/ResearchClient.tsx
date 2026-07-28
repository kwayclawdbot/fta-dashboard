"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldCheck,
  Users2,
  Newspaper,
  FileText,
  Eye,
  Share2,
  GraduationCap,
  Check,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { fetchQuote, fetchNews, fetchBars, type MarketQuote, type MarketBar, type NewsHeadline } from "@/lib/market/client";
import { checkClean, PROFANITY_MESSAGE } from "@/lib/profanity";
import AgeBadge from "@/components/community/AgeBadge";
import UpsellCard from "@/components/dashboard/UpsellCard";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import type { KaiReport } from "@/lib/kai/report";
import SetAlertButton, { type AlertLevel } from "@/components/alerts/SetAlertButton";
import Fundamentals from "@/components/research/Fundamentals";
import { letterColor } from "@/components/research/GradeVisuals";
import PriceTechnicals from "@/components/research/PriceTechnicals";
import { Card, CardLabel, SectionMark } from "@/components/research/board";
import ResearchTabBar, {
  RESEARCH_TABS,
  tabId,
  panelId,
  type ResearchTabKey,
} from "@/components/research/ResearchTabs";
import { useKaiSheet } from "@/components/kai/KaiSheetProvider";
import ContinuePath from "@/components/learn/ContinuePath";
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
import { type ContributionType } from "@/lib/research/social";
import TickerDebate from "@/components/social/TickerDebate";
import ChangedMyMind from "@/components/social/ChangedMyMind";
import ResearchObjectCard from "@/components/social/ResearchObjectCard";
import ResearchObjectCompose from "@/components/social/ResearchObjectCompose";
import Gated from "@/components/entitlements/Gated";
import ContextualWall from "@/components/entitlements/ContextualWall";
import { fetchTickerTheses, type ResearchObjectCard as ThesisCard } from "@/lib/social/research-object";
import {
  pctSinceAdded,
  formatPct,
  pctTone,
  toParagraphs,
  COMMUNITY_DISCLAIMER,
  type CommunityEntry,
} from "@/lib/community-watchlist";
import ResearchCanvas from "./ResearchCanvas";
import ClubRead, { useClubRead } from "./ClubRead";
import ClubTickerStrip from "./ClubTickerStrip";
import KaiReportPanel from "./KaiReportPanel";
import TickerDiscussion from "./TickerDiscussion";

const COMMENT_SELECT =
  "id, ticker, user_id, body, contribution_type, created_at, author:profiles(display_name, avatar_url, age_group, username)";

/** Dynamic back-breadcrumb (J2 fix) — reflect the true referrer instead of
 *  always claiming "Community Watchlist". Keyed by an explicit `?from=` param
 *  (deep-links set it) with a same-origin referrer fallback. */
type BackTarget = { href: string; label: string };
const BACK_MAP: Record<string, BackTarget> = {
  screener: { href: "/screener", label: "Stock Finder" },
  community: { href: "/watchlist/community", label: "Community Watchlist" },
  watchlist: { href: "/watchlist", label: "My Watchlist" },
  discover: { href: "/discover", label: "Discover" },
  news: { href: "/news", label: "Newsroom" },
};
const BACK_DEFAULT: BackTarget = BACK_MAP.community;

function backFromReferrer(): BackTarget | null {
  try {
    const from = new URLSearchParams(window.location.search).get("from");
    if (from && BACK_MAP[from]) return BACK_MAP[from];
    if (!document.referrer) return null;
    const ref = new URL(document.referrer);
    if (ref.origin !== window.location.origin) return null;
    const p = ref.pathname;
    if (p.startsWith("/screener")) return BACK_MAP.screener;
    if (p.startsWith("/watchlist/community")) return BACK_MAP.community;
    if (p.startsWith("/watchlist")) return BACK_MAP.watchlist;
    if (p.startsWith("/discover")) return BACK_MAP.discover;
    if (p.startsWith("/news")) return BACK_MAP.news;
    if (p.startsWith("/community")) return { href: "/community", label: "Community" };
  } catch {
    /* ignore — keep default */
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

/* timeAgo / Avatar / the contribution-icon map moved to TickerDiscussion with
   the thread itself — the client no longer renders a note. */

/* The 52-week range marker now lives on the canvas head (ResearchCanvas →
   RangeRail), drawn as a hairline rail with an INK tick rather than a gold pill
   — position is not a direction, so it never takes a semantic colour. */

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

export default function ResearchClient({
  initialResearch = null,
  initialReport = null,
  reportSeeded = false,
}: {
  /** Server-fetched aggregate for instant first paint (Lane 12C). May be null
   *  when the server couldn't compose it; the client then fetches/refreshes. */
  initialResearch?: ResearchPayload | null;
  /** Server-seeded Kai report (canvas v2 L3) — null when there isn't one. */
  initialReport?: KaiReport | null;
  /** Whether the server's report READ COMPLETED. Distinct from `initialReport
   *  != null`: a completed read that found nothing is a resolved absence and the
   *  Kai tab may show its founding state; a failed read is not, and the tab
   *  stays on its skeleton until the client retry lands. */
  reportSeeded?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { openKai } = useKaiSheet();
  const params = useParams<{ ticker: string }>();
  const ticker = (params?.ticker || "").toString().toUpperCase();

  // ONE read of what the club thinks, shared by the canvas head (the watching
  // stack + the club-rank pill) and the sentiment ring — the same rows, so the
  // faces and the numbers can never disagree.
  const club = useClubRead(supabase, ticker);

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [tierResolved, setTierResolved] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("parent");
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [entries, setEntries] = useState<CommunityEntry[]>([]);
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [report, setReport] = useState<KaiReport | null>(initialReport);
  const [reportResolved, setReportResolved] = useState(reportSeeded);
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
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");
  const [theses, setTheses] = useState<ThesisCard[]>([]);
  // LOADING IS NOT EMPTY. `loading` is cleared by the TIER read, but comments and
  // theses are secondary reads kicked off AFTER it — so the page un-skeletons
  // with both still `[]` and flashed "No published theses yet" / "No research
  // notes yet". These two flags follow the same pattern the file already uses
  // for `researchResolved` / `barsState` / `newsState`.
  const [thesesResolved, setThesesResolved] = useState(false);
  const [commentsResolved, setCommentsResolved] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  // ── TAB STATE ────────────────────────────────────────────────────────────
  // Deep-linkable: `?tab=fundamentals` or `#fundamentals`. Resolved in an effect
  // (not during render) so the server and the first client paint agree, then
  // written back with replaceState so the URL is shareable without adding a
  // history entry per tab. Only tab keys are matched, so the page's existing
  // `#research-notes` / `#practice` anchors still behave as anchors.
  const [tab, setTab] = useState<ResearchTabKey>("overview");

  const selectTab = useCallback((k: ResearchTabKey) => {
    setTab(k);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", k);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* history unavailable — the tab still switches */
    }
  }, []);

  const [back, setBack] = useState<BackTarget>(BACK_DEFAULT);
  const barsReq = useRef(false);
  const newsReq = useRef(false);
  const initRef = useRef(false);

  // Data lanes, deliberately NOT keyed to the tab union: bars feed the canvas
  // head chart (always visible) as well as the Technicals panel, so both lanes
  // stay eager. Tabs change what is COMPOSED, never what is fetched — switching
  // a tab must not stall on a request.
  const ensureTabData = useCallback(
    (lane: "charts" | "news") => {
      if (lane === "charts" && !barsReq.current) {
        barsReq.current = true;
        setBarsState("loading");
        fetchBars(ticker, "2y").then((b) => {
          setBars(b);
          setBarsState("done");
        });
      }
      if (lane === "news" && !newsReq.current) {
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
      .then(
        ({ data: rows }) => {
          setComments((rows || []).map(normComment));
          setCommentsResolved(true);
        },
        () => setCommentsResolved(true)
      );

    // Refresh (and the retry path when the server seed failed). LOADING IS NOT
    // EMPTY: `reportResolved` only ever goes true, so the Kai tab can tell "no
    // report exists" from "the read hasn't answered".
    supabase.rpc("get_latest_kai_report", { p_ticker: ticker }).then(
      ({ data: rep }) => {
        setReport((rep as KaiReport) ?? null);
        setReportResolved(true);
      },
      () => setReportResolved(true)
    );

    // Research Objects (structured theses) for this ticker (SOCIAL OBJECTS S1).
    fetchTickerTheses(supabase, ticker).then(
      (t) => {
        setTheses(t);
        setThesesResolved(true);
      },
      () => setThesesResolved(true)
    );

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
    load();
  }, [load]);

  // Resolve the back-breadcrumb from the referrer/param (client-only, so it
  // can't cause a hydration mismatch — defaults to Community Watchlist).
  useEffect(() => {
    const next = backFromReferrer();
    if (next) setBack(next);
  }, []);

  // Deep-link the analysis tab (client-only, same hydration reasoning).
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const raw = (sp.get("tab") || window.location.hash.replace("#", "")).toLowerCase();
      const hit = RESEARCH_TABS.find((t) => t.key === raw);
      if (hit) setTab(hit.key);
    } catch {
      /* stay on Overview */
    }
  }, []);

  // CONVERGENCE S2 — canonical single scroll: no tabs, so the formerly tab-gated
  // data (charts bars + news) loads once as soon as the page is ready.
  useEffect(() => {
    if (loading || !tierResolved || initRef.current) return;
    initRef.current = true;
    ensureTabData("charts");
    ensureTabData("news");
  }, [loading, tierResolved, ensureTabData]);

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

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      {/* ── BOARD 03 — the ticker head, rebuilt to the mockup ────────────────
          Back / watch / share row, logo + name + club-rank pill, the mark, the
          watching stack, the chart CARD with its member marks and filled range
          pills, four measure cards, and the Kai band. */}
      <ResearchCanvas
        ticker={ticker}
        companyName={companyName}
        quote={quote}
        research={research}
        dailyBars={bars}
        supabase={supabase}
        back={back}
        clubRank={club.rank}
        watchers={club.watchers}
        faces={club.faces}
        onAskKai={() =>
          openKai({ chip: ticker, query: `What should I know about ${ticker} right now?` })
        }
      />

      {/* ── 3 compact actions — Watch · Practice · Share ───────────────────── */}
      <TickerActions
        ticker={ticker}
        canAlert={ageGroup !== "kids" && ageGroup !== "teens"}
        seedPrice={quote?.price ?? null}
        levels={researchLevels(quote?.price ?? null, keyStats)}
      />

      {/* ── THE COMMUNITY LAYER — persistent, ABOVE the analysis ─────────────
          Both blocks sit OUTSIDE the tab system, so they are on screen whichever
          analysis tab is open. Placing them before the tab strip is what makes
          the discussion reachable at 390px without scrolling past a whole panel
          — and it is the honest order for a community product: what the club
          thinks and what the club is saying come before the analyst tabs. */}
      <div className="mt-8 space-y-8">
        <ClubRead data={club} showSentiment={!isKid} />

        <TickerDiscussion
          ticker={ticker}
          companyName={companyName}
          comments={comments}
          commentsResolved={commentsResolved}
          userId={userId}
          role={role}
          canPost={canVote}
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

      {/* ── THE ANALYSIS — four tabbed subpages ──────────────────────────────
          Everything from strengths-and-weaknesses down used to be one vertical
          scroll. It is now real navigation the member clicks through. */}
      <div className="mt-10">
        <ResearchTabBar
          active={tab}
          onSelect={selectTab}
          head={{
            ticker,
            companyName,
            price: quote?.price ?? null,
            changePct: quote?.changePercent ?? null,
          }}
        />

        {tab === "overview" && (
          <div
            id={panelId("overview")}
            role="tabpanel"
            aria-labelledby={tabId("overview")}
            tabIndex={0}
            className="mt-7 space-y-10 focus:outline-none"
          >
            {/* The scorecard POINTER. The full grade object lives on the
                Fundamentals subpage (board 13's financial-health ring), so
                Overview carries a card that states the grade and hands the
                member across — the same read printed twice on one page is what
                made this scroll interminable. */}
            {research ? (
              ungraded ? (
                <Card radius="md" className="px-4 py-3.5">
                  <CardLabel>Scorecard</CardLabel>
                  <p className="mt-2 text-[13px] leading-relaxed text-soft">
                    We don&apos;t have enough published financials to grade {companyName}{" "}
                    yet — many smaller companies and funds don&apos;t report the numbers
                    our scorecard needs. The price chart, news, and community research
                    below still work.
                  </p>
                </Card>
              ) : (
                <button
                  type="button"
                  onClick={() => selectTab("fundamentals")}
                  className="f0-focus block w-full text-left"
                >
                  <Card radius="md" className="flex items-center gap-3.5 px-4 py-3.5">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-[17px] font-extrabold text-white"
                      style={{ backgroundColor: letterColor(research.grades.overall.letter) }}
                      aria-hidden
                    >
                      {research.grades.overall.letter ?? "—"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <CardLabel>Financial health</CardLabel>
                      <span className="mt-1 block font-display text-[16px] font-extrabold text-ink">
                        {research.grades.overall.label ?? "Not enough data"}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-soft">
                        {research.grades.overall.graded} of 4 areas graded
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-gold-700">
                      Open ›
                    </span>
                  </Card>
                </button>
              )
            ) : researchResolved ? (
              <Card radius="md" className="px-4 py-3.5">
                <p className="text-[13px] leading-relaxed text-soft">
                  The scorecard for {companyName} is updating and will be back shortly.
                  The price, charts, news, and community research below still work.
                </p>
              </Card>
            ) : (
              <Card radius="md" className="h-[84px] motion-safe:animate-pulse" />
            )}

            {/* Kai's read has its own subpage (board 14), so Overview carries a
                POINTER. Kai blue, and only when a report actually exists. */}
            {report && (
              <button
                type="button"
                onClick={() => selectTab("kai")}
                className="f0-focus block w-full text-left"
              >
                <Card tone="kai" radius="md" className="flex items-center gap-3 px-4 py-3.5">
                  <Sparkles className="h-4 w-4 shrink-0 text-kai-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <CardLabel tone="kai">Kai research report</CardLabel>
                    <span className="mt-1 block truncate text-[13.5px] font-semibold text-ink">
                      {report.sections.headline || `Kai's read on ${companyName}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-kai-600">
                    Read ›
                  </span>
                </Card>
              </button>
            )}

            {/* Admin thesis (if this is an "our research" pick). */}
            {adminEntry && (adminEntry.headline || adminEntry.thesis) && (
              <Card tone="brand" radius="md" className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold-700" />
                  <CardLabel tone="brand">Our research</CardLabel>
                </div>
                {adminEntry.headline && (
                  <h2 className="mt-2 font-display text-[17px] font-extrabold leading-tight text-ink">
                    {adminEntry.headline}
                  </h2>
                )}
                <div className="mt-2.5 space-y-3">
                  {toParagraphs(adminEntry.thesis).map((p, i) => (
                    <p key={i} className="text-[13px] leading-relaxed text-midnight-200">
                      {p}
                    </p>
                  ))}
                </div>
              </Card>
            )}

            {/* Research Objects (structured theses) + the ONE gated publish entry
                point (TODO(gate:research_publish) lives in the composer + API
                route). Kids never see the composer. */}
            <section>
              <SectionMark
                action={
                  canVote && !isKid && !showCompose ? (
                    <button
                      onClick={() => setShowCompose(true)}
                      className="f0-focus inline-flex shrink-0 items-center gap-1.5 rounded-full bg-volt-500 px-3 py-1.5 text-[11px] font-bold text-[#1A1614] transition-colors hover:bg-volt-600"
                    >
                      <FileText className="h-3.5 w-3.5" /> Publish a thesis
                    </button>
                  ) : undefined
                }
              >
                Theses on {ticker}
              </SectionMark>
              <div className="mt-3.5">
                {showCompose && (
                  // Gate the structured-thesis composer (paid Cheat Code Club).
                  // Free members get the contextual wall here; Challenge-Pass
                  // holders get the countdown ribbon + the composer. Server
                  // enforces the same on POST /api/social/research. The basic
                  // free ticker post stays on the untouched community composer.
                  <Gated
                    feature="publish_thesis"
                    fallback={<ContextualWall feature="publish_thesis" variant="band" />}
                  >
                    <ResearchObjectCompose
                      ticker={ticker}
                      companyName={companyName}
                      onCancel={() => setShowCompose(false)}
                      onPublished={(id) => {
                        setShowCompose(false);
                        fetchTickerTheses(supabase, ticker).then(setTheses, () => {});
                        router.push(`/research/thesis/${id}`);
                      }}
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
                  /* Still arriving — claim nothing. "No published theses yet" is
                     only true once the read has actually come back. */
                  <div
                    className="h-3.5 w-56 max-w-full rounded-full bg-ink/10 motion-safe:animate-pulse"
                    aria-hidden
                  />
                ) : (
                  !showCompose && (
                    <p className="text-[13px] text-soft">
                      No published theses yet
                      {canVote && !isKid
                        ? " — publish the first structured thesis for the club."
                        : "."}
                    </p>
                  )
                )}
              </div>
            </section>

            {/* SOCIAL OBJECTS S1 — per-ticker debate (kid-walled in the RPC →
                renders nothing for kids or tickers without a debate). */}
            <TickerDebate
              supabase={supabase}
              ticker={ticker}
              userId={userId}
              canParticipate={canVote && !isKid}
            />

            {/* Changed My Mind — the member's stance + flip flow (kid-walled) +
                the club's recent "changed their mind" moments. */}
            {!isKid && (
              <section className="f0-rule-top pt-6">
                <ChangedMyMind
                  supabase={supabase}
                  ticker={ticker}
                  userId={userId}
                  canFlip={canVote && !isKid}
                />
              </section>
            )}

            {/* On the board — one card, rows inside it */}
            {entries.length > 0 && (
              <section>
                <SectionMark>On the board</SectionMark>
                <Card radius="md" className="mt-3 px-4 py-1">
                  {entries.map((e) => {
                    const pct = pctSinceAdded(e.snapshot_price, quote?.price ?? e.latest_close);
                    const tone = pctTone(pct);
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-3 border-b border-sand py-3 last:border-b-0"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                          {e.kind === "admin" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-bold text-gold-700">
                              <ShieldCheck className="h-3 w-3" /> Our research
                            </span>
                          ) : (
                            <span className="inline-flex min-w-0 items-center gap-1.5 text-soft">
                              <Users2 className="h-3.5 w-3.5 shrink-0 text-gold-600" />
                              <span className="truncate font-semibold text-ink">
                                {e.family_name || "A family"}
                              </span>
                              {e.promoter_age_group && <AgeBadge ageGroup={e.promoter_age_group} />}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] tabular-nums text-soft">
                          {e.snapshot_price != null && (
                            <span>added {e.snapshot_price.toFixed(2)}</span>
                          )}
                          <span
                            className={`font-semibold ${
                              tone === "up"
                                ? "text-price-up"
                                : tone === "down"
                                  ? "text-price-down"
                                  : "text-soft"
                            }`}
                          >
                            {formatPct(pct)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </section>
            )}

            {/* About — description + the company definition ledger */}
            {research?.company.description && (
              <section>
                <SectionMark>About {companyName}</SectionMark>
                <Card radius="md" className="mt-3 px-4 py-3.5">
                  <CompanyProfileCard company={research.company} kidsMode={isKid} />
                </Card>
              </section>
            )}
          </div>
        )}

        {tab === "technicals" && (
          <div
            id={panelId("technicals")}
            role="tabpanel"
            aria-labelledby={tabId("technicals")}
            tabIndex={0}
            className="mt-7 focus:outline-none"
          >
            {research && barsState === "done" ? (
              <PriceTechnicals symbol={ticker} momentum={research.momentum} bars={bars} />
            ) : (
              <div className="space-y-3" aria-busy="true">
                <Card className="h-[104px] motion-safe:animate-pulse" />
                <div className="flex gap-2.5">
                  <Card radius="sm" className="h-[92px] flex-1 motion-safe:animate-pulse" />
                  <Card radius="sm" className="h-[92px] flex-1 motion-safe:animate-pulse" />
                </div>
                <Card radius="md" className="h-[188px] motion-safe:animate-pulse" />
              </div>
            )}
          </div>
        )}

        {tab === "fundamentals" && (
          <div
            id={panelId("fundamentals")}
            role="tabpanel"
            aria-labelledby={tabId("fundamentals")}
            tabIndex={0}
            className="mt-7 space-y-8 focus:outline-none"
          >
            {/* Board 13 — the health ring, revenue, the margin rings and the
                valuation bars, plus strengths / weaknesses as cards. */}
            {research ? (
              <Fundamentals
                research={research}
                companyName={companyName}
                locked={locked}
                upsell={<UpsellCard context="watchlist" />}
              />
            ) : (
              <div className="space-y-3" aria-busy="true">
                <Card className="h-[104px] motion-safe:animate-pulse" />
                <Card radius="md" className="h-[150px] motion-safe:animate-pulse" />
              </div>
            )}

            {keyStats && (
              <section>
                <SectionMark>Key stats</SectionMark>
                <Card radius="md" className="mt-3 px-4 py-1">
                  <KeyStatsGrid k={keyStats} />
                </Card>
              </section>
            )}

            <section>
              <SectionMark>The charts</SectionMark>
              <div className="mt-3">
                {!research || !keyStats ? (
                  <Card radius="md" className="h-64 motion-safe:animate-pulse" />
                ) : research.insufficient ? (
                  <Card radius="md" className="px-4 py-8">
                    <p className="text-center text-[13px] leading-relaxed text-soft">
                      We don&apos;t have enough published financials for {companyName} to
                      chart yet — many smaller companies and funds don&apos;t report the
                      quarterly numbers these charts need.
                    </p>
                  </Card>
                ) : locked ? (
                  <UpsellCard context="watchlist" />
                ) : (
                  <Card radius="md" className="px-4 py-3.5">
                    <FinancialsSection
                      charts={research.charts}
                      keyStats={keyStats}
                      medians={research.sectorMedians}
                    />
                  </Card>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ── KAI REPORT — the canvas's fifth ticker subpage (board 14) ──────
            Everything Kai has written on this name, or an honest founding state
            when it hasn't. No verdict, no confidence dial, no options flow —
            see KaiReportPanel for why each of the three is out. */}
        {tab === "kai" && (
          <div
            id={panelId("kai")}
            role="tabpanel"
            aria-labelledby={tabId("kai")}
            tabIndex={0}
            className="mt-7 focus:outline-none"
          >
            <KaiReportPanel
              ticker={ticker}
              companyName={companyName}
              report={report}
              // The tier gate is part of "resolved" here: `locked` defaults to
              // TRUE until the tier read lands, so without this a paying member
              // would see the upsell wall flash before their own report. A
              // skeleton is the honest thing to show while entitlement is
              // unknown.
              resolved={reportResolved && tierResolved}
              locked={locked}
              upsell={<UpsellCard context="watchlist" />}
              onAskKai={() =>
                openKai({
                  chip: ticker,
                  query: `What should I know about ${ticker} right now?`,
                })
              }
            />
          </div>
        )}

        {tab === "news" && (
          <div
            id={panelId("news")}
            role="tabpanel"
            aria-labelledby={tabId("news")}
            tabIndex={0}
            className="mt-7 focus:outline-none"
          >
            {newsState !== "done" ? (
              <div className="space-y-2.5" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <Card key={i} radius="md" className="h-16 motion-safe:animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-7">
                {clubNews.length > 0 && (
                  <section>
                    <SectionMark suffix="Club recaps">From the Club Newsroom</SectionMark>
                    <div className="mt-3 space-y-2.5">
                      {clubNews.map((a) => (
                        <Link key={a.slug} href={`/news/${a.slug}`} className="f0-focus block">
                          <Card radius="md" className="group px-4 py-3">
                            <span className="mb-1.5 flex items-center gap-2">
                              <KindChip kind={a.kind} />
                              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-soft">
                                {newsTimeAgo(a.generated_at)}
                              </span>
                            </span>
                            <span className="block text-[13.5px] font-semibold leading-snug text-ink group-hover:text-gold-700">
                              {a.title}
                            </span>
                            {a.dek && (
                              <span className="mt-1 block line-clamp-1 text-[11.5px] text-soft">
                                {a.dek}
                              </span>
                            )}
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
                <section>
                  <SectionMark suffix="Headlines from around the web">
                    <span className="inline-flex items-center gap-1.5">
                      <Newspaper className="h-3 w-3" aria-hidden /> News
                    </span>
                  </SectionMark>
                  <Card radius="md" className="mt-3 px-4 py-1">
                    <NewsList news={news} />
                  </Card>
                </section>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Practice — the ticker-relevant Continue Path lesson (amendment #3).
          Outside the tabs so the "Practice" action always resolves. */}
      <div id="practice" className="mt-12 scroll-mt-20">
        <ContinuePath pickup={null} ticker={ticker} />
      </div>

      {/* The way out — nine identity marks and nine deltas (canvas TickerTile).
          Outside the tabs, because leaving a ticker page is not an analysis. */}
      <ClubTickerStrip ticker={ticker} />

      <footer className="mt-10 border-t border-sand pt-5">
        <p className="text-[11px] leading-relaxed text-soft">{COMMUNITY_DISCLAIMER}</p>
      </footer>
    </div>
  );
}

/* ─────────────── 3 compact actions (Watch · Practice · Share) ────────────────
   Canonical ticker page (CONVERGENCE S2): one compact action row directly under
   the canvas head. Ask Kai is NOT here — it earned its own Kai-blue band inside
   the head, so it stops competing as one pill among four. Watch = the kid-gated
   price-alert control; Practice jumps to the ContinuePath lesson (amendment #3);
   Share copies / shares the page. */
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
    const title = `${ticker} on Cheat Code`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      /* dismissed / unsupported */
    }
  }

  function onPractice() {
    document.getElementById("practice")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Three pill actions, matching the board's control language.
  const cell =
    "f0-focus flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sand bg-card py-2.5 text-[12.5px] font-bold text-ink shadow-soft transition-colors hover:border-volt-300 hover:text-gold-700";

  return (
    <div className="mt-5 flex gap-2">
      {canAlert ? (
        <div className="flex flex-1 items-center justify-center rounded-full border border-sand bg-card shadow-soft transition-colors hover:border-volt-300">
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
      ) : (
        <button type="button" onClick={onPractice} className={cell}>
          <Eye className="h-4 w-4" /> Watch
        </button>
      )}

      <button type="button" onClick={onPractice} className={cell}>
        <GraduationCap className="h-4 w-4" /> Practice
      </button>

      <button type="button" onClick={onShare} className={cell}>
        {shared ? <Check className="h-4 w-4 text-gold-700" /> : <Share2 className="h-4 w-4" />}
        {shared ? "Copied" : "Share"}
      </button>
    </div>
  );
}

/* The old `Section` helper (an f0 hairline section-rule wrapping an un-boxed
   body) is gone: every block on these subpages is now the board's own object —
   a brand-orange `SectionMark` over one or more `Card`s. */
