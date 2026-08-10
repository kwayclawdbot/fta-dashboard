"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Eye,
  Activity,
  ArrowRight,
  Trash2,
  Plus,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Check,
  Target,
  Crosshair,
  Loader2,
  Zap,
  Users,
  Newspaper,
  Bell,
  ChevronDown,
  Gauge,
  Trophy,
  Settings2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CompanyLogo from "@/components/fic/CompanyLogo";
import SetAlertButton from "@/components/alerts/SetAlertButton";
import PickCard from "@/components/alerts/PickCard";
import SetupGraphCard from "@/components/alerts/SetupGraphCard";
import { ResultShareModal, OutcomePoster } from "@/components/alerts/ShareOutcomeCard";
import { KaiVoice } from "@/components/alerts/poster";
import { FoundingState } from "@/components/family/canvas";
import KaiWatch from "@/components/kai/KaiWatch";
import WatchRail from "@/components/watch/WatchRail";
import {
  Card,
  CardLink,
  CountPill,
  Eyebrow as BoardEyebrow,
  BoardLead,
} from "@/components/alerts/board";
import {
  MAX_ACTIVE_RULES,
  ruleLabel,
  suggestedRulesFor,
  SETUP_OPTIONS,
  TIMEFRAME_OPTIONS,
  RISK_OPTIONS,
  STRATEGY_PLAYS,
  type TradeAlert,
  type AlertEvent,
  type AlertKind,
  type AlertRule,
  type StrategyProfile,
  type AlertPrefs,
  type SampleAlert,
  type StrategyPlay,
  type WatchCurrentState,
  type AlertSetup,
} from "@/lib/alerts/types";
import ScrollRow from "@/components/canvas2/ScrollRow";
import SegmentedRail, {
  type SegmentedOption,
} from "@/components/canvas2/Segmented";
import type { TrackRecord, AlertOutcome } from "@/lib/alerts/history";
import type { WatchState } from "@/lib/alerts/watch-state";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";
import {
  SETUP_STATE_META,
  watchStateLine,
  setupStateLine,
  marketStatus,
  freshnessLabel,
  type ObservationalRow,
} from "@/lib/alerts/watch-ui";

/**
 * /alerts — KAI WATCH, visual redesign 2026-08-10 (owner-approved poster
 * language; prior art cheatcode-os ShareCard / KaiWinDetailPage on club
 * tokens). Two rooms now:
 *
 *   NOW      — the magazine front page: violet KAI masthead with ONE status
 *              line in Kai's voice, TODAY'S THREE as hero posters (glow +
 *              TODAY tag), THE WEEK as a quieter stack, the Daily Brief as a
 *              typographic letter block, a fresh-result share poster, and
 *              the member's watch admin tucked behind ONE gear affordance
 *              (every write intact: toggle, digest, delete, NL creation,
 *              plays, prefs, tuner).
 *   HISTORY  — the Record tab merged in: honest W/L band on top (month vs
 *              all-time, both sides always), editorial time headers, mini
 *              outcome posters interleaved with slim brief/notice rows, and
 *              a winner/loser click opening the FULL shareable result card
 *              (ResultShareModal, canvas PNG export intact).
 *
 * Old deep-links (#overview/#daily/#watch/#live/#history/#track/#record/
 * #kai-nl) remap in the hash effect below — no inbound link lands on
 * nothing; #track/#record land on HISTORY where the record band now lives.
 *
 * HEAT-BY-GLOW LAW: no state chips, no lifecycle bars, no distance meters
 * on the consumption surfaces — state is one human Kai line; live cards
 * glow and breathe. Green/red stay on price; every number is stored.
 */

type Tab = "now" | "history";

/** What the cron recorded alongside a watch's current state (migration 157). */
type WatchDetail = WatchCurrentState["detail"];

interface Props {
  userId: string;
  isSolo: boolean;
  /** Events + broadcasts that landed since this member last opened the hub. */
  newSinceSeen: number;
  /** The watermark itself, so History can mark WHICH rows are the new ones. */
  hubSeenAt: string | null;
  broadcasts: TradeAlert[];
  events: AlertEvent[];
  rules: AlertRule[];
  strategy: StrategyProfile | null;
  prefs: AlertPrefs;
  priceMap: Record<string, number>;
  marketEvents: { ticker: string; title: string; dek: string | null; slug: string }[];
  sampleAlert: SampleAlert | null;
  trackRecord: TrackRecord;
  watchlistTickers: { ticker: string; company_name: string }[];
  watchStates: WatchCurrentState[];
  setups: AlertSetup[];
  observational: ObservationalRow[];
}

/** kind → the dimension chip Kai shows he is monitoring. */
const KIND_DIMENSION: Record<AlertKind, string> = {
  price_cross: "Price",
  pct_move: "Big moves",
  vol_surge: "Volume",
  rsi_cross: "Momentum",
  ema_cross: "Trend",
  w52_break: "52-week",
  preset_match: "Screen",
  sentiment_velocity: "Club sentiment",
  news_event: "News",
};

