"use client";

/**
 * CLUB HOME — board 01, in the design-v2 canvas (orange/dark `--cc-*` system).
 *
 * This is the SOLO-CLUB ADULT home re-skinned to the Cheat Code App canvas. It
 * is a pure presentation swap: ClubHomeV2 resolves every promise/hook and hands
 * the FINISHED data down here, so the flag only changes how the surface LOOKS —
 * the data path, the honest-absence rules and the feature set are identical to
 * the v1 board-01 composition it mirrors object-for-object:
 *
 *   0  ChallengeSlot / LIVE NOW  — preserved law (existing components; rare,
 *                                  active-pass / on-air only).
 *   1  greeting (real display name)
 *   2  today's one thing + due strip  — the loop
 *   3  TOP IN THE CLUB   — ranked rail from real trending (honest delta labels)
 *   4  TODAY IN 30 SEC   — Kai brief lead + real SPY/QQQ/IWM index chips
 *   5  YOUR SIGNALS      — for-you rows from real watched-ticker deltas
 *   6  WHERE THE CLUB SPLITS — contested ticker + live debate (votable) + best thinking
 *   7  THE ROOM          — collective + a person worth following
 *   8  YOU               — real XP / belt / ladder ring
 *   +  KEEP LEARNING     — preserved law, in cc card language
 *
 * HONEST DATA. The ranked rail's sub-numeral is the Club ATTENTION delta or the
 * ticker's price move — never a "rank ▲N" claim we cannot back (there is no
 * rank-movement series). The YOU ring is XP-through-the-ladder (a bounded
 * participation read), never accuracy. Raw sentiment is raw. Absent sources
 * render nothing rather than a fabricated number — same law as v1.
 */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Flame, Layers, Radar } from "lucide-react";

import { useClubData, postDebateVote } from "@/lib/clubhome/client";
import type {
  BriefResponse,
  CollectiveResponse,
  DebateResponse,
  ForYouResponse,
  PeopleResponse,
  ThinkingResponse,
  TrendingResponse,
} from "@/lib/clubhome/contract";
import type { TodayLoop } from "@/lib/club/today";
import { beltProgress } from "@/lib/belts";
import { LEVELS } from "@/lib/xp";
import type { LiveEvent } from "@/lib/clubhome/live-events";
import { LiveNowStrip } from "@/components/live";

import {
  Kicker,
  CcMark,
  TickerBadge,
  BeltAvatar,
  Ring,
  OrangeButton,
} from "@/components/cc/ui";

import { signedCount, signedPct } from "../board";
import { useLocalHour } from "../clock";
import ChallengeSlot from "../ChallengeSlot";
import type { LearningPickup } from "../ClubHomeV2";
import V2Surface from "./V2Surface";

/* ── tone helpers (cc market-truth colours) ───────────────────────────────── */

function toneColor(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || Math.round(n * 100) === 0)
    return "var(--cc-soft)";
  return n > 0 ? "var(--cc-up)" : "var(--cc-down)";
}

/** r16 raised card — big blocks (today, brief, YOU). Artboard #17141A → token. */
const CARD = "rounded-2xl border border-[var(--cc-line)] bg-[var(--cc-card)]";
/** r12 compact list row — the artboard's signal/room/learn rows (10-12px pad). */
const ROW = "rounded-xl border border-[var(--cc-line)] bg-[var(--cc-card)]";

/* Warm hero ground — the board's linear-gradient(140deg,#241009,#17141A) deep-
   brown wash, composed from tokens so it themes. This is the RICH ground the
   brief / YOU heroes ride on; the muted 22% wash read flat, so it goes deeper. */
const WARM_HERO =
  "linear-gradient(140deg, color-mix(in srgb, var(--cc-orange) 30%, var(--cc-card)) 0%, color-mix(in srgb, var(--cc-orange) 11%, var(--cc-card)) 46%, var(--cc-card) 100%)";
/** A gentler warm wash for the second-tier hero (today · one thing) — rhythm. */
const WARM_SOFT =
  "linear-gradient(135deg, color-mix(in srgb, var(--cc-orange) 15%, var(--cc-card)) 0%, var(--cc-card) 58%)";
