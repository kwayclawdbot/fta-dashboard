"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Flame,
  PlayCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import {
  fetchQuotes,
  formatPrice,
  formatChangePct,
  changeTone,
  type MarketQuote,
} from "@/lib/market/client";
import Sparkline from "@/components/fic/Sparkline";
import CompanyLogo from "@/components/fic/CompanyLogo";
import BeltHeroStrip from "@/components/dashboard/BeltHeroStrip";
import ClubPulseMasthead from "@/components/dashboard/ClubPulseMasthead";
import ClubActivityStrip from "@/components/community/ClubActivityStrip";

/**
 * ClubHome — the community-first Home for CLUB (individual / solo) members
 * (Cheat Code Club redesign, D1). Family-mode households keep the academy-first
 * Home in dashboard/page.tsx; this surface renders for solo owners (mode="club").
 *
 * D1 rebuild: the first screen answers "what's happening in the Club right now"
 * in one glance via the <ClubPulseMasthead> live-pulse signature (dateline +
 * market ticker + big mono numerals on hairline rules) — NOT the old grid of
 * equal stat/entry cards. Duplicate entry-point cards (Ask Kai, Newsroom) are
 * removed: Kai lives in the nav + floating button, News under Discover. What
 * stays are functional data objects — trending ticker rows, the real activity
 * slice, one Kai briefing line, and a single "keep learning" pickup.
 */

interface TrendingRow {
  ticker: string;
  company_name: string;
  comment_count: number;
}

interface Briefing {
  ticker: string;
  direction: string;
  setup_label: string | null;
}

interface LearningToday {
  title: string;
  href: string;
  context: string | null;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Consecutive-day activity streak from distinct XP-earning dates (real). */
function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const days = new Set(
    dates.map((iso) => {
      const d = new Date(iso);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  const DAY = 86_400_000;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Allow the streak to count if the member was active today OR yesterday.
  if (!days.has(cursor.getTime())) cursor = new Date(cursor.getTime() - DAY);
  let streak = 0;
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return streak;
}

export default function ClubHome({
  firstName,
  xp,
  learning,
}: {
  firstName: string;
  xp: number;
  learning: LearningToday | null;
}) {
  const supabase = createClient();
  const [trending, setTrending] = useState<TrendingRow[] | null>(null);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      // ── Trending in the Club — community board top by discussion ─────────────
      void (async () => {
        const { data } = await withTimeout(
          supabase.rpc("get_community_board"),
          LOAD_TIMEOUT_MS,
          { data: null } as { data: unknown }
        );
        const board = (data || {}) as { entries?: TrendingRow[] };
        const rows = (board.entries || [])
          .slice()
          .sort((a, b) => (b.comment_count ?? 0) - (a.comment_count ?? 0))
          .slice(0, 3);
        if (!mounted) return;
        setTrending(rows);
        const syms = rows.map((r) => r.ticker).filter(Boolean);
        if (syms.length) {
          const q = await fetchQuotes(syms).catch(() => ({}));
          if (mounted) setQuotes(q);
        }
      })().catch(() => mounted && setTrending([]));

      // ── Latest Kai briefing (newest trade alert) ─────────────────────────────
      void (async () => {
        const { data } = await supabase
          .from("trade_alerts")
          .select("ticker, direction, setup_label")
          .order("issued_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (mounted && data) setBriefing(data as Briefing);
      })().catch(() => {});

      // ── Activity streak from XP-earning days (real engagement) ───────────────
      void (async () => {
        const since = new Date(Date.now() - 40 * 86_400_000).toISOString();
        const { data } = await supabase
          .from("xp_events")
          .select("created_at")
          .eq("user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(400);
        if (mounted && data)
          setStreak(computeStreak((data as { created_at: string }[]).map((r) => r.created_at)));
      })().catch(() => {});
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* ── Greeting + streak ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {greeting()}, {firstName || "there"}
          </h1>
          <p className="mt-1 text-soft">Here&apos;s what&apos;s moving in the Club.</p>
        </div>
        {streak >= 2 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-chip-amber px-3 py-1.5 text-xs font-semibold text-gold-800">
            <Flame className="h-3.5 w-3.5" />
            {streak} day streak
          </span>
        )}
      </div>

      {/* ── Signature: the live "Today in the Club" pulse masthead ─────────── */}
      <ClubPulseMasthead />

      {/* Belt/XP hero — earned progress toward the next belt (real). */}
      <BeltHeroStrip xp={xp} />

      {/* ── Trending in the Club — ticker rows w/ sparkline + delayed price ── */}
      {trending && trending.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-ink">Trending in the Club</h2>
            <Link
              href="/discover"
              className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:text-gold-800"
            >
              See all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {trending.map((row) => {
              const q = quotes[row.ticker];
              const tone = changeTone(q?.changePercent);
              return (
                <Link
                  key={row.ticker}
                  href={`/research/${encodeURIComponent(row.ticker)}`}
                  className="paper-card group flex flex-col gap-2 p-3.5 transition-colors hover:border-gold-400/50"
                >
                  <div className="flex items-center gap-2">
                    <CompanyLogo symbol={row.ticker} name={row.company_name} size={22} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-bold text-ink">{row.ticker}</p>
                      <p className="truncate text-[11px] text-soft">{row.company_name}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-ink">
                      {formatPrice(q?.price)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 font-mono text-xs font-bold ${
                        tone === "up" ? "text-green-600" : tone === "down" ? "text-red-600" : "text-soft"
                      }`}
                    >
                      {tone === "up" ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : tone === "down" ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      {formatChangePct(q?.changePercent) || "—"}
                    </span>
                  </div>
                  <Sparkline symbol={row.ticker} height={40} />
                  <span className="text-[10px] text-midnight-500">
                    {row.comment_count ?? 0} in discussion · price delayed
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Kai morning briefing — one editorial line (Kai lives in nav+FAB) ── */}
      {briefing && (
        <Link
          href="/alerts"
          className="flex items-center gap-3 rounded-xl border border-kai-500/30 bg-kai-500/[0.06] px-4 py-3 transition hover:border-kai-500/50"
        >
          <Bell className="h-4 w-4 shrink-0 text-kai-500" />
          <span className="font-display text-[11px] font-bold uppercase tracking-wide text-kai-600 shrink-0">
            Kai briefing
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
            {briefing.ticker} {briefing.direction}
            {briefing.setup_label ? ` — ${briefing.setup_label}` : ""}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-kai-500" />
        </Link>
      )}

      {/* ── Recent Club Activity — real feed slice w/ avatars + belt dots ───── */}
      <ClubActivityStrip limit={4} />

      {/* ── Keep learning — education DEMOTED to one compact pickup line ────── */}
      {learning ? (
        <Link
          href={learning.href}
          className="paper-card group flex items-center gap-4 p-4 transition-colors hover:border-gold-400/50"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-700">
            <PlayCircle className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[11px] font-bold uppercase tracking-wider text-gold-700">
              Keep learning
            </p>
            <p className="truncate font-semibold text-ink">{learning.title}</p>
            {learning.context && (
              <p className="truncate text-[12px] text-soft">{learning.context}</p>
            )}
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-gold-700 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <Link
          href="/courses"
          className="paper-card group flex items-center gap-4 p-4 transition-colors hover:border-gold-400/50"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-700">
            <PlayCircle className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[11px] font-bold uppercase tracking-wider text-gold-700">
              Keep learning
            </p>
            <p className="font-semibold text-ink">Pick up the Foundations</p>
            <p className="text-[12px] text-soft">One concept, one company, every week.</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-gold-700 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