export default function AlertsClient({
  userId,
  isSolo,
  newSinceSeen,
  hubSeenAt,
  broadcasts,
  events,
  rules: initialRules,
  strategy: initialStrategy,
  prefs: initialPrefs,
  priceMap,
  marketEvents,
  sampleAlert,
  trackRecord,
  watchlistTickers,
  watchStates,
  setups: initialSetups,
  observational,
}: Props) {
  const [tab, setTab] = useState<Tab>("now");
  const [rules, setRules] = useState(initialRules);
  // Follow-state now lives on the story page (the poster carries no chip), so
  // the setups list is render-only here.
  const setups = initialSetups;
  // The watches admin sits behind ONE gear affordance at the bottom of NOW;
  // deep-links that target it (#watch / #kai-nl) unfold it before scrolling.
  const [watchesOpen, setWatchesOpen] = useState(false);
  // The full shareable result card, presented as an overlay (owner ruling).
  const [shareResult, setShareResult] = useState<{
    o: AlertOutcome;
    won: boolean;
    storyHref: string | null;
  } | null>(null);

  const openResult = useCallback(
    (o: AlertOutcome, won: boolean, storyHref: string | null) =>
      setShareResult({ o, won, storyHref }),
    []
  );

  // Deep-link. Two rooms now (NOW · HISTORY) — every OLD hash remaps onto
  // its new home so no inbound link lands on nothing:
  //   #overview / #daily / #watch / #live → NOW; #watch unfolds + scrolls to
  //     the gear'd watches admin, #daily to the Daily Brief letter.
  //   #history / #track / #record → HISTORY (the record band lives there).
  //   #kai-nl → the NL composer inside the watches admin (unfolds it).
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const valid: Tab[] = ["now", "history"];
    const LEGACY: Record<string, Tab> = {
      overview: "now",
      daily: "now",
      watch: "now",
      live: "now",
      history: "history",
      track: "history",
      record: "history",
    };
    let target: Tab | null = null;
    let scrollId: string | null = null;
    let block: ScrollLogicalPosition = "start";
    if ((valid as string[]).includes(hash)) {
      target = hash as Tab;
    } else if (hash in LEGACY) {
      target = LEGACY[hash];
      if (hash === "watch") scrollId = "my-watches";
      if (hash === "daily") scrollId = "daily-brief";
    } else if (hash === "kai-nl") {
      target = "now";
      scrollId = "kai-nl";
      block = "center";
    }
    if (!target) return;
    const finalTarget = target;
    const finalScrollId = scrollId;
    // Deferred one frame so the effect body stays a pure read (no synchronous
    // setState → no cascading-render), then two more frames for the tab swap
    // to commit and AnimatePresence to lay out before the node is measured.
    const raf = requestAnimationFrame(() => {
      setTab(finalTarget);
      if (finalScrollId === "my-watches" || finalScrollId === "kai-nl") {
        setWatchesOpen(true);
      }
      if (finalScrollId) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            document
              .getElementById(finalScrollId)
              ?.scrollIntoView({ behavior: "smooth", block })
          )
        );
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Stamp the "I have seen the hub" watermark that the N-new count reads back
  // (migration 195). Fire-and-forget on mount: the count on THIS render is
  // already computed server-side, so writing now only affects the next visit.
  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("alert_prefs")
      .upsert(
        { user_id: userId, hub_seen_at: new Date().toISOString() },
        { onConflict: "user_id" }
      )
      .then(() => undefined);
  }, [userId]);

  const activeRules = useMemo(() => rules.filter((r) => r.active), [rules]);

  // Current state per active rule (Lane A view), keyed for O(1) lookup.
  const stateByRule = useMemo(() => {
    const map = new Map<string, WatchState>();
    for (const w of watchStates) map.set(w.rule_id, w.state as WatchState);
    return map;
  }, [watchStates]);

  // …and the DETAIL the same cron recorded next to it: the measured quantity
  // shown on a watch's admin row (migration 157).
  const detailByRule = useMemo(() => {
    const map = new Map<string, WatchDetail>();
    for (const w of watchStates) map.set(w.rule_id, w.detail || {});
    return map;
  }, [watchStates]);

  // Honest freshness: the most recent time a cron looked at any of my watches.
  const lastChecked = useMemo(() => {
    let max: string | null = null;
    for (const r of activeRules) {
      if (r.last_checked_at && (!max || r.last_checked_at > max)) max = r.last_checked_at;
    }
    return max;
  }, [activeRules]);

  // "Three plays live." — the masthead line counts Kai's own mid-lifecycle
  // setups (the plays the posters below actually draw), never an estimate.
  const livePlayCount = useMemo(
    () => setups.filter((s) => SETUP_STATE_META[s.state]?.developing).length,
    [setups]
  );

  const TAB_ITEMS = useMemo<SegmentedOption<Tab>[]>(
    () => [
      { id: "now", label: "Now" },
      { id: "history", label: "History" },
    ],
    []
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <WatchHead
        newSinceSeen={newSinceSeen}
        livePlayCount={livePlayCount}
        lastChecked={lastChecked}
      />

      <SegmentedRail
        options={TAB_ITEMS}
        value={tab}
        onChange={setTab}
        ariaLabel="Kai Watch sections"
        /* Kai-blue: this board IS the Kai layer, and the colour law keeps the
           AI surface distinct from the orange brand actions beside it. */
        barClassName="bg-kai-500"
        className="mb-6 mt-6"
      />

      <AnimatePresence mode="wait">
        <m.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "now" && (
            <NowTab
              userId={userId}
              rules={rules}
              setRules={setRules}
              stateByRule={stateByRule}
              detailByRule={detailByRule}
              setups={setups}
              priceMap={priceMap}
              isSolo={isSolo}
              prefs={initialPrefs}
              strategy={initialStrategy}
              watchlistTickers={watchlistTickers}
              broadcasts={broadcasts}
              track={trackRecord}
              marketEvents={marketEvents}
              sampleAlert={sampleAlert}
              watchesOpen={watchesOpen}
              setWatchesOpen={setWatchesOpen}
              onOpenResult={openResult}
              onOpenHistory={() => setTab("history")}
            />
          )}
          {tab === "history" && (
            <HistoryTab
              events={events}
              broadcasts={broadcasts}
              setups={setups}
              track={trackRecord}
              observational={observational}
              hubSeenAt={hubSeenAt}
              sampleAlert={sampleAlert}
              onOpenResult={openResult}
            />
          )}
        </m.div>
      </AnimatePresence>

      {shareResult && (
        <ResultShareModal
          o={shareResult.o}
          won={shareResult.won}
          storyHref={shareResult.storyHref}
          onClose={() => setShareResult(null)}
        />
      )}

      <p className="mt-10 text-[11px] leading-relaxed text-soft/70">
        Kai&apos;s watches and briefings are educational market analysis, not financial advice or a
        recommendation to buy or sell. Intraday prices are delayed roughly 15 minutes. Past
        performance never guarantees future results.
      </p>
    </div>
  );
}

/* ============================================================================
 * MASTHEAD — the magazine front page's head: the KAI violet mark and ONE
 * status line in Kai's voice ("Three plays live. Market open."), derived from
 * the real setup lifecycle counts + the real clock. The old status-band card
 * is gone. The since-you-were-gone chip is small and watermark-driven — a
 * first-ever visit shows nothing rather than inventing a backlog.
 * ==========================================================================*/
const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

function kaiStatusLine(livePlayCount: number, marketLabel: string): string {
  const plays =
    livePlayCount === 0
      ? "Nothing live right now."
      : `${COUNT_WORDS[livePlayCount] ?? livePlayCount} ${livePlayCount === 1 ? "play" : "plays"} live.`;
  return `${plays} ${marketLabel}.`;
}

