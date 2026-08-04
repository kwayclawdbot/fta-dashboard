"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Flame, PlayCircle } from "lucide-react";
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
import Ticker from "@/components/ui/Ticker";
import BeltHeroStrip from "@/components/dashboard/BeltHeroStrip";
import ClubPulseMasthead from "@/components/dashboard/ClubPulseMasthead";
import ClubActivityStrip from "@/components/community/ClubActivityStrip";
import { BoardSection } from "@/components/clubhome/board";
import { useLocalHour } from "@/components/clubhome/clock";

/**
 * ClubHome — the LEGACY community-first Home for solo Club members.
 *
 * The live Club home is now `components/clubhome/ClubHomeV2`; this file is the
 * older composition kept beside it. It was still writing the PREVIOUS version's
 * chrome — `paper-card` boxes, raw `midnight-*` micro-copy, hand-rolled
 * green/red price text and bold-11px floating headings — so it read as a
 * different app to anything drawn on board 01. It is now on the same card
 * vocabulary: `BoardSection` marks, white `club-b-card` objects, price through
 * the `price-up` / `price-down` tokens only.
 *
 * NO CLOCK IN RENDER: the greeting called `new Date().getHours()` straight from
 * JSX. It now reads the shared hour-bucketed external store; before that store
 * primes (server render and the first client frame) the greeting is the neutral
 * "Welcome back", never a guessed time of day.
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

/** Pure once the hour is handed in. `null` → the neutral first frame. */
function greetingFor(hour: number | null): string {
  if (hour == null) return "Welcome back";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Price tone → the price tokens. The ONLY place green/red is allowed. */
function priceToneClass(tone: ReturnType<typeof changeTone>): string {
  return tone === "up"
    ? "text-price-up"
    : tone === "down"
      ? "text-price-down"
      : "text-soft";
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
  const hour = useLocalHour();
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
    <div className="mx-auto max-w-5xl space-y-7 pb-12">
      {/* ── Greeting + streak ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-extrabold uppercase leading-[1.05] text-ink">
            {greetingFor(hour)}, {firstName || "there"}
          </h1>
          <p className="mt-1.5 text-[14px] text-soft">
            Here&apos;s what&apos;s moving in the Club.
          </p>
        </div>
        {streak >= 2 && (
          <span className="club-b-card inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-semibold text-ink tabular-nums">
            <Flame className="h-3.5 w-3.5 text-accent" aria-hidden />
            {streak} day streak
          </span>
        )}
      </div>

      {/* ── Signature: the live "Today in the Club" pulse masthead ─────────── */}
      <ClubPulseMasthead />

      {/* Belt/XP hero — earned progress toward the next belt (real). */}
      <BeltHeroStrip xp={xp} />

      {/* ── Trending in the Club — ticker cards w/ sparkline + delayed price ── */}
      {trending && trending.length > 0 && (
        <BoardSection
          id="club-trending"
          label="Trending in"
          mark="the Club"
          action={
            <Link
              href="/discover"
              className="f0-focus shrink-0 text-[11px] font-semibold text-soft transition-colors hover:text-ink"
            >
              See all
            </Link>
          }
        >
          {/* 3+ trending → the three-up card strip. 1–2 → full-width cards, so a
              lone item never floats in a two-thirds-empty grid. */}
          <div
            className={`mt-2.5 grid gap-2.5 ${
              trending.length >= 3 ? "sm:grid-cols-3" : ""
            }`}
          >
            {trending.map((row) => {
              const q = quotes[row.ticker];
              const tone = changeTone(q?.changePercent);
              return (
                <Link
                  key={row.ticker}
                  href={`/research/${encodeURIComponent(row.ticker)}`}
                  className="club-b-card f0-focus f0-press flex flex-col gap-2 px-3.5 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <CompanyLogo
                      symbol={row.ticker}
                      name={row.company_name}
                      size={26}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[13px] font-bold text-ink">
                        {row.ticker}
                      </p>
                      <p className="truncate text-[11px] text-soft">
                        {row.company_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[14px] font-semibold text-ink tabular-nums">
                      {formatPrice(q?.price)}
                    </span>
                    <span
                      className={`font-mono text-[12px] font-bold tabular-nums ${priceToneClass(tone)}`}
                    >
                      {formatChangePct(q?.changePercent) || "—"}
                    </span>
                  </div>
                  <Sparkline symbol={row.ticker} height={36} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft tabular-nums">
                    {row.comment_count ?? 0} in discussion · price delayed
                  </span>
                </Link>
              );
            })}
          </div>
        </BoardSection>
      )}

      {/* ── Kai morning briefing — one editorial line (Kai lives in nav+FAB).
             Kai blue is an IDENTITY colour reserved for Kai/AI by law, and it is
             declared CONSTANT across modes and themes (see the club palette in
             globals.css), so the hairline tint is a literal — the one sanctioned
             place in this file where a colour is not a token. ─────────────── */}
      {briefing && (
        <Link
          href="/alerts"
          className="club-b-card f0-focus f0-press flex items-center gap-3 px-4 py-3"
          style={{ borderColor: "color-mix(in srgb, #2563FF 32%, var(--sand))" }}
        >
          <Bell className="h-4 w-4 shrink-0 text-kai-500" aria-hidden />
          <span className="shrink-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-kai-600">
            Kai briefing
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[14px] font-semibold text-ink">
            <Ticker symbol={briefing.ticker} variant="chip" size="sm" />
            <span className="min-w-0 truncate">
              {briefing.direction}
              {briefing.setup_label ? ` — ${briefing.setup_label}` : ""}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-kai-500" aria-hidden />
        </Link>
      )}

      {/* ── Recent Club Activity — real feed slice w/ avatars + belt dots ───── */}
      <ClubActivityStrip limit={4} />

      {/* ── Keep learning — education DEMOTED to one compact pickup card ────── */}
      <Link
        href={learning ? learning.href : "/courses"}
        className="club-b-card f0-focus f0-press flex items-center gap-3.5 px-4 py-3.5"
      >
        <span
          className="club-b-orb h-10 w-10 shrink-0"
          aria-hidden
        >
          <PlayCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
            Keep <span className="text-accent">learning</span>
          </p>
          <p className="mt-1 truncate font-display text-[15px] font-bold text-ink">
            {learning ? learning.title : "Pick up the Foundations"}
          </p>
          {/* No invented sub-line: when the pickup has no context the line is
              simply absent. */}
          {(learning ? learning.context : "One concept, one company, every week.") && (
            <p className="mt-0.5 truncate text-[12px] text-soft">
              {learning
                ? learning.context
                : "One concept, one company, every week."}
            </p>
          )}
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-soft" aria-hidden />
      </Link>
    </div>
  );
}
