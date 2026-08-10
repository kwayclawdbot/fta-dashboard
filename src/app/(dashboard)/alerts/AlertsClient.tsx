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
  Search,
  ChevronRight,
  Users,
  Newspaper,
  Bell,
  ChevronDown,
  Gauge,
  LineChart,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CompanyLogo from "@/components/fic/CompanyLogo";
import SetAlertButton from "@/components/alerts/SetAlertButton";
import PickCard from "@/components/alerts/PickCard";
import SetupGraphCard from "@/components/alerts/SetupGraphCard";
import ShareOutcomeCard from "@/components/alerts/ShareOutcomeCard";
import { FoundingState } from "@/components/family/canvas";
import KaiWatch from "@/components/kai/KaiWatch";
import WatchRail from "@/components/watch/WatchRail";
import {
  Card,
  CardLink,
  AccentCard,
  Dial,
  StatePill,
  StatGrid,
  LifecycleBar,
  CountPill,
  NavCard,
  CondRow,
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
  WATCH_STATE_META,
  SETUP_STATE_META,
  watchStateLine,
  setupStateLine,
  marketStatus,
  freshnessLabel,
  readSetupLevels,
  type StateTone,
  type ObservationalRow,
} from "@/lib/alerts/watch-ui";

/**
 * /alerts — KAI WATCH, rebuilt on the owner's canvas.
 *
 * Boards 06 (Watch · overview), 18 (Watch · Kai Alerts) and 19 (Alert setup) are
 * the reference. They are CARD boards: the big lowercase wordmark, the orange
 * pill rail, then white cards on warm paper — nav rows, the accent "getting
 * close" card with its ring, alert cards with a coloured left edge, and compact
 * dimmed rows for anything older than today. The obsidian Kai masthead that used
 * to open this screen is not on any of those boards and is gone.
 *
 * WHAT THE CANVAS ASKS FOR THAT WE WILL NOT SAY: board 18 labels its cards BUY
 * SIGNAL and SELL SIGNAL in the price colours. An alert states what HAPPENED, so
 * the pill carries the state machine's own word (Triggered · Heating up ·
 * Building · Into earnings) on the state ramp, and green/red stay on price.
 * The chips under a card body carry MEASURED quantities the cron recorded —
 * never invented checkmarks.
 */

type Tab = "overview" | "daily" | "watch" | "history" | "track";

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
  const [tab, setTab] = useState<Tab>("overview");
  const [rules, setRules] = useState(initialRules);
  const [setups, setSetups] = useState(initialSetups);

  // Deep-link. Two shapes, and they are NOT the same thing:
  //   #overview|#daily|#watch|#history|#track → a tab name (the detail screen's
  //     "Edit this watch" uses #watch). #live is kept as an alias: the Live
  //     Watches tab was absorbed into the canvas's OVERVIEW board, and old links
  //     must not land on nothing.
  //   #kai-nl → an ELEMENT inside the watch tab (the ticker page's Kai Report
  //     panel links here to start a natural-language watch). It selects the
  //     owning tab first and scrolls to the node once it exists.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    if (hash === "live") {
      setTab("overview");
      return;
    }
    const valid: Tab[] = ["overview", "daily", "watch", "history", "track"];
    if ((valid as string[]).includes(hash)) {
      setTab(hash as Tab);
      return;
    }
    if (hash === "kai-nl") {
      setTab("watch");
      // Two frames: one for the tab swap to commit, one for the AnimatePresence
      // enter to lay out, before the node can be measured.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          document
            .getElementById("kai-nl")
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        )
      );
    }
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
  const followedSetups = useMemo(
    () => setups.filter((s) => s.subscribed),
    [setups]
  );

  // Current state per active rule (Lane A view), keyed for O(1) lookup.
  const stateByRule = useMemo(() => {
    const map = new Map<string, WatchState>();
    for (const w of watchStates) map.set(w.rule_id, w.state as WatchState);
    return map;
  }, [watchStates]);

  // …and the DETAIL the same cron recorded next to it: how close the condition
  // is (0..1) and the measured quantity. Stored since migration 157 — it is what
  // fills the canvas's ring and what the meters are drawn from.
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

  const watchingCount = activeRules.length + followedSetups.length;

  // Developing watches (non-baseline machine state) for the overview count.
  const developingCount = useMemo(() => {
    let n = 0;
    for (const r of activeRules) {
      const s = stateByRule.get(r.id);
      if (s && WATCH_STATE_META[s]?.developing) n++;
    }
    for (const s of followedSetups) {
      if (SETUP_STATE_META[s.state]?.developing) n++;
    }
    return n;
  }, [activeRules, stateByRule, followedSetups]);

  // ONE CONTROL, NOT TWO. These five sections used to ride <SectionPills> — a
  // second row of filled pills directly under the cross-surface pill rail. The
  // rail has gone inline (see WatchHead), and the sections moved onto the
  // canvas's shared <SegmentedRail>, which is the app's one answer to "pick one
  // of N": an underline carried by type weight first and colour second, so it
  // still reads with colour stripped and it never becomes pill soup. Nothing
  // was dropped — all five sections are here, and the live watch count that the
  // pills carried in a superscript now rides the label itself.
  const TAB_ITEMS = useMemo<SegmentedOption<Tab>[]>(
    () => [
      { id: "overview", label: "Overview" },
      { id: "daily", label: "Kai Daily" },
      {
        id: "watch",
        label: activeRules.length
          ? `My watches · ${activeRules.length}`
          : "My watches",
      },
      { id: "history", label: "Alerts" },
      { id: "track", label: "Record" },
    ],
    [activeRules.length]
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <WatchHead
        newSinceSeen={newSinceSeen}
        watchingCount={watchingCount}
        developingCount={developingCount}
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
          {tab === "overview" && (
            <OverviewTab
              onGo={setTab}
              rules={activeRules}
              stateByRule={stateByRule}
              detailByRule={detailByRule}
              setups={setups}
              priceMap={priceMap}
              watchlistCount={watchlistTickers.length}
              activeCount={activeRules.length}
              broadcastCount={broadcasts.length}
              newSinceSeen={newSinceSeen}
            />
          )}
          {tab === "daily" && (
            <KaiDailyTab
              broadcasts={broadcasts}
              events={events}
              setups={setups}
              setSetups={setSetups}
              priceMap={priceMap}
              marketEvents={marketEvents}
              sampleAlert={sampleAlert}
            />
          )}
          {tab === "watch" && (
            <MyWatchTab
              userId={userId}
              rules={rules}
              setRules={setRules}
              stateByRule={stateByRule}
              detailByRule={detailByRule}
              isSolo={isSolo}
              prefs={initialPrefs}
              strategy={initialStrategy}
              watchlistTickers={watchlistTickers}
            />
          )}
          {tab === "history" && (
            <HistoryTab
              events={events}
              broadcasts={broadcasts}
              setups={setups}
              track={trackRecord}
              priceMap={priceMap}
              hubSeenAt={hubSeenAt}
              lastChecked={lastChecked}
              newSinceSeen={newSinceSeen}
            />
          )}
          {tab === "track" && (
            <TrackRecordTab track={trackRecord} observational={observational} sampleAlert={sampleAlert} />
          )}
        </m.div>
      </AnimatePresence>

      <p className="mt-10 text-[11px] leading-relaxed text-soft/70">
        Kai&apos;s watches and briefings are educational market analysis, not financial advice or a
        recommendation to buy or sell. Intraday prices are delayed roughly 15 minutes. Past
        performance never guarantees future results.
      </p>
    </div>
  );
}