function WatchHead({
  newSinceSeen,
  livePlayCount,
  lastChecked,
}: {
  newSinceSeen: number;
  livePlayCount: number;
  lastChecked: string | null;
}) {
  const mkt = marketStatus();

  return (
    <header>
      <BoardLead word="kai watch" />

      {/* The section rail below is this board's one control. The cross-surface
          rail therefore drops to its quiet inline line rather than stacking a
          second row of pills on top of it — see WatchRail's note. */}
      <WatchRail active="kai" variant="inline" className="mt-3" />

      {/* KAI mark + the one status line, in Kai's voice */}
      <div className="mt-6 flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-kai-500/12 text-kai-blue ring-1 ring-kai-500/30">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[19px] font-extrabold leading-snug tracking-tight text-kai-blue">
            {kaiStatusLine(livePlayCount, mkt.label)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {newSinceSeen > 0 && (
              <CountPill strong>{newSinceSeen} new since you were gone</CountPill>
            )}
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft/60">
              {lastChecked ? freshnessLabel(lastChecked) : "Not checked yet"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ============================================================================
 * NOW — the magazine front page (redesign 2026-08-10). TODAY'S THREE leads as
 * the hero poster block (owner ruling: today's up-to-three plays, larger,
 * glowing, TODAY-tagged), THE WEEK follows as a quieter vertical stack of
 * smaller posters, the Daily Brief reads as a typographic letter in Kai's
 * voice, a fresh result (win OR loss, ~48h) gets a share poster, and the
 * member's watch admin tucks behind ONE gear affordance at the very bottom —
 * consumption surface clean, every write preserved.
 * ==========================================================================*/
function NowTab({
  userId,
  rules,
  setRules,
  stateByRule,
  detailByRule,
  setups,
  priceMap,
  isSolo,
  prefs,
  strategy,
  watchlistTickers,
  broadcasts,
  track,
  marketEvents,
  sampleAlert,
  watchesOpen,
  setWatchesOpen,
  onOpenResult,
  onOpenHistory,
}: {
  userId: string;
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
  stateByRule: Map<string, WatchState>;
  detailByRule: Map<string, WatchDetail>;
  setups: AlertSetup[];
  priceMap: Record<string, number>;
  isSolo: boolean;
  prefs: AlertPrefs;
  strategy: StrategyProfile | null;
  watchlistTickers: { ticker: string; company_name: string }[];
  broadcasts: TradeAlert[];
  track: TrackRecord;
  marketEvents: Props["marketEvents"];
  sampleAlert: SampleAlert | null;
  watchesOpen: boolean;
  setWatchesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenResult: (o: AlertOutcome, won: boolean, storyHref: string | null) => void;
  onOpenHistory: () => void;
}) {
  // TODAY'S THREE (owner ruling): the up-to-three alerts active TODAY —
  // issued today OR whose lifecycle moved today (state_entered_at). THE WEEK
  // is everything else the last 7 days actually carried. Nothing invented:
  // an empty day is an empty block.
  const { todayThree, weekStack } = useMemo(() => {
    const todayStr = new Date().toDateString();
    const isToday = (iso: string) => new Date(iso).toDateString() === todayStr;
    const weekCutoff = +new Date() - 7 * 86400000;
    const today = setups.filter(
      (s) => isToday(s.created_at) || isToday(s.state_entered_at)
    );
    today.sort((a, b) => {
      const da = SETUP_STATE_META[a.state]?.developing ? 1 : 0;
      const db = SETUP_STATE_META[b.state]?.developing ? 1 : 0;
      if (da !== db) return db - da;
      return (b.state_entered_at ?? "").localeCompare(a.state_entered_at ?? "");
    });
    const three = today.slice(0, 3);
    const threeIds = new Set(three.map((s) => s.id));
    const week = setups
      .filter(
        (s) =>
          !threeIds.has(s.id) &&
          (+new Date(s.created_at) >= weekCutoff ||
            +new Date(s.state_entered_at) >= weekCutoff)
      )
      .sort((a, b) => (b.state_entered_at ?? "").localeCompare(a.state_entered_at ?? ""));
    return { todayThree: three, weekStack: week };
  }, [setups]);

  // Fresh result — a win OR loss resolved in the last ~48h whose owning alert
  // the track record genuinely graded. Absent data = absent object. (Plain
  // derivation — the compiler memoizes; a manual useMemo over the clock read
  // cannot be preserved.)
  const freshResult = (() => {
    const outcomeByAlert = new Map(track.outcomes.map((o) => [o.id, o] as const));
    const cutoff = +new Date() - 48 * 3600000;
    const resolved = setups
      .filter(
        (s) =>
          RESOLVED_STATES.includes(s.state) &&
          +new Date(s.state_entered_at) >= cutoff
      )
      .sort((a, b) => b.state_entered_at.localeCompare(a.state_entered_at));
    for (const s of resolved) {
      const o = outcomeByAlert.get(s.alert_id);
      if (o && o.peakPct != null)
        return { s, o, won: o.peakPct >= SHARE_HIT_THRESHOLD };
    }
    return null;
  })();

  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div>
      {/* ── TODAY'S THREE — the hero poster block ───────────────────────── */}
      {todayThree.length > 0 && (
        <section>
          <BoardEyebrow
            accent
            className="mb-2.5"
            meta={
              <span className="font-mono text-[10px] tabular-nums text-soft/70">
                {todayThree.length} today
              </span>
            }
          >
            Today
          </BoardEyebrow>
          <div
            className={`grid gap-3.5 ${
              todayThree.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""
            }`}
          >
            {todayThree.map((s) => (
              <SetupGraphCard
                key={s.id}
                s={s}
                current={priceMap[s.ticker] ?? null}
                hero
                today
              />
            ))}
          </div>
        </section>
      )}

      {/* ── THE WEEK — the quieter vertical stack ───────────────────────── */}
      {weekStack.length > 0 && (
        <section className={todayThree.length > 0 ? "mt-8" : ""}>
          <BoardEyebrow className="mb-2">The week</BoardEyebrow>
          <div className="space-y-2.5">
            {weekStack.map((s) => (
              <SetupGraphCard key={s.id} s={s} current={priceMap[s.ticker] ?? null} />
            ))}
          </div>
        </section>
      )}

      {todayThree.length === 0 && weekStack.length === 0 && (
        <Card className="px-4 py-5">
          <KaiVoice size="lg">
            Nothing on the board this week. The moment I flag a play, it lands
            here first.
          </KaiVoice>
        </Card>
      )}

      {/* ── DAILY BRIEF — Kai's letter, violet, typographic ─────────────── */}
      <DailyBriefLetter
        broadcasts={broadcasts}
        setups={setups}
        marketEvents={marketEvents}
        sampleAlert={sampleAlert}
      />

      {/* ── FRESH RESULT — a win or loss resolved in the last ~48h ──────── */}
      {freshResult && (
        <section className="mt-8">
          <BoardEyebrow accent className="mb-2">
            Fresh result
          </BoardEyebrow>
          <OutcomePoster
            o={freshResult.o}
            won={freshResult.won}
            onOpen={() =>
              onOpenResult(
                freshResult.o,
                freshResult.won,
                `/alerts/s/${encodeURIComponent(freshResult.s.id)}`
              )
            }
          />
        </section>
      )}

      {/* ── quiet footer → History ──────────────────────────────────────── */}
      <button
        type="button"
        onClick={onOpenHistory}
        className="f0-focus mt-8 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-soft transition hover:text-ink"
      >
        Everything Kai has sent, and the open record
        <ArrowRight className="h-3.5 w-3.5" />
      </button>

      {/* ── YOUR WATCHES — the admin room behind ONE gear affordance ────── */}
      <section id="my-watches" className="mt-9">
        <button
          type="button"
          onClick={() => setWatchesOpen((v) => !v)}
          aria-expanded={watchesOpen}
          className="f0-focus f0-press flex w-full items-center gap-2.5 rounded-[14px] border border-sand bg-card px-4 py-3 text-left transition hover:border-kai-500/40"
        >
          <Settings2 className="h-4 w-4 shrink-0 text-soft" />
          <span className="text-[12.5px] font-bold text-ink">Your watches</span>
          <span className="font-mono text-[10px] tabular-nums text-soft/70">
            {activeCount}/{MAX_ACTIVE_RULES} active
          </span>
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 text-soft transition-transform ${
              watchesOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {watchesOpen && (
          <div className="mt-4">
            <MyWatchesSection
              userId={userId}
              rules={rules}
              setRules={setRules}
              stateByRule={stateByRule}
              detailByRule={detailByRule}
              isSolo={isSolo}
              prefs={prefs}
              strategy={strategy}
              watchlistTickers={watchlistTickers}
            />
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================================
 * DAILY BRIEF — Kai's letter (redesign 2026-08-10). The most recent day's
 * broadcasts read as ONE typographic block in Kai's voice — large violet
 * quoted paragraphs behind a violet rule — with index chips at the letter's
 * foot deep-linking each name to its setup story (or research when no
 * lifecycle object exists). Bullet boxes and per-broadcast cards are gone
 * from NOW; the plan itself lives on the poster rails and the story pages.
 *
 * EMPTY STATE unchanged in substance: the honest FoundingState, ONE sample
 * pick built from today's real screener data, and this week's market events.
 * ==========================================================================*/
function DailyBriefLetter({
  broadcasts,
  setups,
  marketEvents,
  sampleAlert,
}: {
  broadcasts: TradeAlert[];
  setups: AlertSetup[];
  marketEvents: Props["marketEvents"];
  sampleAlert: SampleAlert | null;
}) {
  const setupByAlert = useMemo(() => {
    const m = new Map<string, AlertSetup>();
    for (const s of setups) m.set(s.alert_id, s);
    return m;
  }, [setups]);

  // The letter is the latest day that actually has broadcasts (the feed
  // arrives newest-first, so it is the first row's calendar day).
  const letter = useMemo(() => {
    if (broadcasts.length === 0) return [];
    const day = new Date(broadcasts[0].issued_at).toDateString();
    return broadcasts.filter((b) => new Date(b.issued_at).toDateString() === day);
  }, [broadcasts]);

  const mkt = marketStatus();

  return (
    <section id="daily-brief" className="mt-9">
      <BoardEyebrow
        accent
        className="mb-2.5"
        meta={
          letter.length > 0 ? (
            <span className="font-mono text-[10px] tabular-nums text-soft/70">
              {new Date(letter[0].issued_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              · {clockTime(letter[0].issued_at)} · {mkt.label.toLowerCase()}
            </span>
          ) : undefined
        }
      >
        Daily brief
      </BoardEyebrow>

      {letter.length === 0 ? (
        /* ── STRONG EMPTY STATE ────────────────────────────────────────────
           The SMS→app pipeline that writes trade_alerts is paused, so there is
           genuinely nothing live. We say so honestly (FoundingState), then show
           ONE plan-led example built from today's REAL screener data so a member
           can see exactly what a pick looks like the moment one lands. */
        <div className="space-y-6">
          <FoundingState
            title="No live setups right now"
            body="Kai posts fresh picks pre-market. When a setup is worth studying, it lands here as a full plan — the call, the levels, and what you'd risk to make. Meanwhile, tell Kai what to watch for you in Your watches below."
          />

          {sampleAlert && (
            <section className="space-y-2">
              <BoardEyebrow className="mb-1">What a pick looks like</BoardEyebrow>
              <PickCard b={sampleToAlert(sampleAlert)} current={sampleAlert.price} sample />
            </section>
          )}

          {marketEvents.length > 0 && (
            <section className="space-y-2">
              <BoardEyebrow className="mb-1">This week in the market</BoardEyebrow>
              {marketEvents.map((mktEv, i) => (
                <CardLink
                  key={i}
                  href={mktEv.ticker ? `/research/${encodeURIComponent(mktEv.ticker)}` : `/news/${mktEv.slug}`}
                >
                  <div className="flex items-center gap-3">
                    {mktEv.ticker && (
                      <CompanyLogo symbol={mktEv.ticker} name={mktEv.ticker} size={30} rounded="rounded-[9px]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">{mktEv.title}</p>
                      {mktEv.dek && <p className="truncate text-[11.5px] text-soft">{mktEv.dek}</p>}
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-soft/60" />
                  </div>
                </CardLink>
              ))}
            </section>
          )}
        </div>
      ) : (
        <>
          {/* the letter — Kai's voice as typography, never bullet boxes */}
          <div
            className="border-l-2 pl-4"
            style={{
              borderColor: "color-mix(in srgb, var(--kai-blue) 45%, transparent)",
            }}
          >
            {letter.map((b) =>
              b.narrative || b.setup_label ? (
                <p
                  key={b.id}
                  className="mt-4 text-[15.5px] leading-[1.65] text-kai-blue first:mt-0"
                >
                  <span className="font-display font-extrabold tracking-tight">
                    ${b.ticker}.
                  </span>{" "}
                  &ldquo;{b.narrative ?? b.setup_label}&rdquo;
                </p>
              ) : null
            )}
          </div>

          {/* index chips at the letter's foot */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {letter.map((b) => {
              const setup = setupByAlert.get(b.id);
              return (
                <Link
                  key={b.id}
                  href={
                    setup
                      ? `/alerts/s/${encodeURIComponent(setup.id)}`
                      : `/research/${encodeURIComponent(b.ticker)}`
                  }
                  className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full border border-sand bg-card px-2.5 py-1.5 font-mono text-[11px] font-semibold text-soft transition hover:border-kai-500/50 hover:text-ink"
                >
                  <CompanyLogo symbol={b.ticker} name={b.ticker} size={16} rounded="rounded" />
                  ${b.ticker}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Map the server-built SAMPLE (real screener data, never persisted) onto the
 * TradeAlert shape the PickCard reads, so the empty state showcases the exact
 * same plan-led card a live pick will render in.
 */
function sampleToAlert(s: SampleAlert): TradeAlert {
  const L = s.levels;
  return {
    id: `sample-${s.ticker}`,
    ticker: s.ticker,
    direction: s.direction,
    setup_label: s.setup_label,
    entry: L.pivot,
    levels: { support: L.shelfLow, resistance: L.pivot, stop: L.invalidation },
    targets: L.targets.map((t) => ({ price: t.price, label: t.label })),
    narrative: s.thesis,
    chart_url: null,
    source: "kai_morning",
    snapshot_price: s.price,
    issued_at: s.issued_at,
    created_at: s.issued_at,
  };
}


/* ============================================================================
 * YOUR WATCHES — NOW's compact secondary section. Was the "My watches" tab.
 * The living list leads (with pause / digest / delete intact), creation
 * follows NL-first, and everything tucked (ready-made plays, the manual
 * builder, delivery prefs, the strategy tuner) folds into disclosure cards
 * so the section stays secondary without losing a single affordance.
 * ==========================================================================*/
const INTENTIONS: { id: string; label: string; icon: typeof Bell; prompt: string }[] = [
  { id: "price", label: "Price Level", icon: Target, prompt: "Tell me if NVDA drops below $150" },
  { id: "momentum", label: "Momentum Shift", icon: Activity, prompt: "Ping me when AAPL gets oversold" },
  { id: "activity", label: "Unusual Activity", icon: Zap, prompt: "Watch TSLA for an unusual volume spike" },
  { id: "sentiment", label: "Club Sentiment", icon: Users, prompt: "Tell me if the club turns bearish on PLTR" },
  { id: "news", label: "Big News", icon: Newspaper, prompt: "Let me know if AMD has major news" },
];
const ADVANCED_INTENTIONS: { id: string; label: string; prompt: string }[] = [
  { id: "rsi", label: "RSI cross", prompt: "Ping me when NVDA RSI crosses above 70" },
  { id: "ema", label: "Moving average", prompt: "Tell me when AAPL closes above its 50-day average" },
  { id: "w52", label: "52-week high/low", prompt: "Let me know when MSFT hits a new 52-week high" },
];

function MyWatchesSection({
  userId,
  rules,
  setRules,
  stateByRule,
  detailByRule,
  isSolo,
  prefs,
  strategy,
  watchlistTickers,
}: {
  userId: string;
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
  stateByRule: Map<string, WatchState>;
  detailByRule: Map<string, WatchDetail>;
  isSolo: boolean;
  prefs: AlertPrefs;
  strategy: StrategyProfile | null;
  watchlistTickers: { ticker: string; company_name: string }[];
}) {
  const [seed, setSeed] = useState<{ text: string; nonce: number }>({ text: "", nonce: 0 });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newTicker, setNewTicker] = useState("");

  const prefill = useCallback((text: string) => {
    setSeed((s) => ({ text, nonce: s.nonce + 1 }));
    requestAnimationFrame(() => {
      document.getElementById("kai-nl")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const toggle = useCallback(
    async (r: AlertRule) => {
      const supabase = createClient();
      const next = !r.active;
      const { error } = await supabase.from("alert_rules").update({ active: next }).eq("id", r.id);
      if (!error) setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
    },
    [setRules]
  );

  const setDigest = useCallback(
    async (r: AlertRule, digest: boolean) => {
      const supabase = createClient();
      const { error } = await supabase.from("alert_rules").update({ digest }).eq("id", r.id);
      if (!error) setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, digest } : x)));
    },
    [setRules]
  );

  const remove = useCallback(
    async (r: AlertRule) => {
      const supabase = createClient();
      const { error } = await supabase.from("alert_rules").delete().eq("id", r.id);
      if (!error) setRules((rs) => rs.filter((x) => x.id !== r.id));
    },
    [setRules]
  );

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("alert_rules")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) setRules(data as AlertRule[]);
  }, [userId, setRules]);

  return (
    <div>

      {/* The living list leads — every watch as a card with the real trigger
          condition spelled out, and every edit affordance intact (pause,
          digest, delete). No "Kai is on it" hand-waving: if you can't read
          the condition, you can't trust the alert. */}
      {rules.length === 0 ? (
        <Card className="px-4 py-5">
          <p className="text-[13px] leading-relaxed text-soft">
            Nothing on watch yet. Tell Kai what to watch below, or add one from
            any screener row, watchlist row or research page.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <WatchManageCard
              key={r.id}
              r={r}
              state={r.active ? stateByRule.get(r.id) ?? null : null}
              detail={r.active ? detailByRule.get(r.id) ?? null : null}
              onToggle={() => toggle(r)}
              onDigest={(d) => setDigest(r, d)}
              onRemove={() => remove(r)}
            />
          ))}
        </div>
      )}

      {/* ── creation — plain English first ──────────────────────────────── */}
      <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-soft">
        Say it in plain English — a stock, a price, a moment you care about. Kai
        turns it into a watch and tells you the moment it happens.
      </p>

      {/* Intentions — deterministic prefills (usable even if NL parse is offline). */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {INTENTIONS.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => prefill(it.prompt)}
              className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full border border-sand bg-card px-3 py-1.5 text-[12px] font-semibold text-soft transition hover:border-kai-500 hover:text-ink"
            >
              <Icon className="h-3.5 w-3.5 text-kai-600" />
              {it.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="f0-focus inline-flex items-center gap-1 rounded-full border border-dashed border-sand bg-card px-3 py-1.5 text-[12px] font-semibold text-soft transition hover:border-kai-500"
        >
          Advanced{" "}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>
      </div>
      {showAdvanced && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ADVANCED_INTENTIONS.map((it) => (
            <button
              key={it.id}
              onClick={() => prefill(it.prompt)}
              className="f0-focus rounded-full border border-sand bg-card px-2.5 py-1 text-[11px] font-medium text-soft transition hover:border-kai-500 hover:text-ink"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}

      {/* NL entry point — the #kai-nl deep-link target. */}
      <div id="kai-nl" className="mt-3">
        <KaiWatch
          userId={userId}
          surface="strategy"
          presetText={seed.text || undefined}
          presetNonce={seed.nonce}
          onCreated={(created) => setRules((rs) => [...created, ...rs])}
        />
      </div>

      {/* ── everything tucked — folded cards, zero affordances lost ─────── */}
      <div className="mt-4 space-y-2">
        <WatchlistPlays userId={userId} watchlistTickers={watchlistTickers} rules={rules} setRules={setRules} />

        <FoldCard title="Build one by hand">
          <p className="mb-3 text-[12px] text-soft">
            Enter a ticker to set a price, volume or technical watch on it.
          </p>
          <div className="flex items-center gap-2">
            <input
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g, ""))}
              placeholder="e.g. AAPL"
              maxLength={8}
              className="w-32 rounded-lg border border-sand bg-paper px-3 py-2 text-[14px] font-semibold text-ink outline-none focus:border-kai-500"
            />
            {newTicker.length >= 1 ? (
              <span onClick={refresh}>
                <SetAlertButton ticker={newTicker} surface="manual" variant="full" stopPropagation={false} />
              </span>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-1.5 rounded-lg border border-sand px-3 py-1.5 text-[13px] font-semibold text-soft/50"
              >
                <Plus className="h-4 w-4" /> Set watch
              </button>
            )}
          </div>
        </FoldCard>

        <DeliveryPrefs isSolo={isSolo} prefs={prefs} />

        <FoldCard
          title="Tune what Kai suggests"
          icon={<Gauge className="h-3.5 w-3.5 text-gold-700" />}
        >
          <StrategyTuner userId={userId} strategy={strategy} rules={rules} setRules={setRules} />
        </FoldCard>
      </div>
    </div>
  );
}

/**
 * FOLD CARD — the section's one disclosure object. The manual builder, the
 * ready-made plays, delivery prefs and the strategy tuner all used to draw
 * their own expand/collapse chrome (or none); this is that pattern once.
 */
function FoldCard({
  title,
  icon,
  meta,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="f0-focus flex w-full items-center justify-between gap-3"
      >
        <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-bold text-ink">
          {icon}
          {title}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {meta}
          <ChevronDown
            className={`h-4 w-4 text-soft transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && <div className="mt-3 border-t border-sand pt-3">{children}</div>}
    </Card>
  );
}

function WatchManageCard({
  r,
  state,
  detail,
  onToggle,
  onDigest,
  onRemove,
}: {
  r: AlertRule;
  state: WatchState | null;
  detail: WatchDetail | null;
  onToggle: () => void;
  onDigest: (d: boolean) => void;
  onRemove: () => void;
}) {
  // The condition in the engine's own words. `label` is what Kai confirmed back
  // at create time; ruleLabel() is the deterministic rendering of the stored
  // params. Showing BOTH when they differ is the honest move.
  const condition = ruleLabel(r.kind, r.ticker, r.params);
  const headline = r.label || condition;
  const showCondition = condition && condition !== headline;

  return (
    <Card dim={!r.active}>
      <div className="flex items-start gap-3">
        {r.ticker ? (
          <CompanyLogo symbol={r.ticker} name={r.ticker} size={32} rounded="rounded-[10px]" />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-kai-500/10 text-kai-600">
            <Sparkles className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-[14px] font-extrabold tracking-tight text-ink">
              {r.ticker ? `$${r.ticker}` : "Screen"}
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft/70">
              {KIND_DIMENSION[r.kind]}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-ink/85">{headline}</p>
          {showCondition && (
            <p className="mt-0.5 font-mono text-[10.5px] leading-snug text-soft/80">
              Fires when {condition.toLowerCase()}
            </p>
          )}
        </div>

        {/* instant / digest */}
        <button
          onClick={() => onDigest(!r.digest)}
          title={r.digest ? "In daily digest — tap for instant" : "Instant — tap for daily digest"}
          className={`f0-focus hidden shrink-0 self-center font-mono text-[9.5px] uppercase tracking-[0.14em] transition sm:inline-flex ${
            r.digest ? "text-soft/70 hover:text-ink" : "text-kai-600 hover:text-kai-500"
          }`}
        >
          {r.digest ? "Digest" : "Instant"}
        </button>
        {/* pause / resume */}
        <button
          type="button"
          onClick={onToggle}
          title={r.active ? "Pause" : "Resume"}
          aria-label={r.active ? "Pause watch" : "Resume watch"}
          className={`f0-focus relative h-6 w-11 shrink-0 self-center rounded-full transition ${
            r.active ? "bg-kai-500" : "bg-sand"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${
              r.active ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
        <button
          onClick={onRemove}
          title="Delete"
          aria-label="Delete watch"
          className="f0-focus shrink-0 self-center p-0.5 text-soft/60 transition hover:text-ink"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* State is ONE human Kai line (heat-by-glow law: no chips, no bars),
          plus the measured quantity the cron genuinely recorded. */}
      {state && (
        <>
          <p className="mt-2 text-[11.5px] leading-snug text-kai-blue">
            &ldquo;{watchStateLine(state, r.ticker || "this screen")}&rdquo;
          </p>
          {typeof detail?.metric === "string" && (
            <p className="mt-1 font-mono text-[10.5px] leading-snug text-soft/80">
              {detail.metric}
            </p>
          )}
        </>
      )}

      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-soft/60">
        {r.active ? "Watching" : "Paused"}
        {" · "}
        {r.last_checked_at ? freshnessLabel(r.last_checked_at).toLowerCase() : "queued"}
      </p>
    </Card>
  );
}

function DeliveryPrefs({ isSolo, prefs }: { isSolo: boolean; prefs: AlertPrefs }) {
  const [briefing, setBriefing] = useState<boolean>(prefs.briefing_enabled ?? isSolo);
  const [digest, setDigest] = useState(prefs.digest);
  const [cap, setCap] = useState(prefs.daily_cap);
  const [quiet, setQuiet] = useState(prefs.quiet_hours);
  const [saved, setSaved] = useState(false);

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("alert_prefs").upsert(
        {
          user_id: user.id,
          briefing_enabled: patch.briefing_enabled ?? briefing,
          digest: patch.digest ?? digest,
          daily_cap: patch.daily_cap ?? cap,
          quiet_hours: patch.quiet_hours ?? quiet,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
    [briefing, digest, cap, quiet]
  );

  // Canvas board 19's "NOTIFY ME" card, folded into the section's disclosure
  // vocabulary. Every switch and the cap select write exactly as before.
  return (
    <FoldCard
      title="Notify me"
      icon={<Bell className="h-3.5 w-3.5 text-kai-600" />}
      meta={
        saved ? (
          <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-gold-700">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <SwitchRow
          label="Kai Daily push"
          hint={isSolo ? "On by default for Club members" : "Opt-in for family accounts"}
          checked={briefing}
          onChange={(v) => {
            setBriefing(v);
            save({ briefing_enabled: v });
          }}
        />
        <SwitchRow
          label="Send everything as a daily digest"
          hint="One summary push instead of instant alerts"
          checked={digest}
          onChange={(v) => {
            setDigest(v);
            save({ digest: v });
          }}
        />
        <SwitchRow
          label="Respect quiet hours"
          hint="Hold non-urgent updates overnight"
          checked={quiet}
          onChange={(v) => {
            setQuiet(v);
            save({ quiet_hours: v });
          }}
        />
        <div className="flex items-center justify-between gap-3 border-t border-sand pt-3">
          <div>
            <p className="text-[12.5px] font-medium text-ink">Daily push limit</p>
            <p className="text-[11px] text-soft/70">Extra alerts roll into your digest</p>
          </div>
          <select
            value={cap}
            onChange={(e) => {
              const v = Number(e.target.value);
              setCap(v);
              save({ daily_cap: v });
            }}
            className="rounded-full border border-sand bg-paper px-3 py-1.5 font-mono text-[12px] font-semibold text-ink outline-none focus:border-kai-500"
          >
            {[5, 10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}/day
              </option>
            ))}
          </select>
        </div>
      </div>
    </FoldCard>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink">{label}</span>
        <span className="block text-[11px] text-soft/70">{hint}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`f0-focus relative h-[19px] w-[34px] shrink-0 rounded-full transition ${
          checked ? "bg-accent" : "bg-sand"
        }`}
      >
        <span
          className={`absolute top-[2.5px] h-[14px] w-[14px] rounded-full bg-card shadow transition-all ${
            checked ? "left-[17px]" : "left-[2.5px]"
          }`}
        />
      </button>
    </label>
  );
}

/* ============================================================================
 * HISTORY — the Record merged in (redesign 2026-08-10). The honest record
 * band leads (big mono W/L, avg move, month vs all-time — BOTH sides always,
 * from the real TrackRecord), then ONE chronological feed under editorial
 * time headers ("This week", month names): resolved setups as mini OUTCOME
 * POSTERS (wins and losses interleaved), briefs and notices as slim dim
 * one-line rows between them. A sticky small filter (All / Wins / Losses /
 * Briefs) rides the scroll. Clicking a winner/loser opens the FULL shareable
 * result card (owner ruling — ResultShareModal, mounted at the hub root).
 * ==========================================================================*/
type FeedRow =
  | { type: "resolved"; at: string; ticker: string; s: AlertSetup; o: AlertOutcome | null }
  | { type: "brief"; at: string; ticker: string; b: TradeAlert }
  | { type: "event"; at: string; ticker: string; e: AlertEvent };

/** A setup whose lifecycle CLOSED — the machine's own final verdicts. */
const RESOLVED_STATES: SetupState[] = ["triggered", "invalidated", "expired"];

type HistoryFilter = "all" | "wins" | "losses" | "briefs";

function HistoryTab({
  events,
  broadcasts,
  setups,
  track,
  observational,
  hubSeenAt,
  sampleAlert,
  onOpenResult,
}: {
  events: AlertEvent[];
  broadcasts: TradeAlert[];
  setups: AlertSetup[];
  track: TrackRecord;
  observational: ObservationalRow[];
  hubSeenAt: string | null;
  sampleAlert: SampleAlert | null;
  onOpenResult: (o: AlertOutcome, won: boolean, storyHref: string | null) => void;
}) {
  const [filter, setFilter] = useState<HistoryFilter>("all");

  // The track record's graded outcome per owning alert — joined onto a
  // resolved row ONLY when the record genuinely graded that setup.
  const outcomeByAlert = useMemo(() => {
    const m = new Map<string, AlertOutcome>();
    for (const o of track.outcomes) m.set(o.id, o);
    return m;
  }, [track]);

  // Briefs that own a lifecycle object deep-link to its story.
  const setupByAlert = useMemo(() => {
    const m = new Map<string, AlertSetup>();
    for (const s of setups) m.set(s.alert_id, s);
    return m;
  }, [setups]);

  const rows = useMemo<FeedRow[]>(() => {
    // A resolution is its own moment in time (state_entered_at) — it sits in
    // the feed at the day it RESOLVED, distinct from the day it was issued.
    const rs: FeedRow[] = setups
      .filter((s) => RESOLVED_STATES.includes(s.state))
      .map((s) => ({
        type: "resolved",
        at: s.state_entered_at,
        ticker: s.ticker,
        s,
        o: outcomeByAlert.get(s.alert_id) ?? null,
      }));
    const bs: FeedRow[] = broadcasts.map((b) => ({
      type: "brief",
      at: b.issued_at,
      ticker: b.ticker,
      b,
    }));
    const es: FeedRow[] = events.map((e) => ({
      type: "event",
      at: e.fired_at,
      ticker: e.ticker,
      e,
    }));
    return [...rs, ...bs, ...es].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [setups, broadcasts, events, outcomeByAlert]);

  const graded = useMemo(() => track.outcomes.filter((o) => o.peakPct != null), [track]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "wins":
        return rows.filter(
          (r) =>
            r.type === "resolved" && r.o?.peakPct != null && r.o.peakPct >= SHARE_HIT_THRESHOLD
        );
      case "losses":
        return rows.filter(
          (r) =>
            r.type === "resolved" && r.o?.peakPct != null && r.o.peakPct < SHARE_HIT_THRESHOLD
        );
      case "briefs":
        return rows.filter((r) => r.type !== "resolved");
      default:
        return rows;
    }
  }, [rows, filter]);

  // Editorial time headers — one pass keeps the newest-first order.
  const groups = useMemo(() => {
    const out: { label: string; rows: FeedRow[] }[] = [];
    let cur: { label: string; rows: FeedRow[] } | null = null;
    for (const r of filtered) {
      const label = editorialBucket(r.at);
      if (!cur || cur.label !== label) {
        cur = { label, rows: [] };
        out.push(cur);
      }
      cur.rows.push(r);
    }
    return out;
  }, [filtered]);

  const winCount = graded.filter((o) => (o.peakPct ?? 0) >= SHARE_HIT_THRESHOLD).length;
  const briefCount = rows.filter((r) => r.type !== "resolved").length;

  const CHIPS: { id: HistoryFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: rows.length },
    { id: "wins", label: "Wins", count: winCount },
    { id: "losses", label: "Losses", count: graded.length - winCount },
    { id: "briefs", label: "Briefs", count: briefCount },
  ];

  return (
    <div>
      {/* ── the honest record band — both sides, always ─────────────────── */}
      {graded.length > 0 ? (
        <RecordBand outcomes={graded} />
      ) : (
        <Card className="px-4 py-5">
          <p className="flex items-center gap-2 font-display text-[16px] font-extrabold text-ink">
            <Trophy className="h-4 w-4 text-gold-700" aria-hidden />
            The record starts soon
          </p>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-soft">
            Once Kai&apos;s daily setups start going out, each one is tracked here
            by its peak favourable move — winners and misses in the open.
          </p>
          {sampleAlert && (
            <p className="mt-2 max-w-md text-[12px] text-soft/75">
              See the <span className="font-semibold text-ink">daily brief</span>{" "}
              on Now for a sample of a tracked setup.
            </p>
          )}
        </Card>
      )}

      {/* ── sticky small filter ─────────────────────────────────────────── */}
      <div className="club2-track sticky top-0 z-10 -mx-4 mt-5 flex gap-1.5 overflow-x-auto bg-paper/95 px-4 py-2 backdrop-blur-sm">
        {CHIPS.map((c) => {
          const on = filter === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={`f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                on
                  ? "border-kai-500 bg-kai-500/10 text-kai-600"
                  : "border-sand text-soft hover:border-kai-500/40"
              }`}
            >
              {c.label}
              <span className="font-mono text-[10px] tabular-nums opacity-70">{c.count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="mt-4 px-4 py-5">
          <p className="font-display text-[16px] font-extrabold text-ink">Nothing here yet</p>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-soft">
            Kai&apos;s briefs, your fired watches and every resolved setup collect
            here as they happen.
          </p>
        </Card>
      ) : (
        <div className="mt-4">
          {groups.map((g) => (
            <section key={g.label} className="mt-7 first:mt-0">
              {/* editorial time header */}
              <h2 className="font-display text-[15px] font-extrabold tracking-tight text-ink">
                {g.label}
              </h2>
              <div className="mt-2.5">
                {g.rows.map((row) => {
                  if (row.type === "resolved") {
                    const o = row.o;
                    if (o && o.peakPct != null) {
                      const won = o.peakPct >= SHARE_HIT_THRESHOLD;
                      const storyHref = `/alerts/s/${encodeURIComponent(row.s.id)}`;
                      return (
                        <div key={`s-${row.s.id}`} className="mt-2.5 first:mt-0">
                          <OutcomePoster
                            o={o}
                            won={won}
                            onOpen={() => onOpenResult(o, won, storyHref)}
                          />
                        </div>
                      );
                    }
                    // Resolved but never graded (no computable peak) — an
                    // honest slim row, never a poster with an invented %.
                    return (
                      <SlimRow
                        key={`s-${row.s.id}`}
                        href={`/alerts/s/${encodeURIComponent(row.s.id)}`}
                        at={row.at}
                        ticker={row.ticker}
                        text={setupStateLine(row.s.state, row.s.ticker)}
                        isNew={!!hubSeenAt && row.at > hubSeenAt}
                      />
                    );
                  }
                  if (row.type === "brief") {
                    const setup = setupByAlert.get(row.b.id);
                    return (
                      <SlimRow
                        key={`b-${row.b.id}`}
                        href={
                          setup
                            ? `/alerts/s/${encodeURIComponent(setup.id)}`
                            : `/research/${encodeURIComponent(row.ticker)}`
                        }
                        at={row.at}
                        ticker={row.ticker}
                        text={row.b.setup_label || row.b.narrative || "Daily brief"}
                        isNew={!!hubSeenAt && row.at > hubSeenAt}
                      />
                    );
                  }
                  return (
                    <SlimRow
                      key={`e-${row.e.id}`}
                      href={`/alerts/e/${encodeURIComponent(row.e.id)}`}
                      at={row.at}
                      ticker={row.ticker}
                      text={row.e.payload?.message || "Condition met"}
                      isNew={!!hubSeenAt && row.at > hubSeenAt}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── the never-scored observational split (kept, quiet) ──────────── */}
      {filter === "all" && observational.length > 0 && (
        <div className="mt-8">
          <ObservationalCards rows={observational} />
        </div>
      )}

      <p className="mt-8 text-[11px] leading-relaxed text-soft/70">
        Peak favourable move is educational performance tracking of past analysis,
        measured from a setup&apos;s issue price to its best subsequent close.
        Follow-through figures for personal watches are neutral price context, not
        graded outcomes. Past performance never guarantees future results.
      </p>
    </div>
  );
}

/** The "N new" count has to be checkable — every row it counted is marked. */
function NewMark() {
  return (
    <span className="shrink-0 rounded-full bg-volt-500 px-1.5 py-px font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-night-950">
      New
    </span>
  );
}

/** Briefs / notices between the posters: slim, dim, hairline-separated —
 *  hairlines only ever on quiet secondary rows (poster law). */
function SlimRow({
  href,
  at,
  ticker,
  text,
  isNew,
}: {
  href: string;
  at: string;
  ticker: string;
  text: string;
  isNew?: boolean;
}) {
  return (
    <Link
      href={href}
      className="f0-focus flex items-center gap-3 border-b border-sand/60 px-1 py-2 opacity-75 transition hover:opacity-100"
    >
      <span className="w-12 shrink-0 font-mono text-[9px] uppercase tabular-nums tracking-[0.08em] text-soft/60">
        {new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </span>
      <span className="shrink-0 font-mono text-[11px] font-semibold text-soft">${ticker}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-soft">{text}</span>
      {isNew && <NewMark />}
    </Link>
  );
}

/* ============================================================================
 * RECORD BAND — the honest record on top of HISTORY (the old Record tab
 * merged in, 2026-08-10): big mono W/L, avg peak move, month vs all-time,
 * BOTH sides always. Every figure comes off the real TrackRecord.
 * ==========================================================================*/
function pctStr(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

/** Mirrors HIT_THRESHOLD in src/lib/alerts/history.ts — "worked" = peak ≥ +5%. */
const SHARE_HIT_THRESHOLD = 5;

function recordSplit(outcomes: AlertOutcome[]) {
  const wins = outcomes.filter((o) => (o.peakPct ?? 0) >= SHARE_HIT_THRESHOLD).length;
  const losses = outcomes.length - wins;
  const avg =
    outcomes.length > 0
      ? outcomes.reduce((s, o) => s + (o.peakPct ?? 0), 0) / outcomes.length
      : null;
  return { wins, losses, avg };
}

function RecordBand({ outcomes }: { outcomes: AlertOutcome[] }) {
  const now = new Date();
  const monthOutcomes = outcomes.filter((o) => {
    const d = new Date(o.issued_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const cols = [
    { label: "This month", r: recordSplit(monthOutcomes), n: monthOutcomes.length },
    { label: "All time", r: recordSplit(outcomes), n: outcomes.length },
  ];

  return (
    <Card className="px-4 py-4">
      <BoardEyebrow accent>The record</BoardEyebrow>
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[13px] border border-sand bg-sand">
        {cols.map((col) => (
          <div key={col.label} className="bg-card px-4 py-3.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-soft/70">
              {col.label}
            </p>
            {/* Big mono W/L — counts stay ink (green/red is price-only). */}
            <p className="mt-1.5 font-mono text-[26px] font-bold tabular-nums leading-none text-ink">
              {col.r.wins}W<span className="mx-1 text-soft/50">·</span>
              {col.r.losses}L
            </p>
            <p
              className={`mt-1.5 font-mono text-[10.5px] font-semibold tabular-nums ${
                col.n === 0
                  ? "text-soft/60"
                  : (col.r.avg ?? 0) >= 0
                    ? "text-price-up"
                    : "text-price-down"
              }`}
            >
              {col.n === 0 ? "no graded setups" : `avg peak ${pctStr(col.r.avg)}`}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-sand pt-2.5 text-[11.5px] leading-relaxed text-soft">
        Kai Daily setups are graded by their peak move in their favour (worked
        = reached +5%). Personal watches show what happened after — never a win
        or a loss.
      </p>
    </Card>
  );
}

function ObservationalCards({ rows }: { rows: ObservationalRow[] }) {
  return (
    <section className="space-y-2">
      <BoardEyebrow className="mb-1">
        <span className="inline-flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-kai-600" /> Your watches — what happened after
        </span>
      </BoardEyebrow>
      <p className="max-w-lg text-[11.5px] leading-relaxed text-soft/80">
        Sentiment, activity and news watches have no set target, so they&apos;re
        never scored. This is neutral follow-through, not a result.
      </p>
      {rows.map((r) => (
        <Card key={r.id}>
          <div className="flex items-center gap-3">
            <CompanyLogo symbol={r.ticker} name={r.ticker} size={30} rounded="rounded-[9px]" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] font-extrabold tracking-tight text-ink">
                ${r.ticker}
              </p>
              <p className="truncate text-[11.5px] text-soft/85">{r.message}</p>
            </div>
            <dl className="flex shrink-0 items-end gap-4">
              <ObsPct label="+1 day" value={r.plus1d} />
              <ObsPct label="+5 days" value={r.plus5d} />
            </dl>
          </div>
        </Card>
      ))}
    </section>
  );
}

function ObsPct({ label, value }: { label: string; value: number | null }) {
  const up = (value ?? 0) >= 0;
  return (
    <div className="text-right">
      <dt className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-soft/60">{label}</dt>
      <dd
        className={`mt-0.5 font-mono text-[13px] font-bold tabular-nums ${
          value == null ? "text-soft/50" : up ? "text-price-up" : "text-price-down"
        }`}
      >
        {value == null ? "—" : `${up ? "+" : ""}${value.toFixed(1)}%`}
      </dd>
    </div>
  );
}

/* ============================================================================
 * STRATEGY TUNER + WATCHLIST PLAYS (deterministic, no LLM).
 * ==========================================================================*/
const PLAY_ICON: Record<string, typeof Bell> = {
  breakout: TrendingUp,
  oversold: TrendingDown,
  momentum: Crosshair,
  pullback: Target,
};

function WatchlistPlays({
  userId,
  watchlistTickers,
  rules,
  setRules,
}: {
  userId: string;
  watchlistTickers: { ticker: string; company_name: string }[];
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
}) {
  const [selected, setSelected] = useState<string | null>(watchlistTickers[0]?.ticker ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existing = useMemo(() => {
    const set = new Set<string>();
    for (const r of rules) if (r.ticker) set.add(`${r.ticker.toUpperCase()}:${r.kind}`);
    return set;
  }, [rules]);

  const create = useCallback(
    async (play: StrategyPlay) => {
      if (!selected) return;
      setBusy(play.id);
      setError(null);
      const supabase = createClient();
      const label = ruleLabel(play.kind, selected, play.params);
      const { data, error: err } = await supabase
        .from("alert_rules")
        .insert({
          user_id: userId,
          kind: play.kind,
          ticker: selected,
          params: play.params,
          label,
          surface: "watchlist",
          active: true,
        })
        .select("*")
        .single();
      setBusy(null);
      if (err) {
        setError(
          /cap reached/i.test(err.message)
            ? `You've hit the ${MAX_ACTIVE_RULES}-watch limit. Pause one first.`
            : "Could not set that watch. Try again."
        );
        return;
      }
      if (data) setRules((rs) => [data as AlertRule, ...rs]);
    },
    [selected, userId, setRules]
  );

  if (watchlistTickers.length === 0) return null;

  return (
    <FoldCard title="Attach a ready-made watch">
      <p className="text-[12.5px] leading-relaxed text-soft">
        Pick a stock you follow and a play. Kai watches for that condition and
        tells you when it trips — a plain, rules-based signal to study.
      </p>

      <ScrollRow tone="card" className="mt-3 flex gap-1.5 pb-1">
        {watchlistTickers.map((w) => {
          const on = selected === w.ticker;
          return (
            <button
              key={w.ticker}
              onClick={() => setSelected(w.ticker)}
              className={`f0-focus flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-mono text-[11.5px] font-semibold transition ${
                on ? "border-kai-500 bg-kai-500/10 text-kai-600" : "border-sand text-soft hover:border-kai-500/40"
              }`}
            >
              <CompanyLogo symbol={w.ticker} name={w.company_name} size={18} rounded="rounded" />
              ${w.ticker}
            </button>
          );
        })}
      </ScrollRow>

      <div className="mt-3 space-y-2">
        {STRATEGY_PLAYS.map((play) => {
          const Icon = PLAY_ICON[play.id] ?? Bell;
          const set = selected ? existing.has(`${selected}:${play.kind}`) : false;
          const isBusy = busy === play.id;
          return (
            <button
              key={play.id}
              disabled={set || isBusy || !selected}
              onClick={() => create(play)}
              className="f0-focus flex w-full items-center gap-3 rounded-[13px] border border-sand bg-paper px-3 py-2.5 text-left transition hover:border-accent/45 disabled:cursor-default disabled:hover:border-sand"
            >
              <Icon className="h-4 w-4 shrink-0 text-kai-600" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-bold text-ink">{play.name}</span>
                <span className="block text-[11px] text-soft">{play.tagline}</span>
                <span className="mt-0.5 block font-mono text-[10px] leading-snug text-soft/75">
                  Fires when {selected ?? "it"} {play.watchLine}
                </span>
              </span>
              {set ? (
                <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft/70">
                  <Check className="h-3.5 w-3.5" /> Set
                </span>
              ) : isBusy ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-kai-600" />
              ) : (
                <Plus className="h-4 w-4 shrink-0 text-soft/60" />
              )}
            </button>
          );
        })}
      </div>

      {/* A failed write is not a price falling — red here would be the third
          meaning of red on a screen that already spends it on price. */}
      {error && (
        <p role="status" className="mt-3 border-t border-sand pt-2.5 text-[12px] font-semibold text-ink">
          {error}
        </p>
      )}
    </FoldCard>
  );
}

function StrategyTuner({
  userId,
  strategy,
  rules,
  setRules,
}: {
  userId: string;
  strategy: StrategyProfile | null;
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
}) {
  const [timeframe, setTimeframe] = useState<StrategyProfile["timeframe"]>(strategy?.timeframe ?? "swing");
  const [setups, setSetups] = useState<string[]>(strategy?.setup_prefs ?? []);
  const [risk, setRisk] = useState<StrategyProfile["risk_posture"]>(strategy?.risk_posture ?? "balanced");
  const [saved, setSaved] = useState(false);

  const save = useCallback(async () => {
    const supabase = createClient();
    await supabase.from("strategy_profiles").upsert(
      { user_id: userId, timeframe, setup_prefs: setups, risk_posture: risk, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [userId, timeframe, setups, risk]);

  const suggestions = useMemo(
    () => suggestedRulesFor({ timeframe, setup_prefs: setups, risk_posture: risk }),
    [timeframe, setups, risk]
  );

  const existingPresetIds = new Set(
    rules.filter((r) => r.kind === "preset_match").map((r) => (r.params as { presetId?: string }).presetId)
  );

  const addSuggestion = useCallback(
    async (s: { presetId: string; presetLabel: string; label: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("alert_rules")
        .insert({
          user_id: userId,
          kind: "preset_match",
          ticker: null,
          params: { presetId: s.presetId, presetLabel: s.presetLabel },
          label: s.label,
          surface: "strategy",
          active: true,
        })
        .select("*")
        .single();
      if (!error && data) setRules((rs) => [data as AlertRule, ...rs]);
    },
    [userId, setRules]
  );

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-snug text-soft">
        Tell Kai how you like to study the market and he&apos;ll suggest watches
        that fit — you stay in control of what actually gets created.
      </p>

      <Section title="How long do you hold?">
        <div className="flex flex-wrap gap-2">
          {TIMEFRAME_OPTIONS.map((o) => (
            <Choice key={o.id} active={timeframe === o.id} onClick={() => setTimeframe(o.id)} label={o.label} />
          ))}
        </div>
      </Section>

      <Section title="What setups interest you?">
        <div className="flex flex-wrap gap-2">
          {SETUP_OPTIONS.map((o) => {
            const on = setups.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => setSetups((s) => (on ? s.filter((x) => x !== o.id) : [...s, o.id]))}
                title={o.blurb}
                className={`f0-focus rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  on ? "border-accent bg-accent/10 text-gold-700" : "border-sand text-soft hover:border-accent/40"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Risk posture">
        <div className="flex flex-wrap gap-2">
          {RISK_OPTIONS.map((o) => (
            <Choice key={o.id} active={risk === o.id} onClick={() => setRisk(o.id)} label={o.label} />
          ))}
        </div>
      </Section>

      <button onClick={save} className="cta-button w-full rounded-full py-2.5 text-[14px]">
        {saved ? "Saved ✓" : "Save"}
      </button>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <BoardEyebrow className="mb-1">Suggested watches for you</BoardEyebrow>
          {suggestions.map((s) => {
            const added = existingPresetIds.has(s.presetId);
            return (
              <div
                key={s.key}
                className="flex items-center gap-3 rounded-[13px] border border-sand bg-paper px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-ink">{s.label}</p>
                  <p className="text-[11px] leading-snug text-soft">{s.reason}</p>
                </div>
                {added ? (
                  <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft/70">
                    <Check className="h-3.5 w-3.5" /> Added
                  </span>
                ) : (
                  <button
                    onClick={() => addSuggestion(s)}
                    className="f0-focus inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/50 px-3 py-1.5 text-[12px] font-semibold text-gold-700 transition hover:bg-accent/10"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-soft/70">{title}</p>
      {children}
    </div>
  );
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`f0-focus rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition ${
        active ? "border-accent bg-accent/10 text-gold-700" : "border-sand text-soft hover:border-accent/40"
      }`}
    >
      {label}
    </button>
  );
}

/* ---------- shared bits ---------- */
/** Editorial time header — "This week", then month names sectioning the scroll. */
function editorialBucket(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);
  if (dayDiff < 7) return "This week";
  if (then.getFullYear() === now.getFullYear())
    return then.toLocaleDateString(undefined, { month: "long" });
  return then.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** "8:15 AM" — the brief block's real issue time (never a scheduled fiction). */
function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
