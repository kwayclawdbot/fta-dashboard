"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchQuotes, type MarketQuote } from "@/lib/market/client";

/**
 * ClubPulseMasthead — the "Today in the Club" live-pulse masthead (D1 redesign).
 *
 * This is the ClubHome / dashboard-Home SIGNATURE. It replaces the old
 * three-equal-card "command center" row (Market pulse / Community heat / Ask Kai
 * — the textbook AI cliché flagged as the app's first-screen offender). Instead
 * of interchangeable bordered boxes it composes ONE masthead object out of
 * typography, a live dateline, an inline market ticker, and big monospace
 * numerals separated by hairline rules — answering, at a glance, "what is
 * happening in the Club right now."
 *
 * HONESTY: every count is real (head-only COUNT queries, no fabricated numbers).
 * The market strip is always live-ish (delayed quotes) so the masthead never
 * reads as a barren empty screen even for a brand-new member with zero activity.
 *
 * Self-fetching and self-contained: it degrades gracefully (0s, or a warm
 * first-mover line) rather than gating the page. Data layer is unchanged — the
 * queries are the same ones the previous ClubHome stat chips used.
 */

const INDICES: { symbol: string; label: string }[] = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq" },
  { symbol: "DIA", label: "Dow" },
];

interface Pulse {
  newPostsToday: number;
  ideasThisWeek: number;
  alertsToday: number;
}

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function startOfWeekISO(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday-based
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function pctText(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function pctClass(v: number | null | undefined): string {
  if (v == null) return "text-soft";
  return v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : "text-soft";
}

export default function ClubPulseMasthead({ isKid = false }: { isKid?: boolean }) {
  const supabase = createClient();
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [indexQuotes, setIndexQuotes] = useState<Record<string, MarketQuote> | null>(null);

  useEffect(() => {
    let mounted = true;

    // Real Club activity counts (COUNT head-only — cheap, honest).
    const todayISO = startOfTodayISO();
    const weekISO = startOfWeekISO();
    void (async () => {
      const [posts, ideas, alerts] = await Promise.all([
        supabase
          .from("feed_posts")
          .select("id", { count: "exact", head: true })
          .neq("kind", "anchor")
          .gte("created_at", todayISO),
        supabase
          .from("community_ticker_comments")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekISO),
        supabase
          .from("trade_alerts")
          .select("id", { count: "exact", head: true })
          .gte("issued_at", todayISO),
      ]);
      if (!mounted) return;
      setPulse({
        newPostsToday: posts.count ?? 0,
        ideasThisWeek: ideas.count ?? 0,
        alertsToday: alerts.count ?? 0,
      });
    })().catch(
      () => mounted && setPulse({ newPostsToday: 0, ideasThisWeek: 0, alertsToday: 0 })
    );

    // Live-ish market strip (adults/teens only — kids skip the index jargon).
    if (!isKid) {
      fetchQuotes(INDICES.map((i) => i.symbol))
        .then((q) => mounted && setIndexQuotes(q))
        .catch(() => mounted && setIndexQuotes({}));
    }

    return () => {
      mounted = false;
    };
  }, [supabase, isKid]);

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // Numeral columns — real counts, each a door to its surface. Kids get the two
  // warm community counts; adults also get the Kai alerts count.
  const stats = [
    {
      key: "posts",
      value: pulse?.newPostsToday ?? 0,
      label: isKid ? "New posts" : "New posts",
      sub: "today",
      href: "/community",
    },
    {
      key: "ideas",
      value: pulse?.ideasThisWeek ?? 0,
      label: "Ideas shared",
      sub: "this week",
      href: "/watchlist/community",
    },
    ...(isKid
      ? []
      : [
          {
            key: "alerts",
            value: pulse?.alertsToday ?? 0,
            label: "Kai alerts",
            sub: "today",
            href: "/alerts",
          },
        ]),
  ];

  const totalActivity = stats.reduce((n, s) => n + s.value, 0);
  const loading = pulse == null;

  return (
    <section
      aria-label="Today in the Club"
      data-tour="club-pulse"
      className="overflow-hidden rounded-2xl border border-sand bg-gradient-to-br from-card to-paper px-5 py-4 shadow-soft sm:px-6 sm:py-5"
    >
      {/* Masthead line: live eyebrow + dateline */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-gold-500 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-500" />
          </span>
          <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-gold-700">
            Today in the Club
          </h2>
        </div>
        <span className="font-mono text-[11px] text-soft">{dateLabel}</span>
      </div>

      {/* Market ticker — indices inline as mono %, not boxed cards (adults). */}
      {!isKid && (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-sand pt-3">
          {INDICES.map((idx) => {
            const q = indexQuotes?.[idx.symbol];
            return (
              <span key={idx.symbol} className="inline-flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-soft">
                  {idx.label}
                </span>
                {indexQuotes == null ? (
                  <span className="inline-block h-3 w-10 animate-pulse rounded bg-sand align-middle" />
                ) : (
                  <span className={`font-mono text-sm font-bold ${pctClass(q?.changePercent)}`}>
                    {pctText(q?.changePercent)}
                  </span>
                )}
              </span>
            );
          })}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-midnight-500">
            markets delayed
          </span>
        </div>
      )}

      {/* The live pulse — big mono numerals separated by hairline rules. */}
      <div
        className="mt-3 grid divide-x divide-sand border-t border-sand pt-3"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      >
        {stats.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className="group flex flex-col px-4 first:pl-0 last:pr-0"
          >
            {loading ? (
              <span className="h-8 w-10 animate-pulse rounded bg-sand" />
            ) : (
              <span
                className={`font-mono text-3xl font-bold leading-none tabular-nums transition-colors ${
                  s.value > 0 ? "text-ink group-hover:text-gold-700" : "text-midnight-500"
                }`}
              >
                {s.value.toLocaleString()}
              </span>
            )}
            <span className="mt-1.5 text-[12px] font-semibold text-ink">{s.label}</span>
            <span className="text-[11px] text-soft">{s.sub}</span>
          </Link>
        ))}
      </div>

      {/* Alive-when-empty: a warm first-mover line instead of a barren screen. */}
      {!loading && totalActivity === 0 && (
        <p className="mt-3 border-t border-sand pt-3 text-[12px] text-soft">
          {isKid
            ? "It's quiet so far today — be the first to share something!"
            : "The Club is just waking up today. Post an idea and get the conversation going."}
        </p>
      )}
    </section>
  );
}
