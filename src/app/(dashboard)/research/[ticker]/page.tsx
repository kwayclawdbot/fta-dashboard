"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
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
import Scorecard from "@/components/research/Scorecard";
import PriceTechnicals from "@/components/research/PriceTechnicals";
import Collapsible from "@/components/research/Collapsible";
import {
  KeyStatsGrid,
  CompanyProfileCard,
  NewsList,
  FinancialsSection,
} from "@/components/research/ResearchSections";
import { fetchResearch, type ResearchPayload } from "@/lib/research/types";
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

export default function TickerResearchPage() {
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
  const [research, setResearch] = useState<ResearchPayload | null>(null);
  const [bars, setBars] = useState<MarketBar[]>([]);
  const [news, setNews] = useState<NewsHeadline[]>([]);
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<ContributionType>("note");
  const [filter, setFilter] = useState<string>("all");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setTierResolved(true);
      return;
    }
    setUserId(user.id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id, role, age_group")
      .eq("id", user.id)
      .maybeSingle();
    setRole(profile?.role || "parent");
    setAgeGroup(profile?.age_group ?? null);
    const t = await getFamilyTier(supabase, profile?.family_id);
    setTier(t);
    setTierResolved(true);

    // Board entries for this ticker (attribution + snapshot + latest close).
    const { data: board } = await supabase.rpc("get_community_board");
    const all = ((board || {}) as { entries?: CommunityEntry[] }).entries || [];
    setEntries(all.filter((e) => e.ticker.toUpperCase() === ticker));

    // Canonical per-ticker wiki thread (typed contributions).
    const { data: rows } = await supabase
      .from("community_ticker_comments")
      .select(COMMENT_SELECT)
      .eq("ticker", ticker)
      .order("created_at", { ascending: true });
    setComments((rows || []).map(normComment));

    // Latest published Kai research report (if any).
    const { data: rep } = await supabase.rpc("get_latest_kai_report", { p_ticker: ticker });
    setReport((rep as KaiReport) ?? null);

    setLoading(false);
    fetchQuote(ticker).then(setQuote);
    fetchResearch(ticker).then(setResearch);
    fetchNews(ticker, 6).then(setNews);
    fetchBars(ticker, "2y").then(setBars);
  }, [supabase, ticker]);

  useEffect(() => {
    // load() setStates only after awaits (data arrives async) — the initial
    // render is the skeleton; this fills it in once the session resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const companyName = useMemo(
    () => research?.company.name || entries.find((e) => e.company_name)?.company_name || ticker,
    [research, entries, ticker]
  );

  const isKid = ageGroup === "kids";
  const locked = tier === "free" && !isKid;
  const canVote = tier !== "free";

  // True 52-week high/low from the last ~252 daily closes (accurate — the
  // screener's trailing-window distance is only an approximation and can read
  // below the live price). Falls back to the payload when bars aren't loaded.
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

  if (loading || !tierResolved) {
    return <DashboardSkeleton variant="detail" title={ticker} />;
  }

  const adminEntry = entries.find((e) => e.kind === "admin") || null;
  const threadHref = "#research-notes";

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-20 sm:px-6">
      <Link
        href="/watchlist/community"
        className="inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Community Watchlist
      </Link>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
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
          </div>
        </div>

        {keyStats && (
          <RangeBar
            low={keyStats.week52Low}
            high={keyStats.week52High}
            price={quote?.price ?? keyStats.week52High}
          />
        )}

        {/* Social bar — hero variant */}
        <div className="mt-4 border-t border-sand pt-4">
          <SocialBar
            supabase={supabase}
            ticker={ticker}
            variant="hero"
            userId={userId}
            ageGroup={ageGroup}
            canVote={canVote}
            threadHref={threadHref}
            showConsensus
          />
        </div>
      </m.div>

      {/* ── Scorecard (gauge + rings + strengths/weaknesses + checks) ─────── */}
      {research ? (
        research.insufficient && research.grades.overall.graded === 0 ? (
          <section className="rounded-2xl border border-sand bg-midnight-900 p-5 text-center shadow-soft">
            <p className="text-sm text-soft">
              We don&apos;t have enough published financials to grade {companyName} yet — many smaller
              companies and funds don&apos;t report the numbers our scorecard needs. The price chart,
              news, and community research below still work.
            </p>
          </section>
        ) : (
          <Scorecard
            grades={research.grades}
            locked={locked}
            upsell={<UpsellCard context="watchlist" />}
          />
        )
      ) : (
        <div className="h-56 animate-pulse rounded-2xl bg-sand/40" />
      )}

      {/* ── Price + technicals (visible to everyone incl. free) ──────────── */}
      {research && (
        <section className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
          <h2 className="mb-4 font-display text-base font-bold text-ink">Price & technicals</h2>
          <PriceTechnicals symbol={ticker} momentum={research.momentum} bars={bars} />
        </section>
      )}

      {/* ── Key stats grid ───────────────────────────────────────────────── */}
      {keyStats && (
        <section className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
          <h2 className="mb-3 font-display text-base font-bold text-ink">Key stats</h2>
          <KeyStatsGrid k={keyStats} />
        </section>
      )}

      {/* ── Fundamentals (collapsed; gated for free) ─────────────────────── */}
      {research && keyStats && !research.insufficient && (
        <Collapsible
          storageKey="fundamentals"
          title="Fundamentals"
          subtitle="Revenue, profit, balance sheet, and valuation charts"
        >
          {locked ? (
            <UpsellCard context="watchlist" />
          ) : (
            <FinancialsSection
              charts={research.charts}
              keyStats={keyStats}
              medians={research.sectorMedians}
            />
          )}
        </Collapsible>
      )}

      {/* ── About (collapsed) ────────────────────────────────────────────── */}
      {research?.company.description && (
        <Collapsible storageKey="about" title={`About ${companyName}`} subtitle="What the company does">
          <CompanyProfileCard company={research.company} kidsMode={isKid} />
        </Collapsible>
      )}

      {/* ── News (collapsed) ─────────────────────────────────────────────── */}
      <Collapsible storageKey="news" title="News" subtitle="Recent headlines from around the web">
        <NewsList news={news} />
      </Collapsible>

      {/* ── Kai Research Report (premium long-form, if generated) ─────────── */}
      {report && (
        <KaiReportSection report={report} ticker={ticker} companyName={companyName} quote={quote} />
      )}

      {/* ── Admin thesis (if this is an "our research" pick) ──────────────── */}
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

      {/* ── On the board ─────────────────────────────────────────────────── */}
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

      {/* ── Research notes thread (typed contributions) ──────────────────── */}
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

      <footer className="border-t border-sand pt-5">
        <p className="text-[11px] leading-relaxed text-soft">{COMMUNITY_DISCLAIMER}</p>
      </footer>
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
