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
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import { fetchQuote, type MarketQuote } from "@/lib/market/client";
import { checkClean, PROFANITY_MESSAGE } from "@/lib/profanity";
import CompanyLogo from "@/components/fic/CompanyLogo";
import LivePrice from "@/components/fic/LivePrice";
import Sparkline from "@/components/fic/Sparkline";
import AgeBadge from "@/components/community/AgeBadge";
import UpsellCard from "@/components/dashboard/UpsellCard";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import KaiReportSection from "@/components/kai/KaiReportSection";
import type { KaiReport } from "@/lib/kai/report";
import {
  pctSinceAdded,
  formatPct,
  pctTone,
  toParagraphs,
  COMMUNITY_DISCLAIMER,
  type CommunityEntry,
  type TickerComment,
} from "@/lib/community-watchlist";

const COMMENT_SELECT =
  "id, ticker, user_id, body, created_at, author:profiles(display_name, avatar_url, age_group, username)";

/** Normalize a PostgREST row (author may embed as an array) into a TickerComment. */
function normComment(r: unknown): TickerComment {
  const row = r as {
    id: string;
    ticker: string;
    user_id: string | null;
    body: string;
    created_at: string;
    author: TickerComment["author"] | TickerComment["author"][] | null;
  };
  const a = row.author;
  return {
    id: row.id,
    ticker: row.ticker,
    user_id: row.user_id,
    body: row.body,
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

function Avatar({
  name,
  url,
  size = 28,
}: {
  name?: string | null;
  url?: string | null;
  size?: number;
}) {
  const dim = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name || "Member"}
        style={dim}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      style={dim}
      className="flex shrink-0 items-center justify-center rounded-full bg-chip-amber text-[10px] font-bold text-gold-700"
    >
      {initials}
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
  const [entries, setEntries] = useState<CommunityEntry[]>([]);
  const [comments, setComments] = useState<TickerComment[]>([]);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [report, setReport] = useState<KaiReport | null>(null);
  const [draft, setDraft] = useState("");
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
      .select("family_id, role")
      .eq("id", user.id)
      .maybeSingle();
    setRole(profile?.role || "parent");
    const t = await getFamilyTier(supabase, profile?.family_id);
    setTier(t);
    setTierResolved(true);
    if (t === "free") {
      setLoading(false);
      return;
    }

    // Board entries for this ticker (attribution + snapshot + latest close).
    const { data: board } = await supabase.rpc("get_community_board");
    const all = ((board || {}) as { entries?: CommunityEntry[] }).entries || [];
    setEntries(all.filter((e) => e.ticker.toUpperCase() === ticker));

    // Wiki comment thread for this ticker.
    const { data: rows } = await supabase
      .from("community_ticker_comments")
      .select(COMMENT_SELECT)
      .eq("ticker", ticker)
      .order("created_at", { ascending: true });
    setComments((rows || []).map(normComment));

    // Latest published Kai research report for this ticker (if any).
    const { data: rep } = await supabase.rpc("get_latest_kai_report", {
      p_ticker: ticker,
    });
    setReport((rep as KaiReport) ?? null);

    setLoading(false);
    fetchQuote(ticker).then(setQuote);
  }, [supabase, ticker]);

  useEffect(() => {
    load();
  }, [load]);

  const companyName = useMemo(
    () => entries.find((e) => e.company_name)?.company_name || ticker,
    [entries, ticker]
  );

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
      .insert({ ticker, user_id: userId, body })
      .select(COMMENT_SELECT)
      .single();
    setPosting(false);
    if (!error && data) {
      setComments((prev) => [...prev, normComment(data)]);
      setDraft("");
    }
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("community_ticker_comments")
      .delete()
      .eq("id", id);
    if (!error) setComments((prev) => prev.filter((c) => c.id !== id));
  }

  if (tierResolved && tier === "free") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <UpsellCard context="watchlist" />
      </div>
    );
  }
  if (loading || !tierResolved) {
    return <DashboardSkeleton variant="detail" title={ticker} />;
  }

  const adminEntry = entries.find((e) => e.kind === "admin") || null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-20 sm:px-6">
      <Link
        href="/watchlist/community"
        className="inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Community Watchlist
      </Link>

      {/* Header */}
      <m.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <CompanyLogo symbol={ticker} name={companyName} size={52} />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-bold text-ink">
                {companyName}
              </h1>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-sm font-medium text-midnight-500">
                  {ticker}
                </span>
                <LivePrice quote={quote} size="md" showDelayed />
              </div>
            </div>
          </div>
          <Link
            href={`/chart?symbol=${encodeURIComponent(ticker)}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sand px-2.5 py-1.5 text-xs font-semibold text-soft hover:bg-paper"
          >
            <LineChart className="h-3.5 w-3.5" /> Chart
          </Link>
        </div>

        <div className="mt-4">
          <Sparkline symbol={ticker} height={110} />
        </div>
      </m.div>

      {/* Kai Research Report (premium long-form, if generated for this ticker) */}
      {report && (
        <KaiReportSection
          report={report}
          ticker={ticker}
          companyName={companyName}
          quote={quote}
        />
      )}

      {/* Admin thesis (if this ticker is one of "our research" picks) */}
      {adminEntry && (adminEntry.headline || adminEntry.thesis) && (
        <section className="rounded-2xl border border-gold-300/40 bg-chip-amber/20 p-5">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold-700" />
            <span className="font-display text-xs font-bold uppercase tracking-wider text-gold-700">
              Our research
            </span>
          </div>
          {adminEntry.headline && (
            <h2 className="font-display text-lg font-bold text-ink">
              {adminEntry.headline}
            </h2>
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

      {/* On the board (all entries for this ticker) */}
      <section className="space-y-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
          On the board
        </h2>
        {entries.map((e) => {
          const pct = pctSinceAdded(e.snapshot_price, quote?.price ?? e.latest_close);
          const tone = pctTone(pct);
          return (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-sand bg-midnight-900 p-3"
            >
              <div className="flex min-w-0 items-center gap-2 text-sm">
                {e.kind === "admin" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-bold text-gold-700">
                    <ShieldCheck className="h-3 w-3" /> Our research
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-soft">
                    <Users2 className="h-3.5 w-3.5 text-gold-600" />
                    <span className="truncate font-semibold text-ink">
                      {e.family_name || "A family"}
                    </span>
                    {e.promoter_age_group && (
                      <AgeBadge ageGroup={e.promoter_age_group} />
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-soft">
                {e.snapshot_price != null && (
                  <span>added ${e.snapshot_price.toFixed(2)}</span>
                )}
                <span
                  className={`font-bold ${
                    tone === "up"
                      ? "text-green-600"
                      : tone === "down"
                        ? "text-red-600"
                        : "text-soft"
                  }`}
                >
                  {formatPct(pct)}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Collaborative research thread */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-gold-600" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
            Research notes ({comments.length})
          </h2>
        </div>
        <p className="text-xs text-soft">
          Study {companyName} together — what it makes, how it earns, what could
          go right or wrong. Everyone in the club can add to the notes.
        </p>

        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar name={c.author?.display_name} url={c.author?.avatar_url} />
              <div className="min-w-0 flex-1 rounded-xl border border-sand bg-midnight-900 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  {c.author?.username ? (
                    <Link
                      href={`/u/${c.author.username}`}
                      className="text-[13px] font-semibold text-ink hover:text-gold-700"
                    >
                      {c.author?.display_name || "Member"}
                    </Link>
                  ) : (
                    <span className="text-[13px] font-semibold text-ink">
                      {c.author?.display_name || "Member"}
                    </span>
                  )}
                  <AgeBadge ageGroup={c.author?.age_group} />
                  <span className="text-[10px] text-midnight-500">
                    · {timeAgo(c.created_at)}
                  </span>
                  {(c.user_id === userId || role === "admin") && (
                    <button
                      onClick={() => remove(c.id)}
                      className="ml-auto text-midnight-500 hover:text-red-600"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-snug text-midnight-200">
                  {c.body}
                </p>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="rounded-xl border border-dashed border-sand px-3 py-6 text-center text-sm text-midnight-500">
              No research notes yet — be the first to share what you found.
            </p>
          )}
        </div>

        {/* Composer */}
        <div className="rounded-xl border border-sand bg-midnight-900 p-3">
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (err) setErr("");
            }}
            rows={2}
            placeholder={`Add a research note about ${companyName}…`}
            className="w-full resize-none rounded-lg border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
          />
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
          <div className="mt-2 flex justify-end">
            <button
              onClick={post}
              disabled={posting || !draft.trim()}
              className="cta-button inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {posting ? "Posting…" : "Post note"}
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-sand pt-5">
        <p className="text-[11px] leading-relaxed text-soft">
          {COMMUNITY_DISCLAIMER}
        </p>
      </footer>
    </div>
  );
}