/** The warm-brown edge the board pairs with those grounds (#3A2418). */
const WARM_BORDER = "color-mix(in srgb, var(--cc-orange) 36%, var(--cc-line))";

/* ── section frame ─────────────────────────────────────────────────────────
   The mono kicker is board 01's section-label primitive (DESIGN-UX-SPEC §3). */
function BoardSection({
  label,
  mark,
  sub,
  action,
  children,
}: {
  label: string;
  mark?: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          {/* artboard kicker: mono 9.5px / .16em — inline wins over cc-mono's 11/.22 */}
          <div
            className="cc-mono flex items-center gap-1"
            style={{ fontSize: "9.5px", letterSpacing: "0.16em" }}
          >
            <span style={{ color: "var(--cc-ink)" }}>{label}</span>
            {mark && <span style={{ color: "var(--cc-orange-ink)" }}>{mark}</span>}
          </div>
          {sub && (
            <p className="mt-[3px] text-[10.5px] leading-snug" style={{ color: "var(--cc-dim)" }}>
              {sub}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function SeeAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-md text-[11px] font-semibold"
      style={{ color: "var(--cc-orange-ink)" }}
    >
      See all
    </Link>
  );
}

/* ── 1 · greeting ──────────────────────────────────────────────────────────── */

function greeting(hour: number | null, name: string): string {
  const who = name ? `, ${name}` : "";
  if (hour == null) return `Welcome back${who}`;
  if (hour < 12) return `GM${who}`;
  if (hour < 17) return `Afternoon${who}`;
  return `Evening${who}`;
}

function Masthead({ firstName }: { firstName?: string }) {
  const hour = useLocalHour();
  const name = (firstName || "").trim();
  const initial = (name.slice(0, 1) || "•").toUpperCase();
  return (
    <header>
      {/* board-01 wordmark: CcMark + Barlow-condensed-italic "Cheat Code Club".
          NOT a Kaushan script mark — Home has no script title. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[9px]">
          <CcMark size={30} />
          <span
            className="cc-display text-[19px]"
            style={{ color: "var(--cc-ink)", letterSpacing: "0.02em" }}
          >
            Cheat Code{" "}
            <span style={{ color: "var(--cc-orange-ink)", fontSize: "11px", letterSpacing: "0.2em" }}>
              Club
            </span>
          </span>
        </div>
        <span
          aria-hidden
          className="grid h-[30px] w-[30px] place-items-center rounded-full text-[11px] font-bold"
          style={{ background: "var(--cc-card2)", color: "var(--cc-ink)" }}
        >
          {initial}
        </span>
      </div>
      {/* greeting: plain Instrument Sans 26px/700, NOT the condensed display italic */}
      <h1
        className="mt-[18px] text-[26px] font-bold leading-none"
        style={{ color: "var(--cc-ink)", letterSpacing: "-0.02em" }}
      >
        {greeting(hour, name)} <span aria-hidden>👋</span>
      </h1>
      <p className="mt-[5px] text-[13px]" style={{ color: "var(--cc-soft)" }}>
        Here&apos;s what the Club is seeing
      </p>
    </header>
  );
}

/* ── 2 · today's one thing + due strip (the loop) ─────────────────────────── */

function useTodayLoop(seed?: TodayLoop | null) {
  const [data, setData] = useState<TodayLoop | null>(seed ?? null);
  const [loading, setLoading] = useState(!seed);
  useEffect(() => {
    if (seed) return;
    const ctrl = new AbortController();
    let mounted = true;
    void (async () => {
      try {
        const res = await fetch("/api/club/today", {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const json = (await res.json()) as TodayLoop;
        if (mounted) setData(json);
      } catch {
        /* absent = renders nothing */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [seed]);
  return { data, loading };
}

function LoopChip({
  href,
  icon,
  children,
  lead = false,
}: {
  href?: string;
  icon: ReactNode;
  children: ReactNode;
  lead?: boolean;
}) {
  const body = (
    <>
      <span aria-hidden style={{ color: lead ? "var(--cc-orange-ink)" : "var(--cc-soft)" }}>
        {icon}
      </span>
      <span className="whitespace-nowrap" style={{ color: "var(--cc-ink)" }}>
        {children}
      </span>
      {href && <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "var(--cc-soft)" }} aria-hidden />}
    </>
  );
  const cls =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-semibold";
  const style = {
    background: "var(--cc-card2)",
    border: "1px solid var(--cc-line)",
  };
  if (!href)
    return (
      <span className={cls} style={style}>
        {body}
      </span>
    );
  return (
    <Link href={href} className={cls} style={style}>
      {body}
    </Link>
  );
}

function TodayOneThing({ seed }: { seed?: TodayLoop | null }) {
  const { data } = useTodayLoop(seed);
  if (!data) return null;
  const { lesson, streakDays, actedToday, cardsDue, watchTriggered } = data;
  const hasCards = typeof cardsDue === "number" && cardsDue > 0;
  const hasWatch = typeof watchTriggered === "number" && watchTriggered > 0;
  const hasStreak = typeof streakDays === "number" && streakDays > 0;
  const streakKnown = typeof streakDays === "number";
  const nOfM =
    lesson && typeof lesson.done === "number" && typeof lesson.total === "number"
      ? `${lesson.done} of ${lesson.total} done`
      : null;

  return (
    <section className="space-y-2.5">
      <div
        className={`${CARD} flex items-center gap-4 px-4 py-4`}
        style={{
          background: WARM_SOFT,
          borderColor: "color-mix(in srgb, var(--cc-orange) 20%, var(--cc-line))",
        }}
      >
        <div className="min-w-0 flex-1">
          <Kicker>
            today <span style={{ color: "var(--cc-orange-ink)" }}>· one thing</span>
          </Kicker>
          <p
            className="cc-display mt-2 text-[19px] leading-tight"
            style={{ color: "var(--cc-ink)" }}
          >
            {lesson ? lesson.title : "Nothing queued — pick your line"}
          </p>
          <p className="mt-1 truncate text-[12px]" style={{ color: "var(--cc-soft)" }}>
            {lesson ? (
              <>
                {lesson.context}
                {nOfM && <span> · {nOfM}</span>}
              </>
            ) : (
              "Start a path and this becomes the one thing waiting for you every morning."
            )}
          </p>
        </div>
        <Link href={lesson ? lesson.href : "/courses"} className="shrink-0">
          <OrangeButton className="px-4 py-2 text-[13px]">
            {lesson ? "Start" : "Choose"} <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </OrangeButton>
        </Link>
      </div>

      {streakKnown && (
        <div className="flex flex-wrap items-center gap-1.5">
          <LoopChip lead icon={<Flame className="h-3 w-3" />}>
            {hasStreak ? `${streakDays}-day streak` : "No streak yet"}
          </LoopChip>
          {hasCards && (
            <LoopChip href="/flashcards" icon={<Layers className="h-3 w-3" />}>
              {cardsDue} card{cardsDue === 1 ? "" : "s"} due
            </LoopChip>
          )}
          {hasWatch && (
            <LoopChip href="/alerts" icon={<Radar className="h-3 w-3" />}>
              {watchTriggered} watch{watchTriggered === 1 ? "" : "es"} triggered
            </LoopChip>
          )}
          {!hasStreak && !hasCards && !hasWatch && (
            <span className="text-[11.5px]" style={{ color: "var(--cc-soft)" }}>
              One action starts it.
            </span>
          )}
          {hasStreak && actedToday && !hasCards && !hasWatch && (
            <span className="text-[11.5px]" style={{ color: "var(--cc-soft)" }}>
              Today is already logged.
            </span>
          )}
        </div>
      )}
    </section>
  );
}

/* ── 3 · top in the club (ranked rail) ────────────────────────────────────── */

function RankTile({
  rank,
  symbol,
  big,
  small,
  smallTone,
  smallLabel,
  lead,
}: {
  rank: number;
  symbol: string;
  big?: string;
  small?: string;
  smallTone: string;
  smallLabel?: string;
  lead: boolean;
}) {
  return (
    <Link
      href={`/research/${encodeURIComponent(symbol)}`}
      className="relative block w-[74px] shrink-0 rounded-[14px] border px-0 py-[9px] text-center"
      style={{
        borderColor: lead ? "var(--cc-orange)" : "var(--cc-line)",
        background: "var(--cc-card)",
        boxShadow: lead ? "var(--cc-halo-soft)" : undefined,
      }}
    >
      <span
        className="absolute -top-[7px] left-2 grid h-[15px] min-w-[15px] place-items-center rounded-full px-[3px] text-[9px] font-extrabold"
        style={
          lead
            ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
            : { background: "var(--cc-card2)", color: "var(--cc-soft)" }
        }
      >
        {rank}
      </span>
      <div className="flex justify-center">
        <TickerBadge symbol={symbol} size={34} />
      </div>
      <div
        className="mt-[6px] font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold"
        style={{ color: "var(--cc-ink)" }}
      >
        {symbol}
      </div>
      {big !== undefined && (
        <div
          className="font-[family-name:var(--font-plex-mono)] text-[11px] font-bold"
          style={{ color: "var(--cc-ink)" }}
        >
          {big}
        </div>
      )}
      {small !== undefined && (
        <div
          className="mt-[1px] font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold"
          style={{ color: smallTone }}
        >
          {small}
          {smallLabel && <span style={{ color: "var(--cc-dim)" }}> {smallLabel}</span>}
        </div>
      )}
    </Link>
  );
}

function TopInTheClub({ trending }: { trending?: TrendingResponse | null }) {
  const all = trending?.rows ?? [];
  const rows = all.slice(0, 10);
  const total = trending?.totalCount ?? all.length;
  if (rows.length === 0) {
    return (
      <BoardSection label="top in" mark="the club">
        <p className="text-[13px]" style={{ color: "var(--cc-soft)" }}>
          No ticker has drawn the Club&apos;s attention yet. Rate one and yours is the first on
          this board.
        </p>
      </BoardSection>
    );
  }
  // ONE reading for the whole strip (mixed meanings read as breakage).
  const mode: "conviction" | "price" | "bare" = rows.some((r) => r.heat != null)
    ? "conviction"
    : rows.some((r) => r.price != null && Number.isFinite(r.price))
      ? "price"
      : "bare";

  return (
    <BoardSection
      label="top in"
      mark="the club"
      sub={
        mode === "conviction"
          ? "Live ranking by member attention & conviction"
          : mode === "price"
            ? "Live ranking by member attention · today's move"
            : "Live ranking by member attention"
      }
      action={total > rows.length ? <SeeAll href="/discover" /> : undefined}
    >
      <div className="no-scrollbar -mx-1 flex gap-[9px] overflow-x-auto px-1 pb-1 pt-2.5">
        {rows.map((r, i) => {
          const hasPct = typeof r.changePct === "number" && Number.isFinite(r.changePct);
          const big =
            mode === "conviction"
              ? r.heat != null
                ? `${r.heat}%`
                : "—"
              : mode === "price"
                ? r.price != null && Number.isFinite(r.price)
                  ? r.price.toFixed(2)
                  : "—"
                : undefined;
          const small =
            mode === "conviction"
              ? signedCount(r.change)
              : mode === "price"
                ? signedPct(hasPct ? r.changePct : null)
                : undefined;
          const smallTone =
            mode === "conviction"
              ? toneColor(r.change)
              : toneColor(hasPct ? r.changePct : null);
          const smallLabel = mode === "conviction" ? "attn" : undefined;
          return (
            <RankTile
              key={r.ticker}
              rank={r.rank}
              symbol={r.ticker}
              big={big}
              small={small}
              smallTone={smallTone}
              smallLabel={smallLabel}
              lead={i === 0}
            />
          );
        })}
      </div>
      {trending?.disclaimer && (
        <p
          className="mt-2.5 font-[family-name:var(--font-plex-mono)] text-[8.5px] uppercase tracking-[0.12em]"
          style={{ color: "var(--cc-dim)" }}
        >
          {trending.disclaimer}
        </p>
      )}
    </BoardSection>
  );
}

/* ── 4 · today in 30 seconds (brief + index chips) ────────────────────────── */

const INDEX_SYMBOLS = ["SPY", "QQQ", "IWM"] as const;

function IndexChips() {
  const [quotes, setQuotes] = useState<Record<string, { changePercent: number | null }> | null>(
    null,
  );
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    let live = true;
    void (async () => {
      try {
        const res = await fetch(`/api/market/quote?symbols=${INDEX_SYMBOLS.join(",")}`, {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as {
          quotes?: Record<string, { changePercent: number | null }>;
        };
        if (live) setQuotes(json.quotes ?? {});
      } catch {
        if (live) setQuotes({});
      } finally {
        if (live) setSettled(true);
      }
    })();
    return () => {
      live = false;
      ctrl.abort();
    };
  }, []);
  return (
    <div className="mt-3 flex flex-wrap gap-[7px]" aria-busy={!settled}>
      {INDEX_SYMBOLS.map((sym) => {
        const pct = quotes?.[sym]?.changePercent ?? null;
        return (
          <span
            key={sym}
            className="inline-flex items-center gap-1 rounded-md px-2 py-[3px] font-[family-name:var(--font-plex-mono)] text-[9.5px]"
            style={{
              background: "color-mix(in srgb, var(--cc-bg) 55%, transparent)",
              border: "1px solid color-mix(in srgb, var(--cc-orange) 22%, var(--cc-line))",
              color: "var(--cc-soft)",
            }}
          >
            {sym}
            {!settled ? (
              <span
                className="inline-block h-2 w-8 rounded-full motion-safe:animate-pulse"
                style={{ background: "var(--cc-line)" }}
                aria-hidden
              />
            ) : (
              <span style={{ color: toneColor(pct) }}>{signedPct(pct)}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function TodayIn30({ brief }: { brief?: BriefResponse | null }) {
  const items = brief?.items ?? [];
  const available = brief?.available ?? true;
  const lead = items[0] ?? null;
  return (
    <section
      className="overflow-hidden rounded-2xl px-[15px] py-[14px]"
      style={{
        background: WARM_HERO,
        border: `1px solid ${WARM_BORDER}`,
        boxShadow: "var(--cc-halo-soft)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* artboard: 14.5px/700 uppercase body title — NOT the tiny mono kicker */}
          <div
            className="text-[14.5px] font-bold uppercase leading-[1.3]"
            style={{ color: "var(--cc-ink)" }}
          >
            Today in 30 seconds
          </div>
          <p className="mt-1 max-w-[220px] text-[12px] font-medium leading-snug" style={{ color: "var(--cc-soft)" }}>
            {!available ? (
              "Kai is temporarily unavailable — here's what the Club's activity shows."
            ) : lead ? (
              <>
                {lead.ticker && (
                  <span
                    className="mr-1 font-[family-name:var(--font-plex-mono)] font-bold"
                    style={{ color: "var(--cc-orange-ink)" }}
                  >
                    ${lead.ticker}
                  </span>
                )}
                <span style={{ color: "var(--cc-ink)" }}>{lead.text}</span>
              </>
            ) : (
              "Your brief fills in as the Club moves — check back once a little more activity lands."
            )}
          </p>
        </div>
        <Link
          href="/kai"
          aria-label="Open the full read with Kai"
          className="cc-halo grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--cc-orange)" }}
        >
          <span
            aria-hidden
            style={{
              width: 0,
              height: 0,
              borderLeft: "11px solid var(--cc-orange-deep)",
              borderTop: "7px solid transparent",
              borderBottom: "7px solid transparent",
              marginLeft: 3,
            }}
          />
        </Link>
      </div>
      <IndexChips />
    </section>
  );
}

/* ── 5 · your signals ─────────────────────────────────────────────────────── */

function YourSignals({ foryou }: { foryou?: ForYouResponse | null }) {
  const seen = new Set<string>();
  const items = (foryou?.items ?? [])
    .filter((it) => {
      const line = (it.delta || "").trim();
      if (!line) return true;
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .slice(0, 4);

  return (
    <BoardSection label="your signals" action={<SeeAll href="/watchlist" />}>
      {items.length === 0 ? (
        <div className={`${ROW} px-3.5 py-3.5`}>
          <p className="text-[13px] font-bold" style={{ color: "var(--cc-ink)" }}>
            Nothing on your watch yet
          </p>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            Watch a ticker and this becomes the one place that tells you what changed on it.
          </p>
          <Link
            href="/watchlist"
            className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: "var(--cc-orange-ink)" }}
          >
            Build your watchlist <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-[7px]">
          {items.map((it) => {
            const hasPct = typeof it.changePct === "number" && Number.isFinite(it.changePct);
            return (
              <Link
                key={it.ticker}
                href={`/research/${encodeURIComponent(it.ticker)}`}
                className={`${ROW} flex items-center gap-2.5 px-3 py-2.5`}
              >
                <TickerBadge symbol={it.ticker} size={26} />
                <span
                  className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold"
                  style={{ color: "var(--cc-ink)" }}
                >
                  {it.ticker}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--cc-soft)" }}>
                  {it.delta}
                </span>
                {hasPct ? (
                  <span
                    className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[10.5px] font-semibold"
                    style={{ color: toneColor(it.changePct) }}
                  >
                    {signedPct(it.changePct)}
                  </span>
                ) : (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--cc-soft)" }} aria-hidden />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </BoardSection>
  );
}

/* ── 6 · where the club splits (contested + debate + best thinking) ───────── */

function pickSplit(trending?: TrendingResponse | null) {
  let best: { ticker: string; bull: number; bear: number } | null = null;
  let bestScore = 0;
  for (const row of trending?.rows ?? []) {
    const s = row.sentiment;
    if (!s) continue;
    const bull = Number(s.bull) || 0;
    const bear = Number(s.bear) || 0;
    if (bull < 1 || bear < 1) continue;
    const score = Math.min(bull, bear) * 100 - Math.abs(bull - bear);
    if (score > bestScore) {
      bestScore = score;
      best = { ticker: row.ticker, bull, bear };
    }
  }
  return best;
}

function DebateBlock({ debate }: { debate: DebateResponse }) {
  const [counts, setCounts] = useState(debate.counts);
  const [vote, setVote] = useState<"yes" | "no" | null>(debate.userVote ?? null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function cast(choice: "yes" | "no") {
    if (busy || vote === choice) return;
    setBusy(true);
    setFailed(false);
    const next = await postDebateVote(debate.id, choice);
    if (next) {
      setCounts(next);
      setVote(choice);
    } else setFailed(true);
    setBusy(false);
  }

  const total = (counts?.yes ?? 0) + (counts?.no ?? 0);
  const showCounts = debate.floorMet && total > 0;

  return (
    <div className={`${ROW} px-3.5 py-3`}>
      <p className="text-[13px] font-bold leading-snug" style={{ color: "var(--cc-ink)" }}>
        {debate.question}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {(["yes", "no"] as const).map((choice) => {
          const on = vote === choice;
          return (
            <button
              key={choice}
              type="button"
              onClick={() => void cast(choice)}
              disabled={busy}
              aria-pressed={on}
              className="rounded-full px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] transition disabled:opacity-60"
              style={
                on
                  ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
                  : { background: "var(--cc-card2)", border: "1px solid var(--cc-line)", color: "var(--cc-ink)" }
              }
            >
              {choice === "yes" ? "Yes" : "No"}
              {showCounts && (
                <span className="ml-1.5 font-[family-name:var(--font-plex-mono)] tabular-nums opacity-70">
                  {choice === "yes" ? counts.yes : counts.no}
                </span>
              )}
            </button>
          );
        })}
        <span className="ml-1 text-[11px]" style={{ color: "var(--cc-soft)" }}>
          {failed
            ? "That vote didn't save — try again."
            : showCounts
              ? `${total} member${total === 1 ? "" : "s"} in`
              : vote
                ? "Your position is in."
                : "Be an early voice on this one."}
        </span>
      </div>
    </div>
  );
}

function ClubSplit({
  trending,
  debate,
  thinking,
}: {
  trending?: TrendingResponse | null;
  debate?: DebateResponse | null;
  thinking?: ThinkingResponse | null;
}) {
  const split = pickSplit(trending);
  const liveDebate = debate && debate.id && debate.question ? debate : null;
  const lead = thinking?.lead ?? null;
  if (!split && !liveDebate && !lead) return null;

  return (
    <BoardSection label="where the club" mark="splits">
      <div className="flex flex-col gap-2">
        {split && (
          <Link
            href={`/research/${encodeURIComponent(split.ticker)}#club-read`}
            className={`${ROW} flex items-center gap-2.5 px-3 py-2.5`}
          >
            <TickerBadge symbol={split.ticker} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--cc-ink)" }}>
                The Club disagrees on {split.ticker}
              </span>
              <span className="block truncate text-[11px]" style={{ color: "var(--cc-soft)" }}>
                {split.bull} bull / {split.bear} bear — read the split
              </span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--cc-soft)" }} aria-hidden />
          </Link>
        )}
        {liveDebate && <DebateBlock debate={liveDebate} />}
        {lead && (
          <Link href={lead.href} className={`${ROW} flex items-center gap-2.5 px-3 py-2.5`}>
            <span
              className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-[13px] font-bold"
              style={{
                background: "color-mix(in srgb, var(--cc-orange) 14%, transparent)",
                color: "var(--cc-orange-ink)",
              }}
              aria-hidden
            >
              ❝
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--cc-ink)" }}>
                {lead.title}
              </span>
              <span className="block truncate text-[11px]" style={{ color: "var(--cc-soft)" }}>
                {lead.author.name}
                {lead.author.badge ? ` · ${lead.author.badge}` : ""}
                {lead.comments > 0
                  ? ` · ${lead.comments} repl${lead.comments === 1 ? "y" : "ies"}`
                  : ""}
              </span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--cc-soft)" }} aria-hidden />
          </Link>
        )}
      </div>
    </BoardSection>
  );
}

/* ── 7 · the room ─────────────────────────────────────────────────────────── */

function ClubRoom({
  collective,
  people,
}: {
  collective?: CollectiveResponse | null;
  people?: PeopleResponse | null;
}) {
  const minds = collective?.connectedMinds ?? 0;
  const actions = collective?.actionsToday ?? 0;
  const floorMet = !!collective?.floorMet;
  const suggested = (people?.members ?? [])[0] ?? null;
  if (!collective && !suggested) return null;

  const line = !collective
    ? null
    : floorMet
      ? `${minds.toLocaleString()} member${minds === 1 ? "" : "s"} · ${actions.toLocaleString()} thing${
          actions === 1 ? "" : "s"
        } done today`
      : "The room is still small — early members shape it.";

  return (
    <Link href="/community" className={`${ROW} flex items-center gap-2.5 px-3 py-2.5`}>
      <span
        className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg font-[family-name:var(--font-plex-mono)] text-[10px] font-bold"
        style={{
          background: "color-mix(in srgb, var(--cc-orange) 14%, transparent)",
          color: "var(--cc-orange-ink)",
        }}
        aria-hidden
      >
        {minds > 0 ? minds : "·"}
      </span>
      <span className="min-w-0 flex-1">
        {line && (
          <span className="block truncate text-[12px] font-semibold" style={{ color: "var(--cc-ink)" }}>
            {line}
          </span>
        )}
        {suggested && (
          <span className="block truncate text-[11px]" style={{ color: "var(--cc-soft)" }}>
            {suggested.name} — {suggested.reason}
          </span>
        )}
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--cc-soft)" }} aria-hidden />
    </Link>
  );
}

/* ── 8 · you (belt / xp / ladder ring) ────────────────────────────────────── */

const LADDER_TOP = LEVELS[LEVELS.length - 1]?.min || 1;

function YouStrip({ xp }: { xp: number | null }) {
  if (xp == null) {
    return (
      <Link href="/belts" className={`${CARD} flex items-center gap-3 px-4 py-3`}>
        <BeltAvatar initials="•" belt="white" size={40} />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold" style={{ color: "var(--cc-soft)" }}>
            YOU · <span style={{ color: "var(--cc-ink)" }}>Unranked</span>
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: "var(--cc-soft)" }}>
            Your rank starts with your first rep — reading, rating and posting all count.
          </span>
        </span>
        <Ring value={0} size={48} stroke={4} color="var(--cc-ink)">
          <span className="font-[family-name:var(--font-plex-mono)] text-[11px]" style={{ color: "var(--cc-dim)" }}>
            —
          </span>
        </Ring>
      </Link>
    );
  }
  const { current, next } = beltProgress(xp);
  const ladderPct = Math.max(0, Math.min(100, Math.round((xp / LADDER_TOP) * 100)));
  const target = next ? next.level.min : LADDER_TOP;
  const initials = (current.label || "You").slice(0, 2).toUpperCase();

  return (
    <Link
      href="/belts"
      className={`${CARD} flex items-center gap-3 px-[15px] py-[13px]`}
      style={{
        background: WARM_HERO,
        border: `1px solid ${WARM_BORDER}`,
        boxShadow: "var(--cc-halo-soft)",
      }}
      aria-label={`${current.label}, ${xp.toLocaleString()} XP`}
    >
      <BeltAvatar initials={initials} belt={current.belt.key} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold" style={{ color: "var(--cc-soft)" }}>
          YOU · <span style={{ color: "var(--cc-ink)" }}>{current.label}</span>
        </span>
        <span className="mt-[3px] block font-[family-name:var(--font-plex-mono)] text-[10px] tabular-nums" style={{ color: "var(--cc-soft)" }}>
          XP {xp.toLocaleString()} / {target.toLocaleString()}
        </span>
        <span
          className="mt-1.5 block h-[5px] overflow-hidden rounded-full"
          style={{ background: "var(--cc-line)" }}
        >
          <span
            className="block h-full rounded-full"
            style={{
              width: `${ladderPct}%`,
              background:
                "linear-gradient(90deg, var(--cc-orange), color-mix(in srgb, var(--cc-orange) 55%, white))",
            }}
          />
        </span>
      </span>
      <Ring value={ladderPct} size={48} stroke={4} color="var(--cc-ink)">
        <div className="text-center">
          <div className="font-[family-name:var(--font-plex-mono)] text-[13px] font-bold" style={{ color: "var(--cc-ink)" }}>
            {ladderPct}
          </div>
          <div className="font-[family-name:var(--font-plex-mono)] text-[6.5px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>
            ladder
          </div>
        </div>
      </Ring>
    </Link>
  );
}

/* ── keep learning (preserved law) ────────────────────────────────────────── */

function KeepLearning({ pickup }: { pickup: LearningPickup | null }) {
  const href = pickup?.href ?? "/courses";
  const title = pickup?.title ?? "Pick up the Foundations";
  const context = pickup?.context ?? "One concept, one company, every week.";
  return (
    <Link href={href} className={`${ROW} flex items-center gap-2.5 px-3 py-2.5`}>
      <span
        className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg"
        style={{
          background: "color-mix(in srgb, var(--cc-orange) 14%, transparent)",
          color: "var(--cc-orange-ink)",
        }}
        aria-hidden
      >
        ▶
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold" style={{ color: "var(--cc-ink)" }}>
          {title}
        </span>
        <span className="block truncate text-[11px]" style={{ color: "var(--cc-soft)" }}>
          {context}
        </span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--cc-soft)" }} aria-hidden />
    </Link>
  );
}

/* ── the board ─────────────────────────────────────────────────────────────── */

export default function ClubHomeBoard({
  firstName,
  learning,
  challengeExpiresAt = null,
  xp = null,
  today,
  liveNow,
  data,
}: {
  firstName?: string;
  learning: LearningPickup | null;
  challengeExpiresAt?: string | null;
  xp?: number | null;
  today: TodayLoop | null;
  liveNow: LiveEvent | null;
  /** The club sections, already resolved by ClubHomeV2 (single useClubData). */
  data: ReturnType<typeof useClubData>["data"];
}) {
  return (
    <V2Surface>
      <div className="mx-auto max-w-2xl space-y-4 px-[18px] pb-16 pt-4">
        {/* preserved law — only during an active pass */}
        <ChallengeSlot challengeExpiresAt={challengeExpiresAt} />
        {/* preserved law — only when a room is on the air */}
        {liveNow && <LiveNowStrip event={liveNow} />}

        <Masthead firstName={firstName} />
        <TodayOneThing seed={today} />
        <TopInTheClub trending={data.trending} />
        <TodayIn30 brief={data.brief} />
        <YourSignals foryou={data.foryou} />
        <ClubSplit trending={data.trending} debate={data.debate} thinking={data.thinking} />
        <ClubRoom collective={data.collective} people={data.people} />
        <YouStrip xp={xp} />
        <KeepLearning pickup={learning} />
      </div>
    </V2Surface>
  );
}
