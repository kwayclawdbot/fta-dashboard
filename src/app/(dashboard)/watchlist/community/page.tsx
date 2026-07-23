"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import {
  Users2,
  Sparkles,
  MessageCircle,
  Trophy,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ArrowRight,
  Gem,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import { fetchQuotes, type MarketQuote } from "@/lib/market/client";
import CompanyLogo from "@/components/fic/CompanyLogo";
import LivePrice from "@/components/fic/LivePrice";
import Sparkline from "@/components/fic/Sparkline";
import AgeBadge from "@/components/community/AgeBadge";
import UpsellCard from "@/components/dashboard/UpsellCard";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import {
  pctSinceAdded,
  formatPct,
  pctTone,
  COMMUNITY_DISCLAIMER,
  type CommunityEntry,
} from "@/lib/community-watchlist";
import {
  useNewMemberHints,
  HintReopen,
  HintDismiss,
} from "@/components/hints/useNewMemberHints";

type Tab = "board" | "record";

/** Best "current" price for a ticker: live/delayed quote, else latest daily close. */
function currentPrice(
  entry: CommunityEntry,
  quotes: Record<string, MarketQuote>
): number | null {
  const q = quotes[entry.ticker];
  if (q && q.price != null) return q.price;
  return entry.latest_close ?? null;
}

function PerfPill({ pct }: { pct: number | null }) {
  const tone = pctTone(pct);
  const cls =
    tone === "up"
      ? "bg-green-500/10 text-green-600"
      : tone === "down"
        ? "bg-red-500/10 text-red-600"
        : "bg-paper text-soft";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}
      title="Change since it landed on the board"
    >
      {tone === "up" ? (
        <TrendingUp className="h-3 w-3" />
      ) : tone === "down" ? (
        <TrendingDown className="h-3 w-3" />
      ) : null}
      {formatPct(pct)}
    </span>
  );
}