/* ============================================================================
 * BOARD HEAD — canvas 06/17/18: wordmark, pill rail, then (board 18) the Kai
 * identity row with the "N NEW" pill. No dark field: none of these boards draw
 * one, and the one that used to sit here was the loudest thing on the screen
 * that the canvas does not contain.
 * ==========================================================================*/
function WatchHead({
  newSinceSeen,
  watchingCount,
  developingCount,
  lastChecked,
}: {
  newSinceSeen: number;
  watchingCount: number;
  developingCount: number;
  lastChecked: string | null;
}) {
  const mkt = marketStatus();

  // Board 18's sub-line is "Generated from your watchlist & positions · 6:02 AM".
  // Ours says the same thing from real readings: what Kai is on, the session,
  // and when a cron last actually looked.
  const readings = [
    watchingCount === 1 ? "1 watch running" : `${watchingCount} watches running`,
    mkt.label,
    lastChecked ? freshnessLabel(lastChecked).toLowerCase() : "not checked yet",
  ];

  return (
    <header>
      {/* THIS BOARD IS "KAI WATCH", AND NOW IT SAYS SO. It shipped under the
          wordmark "watch" — the same word /watchlist prints — so two entirely
          different rooms wore one name and the browser tab could not tell them
          apart either. Kai Watch is the name the rail already uses to send a
          member here (WatchRail's third cell) and the name the rules layer
          carries throughout, so the door and the room finally agree. */}
      <BoardLead word="kai watch" />

      {/* The section rail below is this board's one control. The cross-surface
          rail therefore drops to its quiet inline line rather than stacking a
          second row of pills on top of it — see WatchRail's note. */}
      <WatchRail active="kai" variant="inline" className="mt-3" />

      <Card className="mt-4 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-kai-500/12 text-kai-600 ring-1 ring-kai-500/25">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink">Kai&apos;s alerts for you</p>
          <p className="mt-px truncate text-[10px] text-soft/85">
            {readings.join(" · ")}
          </p>
        </div>
        {developingCount > 0 && (
          <span className="hidden shrink-0 items-center gap-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-gold-700 sm:inline-flex">
            <Zap className="h-3 w-3" /> {developingCount} developing
          </span>
        )}
        {/* The canvas draws a "3 NEW" pill. It is only allowed to exist because
            migration 195 gave the hub a real watermark to measure against — a
            first-ever visit shows nothing rather than inventing a backlog. */}
        {newSinceSeen > 0 && <CountPill strong>{newSinceSeen} new</CountPill>}
      </Card>
    </header>
  );
}

/* ============================================================================
 * OVERVIEW — canvas board 06.
 *
 * The board draws four nav rows, then the "GETTING CLOSE" accent card with its
 * ring, then a compact row for the next setup along. Three of the four nav rows
 * have real destinations in this app; the fourth (an earnings calendar) has no
 * data source, so it is not drawn as a dead row.
 * ==========================================================================*/
function OverviewTab({
  onGo,
  rules,
  stateByRule,
  detailByRule,
  setups,
  priceMap,
  watchlistCount,
  activeCount,
  broadcastCount,
  newSinceSeen,
}: {
  onGo: (t: Tab) => void;
  rules: AlertRule[];
  stateByRule: Map<string, WatchState>;
  detailByRule: Map<string, WatchDetail>;
  setups: AlertSetup[];
  priceMap: Record<string, number>;
  watchlistCount: number;
  activeCount: number;
  broadcastCount: number;
  newSinceSeen: number;
}) {
  // Everything actually developing, ordered by how close the cron says it is.
  // The nearest one becomes the board's accent card; the rest are compact rows.
  const developing = useMemo(() => {
    const rows = rules
      .map((r) => ({ r, state: stateByRule.get(r.id), detail: detailByRule.get(r.id) ?? null }))
      .filter(
        (x): x is { r: AlertRule; state: WatchState; detail: WatchDetail | null } =>
          !!x.state && WATCH_STATE_META[x.state].developing
      );
    return rows.sort((a, b) => (b.detail?.progress ?? 0) - (a.detail?.progress ?? 0));
  }, [rules, stateByRule, detailByRule]);

  // The visual board's rows: every LIVE Kai Daily setup (developing lifecycle
  // state), each drawn as a graphic card — real month chart + stored level
  // lines + state chip + distance-to-trigger. Followed or not, if it is live
  // it is on the board; nothing is cherry-picked.
  const liveSetups = useMemo(() => {
    const developing = setups.filter((s) => SETUP_STATE_META[s.state]?.developing);
    if (developing.length > 0) return developing;
    // Quiet market: nothing is mid-lifecycle right now. The board still leads
    // with the GRAPHIC cards — the newest setups in their REAL states
    // (triggered / cooled / called off), which is honest and keeps the visual
    // surface present instead of silently reverting to the text rows.
    return [...setups]
      .sort((a, b) => (b.state_entered_at ?? "").localeCompare(a.state_entered_at ?? ""))
      .slice(0, 4);
  }, [setups]);

  const lead = developing[0] ?? null;
  const rest = developing.slice(1);

  return (
    <div className="space-y-6">
      {/* ── LIVE SETUPS — the overview leads with the graphic board ─────── */}
      {liveSetups.length > 0 && (
        <section>
          <BoardEyebrow
            accent
            className="mb-2"
            meta={
              <span className="font-mono text-[10px] tabular-nums text-soft/70">
                {liveSetups.length} live
              </span>
            }
          >
            Live setups
          </BoardEyebrow>
          <div className="grid gap-3 lg:grid-cols-2">
            {liveSetups.map((s) => (
              <SetupGraphCard key={s.id} s={s} current={priceMap[s.ticker] ?? null} />
            ))}
          </div>
        </section>
      )}

      {/* ── the board's four rows ───────────────────────────────────────── */}
      <div className="space-y-2">
        <NavCard
          href="/watchlist"
          icon={<LineChart className="h-4 w-4" />}
          title="My watchlist"
          sub={
            watchlistCount === 0
              ? "Nothing on the board yet"
              : `${watchlistCount} ${watchlistCount === 1 ? "company" : "companies"}`
          }
        />
        <NavCard
          onClick={() => onGo("watch")}
          icon={<Eye className="h-4 w-4" />}
          title="Kai Watch"
          sub={
            activeCount === 0
              ? "Tell Kai what to watch"
              : `${activeCount} active ${activeCount === 1 ? "setup" : "setups"}`
          }
          badge={developing.length || undefined}
        />
        <NavCard
          onClick={() => onGo("daily")}
          icon={<Bell className="h-4 w-4" />}
          title="Kai Daily"
          sub={
            broadcastCount === 0
              ? "Kai's briefing setups land here"
              : `${broadcastCount} recent ${broadcastCount === 1 ? "setup" : "setups"}`
          }
          badge={newSinceSeen || undefined}
        />
        <NavCard
          href="/watchlist/community"
          icon={<RefreshCw className="h-4 w-4" />}
          title="Opinion changes"
          sub="Who the club re-thought in the last 24 hours"
        />
      </div>

      {/* ── GETTING CLOSE — the board's centrepiece ─────────────────────── */}
      {lead ? (
        <GettingCloseCard
          r={lead.r}
          state={lead.state}
          detail={lead.detail}
          current={lead.r.ticker ? priceMap[lead.r.ticker] ?? null : null}
        />
      ) : (
        <Card className="px-4 py-5">
          <BoardEyebrow accent>Getting close</BoardEyebrow>
          <p className="mt-2 font-display text-[16px] font-extrabold text-ink">
            Nothing at the doorstep
          </p>
          <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-soft">
            Kai is watching quietly. The moment one of your conditions starts to
            build, it moves up here with how close it is — so you read it before
            it trips, not after.
          </p>
          <button
            onClick={() => onGo("watch")}
            className="f0-focus mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gold-700 transition hover:text-gold-600"
          >
            Tell Kai what to watch <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </Card>
      )}

      {/* ── everything else on the move ─────────────────────────────────── */}
      {rest.length > 0 && (
        <section className="space-y-2">
          <BoardEyebrow className="mb-1">Also developing</BoardEyebrow>
          {rest.map(({ r, state, detail }) => (
            <DevelopingRow
              key={r.id}
              r={r}
              state={state}
              detail={detail}
              current={r.ticker ? priceMap[r.ticker] ?? null : null}
            />
          ))}
        </section>
      )}

    </div>
  );
}

