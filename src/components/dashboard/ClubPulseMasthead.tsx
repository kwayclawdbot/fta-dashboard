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
/* PRICE COLOUR, canonically. `text-green-600` / `text-red-600` measured ~3.8:1
   and ~2.9:1 on the dark page; text-price-up / text-price-down carry the same
   MEANING and re-map per theme, and must never be written with a dark: variant. */
function pctClass(v: number | null | undefined): string {
  if (v == null) return "text-soft";
  return v > 0 ? "text-price-up" : v < 0 ? "text-price-down" : "text-soft";
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
  // Each slot carries a warm `empty` invitation used INSTEAD of a bare "0" when
  // the count is zero — a dead-room numeral on the first screen defeats the
  // masthead's purpose, so an empty day reads as an open door, not a void.
  const stats = [
    {
      key: "posts",
      value: pulse?.newPostsToday ?? 0,
      label: "New posts",
      sub: "today",
      href: "/community",
      empty: { title: "Be the first", sub: "post today →" },
    },
    {
      key: "ideas",
      value: pulse?.ideasThisWeek ?? 0,
      label: "Ideas shared",
      sub: "this week",
      href: "/watchlist/community",
      empty: { title: "Share an idea", sub: "start the week →" },
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
            empty: { title: "Kai is watching", sub: "11,000+ stocks →" },
          },
        ]),
  ];

  const loading = pulse == null;

  return (
    /* CANVAS V2 (M1): the bordered gradient panel is gone. The masthead was
       already composed from type, rules and numerals — wrapping it in a card
       was the one thing making it read as another box in a stack. It now sits
       directly on the paper, which is what lets the numerals be the object. */
    <section
      aria-label="Today in the Club"
      data-tour="club-pulse"
    >
      {/* Masthead line: live eyebrow + dateline */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <h2 className="font-display text-eyebrow font-bold uppercase text-gold-700">
            Today in the Club
          </h2>
        </div>
        <span className="font-mono text-[11px] text-soft">{dateLabel}</span>
      </div>

      {/* Market ticker — indices inline as mono %, not boxed cards (adults). */}
      {!isKid && (
        <div className="f0-rule-top mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 pt-3">
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
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
            markets delayed
          </span>
        </div>
      )}

      {/* The live pulse — big mono numerals separated by hairline rules. */}
      <div
        className="f0-rule-top mt-3 grid divide-x divide-sand pt-3"
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
            ) : s.value > 0 ? (
              <>
                <span className="font-mono text-3xl font-bold leading-none tabular-nums text-ink transition-colors group-hover:text-gold-700">
                  {s.value.toLocaleString()}
                </span>
                <span className="mt-1.5 text-[12px] font-semibold text-ink">{s.label}</span>
                <span className="text-[11px] text-soft">{s.sub}</span>
              </>
            ) : (
              // Empty slot → warm invitation in the same type system (never a bare 0).
              <>
                <span className="font-display text-[13px] font-bold leading-tight text-gold-700 transition-colors group-hover:text-gold-800">
                  {s.empty.title}
                </span>
                <span className="mt-1 text-[11px] leading-snug text-soft">{s.empty.sub}</span>
              </>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