export default function CommunityWatchlistPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [tierResolved, setTierResolved] = useState(false);
  const [entries, setEntries] = useState<CommunityEntry[]>([]);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [tab, setTab] = useState<Tab>("board");
  // The "how to use the board" hint expires after the new-member window; the
  // delayed-price / not-advice compliance line below it stays permanent (Lane 7A).
  const howToHint = useNewMemberHints("watchlist-community-howto");

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setTierResolved(true);
      return;
    }

    // Resolve tier for the members-only gate (never flash the board to free).
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .maybeSingle();
    const t = await getFamilyTier(supabase, profile?.family_id);
    setTier(t);
    setTierResolved(true);
    if (t === "free") {
      setLoading(false);
      return;
    }

    const { data: raw } = await withTimeout(
      supabase.rpc("get_community_board"),
      LOAD_TIMEOUT_MS,
      { data: null } as { data: unknown }
    );
    const board = (raw || {}) as { entries?: CommunityEntry[] };
    const list = board.entries || [];
    setEntries(list);
    setLoading(false);

    const tickers = Array.from(new Set(list.map((e) => e.ticker).filter(Boolean)));
    if (tickers.length) {
      fetchQuotes(tickers).then((q) => setQuotes((prev) => ({ ...prev, ...q })));
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const adminPicks = useMemo(
    () => entries.filter((e) => e.kind === "admin"),
    [entries]
  );
  const memberPicks = useMemo(
    () => entries.filter((e) => e.kind === "member"),
    [entries]
  );

  // Pick Record: rank every entry by "% since added".
  const ranked = useMemo(() => {
    return entries
      .map((e) => ({ e, pct: pctSinceAdded(e.snapshot_price, currentPrice(e, quotes)) }))
      .filter((r): r is { e: CommunityEntry; pct: number } => r.pct != null)
      .sort((a, b) => b.pct - a.pct);
  }, [entries, quotes]);
  const best = ranked.slice(0, 5);
  const worst = ranked.slice(-5).reverse();

  // ── Free-tier gate ─────────────────────────────────────────────────────────
  if (tierResolved && tier === "free") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <UpsellCard context="watchlist" />
      </div>
    );
  }
  if (loading || !tierResolved) {
    return <DashboardSkeleton variant="board" title="Community Watchlist" />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6">
      {/* Header */}
      <m.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-chip-amber text-gold-700">
            <Users2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              Community Watchlist
            </h1>
            <p className="text-xs text-soft">
              The whole club, researching together — our picks and yours.
            </p>
          </div>
        </div>
        {howToHint.show ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-gold-300/40 bg-chip-amber/40 px-3.5 py-2.5 text-[13px] leading-snug text-midnight-100">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
            <p className="min-w-0 flex-1">
              Add a company from your Family Watchlist to research it together
              with every family in the club.{" "}
              <span className="text-midnight-100/75">
                Prices are delayed ~15 min. Not investment advice.
              </span>
            </p>
            <HintDismiss onClick={howToHint.dismiss} className="mt-0.5" />
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-[11px] leading-snug text-soft">
            Prices are delayed ~15 min. Not investment advice.
            <HintReopen
              onClick={howToHint.reopen}
              label="How the community board works"
            />
          </p>
        )}
      </m.div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5">
        {[
          { id: "board" as Tab, label: "The board", icon: Users2 },
          { id: "record" as Tab, label: "Pick Record", icon: Trophy },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.id
                  ? "bg-gold-500 text-white"
                  : "bg-paper text-soft ring-1 ring-sand hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "board" ? (
        <>
          {entries.length === 0 && (
            <div className="rounded-2xl border border-dashed border-sand bg-paper/60 py-16 text-center">
              <Gem className="mx-auto mb-3 h-10 w-10 text-gold-400/60" />
              <h3 className="font-display text-lg font-bold text-ink">
                The board is warming up
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-soft">
                Promote a company from your{" "}
                <Link href="/watchlist" className="font-semibold text-gold-700">
                  Family Watchlist
                </Link>{" "}
                to start the club&apos;s shared research.
              </p>
            </div>
          )}

          {/* Our Research (admin) */}
          {adminPicks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gold-600" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
                  Our research
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {adminPicks.map((e) => (
                  <EntryCard key={e.id} entry={e} quotes={quotes} featured />
                ))}
              </div>
            </section>
          )}

          {/* From our families (member) */}
          {memberPicks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users2 className="h-4 w-4 text-gold-600" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
                  From our families
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {memberPicks.map((e) => (
                  <EntryCard key={e.id} entry={e} quotes={quotes} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <PickRecord best={best} worst={worst} quotes={quotes} />
      )}

      <footer className="mt-8 border-t border-sand pt-5">
        <p className="text-[11px] leading-relaxed text-soft">
          {COMMUNITY_DISCLAIMER}
        </p>
      </footer>
    </div>
  );
}

function EntryCard({
  entry,
  quotes,
  featured = false,
}: {
  entry: CommunityEntry;
  quotes: Record<string, MarketQuote>;
  featured?: boolean;
}) {
  const pct = pctSinceAdded(entry.snapshot_price, currentPrice(entry, quotes));
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-sand bg-midnight-900 p-4 shadow-soft"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <CompanyLogo symbol={entry.ticker} name={entry.company_name} size={40} />
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-bold text-ink">
              {entry.company_name}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-midnight-500">
                {entry.ticker}
              </span>
              <LivePrice quote={quotes[entry.ticker]} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {entry.kind === "admin" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-bold text-gold-700">
              <ShieldCheck className="h-3 w-3" /> Our research
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-chip-amber px-2 py-0.5 text-[10px] font-bold text-gold-700">
              <Users2 className="h-3 w-3" /> Family pick
            </span>
          )}
          <PerfPill pct={pct} />
        </div>
      </div>

      {featured && entry.headline && (
        <p className="mt-3 font-display text-sm font-semibold text-ink">
          {entry.headline}
        </p>
      )}
      {(entry.thesis || entry.blurb) && (
        <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-midnight-200">
          {featured ? entry.thesis : entry.blurb}
        </p>
      )}

      {entry.kind === "member" && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-soft">
          <span className="font-semibold text-ink">
            {entry.family_name || "A family"}
          </span>
          {entry.promoter_name && <span>· {entry.promoter_name}</span>}
          {entry.promoter_age_group && (
            <AgeBadge ageGroup={entry.promoter_age_group} />
          )}
        </div>
      )}

      <div className="mt-3">
        <Sparkline symbol={entry.ticker} height={52} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-sand pt-2.5">
        <span className="text-[11px] text-midnight-500">
          {entry.snapshot_price != null
            ? `Added at $${entry.snapshot_price.toFixed(2)}`
            : "Snapshotting…"}
        </span>
        <Link
          href={`/research/${encodeURIComponent(entry.ticker)}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:text-gold-800"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Research {entry.comment_count > 0 ? `(${entry.comment_count})` : ""}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </m.div>
  );
}

function RecordRow({
  entry,
  pct,
  quotes,
}: {
  entry: CommunityEntry;
  pct: number;
  quotes: Record<string, MarketQuote>;
}) {
  return (
    <Link
      href={`/research/${encodeURIComponent(entry.ticker)}`}
      className="flex items-center gap-3 rounded-xl border border-sand bg-midnight-900 p-3 transition-colors hover:border-gold-300"
    >
      <CompanyLogo symbol={entry.ticker} name={entry.company_name} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {entry.company_name}
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-soft">
          {entry.ticker}
          {entry.kind === "admin" ? (
            <span className="text-gold-700">· Our research</span>
          ) : (
            <span>· {entry.family_name || "A family"}</span>
          )}
        </p>
      </div>
      <LivePrice quote={quotes[entry.ticker]} />
      <PerfPill pct={pct} />
    </Link>
  );
}

function PickRecord({
  best,
  worst,
  quotes,
}: {
  best: { e: CommunityEntry; pct: number }[];
  worst: { e: CommunityEntry; pct: number }[];
  quotes: Record<string, MarketQuote>;
}) {
  if (best.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-sand bg-paper/60 py-16 text-center">
        <Trophy className="mx-auto mb-3 h-10 w-10 text-gold-400/60" />
        <h3 className="font-display text-lg font-bold text-ink">
          No record yet
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-soft">
          Once picks have a snapshot and a daily close, the best and worst
          performers show up here.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
            Best performers
          </h2>
        </div>
        <div className="space-y-2">
          {best.map((r) => (
            <RecordRow key={r.e.id} entry={r.e} pct={r.pct} quotes={quotes} />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-red-600" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
            Watching closely
          </h2>
        </div>
        <div className="space-y-2">
          {worst.map((r) => (
            <RecordRow key={r.e.id} entry={r.e} pct={r.pct} quotes={quotes} />
          ))}
        </div>
      </section>
    </div>
  );
}