/**
 * The canvas's "GETTING CLOSE · NVDA Bullish Break · 2/3" card: accent gradient,
 * a ring, and a condition list beside it.
 *
 * OUR RING IS THE CRON'S OWN NUMBER. `detail.progress` is a 0..1 closeness the
 * Lane-A cron computes on every transition. It sizes the ring, and the centre
 * prints the state machine's STEP (e.g. 3 of 5 states walked), not a percentage
 * — because progress normalises seven different condition kinds and a "%" next
 * to a ticker would be read as a likelihood, which it is not.
 *
 * The condition list is the real machine path: the states this watch has
 * actually reached, ticked, and the one it is working on, hollow.
 */
const WATCH_LADDER: WatchState[] = ["watching", "building", "near_trigger", "triggered"];

function GettingCloseCard({
  r,
  state,
  detail,
  current,
}: {
  r: AlertRule;
  state: WatchState;
  detail: WatchDetail | null;
  current: number | null;
}) {
  const meta = WATCH_STATE_META[state];
  const condition = r.label || ruleLabel(r.kind, r.ticker, r.params);
  const idx = WATCH_LADDER.indexOf(state);
  // Off-ladder states (cooled / stood down / into earnings) get no step count —
  // they are not "N of 4 of the way there", they are somewhere else entirely.
  const onLadder = idx >= 0;
  const step = onLadder ? idx + 1 : null;
  const progress =
    typeof detail?.progress === "number" && Number.isFinite(detail.progress)
      ? Math.min(1, Math.max(0, detail.progress))
      : onLadder
        ? (idx + 1) / WATCH_LADDER.length
        : 0.5;

  return (
    <AccentCard>
      <div className="flex items-start gap-3">
        <BoardEyebrow accent>Getting close</BoardEyebrow>
        <span className="ml-auto shrink-0">
          <StatePill tone={meta.tone} label={meta.label} live={meta.live} />
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2.5">
        {r.ticker && (
          <CompanyLogo symbol={r.ticker} name={r.ticker} size={28} rounded="rounded-[9px]" />
        )}
        <p className="min-w-0 flex-1 truncate font-display text-[16px] font-extrabold text-ink">
          {r.ticker ? `$${r.ticker}` : "Screen"} · {condition}
        </p>
        {current != null && (
          <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-ink">
            {money(current)}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Dial
          value={progress}
          size={84}
          tone={meta.tone}
          center={step ? `${step}/${WATCH_LADDER.length}` : meta.label.slice(0, 1)}
          centerClassName="text-[16px]"
          label={
            step
              ? `Step ${step} of ${WATCH_LADDER.length} of the way to this condition`
              : `Kai's current read on this watch: ${meta.label}`
          }
        />
        <div className="min-w-0 flex-1 space-y-2">
          {onLadder ? (
            WATCH_LADDER.map((s, i) => (
              <CondRow
                key={s}
                met={i <= idx}
                tone={meta.tone}
                label={WATCH_STATE_META[s].label}
                value={i === idx && typeof detail?.metric === "string" ? detail.metric : null}
              />
            ))
          ) : (
            <p className="text-[12.5px] leading-relaxed text-ink/85">
              {watchStateLine(state, r.ticker || "this screen")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-sand pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft/75">
          {r.last_checked_at ? freshnessLabel(r.last_checked_at) : "Queued"}
        </span>
        {r.ticker && (
          <Link
            href={`/research/${encodeURIComponent(r.ticker)}`}
            className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-gold-700 transition hover:text-gold-600"
          >
            See what Kai found <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </AccentCard>
  );
}

/** The canvas's compact "TSLA earnings setup · 1/3 conditions · 3 days" row. */
function DevelopingRow({
  r,
  state,
  detail,
  current,
}: {
  r: AlertRule;
  state: WatchState;
  detail: WatchDetail | null;
  current: number | null;
}) {
  const meta = WATCH_STATE_META[state];
  const label = r.label || ruleLabel(r.kind, r.ticker, r.params);
  return (
    <Card edge={meta.tone}>
      <div className="flex items-center gap-3">
        {r.ticker ? (
          <CompanyLogo symbol={r.ticker} name={r.ticker} size={30} rounded="rounded-[9px]" />
        ) : (
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-kai-500/10 text-kai-600">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] text-ink/85">
            <span className="font-display font-extrabold text-ink">
              {r.ticker ? `$${r.ticker}` : "Screen"}
            </span>{" "}
            · {label}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-soft/70">
            {watchStateLine(state, r.ticker || "this screen")}
          </p>
        </div>
        {current != null && (
          <span className="shrink-0 font-mono text-[12.5px] font-semibold tabular-nums text-ink">
            {money(current)}
          </span>
        )}
        <StatePill tone={meta.tone} label={meta.label} live={meta.live} />
      </div>
      <LifecycleBar
        className="mt-2.5"
        pct={barPct(detail?.progress, WATCH_BAR[state])}
        tone={meta.tone}
        label={`Watch lifecycle: ${meta.label}`}
      />
      {typeof detail?.metric === "string" && (
        <p className="mt-1.5 font-mono text-[10.5px] leading-snug text-soft/80">
          {detail.metric}
        </p>
      )}
    </Card>
  );
}

/* ============================================================================
 * KAI DAILY — canvas board 18's alert cards, one per broadcast.
 * ==========================================================================*/
function KaiDailyTab({
  broadcasts,
  events,
  setups,
  setSetups,
  priceMap,
  marketEvents,
  sampleAlert,
}: {
  broadcasts: TradeAlert[];
  events: AlertEvent[];
  setups: AlertSetup[];
  setSetups: React.Dispatch<React.SetStateAction<AlertSetup[]>>;
  priceMap: Record<string, number>;
  marketEvents: Props["marketEvents"];
  sampleAlert: SampleAlert | null;
}) {
  const setupByAlert = useMemo(() => {
    const m = new Map<string, AlertSetup>();
    for (const s of setups) m.set(s.alert_id, s);
    return m;
  }, [setups]);

  // setup_update events grouped by setup, so a followed setup shows its thread.
  const threadBySetup = useMemo(() => {
    const m = new Map<string, AlertEvent[]>();
    for (const e of events) {
      if (e.kind !== "setup_update") continue;
      const sid = e.payload?.setup_id;
      if (!sid) continue;
      const arr = m.get(sid) || [];
      arr.push(e);
      m.set(sid, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => +new Date(b.fired_at) - +new Date(a.fired_at));
    return m;
  }, [events]);

  const onSub = useCallback(
    (setupId: string, subscribed: boolean) => {
      setSetups((ss) => ss.map((s) => (s.id === setupId ? { ...s, subscribed } : s)));
    },
    [setSetups]
  );

  // Board 18 groups by day. Broadcasts arrive newest-first, so one pass keeps
  // that order and drops empty buckets.
  const groups = useMemo(() => {
    const out: { label: string; rows: TradeAlert[] }[] = [];
    let cur: { label: string; rows: TradeAlert[] } | null = null;
    for (const b of broadcasts) {
      const label = dateBucket(b.issued_at);
      if (!cur || cur.label !== label) {
        cur = { label, rows: [] };
        out.push(cur);
      }
      cur.rows.push(b);
    }
    return out;
  }, [broadcasts]);

  const mkt = marketStatus();

  return (
    <div className="space-y-6">
      <p className="max-w-lg text-[13px] leading-relaxed text-soft">
        Kai&apos;s read on the market — the setups worth studying, laid out as a plan:
        where it works, where it&apos;s wrong, and what you&apos;d risk to make.
      </p>

      {broadcasts.length === 0 ? (
        /* ── STRONG EMPTY STATE ────────────────────────────────────────────
           The SMS→app pipeline that writes trade_alerts is paused, so there is
           genuinely nothing live. We say so honestly (FoundingState), then show
           ONE plan-led example built from today's REAL screener data so a member
           can see exactly what a pick looks like the moment one lands. */
        <>
          <FoundingState
            title="No live setups right now"
            body="Kai posts fresh picks pre-market. When a setup is worth studying, it lands here as a full plan — the call, the levels, and what you'd risk to make. Meanwhile, tell Kai what to watch for you in My watches."
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
        </>
      ) : (
        <>
          <BoardEyebrow
            accent
            className="mb-1"
            meta={
              <span className="font-mono text-[10px] tabular-nums text-soft/70">
                {broadcasts.length} live · {mkt.label.toLowerCase()}
              </span>
            }
          >
            Today&apos;s picks
          </BoardEyebrow>
          {groups.map((g) => {
            /* CheatCodeDoors' Daily Brief blocks (Morning 8:15 · Midday 12:30).
               The prototype's third block (Close · how the day resolved) has no
               data source here — no close-recap broadcast exists — so it is
               omitted rather than faked. The "when" line carries the REAL
               source (kai_morning / kai_intraday) and the REAL issue time. */
            const blocks = [
              { when: "Morning brief", rows: g.rows.filter((b) => b.source === "kai_morning") },
              { when: "Intraday", rows: g.rows.filter((b) => b.source !== "kai_morning") },
            ].filter((blk) => blk.rows.length > 0);
            return (
              <section key={g.label} className="space-y-4">
                {blocks.map((blk) => (
                  <div key={blk.when} className="space-y-4">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-kai-blue">
                      {g.label} · {blk.when} · {clockTime(blk.rows[0].issued_at)}
                    </p>
                    {blk.rows.map((b) => {
                      const setup = setupByAlert.get(b.id);
                      const thread = setup ? threadBySetup.get(setup.id) || [] : [];
                      return (
                        <PickCard
                          key={b.id}
                          b={b}
                          current={priceMap[b.ticker] ?? null}
                          setup={setup}
                          thread={thread}
                          onSub={onSub}
                        />
                      );
                    })}
                  </div>
                ))}
              </section>
            );
          })}
        </>
      )}
    </div>
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

/* ---------- shared formatters ---------- */
function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ============================================================================
 * CheatCodeDoors card language — urgency tiers, lifecycle positions and the
 * "Kai's read" line, mapped onto the REAL machine states (never invented).
 * ==========================================================================*/

/** The prototype's LIFE bar: fixed lifecycle positions for the watching bar. */
const WATCH_BAR: Record<WatchState, number> = {
  watching: 18,
  building: 42,
  near_trigger: 78,
  triggered: 100,
  cooled: 30,
  invalidated: 100,
  earnings_wait: 50,
};
/** Bar position: the cron's own 0..1 progress when recorded, else the state's
 *  fixed ladder position — a position, never a probability. */
function barPct(progress: number | null | undefined, fallback: number): number {
  return typeof progress === "number" && Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress)) * 100
    : fallback;
}

/** Reward:risk derived from STORED levels only — null (no cell) when a leg is
 *  missing, per the "omit rather than fake" rule. */
function rrOf(
  entry: number | null,
  stop: number | null,
  target: number | null
): string | null {
  if (entry == null || stop == null || target == null) return null;
  const risk = Math.abs(entry - stop);
  if (risk <= 1e-9) return null;
  return `${(Math.abs(target - entry) / risk).toFixed(1)}R`;
}

/** CheatCodeDoors urgency tiers: high = 800 17px Sora title over the accent
 *  tint with a 1.5px accent edge · med = 700 14.5px on card · low = 12.5px. */
type Urgency = "high" | "med" | "low";
const URGENCY_HEAD: Record<Urgency, string> = {
  high: "font-display text-[17px] font-extrabold leading-[1.2] text-ink",
  med: "font-display text-[14.5px] font-bold leading-[1.25] text-ink",
  low: "font-display text-[12.5px] font-bold leading-[1.3] text-ink",
};

/** The high-urgency frame — accent-soft wash + 1.5px accent edge, mixed from
 *  --accent-solid so it stays mode-correct and flips with the theme. */
function urgencyFrame(u: Urgency): React.CSSProperties | undefined {
  if (u !== "high") return undefined;
  return {
    borderWidth: 1.5,
    borderColor: "color-mix(in srgb, var(--accent-solid) 55%, var(--sand))",
    background: "color-mix(in srgb, var(--accent-solid) 10%, var(--card))",
  };
}

/** The prototype's "Kai's read" interpretation line — kai-blue, quoted. */
function KaiRead({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`text-[12px] leading-[1.5] text-kai-blue ${className}`}>
      &ldquo;{text}&rdquo;
    </p>
  );
}

/**
 * Which WAY a setup is drawn — the direction of the level being watched, not an
 * instruction. Carried by an arrow and the word, never by a green/red pill:
 * green and red belong to price, and a green LONG badge is a verdict in a
 * costume.
 */
const DIR_GLYPH: Record<string, string> = { long: "↑", short: "↓", watch: "•" };

function DirChip({ dir }: { dir: string }) {
  const glyph = DIR_GLYPH[dir] ?? DIR_GLYPH.watch;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-soft">
      <span aria-hidden>{glyph}</span>
      {dir}
    </span>
  );
}

/* ============================================================================
 * MY WATCHES — NL-first, intentions, and every watch as a card.
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

function MyWatchTab({
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
  const [showManual, setShowManual] = useState(false);
  const [showTune, setShowTune] = useState(false);

  const activeCount = rules.filter((r) => r.active).length;

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
    <div className="space-y-6">
      <p className="max-w-lg text-[13px] leading-relaxed text-soft">
        Say it in plain English — a stock, a price, a moment you care about. Kai
        turns it into a watch and tells you the moment it happens.
      </p>

      {/* Intentions — deterministic prefills (usable even if NL parse is offline). */}
      <div className="flex flex-wrap gap-1.5">
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
        <div className="-mt-3 flex flex-wrap gap-1.5">
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
      <div id="kai-nl">
        <KaiWatch
          userId={userId}
          surface="strategy"
          presetText={seed.text || undefined}
          presetNonce={seed.nonce}
          onCreated={(created) => setRules((rs) => [...created, ...rs])}
        />
      </div>

      <WatchlistPlays userId={userId} watchlistTickers={watchlistTickers} rules={rules} setRules={setRules} />

      {/* Manual builder — reachable, tucked. */}
      <Card>
        <button
          onClick={() => setShowManual((v) => !v)}
          className="f0-focus flex w-full items-center justify-between"
        >
          <span className="text-[12.5px] font-bold text-ink">Or build one by hand</span>
          <ChevronDown className={`h-4 w-4 text-soft transition-transform ${showManual ? "rotate-180" : ""}`} />
        </button>
        {showManual && (
          <div className="mt-3 border-t border-sand pt-3">
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
          </div>
        )}
      </Card>

      {/* The living list — every watch as a card, with the real trigger
          condition spelled out. No "Kai is on it" hand-waving: if you can't read
          the condition, you can't trust the alert. */}
      <section className="space-y-2">
        <BoardEyebrow
          className="mb-1"
          meta={
            <span className="font-mono text-[10px] tabular-nums text-soft/70">
              {activeCount}/{MAX_ACTIVE_RULES} active
            </span>
          }
        >
          What Kai is watching
        </BoardEyebrow>
        {rules.length === 0 ? (
          <Card className="px-4 py-5">
            <p className="text-[13px] leading-relaxed text-soft">
              Nothing on watch yet. Tell Kai what to watch above, or add one from
              any screener row, watchlist row or research page.
            </p>
          </Card>
        ) : (
          rules.map((r) => (
            <WatchManageCard
              key={r.id}
              r={r}
              state={r.active ? stateByRule.get(r.id) ?? null : null}
              detail={r.active ? detailByRule.get(r.id) ?? null : null}
              onToggle={() => toggle(r)}
              onDigest={(d) => setDigest(r, d)}
              onRemove={() => remove(r)}
            />
          ))
        )}
      </section>

      <DeliveryPrefs isSolo={isSolo} prefs={prefs} />

      {/* Fine-tuning (strategy profile) — reachable, tucked. */}
      <Card>
        <button onClick={() => setShowTune((v) => !v)} className="f0-focus flex w-full items-center justify-between">
          <span className="flex items-center gap-2 text-[12.5px] font-bold text-ink">
            <Gauge className="h-3.5 w-3.5 text-gold-700" /> Tune what Kai suggests
          </span>
          <ChevronDown className={`h-4 w-4 text-soft transition-transform ${showTune ? "rotate-180" : ""}`} />
        </button>
        {showTune && (
          <div className="mt-4 border-t border-sand pt-4">
            <StrategyTuner userId={userId} strategy={strategy} rules={rules} setRules={setRules} />
          </div>
        )}
      </Card>
    </div>
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
  const meta = state ? WATCH_STATE_META[state] : null;
  // The condition in the engine's own words. `label` is what Kai confirmed back
  // at create time; ruleLabel() is the deterministic rendering of the stored
  // params. Showing BOTH when they differ is the honest move.
  const condition = ruleLabel(r.kind, r.ticker, r.params);
  const headline = r.label || condition;
  const showCondition = condition && condition !== headline;

  return (
    <Card edge={meta && meta.tone !== "quiet" ? meta.tone : undefined} dim={!r.active}>
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
            {meta && meta.tone !== "quiet" && (
              <StatePill tone={meta.tone} label={meta.label} live={meta.live} />
            )}
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

      {/* Where in the lifecycle this watch sits — CheatCodeDoors' 5px bar.
          The fill is the cron's own 0..1 progress when recorded; otherwise the
          state's fixed ladder position. Drawn for every active watch (a
          baseline WATCHING row sits at the ladder's start, honestly low). */}
      {state && meta && (
        <>
          <LifecycleBar
            className="mt-2.5"
            pct={barPct(detail?.progress, WATCH_BAR[state])}
            tone={meta.tone}
            label={`Watch lifecycle: ${meta.label}`}
          />
          {typeof detail?.metric === "string" && (
            <p className="mt-1.5 font-mono text-[10.5px] leading-snug text-soft/80">
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

  // Canvas board 19's "NOTIFY ME" card: a titled card of labelled switches.
  return (
    <Card>
      <BoardEyebrow
        meta={
          saved ? (
            <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-gold-700">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          ) : undefined
        }
      >
        Notify me
      </BoardEyebrow>
      <div className="mt-3 space-y-3">
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
    </Card>
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
 * ALERTS — canvas board 18's feed: grouped by day, cards for today, compact
 * dimmed rows for everything older.
 * ==========================================================================*/
type FeedRow =
  | { type: "event"; at: string; ticker: string; e: AlertEvent }
  | { type: "broadcast"; at: string; ticker: string; b: TradeAlert };

function HistoryTab({
  events,
  broadcasts,
  setups,
  track,
  priceMap,
  hubSeenAt,
  lastChecked,
  newSinceSeen,
}: {
  events: AlertEvent[];
  broadcasts: TradeAlert[];
  setups: AlertSetup[];
  track: TrackRecord;
  priceMap: Record<string, number>;
  hubSeenAt: string | null;
  lastChecked: string | null;
  newSinceSeen: number;
}) {
  const [q, setQ] = useState("");

  const rows = useMemo<FeedRow[]>(() => {
    const es: FeedRow[] = events.map((e) => ({ type: "event", at: e.fired_at, ticker: e.ticker, e }));
    const bs: FeedRow[] = broadcasts.map((b) => ({ type: "broadcast", at: b.issued_at, ticker: b.ticker, b }));
    return [...es, ...bs].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [events, broadcasts]);

  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase();
    if (!needle) return rows;
    return rows.filter((r) => r.ticker.toUpperCase().includes(needle));
  }, [rows, q]);

  // Board 18: Today / Yesterday. Rows arrive newest-first, so one pass into
  // ordered buckets keeps that order and drops empty buckets.
  const groups = useMemo(() => {
    const out: { label: string; rows: FeedRow[] }[] = [];
    let cur: { label: string; rows: FeedRow[] } | null = null;
    for (const r of filtered) {
      const label = dateBucket(r.at);
      if (!cur || cur.label !== label) {
        cur = { label, rows: [] };
        out.push(cur);
      }
      cur.rows.push(r);
    }
    return out;
  }, [filtered]);

  return (
    <div className="space-y-5">
      <Card className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-kai-500/12 text-kai-600 ring-1 ring-kai-500/25">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink">Everything Kai has sent you</p>
          <p className="mt-px truncate text-[10px] text-soft/85">
            From your watchlist &amp; your watches ·{" "}
            {lastChecked ? freshnessLabel(lastChecked).toLowerCase() : "not checked yet"}
          </p>
        </div>
        {newSinceSeen > 0 && <CountPill>{newSinceSeen} new</CountPill>}
      </Card>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft/60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by ticker…"
          className="w-full rounded-full border border-sand bg-card py-2.5 pl-9 pr-3 text-[13.5px] text-ink outline-none placeholder:text-soft/60 focus:border-kai-500"
        />
      </div>

      {/* ── RESOLVED SETUPS — the clean outcome ledger ──────────────────────
          Every Kai Daily setup whose lifecycle CLOSED (level hit / stopped /
          expired) as one hairline-separated ledger: the machine's own verdict
          chip, the peak favourable move where the record graded it, and an
          R figure only when the stored legs genuinely carry one. */}
      <ResolvedLedger setups={setups} track={track} q={q} />

      {filtered.length === 0 ? (
        <Card className="px-4 py-5">
          <p className="font-display text-[16px] font-extrabold text-ink">
            {q.trim() ? `Nothing for $${q.trim().toUpperCase()} yet` : "No alerts yet"}
          </p>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-soft">
            Kai&apos;s updates and your fired watches collect here as they happen.
          </p>
        </Card>
      ) : (
        groups.map((g, gi) => (
          <section key={g.label} className="space-y-2">
            <BoardEyebrow className="mb-1">{g.label}</BoardEyebrow>
            {g.rows.map((row) =>
              row.type === "broadcast" ? (
                <HistoryBroadcastRow
                  key={`b-${row.b.id}`}
                  b={row.b}
                  current={priceMap[row.ticker] ?? null}
                  isNew={!!hubSeenAt && row.at > hubSeenAt}
                  compact={gi > 0}
                />
              ) : (
                <HistoryEventRow
                  key={`e-${row.e.id}`}
                  e={row.e}
                  current={priceMap[row.ticker] ?? null}
                  isNew={!!hubSeenAt && row.at > hubSeenAt}
                  compact={gi > 0}
                />
              )
            )}
          </section>
        ))
      )}
    </div>
  );
}

/**
 * RESOLVED LEDGER — closed alert_setups lifecycles as one clean ledger.
 *
 * Outcome chips are the state machine's OWN verdicts (Triggered / Called off /
 * Fizzled), never re-worded into wins. The peak favourable % joins a row only
 * when the track record graded that setup's owning alert; the R figure is
 * derived purely from stored legs — realized peak-R when entry + stop + peak
 * all exist, the planned R:R otherwise, and nothing when neither computes.
 */
function ResolvedLedger({
  setups,
  track,
  q,
}: {
  setups: AlertSetup[];
  track: TrackRecord;
  q: string;
}) {
  const outcomeByAlert = useMemo(() => {
    const m = new Map<string, AlertOutcome>();
    for (const o of track.outcomes) m.set(o.id, o);
    return m;
  }, [track]);

  const resolved = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return setups
      .filter(
        (s) =>
          s.state === "triggered" || s.state === "invalidated" || s.state === "expired"
      )
      .filter((s) => !needle || s.ticker.toUpperCase().includes(needle));
  }, [setups, q]);

  if (resolved.length === 0) return null;

  return (
    <section>
      <BoardEyebrow
        className="mb-1"
        meta={
          <span className="font-mono text-[10px] tabular-nums text-soft/70">
            {resolved.length} resolved
          </span>
        }
      >
        Resolved setups
      </BoardEyebrow>
      <Card padded={false} className="divide-y divide-sand">
        {resolved.map((s) => {
          const meta = SETUP_STATE_META[s.state];
          const L = readSetupLevels(s.levels);
          const entry = s.entry;
          const stop = L.stop ?? L.support;
          const target = L.resistance;
          const o = outcomeByAlert.get(s.alert_id);
          const peakPct = o?.peakPct ?? null;
          // Realized peak-R only when every leg is genuinely stored.
          const peakR =
            entry != null &&
            stop != null &&
            Math.abs(entry - stop) > 1e-9 &&
            o?.peakPrice != null
              ? Math.abs(o.peakPrice - entry) / Math.abs(entry - stop)
              : null;
          const planned = rrOf(entry, stop, target);
          return (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <CompanyLogo symbol={s.ticker} name={s.ticker} size={28} rounded="rounded-[9px]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-display text-[13px] font-extrabold tracking-tight text-ink">
                    ${s.ticker}
                  </span>
                  <StatePill tone={meta.tone} label={meta.label} />
                </div>
                <p className="mt-0.5 truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-soft/70">
                  {new Date(s.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  {" · resolved "}
                  {new Date(s.state_entered_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {peakPct != null && (
                  <p
                    className={`font-mono text-[13px] font-semibold tabular-nums ${
                      peakPct >= 0 ? "text-price-up" : "text-price-down"
                    }`}
                  >
                    {pctStr(peakPct)}
                  </p>
                )}
                {(peakR != null || planned != null) && (
                  <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-soft/60">
                    {peakR != null ? `peak ${peakR.toFixed(1)}R` : `plan ${planned}`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </Card>
      <p className="mt-1.5 text-[10.5px] leading-relaxed text-soft/70">
        Chips are the lifecycle&apos;s own verdicts. Peak % and R figures derive
        only from stored levels and daily closes.
      </p>
    </section>
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

/**
 * A fired watch / Kai update as a CheatCodeDoors alert card: identity row with
 * the uppercase mono state chip, the urgency-tiered Sora headline, the stat
 * rows (only cells the event actually recorded), and — on lifecycle updates —
 * the "Kai's read" line. Urgency comes from the machine's own state: a live
 * state (Triggered / Heating up) is HIGH; today's other rows are MEDIUM;
 * older, compacted rows are LOW.
 */
function HistoryEventRow({
  e,
  current,
  isNew,
  compact,
}: {
  e: AlertEvent;
  current: number | null;
  isNew?: boolean;
  compact?: boolean;
}) {
  const isUpdate = e.kind === "kai_update" || e.kind === "setup_update";
  const state = e.payload?.state as WatchState | SetupState | undefined;
  const meta = state
    ? e.kind === "setup_update"
      ? SETUP_STATE_META[state as SetupState]
      : WATCH_STATE_META[state as WatchState]
    : null;
  const tone: StateTone = meta?.tone ?? "quiet";
  const snap = e.payload?.snapshot_price ?? null;
  const urgency: Urgency = compact ? "low" : meta?.live ? "high" : "med";

  const kindLabel =
    e.kind === "kai_update" ? "Kai update" : e.kind === "setup_update" ? "Setup update" : "Your watch";

  // Stat rows — only quantities this event genuinely carries.
  const sincePct =
    !isUpdate && snap != null && snap > 0 && current != null
      ? ((current - snap) / snap) * 100
      : null;
  const stats: { k: string; v: string; tone?: "up" | "down" }[] = [];
  if (e.payload?.condition) stats.push({ k: "Condition", v: e.payload.condition });
  if (snap != null) stats.push({ k: "At fire", v: money(snap) });
  if (sincePct != null)
    stats.push({
      k: "Since",
      v: `${sincePct >= 0 ? "+" : ""}${sincePct.toFixed(1)}%`,
      tone: sincePct >= 0 ? "up" : "down",
    });

  // The interpretation line — the state machine's own deterministic read.
  const kaiLine =
    state && e.kind === "setup_update"
      ? setupStateLine(state as SetupState, e.ticker)
      : state && e.kind === "kai_update"
        ? watchStateLine(state as WatchState, e.ticker)
        : null;

  return (
    <Link
      href={`/alerts/e/${e.id}`}
      style={urgencyFrame(urgency)}
      className={`f0-focus f0-press block rounded-[18px] border border-sand bg-card p-[15px] transition hover:border-accent/45 ${
        compact ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <CompanyLogo
          symbol={e.ticker}
          name={e.ticker}
          size={compact ? 28 : 36}
          rounded="rounded-[10px]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[13.5px] font-bold leading-[1.15] text-ink">
            ${e.ticker}
          </p>
          <p className="mt-1 truncate font-mono text-[9.5px] leading-none text-soft/70">
            {kindLabel} · {timeAgo(e.fired_at)}
          </p>
        </div>
        {isNew && <NewMark />}
        {meta ? (
          <StatePill tone={tone} label={meta.label} live={meta.live && !compact} />
        ) : (
          <StatePill tone="quiet" label={kindLabel} />
        )}
      </div>

      <p className={`mt-3 ${URGENCY_HEAD[urgency]} ${compact ? "truncate" : ""}`}>
        {e.payload?.message || "Condition met"}
      </p>
      {e.payload?.delayed && (
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-soft/55">
          delayed ~15m
        </p>
      )}

      {!compact && <StatGrid className="mt-3" stats={stats} />}
      {!compact && kaiLine && <KaiRead className="mt-3" text={kaiLine} />}
    </Link>
  );
}

/**
 * A Kai Daily broadcast in the feed, on the same card anatomy: MEDIUM urgency
 * (LOW when compacted), setup label as the Sora headline, the narrative as the
 * "Kai's read" line, and entry / stop / target / since-issued stat rows read
 * straight off trade_alerts — a missing level is a missing cell.
 */
function HistoryBroadcastRow({
  b,
  current,
  isNew,
  compact,
}: {
  b: TradeAlert;
  current: number | null;
  isNew?: boolean;
  compact?: boolean;
}) {
  const urgency: Urgency = compact ? "low" : "med";
  const L = readSetupLevels(b.levels);
  const entry = b.entry ?? null;
  const stop = L.stop ?? L.support;
  const target = b.targets?.[0]?.price ?? L.resistance;
  const sincePct =
    b.snapshot_price != null && b.snapshot_price > 0 && current != null
      ? ((current - b.snapshot_price) / b.snapshot_price) * 100
      : null;

  const stats: { k: string; v: string; tone?: "up" | "down" }[] = [];
  if (entry != null) stats.push({ k: "Entry", v: money(entry) });
  if (stop != null) stats.push({ k: "Stop", v: money(stop), tone: "down" });
  if (target != null) stats.push({ k: "Target", v: money(target), tone: "up" });
  if (sincePct != null)
    stats.push({
      k: "Since issued",
      v: `${sincePct >= 0 ? "+" : ""}${sincePct.toFixed(1)}%`,
      tone: sincePct >= 0 ? "up" : "down",
    });

  const head = b.setup_label || b.narrative || "Daily setup";

  return (
    <Link
      href={`/research/${encodeURIComponent(b.ticker)}`}
      className={`f0-focus f0-press block rounded-[18px] border border-sand bg-card p-[15px] transition hover:border-accent/45 ${
        compact ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <CompanyLogo
          symbol={b.ticker}
          name={b.ticker}
          size={compact ? 28 : 36}
          rounded="rounded-[10px]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[13.5px] font-bold leading-[1.15] text-ink">
            ${b.ticker}
          </p>
          <p className="mt-1 truncate font-mono text-[9.5px] leading-none text-soft/70">
            Kai daily · {timeAgo(b.issued_at)}
          </p>
        </div>
        {isNew && <NewMark />}
        <StatePill tone="kai" label="Kai daily" />
      </div>

      <p className={`mt-3 ${URGENCY_HEAD[urgency]} ${compact ? "truncate" : ""}`}>{head}</p>

      {!compact && <StatGrid className="mt-3" stats={stats} />}
      {!compact && b.setup_label && b.narrative && (
        <KaiRead className="mt-3" text={b.narrative} />
      )}
    </Link>
  );
}

/* ============================================================================
 * RECORD — honest split (graded W/L for Kai's own setups + observational
 * follow-through for personal watches, which are NEVER scored).
 * ==========================================================================*/
function pctStr(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function TrackRecordTab({
  track,
  observational,
  sampleAlert,
}: {
  track: TrackRecord;
  observational: ObservationalRow[];
  sampleAlert: SampleAlert | null;
}) {
  const graded = track.total;
  const signals = graded + observational.length;
  const empty = signals === 0;
  // Board 17's footer summary object: the count, the average, the best.
  const hit = track.hitRate;

  return (
    <div className="space-y-5">
      <AccentCard>
        <BoardEyebrow accent>Track record · last 30 days</BoardEyebrow>
        <div className="mt-3 flex items-center gap-4">
          <Dial
            value={hit ?? 0}
            size={72}
            ring={6}
            tone={hit == null ? "quiet" : "price-up"}
            center={hit == null ? "—" : `${Math.round(hit * 100)}%`}
            centerClassName="text-[14px]"
            label={
              hit == null
                ? "No graded setups yet"
                : `${Math.round(hit * 100)} percent of Kai's graded setups reached at least plus five percent`
            }
          />
          <dl className="flex min-w-0 flex-1 flex-wrap items-end gap-x-7 gap-y-3">
            <Stat label="Signals" value={empty ? "—" : String(signals)} />
            <Stat label="Graded" value={graded === 0 ? "—" : String(graded)} />
            <Stat label="Avg peak" value={graded === 0 ? "—" : pctStr(track.avgPeak)} tone="up" />
            <Stat label="Best" value={graded === 0 ? "—" : pctStr(track.bestPeak)} tone="up" />
          </dl>
        </div>
        <p className="mt-3.5 border-t border-sand pt-3 text-[11.5px] leading-relaxed text-soft">
          Kai Daily setups are graded by their peak move in their favour (worked
          = reached +5%). Personal watches show what happened after — never a win
          or a loss.
        </p>
      </AccentCard>

      {empty ? (
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
              See <span className="font-semibold text-ink">Kai Daily</span> for a
              sample of a tracked setup.
            </p>
          )}
        </Card>
      ) : (
        <>
          <OutcomeShareBoard outcomes={track.outcomes} />
          {track.outcomes.length > 0 && (
            <OutcomeSection title="Every Kai Daily setup" outcomes={track.outcomes} />
          )}
          {observational.length > 0 && <ObservationalCards rows={observational} />}
        </>
      )}

      <p className="text-[11px] leading-relaxed text-soft/70">
        Peak favourable move is educational performance tracking of past analysis,
        measured from a setup&apos;s issue price to its best subsequent close.
        Follow-through figures for personal watches are neutral price context, not
        graded outcomes. Past performance never guarantees future results.
      </p>
    </div>
  );
}

/** Mirrors HIT_THRESHOLD in src/lib/alerts/history.ts — "worked" = peak ≥ +5%. */
const SHARE_HIT_THRESHOLD = 5;

/**
 * WINNERS & LOSERS — every graded outcome as a branded share card (prior art:
 * the Kai dashboard's win cards, adapted to the club terminal law). The
 * honesty law is structural: the default view is ALL graded outcomes, wins
 * and losses interleaved newest-first; the chips filter, they never hide the
 * other side's existence (both counts stay printed on the rail).
 */
function OutcomeShareBoard({ outcomes }: { outcomes: AlertOutcome[] }) {
  const [filter, setFilter] = useState<"all" | "wins" | "losses">("all");
  const graded = useMemo(() => outcomes.filter((o) => o.peakPct != null), [outcomes]);
  const wins = useMemo(
    () => graded.filter((o) => (o.peakPct ?? 0) >= SHARE_HIT_THRESHOLD),
    [graded]
  );
  const losses = useMemo(
    () => graded.filter((o) => (o.peakPct ?? 0) < SHARE_HIT_THRESHOLD),
    [graded]
  );
  const shown = filter === "wins" ? wins : filter === "losses" ? losses : graded;
  const capped = shown.slice(0, 12);

  if (graded.length === 0) return null;

  const chips: { id: "all" | "wins" | "losses"; label: string; count: number }[] = [
    { id: "all", label: "All", count: graded.length },
    { id: "wins", label: "Wins", count: wins.length },
    { id: "losses", label: "Losses", count: losses.length },
  ];

  return (
    <section>
      <BoardEyebrow className="mb-2">Winners &amp; losers</BoardEyebrow>
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => {
          const on = filter === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`f0-focus f0-press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
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
      <p className="mt-2 max-w-lg text-[11.5px] leading-relaxed text-soft/80">
        Every graded setup gets a card — the ones that worked and the ones that
        didn&apos;t, in the open. &ldquo;Worked&rdquo; means the peak favourable
        move reached +{SHARE_HIT_THRESHOLD}%.
      </p>
      {capped.length === 0 ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
          Nothing in this bucket yet
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {capped.map((o) => (
            <ShareOutcomeCard
              key={o.id}
              o={o}
              won={(o.peakPct ?? 0) >= SHARE_HIT_THRESHOLD}
            />
          ))}
        </div>
      )}
      {shown.length > capped.length && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-soft/60">
          +{shown.length - capped.length} more in the full ledger below
        </p>
      )}
    </section>
  );
}

function OutcomeSection({
  title,
  icon,
  outcomes,
  rank = false,
}: {
  title: string;
  icon?: React.ReactNode;
  outcomes: AlertOutcome[];
  rank?: boolean;
}) {
  return (
    <section className="space-y-2">
      <BoardEyebrow className="mb-1">
        <span className="inline-flex items-center gap-1.5">
          {icon} {title}
        </span>
      </BoardEyebrow>
      {outcomes.map((o, i) => {
        const up = (o.peakPct ?? 0) >= 0;
        return (
          <CardLink key={o.id} href={`/research/${encodeURIComponent(o.ticker)}`}>
            <div className="flex items-center gap-3">
              {rank && (
                <span className="w-5 shrink-0 text-center font-mono text-[12px] font-semibold text-gold-700">
                  #{i + 1}
                </span>
              )}
              <CompanyLogo symbol={o.ticker} name={o.ticker} size={30} rounded="rounded-[9px]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-display text-[13.5px] font-extrabold tracking-tight text-ink">
                    ${o.ticker}
                  </span>
                  <DirChip dir={o.direction} />
                </div>
                {o.setup_label && (
                  <p className="mt-0.5 truncate text-[11.5px] text-soft/85">{o.setup_label}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`font-mono text-[14px] font-semibold tabular-nums ${
                    up ? "text-price-up" : "text-price-down"
                  }`}
                >
                  {pctStr(o.peakPct)}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-soft/55">
                  {o.daysToPeak != null ? `peak in ${o.daysToPeak}d` : "tracking…"}
                </p>
              </div>
            </div>
          </CardLink>
        );
      })}
    </section>
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

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" }) {
  // `tone="up"` only paints when there is a real, positive figure — a green "—"
  // would be claiming a gain out of an empty ledger.
  const priced = tone === "up" && value !== "—" && !value.startsWith("-");
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-soft/70">{label}</dt>
      <dd
        className={`mt-1 font-mono text-[19px] font-semibold leading-none tabular-nums ${
          priced ? "text-price-up" : "text-ink"
        }`}
      >
        {value}
      </dd>
      {sub && <p className="mt-1 font-mono text-[9px] text-soft/55">{sub}</p>}
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
    <Card>
      <BoardEyebrow>Or attach a ready-made watch</BoardEyebrow>
      <p className="mt-2 text-[12.5px] leading-relaxed text-soft">
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
    </Card>
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
/** Calendar-relative bucket label for the day groups (canvas board 18). */
function dateBucket(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);
  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return "Earlier this week";
  if (dayDiff < 30) return "Earlier this month";
  return then.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** "8:15 AM" — the brief block's real issue time (never a scheduled fiction). */
function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
