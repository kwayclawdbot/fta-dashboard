"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Radio,
  Eye,
  Activity,
  History as HistoryIcon,
  Trophy,
  ArrowRight,
  Trash2,
  Plus,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Info,
  Check,
  Target,
  Crosshair,
  Loader2,
  Zap,
  Clock,
  Search,
  ChevronRight,
  Users,
  Newspaper,
  Bell,
  ChevronDown,
  Gauge,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CompanyLogo from "@/components/fic/CompanyLogo";
import SetAlertButton from "@/components/alerts/SetAlertButton";
import WatchSetupButton from "@/components/alerts/WatchSetupButton";
import KaiWatch from "@/components/kai/KaiWatch";
import Tabs from "@/components/ui/Tabs";
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
import type { TrackRecord, AlertOutcome } from "@/lib/alerts/history";
import type { WatchState } from "@/lib/alerts/watch-state";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";
import {
  WATCH_STATE_META,
  SETUP_STATE_META,
  watchStateLine,
  setupStateLine,
  toneClasses,
  marketStatus,
  freshnessLabel,
  type StateTone,
  type ObservationalRow,
} from "@/lib/alerts/watch-ui";

type Tab = "daily" | "watch" | "live" | "history" | "track";

interface Props {
  userId: string;
  isSolo: boolean;
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
  const [tab, setTab] = useState<Tab>("daily");
  const [rules, setRules] = useState(initialRules);
  const [setups, setSetups] = useState(initialSetups);

  // Deep-link: /alerts#watch (from the detail "Edit" action) opens My Kai Watch.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    const valid: Tab[] = ["daily", "watch", "live", "history", "track"];
    if ((valid as string[]).includes(hash)) setTab(hash as Tab);
  }, []);

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

  // Honest freshness: the most recent time a cron looked at any of my watches.
  const lastChecked = useMemo(() => {
    let max: string | null = null;
    for (const r of activeRules) {
      if (r.last_checked_at && (!max || r.last_checked_at > max)) max = r.last_checked_at;
    }
    return max;
  }, [activeRules]);

  const watchingCount = activeRules.length + followedSetups.length;

  // Developing watches (non-baseline machine state) for the Live tab count.
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

  const TAB_ITEMS = useMemo(
    () => [
      { key: "daily" as const, label: "Kai Daily", icon: Radio },
      { key: "watch" as const, label: "My Kai Watch", icon: Eye, count: activeRules.length },
      { key: "live" as const, label: "Live Watches", icon: Activity, count: developingCount || undefined },
      { key: "history" as const, label: "History", icon: HistoryIcon },
      { key: "track" as const, label: "Track Record", icon: Trophy },
    ],
    [activeRules.length, developingCount]
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <StatusBoard
        watchingCount={watchingCount}
        developingCount={developingCount}
        lastChecked={lastChecked}
      />

      <Tabs<Tab>
        tabs={TAB_ITEMS}
        active={tab}
        onSelect={setTab}
        ariaLabel="Kai Watch sections"
        sticky
        className="mb-5 mt-4"
      />

      <AnimatePresence mode="wait">
        <m.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
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
              isSolo={isSolo}
              prefs={initialPrefs}
              strategy={initialStrategy}
              watchlistTickers={watchlistTickers}
            />
          )}
          {tab === "live" && (
            <LiveWatchesTab
              rules={activeRules}
              stateByRule={stateByRule}
              followedSetups={followedSetups}
              priceMap={priceMap}
            />
          )}
          {tab === "history" && <HistoryTab events={events} broadcasts={broadcasts} priceMap={priceMap} />}
          {tab === "track" && (
            <TrackRecordTab track={trackRecord} observational={observational} sampleAlert={sampleAlert} />
          )}
        </m.div>
      </AnimatePresence>

      <p className="mt-8 border-t border-sand pt-4 text-center text-[11px] leading-relaxed text-soft/70">
        Kai&apos;s watches and briefings are educational market analysis, not financial advice or a
        recommendation to buy or sell. Intraday prices are delayed roughly 15 minutes. Past
        performance never guarantees future results.
      </p>
    </div>
  );
}

/* ============================================================================
 * STATUS BOARD — the war-room header (honest, companion-voiced).
 * ==========================================================================*/
function StatusBoard({
  watchingCount,
  developingCount,
  lastChecked,
}: {
  watchingCount: number;
  developingCount: number;
  lastChecked: string | null;
}) {
  const mkt = marketStatus();
  const live = watchingCount > 0;
  const monitorLine = mkt.open
    ? "Monitoring live"
    : mkt.label === "Pre-market" || mkt.label === "After hours"
      ? "Watching after hours"
      : "Watching overnight";

  return (
    <div className="club-field-kai overflow-hidden rounded-2xl p-5 sm:p-6">
      {/* charged live eyebrow */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          {live && (
            <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-kai-blue/50" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-kai-blue club-livedot-kai" : "bg-soft/50"}`}
          />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-kai-blue">
          {live ? `Kai is live · ${watchingCount} watch${watchingCount === 1 ? "" : "es"} active` : "Kai is resting"}
        </span>
        {developingCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-volt-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-volt-700">
            <Zap className="h-3 w-3" /> {developingCount} developing
          </span>
        )}
      </div>

      <h1 className="mt-2 font-display text-[22px] font-bold leading-tight text-ink sm:text-2xl">
        {watchingCount > 0 ? (
          <>
            Kai is watching{" "}
            <span className="text-gradient-teal">{watchingCount} thing{watchingCount === 1 ? "" : "s"}</span> for you
          </>
        ) : (
          <>Kai is ready to watch the market for you</>
        )}
      </h1>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-soft">
        <span className="font-semibold text-ink/80">{mkt.label}</span>
        <span className="text-soft/40">·</span>
        <span>{monitorLine}</span>
        {lastChecked && (
          <>
            <span className="text-soft/40">·</span>
            <span className="inline-flex items-center gap-1 text-[12px] text-soft/80">
              <Clock className="h-3 w-3" /> {freshnessLabel(lastChecked)}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

/* ============================================================================
 * KAI DAILY — curated broadcasts, each followable as a setup + its thread.
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
  // Setup per broadcast (for the Watch-this-setup button + subscribed thread).
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

  return (
    <div className="space-y-3">
      <SectionIntro
        title="Kai Daily"
        blurb="Kai's curated look at the market — the broad opportunities worth studying. Follow any setup to get its story as it develops."
      />

      {sampleAlert && <SampleAlertCard s={sampleAlert} />}

      {broadcasts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand bg-paper/60 px-5 py-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-chip-amber text-gold-700">
            <Radio className="h-6 w-6" />
          </span>
          <p className="font-display text-lg font-bold text-ink">Kai Daily lands here</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-soft">
            Kai&apos;s daily briefing setups post here as soon as they go out. Meanwhile, tell Kai
            what to watch for you in{" "}
            <span className="font-semibold text-ink">My Kai Watch</span>.
          </p>
          {marketEvents.length > 0 && (
            <div className="mt-6 text-left">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft/70">
                <Info className="h-3.5 w-3.5" /> This week in the market
              </p>
              <div className="divide-y divide-sand/70 border-y border-sand/70">
                {marketEvents.map((mkt, i) => (
                  <Link
                    key={i}
                    href={mkt.ticker ? `/research/${encodeURIComponent(mkt.ticker)}` : `/news/${mkt.slug}`}
                    className="club-row flex items-center gap-3 py-2.5"
                  >
                    {mkt.ticker && <CompanyLogo symbol={mkt.ticker} name={mkt.ticker} size={30} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">{mkt.title}</p>
                      {mkt.dek && <p className="truncate text-[12px] text-soft">{mkt.dek}</p>}
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-soft" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        broadcasts.map((b) => {
          const setup = setupByAlert.get(b.id);
          const thread = setup ? threadBySetup.get(setup.id) || [] : [];
          return (
            <BroadcastCard
              key={b.id}
              b={b}
              current={priceMap[b.ticker] ?? null}
              setup={setup}
              thread={thread}
              onSub={onSub}
            />
          );
        })
      )}
    </div>
  );
}

function BroadcastCard({
  b,
  current,
  setup,
  thread,
  onSub,
}: {
  b: TradeAlert;
  current: number | null;
  setup: AlertSetup | undefined;
  thread: AlertEvent[];
  onSub: (setupId: string, subscribed: boolean) => void;
}) {
  const following = !!setup?.subscribed;
  return (
    <div className="overflow-hidden rounded-2xl border border-sand bg-paper">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <CompanyLogo symbol={b.ticker} name={b.ticker} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-display text-sm font-bold text-ink">{b.ticker}</span>
              <DirChip dir={b.direction} />
              <span className="rounded-full bg-chip-amber px-1.5 py-0.5 text-[9px] font-bold text-gold-700">
                {b.source === "kai_intraday" ? "KAI · INTRADAY" : "KAI · DAILY"}
              </span>
              {setup && <SetupStateChip state={setup.state} />}
            </div>
            {b.setup_label && <p className="truncate text-[13px] font-medium text-soft">{b.setup_label}</p>}
          </div>
          <div className="text-right">
            <PerfSince from={b.snapshot_price} to={current} />
            <p className="text-[10px] text-soft/60">since issued</p>
          </div>
        </div>

        {b.narrative && <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-ink/80">{b.narrative}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {setup ? (
            <WatchSetupButton
              setupId={setup.id}
              initialSubscribed={following}
              onChange={(sub) => onSub(setup.id, sub)}
            />
          ) : null}
          <Link
            href={`/research/${encodeURIComponent(b.ticker)}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sand bg-paper px-3 py-2 text-[13px] font-semibold text-soft transition hover:border-gold-300 hover:text-ink active:scale-[0.98]"
          >
            Research {b.ticker} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <span className="ml-auto text-[11px] text-soft/70">{timeAgo(b.issued_at)}</span>
        </div>
      </div>

      {/* Followed-setup lifecycle thread (opt-ins only). */}
      {following && (
        <div className="border-t border-teal-500/20 bg-teal-500/[0.04] px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-700">
            <Eye className="h-3.5 w-3.5" /> You&apos;re following this setup
          </p>
          {thread.length === 0 ? (
            <p className="text-[12px] leading-snug text-soft">
              {setup ? setupStateLine(setup.state, b.ticker) : `Kai is watching ${b.ticker}.`} You&apos;ll
              get every step — confirmed, triggered or called off.
            </p>
          ) : (
            <ol className="space-y-2">
              {thread.map((e) => {
                const st = (e.payload?.state as SetupState) || "waiting";
                const tone = SETUP_STATE_META[st]?.tone ?? "quiet";
                const tc = toneClasses(tone);
                return (
                  <li key={e.id} className="flex gap-2.5">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tc.dot} ${tc.glow}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-snug text-ink/85">
                        {e.payload?.message || setupStateLine(st, b.ticker)}
                      </p>
                      <p className="text-[10px] text-soft/60">{timeAgo(e.fired_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- SAMPLE alert (kept from C6 — built from real screener data) ---------- */
function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function money0(n: number): string {
  return Math.round(n).toLocaleString();
}

function SampleAlertCard({ s }: { s: SampleAlert }) {
  const L = s.levels;
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-dashed border-teal-500/50 bg-paper">
      <div className="flex items-center justify-between gap-2 bg-teal-500/10 px-4 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-700">
          <Info className="h-3.5 w-3.5" />
          Sample — what a Kai Daily setup looks like
        </span>
        <span className="text-[10px] font-medium text-soft/70">example only</span>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <CompanyLogo symbol={s.ticker} name={s.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-display text-base font-bold text-ink">{s.ticker}</span>
              <DirChip dir={s.direction} />
              <span className="rounded-full bg-chip-amber px-1.5 py-0.5 text-[9px] font-bold text-gold-700">
                KAI · DAILY
              </span>
            </div>
            <p className="text-[13px] font-semibold text-ink/90">{s.setup_label}</p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold tabular-nums text-ink">${money(s.price)}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">{s.tier}</p>
          </div>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-ink/80">{s.thesis}</p>

        <div className="mt-3 divide-y divide-sand/70 border-y border-sand/70">
          <LevelRow
            tone="entry"
            label="Entry zone"
            value={`$${money0(L.entryLow)} – $${money0(L.entryHigh)}`}
            note={`reclaim & hold the $${money0(L.pivot)} pivot`}
          />
          {L.targets.map((t) => (
            <LevelRow
              key={t.label}
              tone="target"
              label={t.label.split(" · ")[0]}
              value={`$${money0(t.price)}`}
              note={t.label.split(" · ")[1] ?? "target"}
            />
          ))}
          <LevelRow
            tone="invalid"
            label="Invalidation"
            value={`$${money0(L.invalidation)}`}
            note={`close below the $${money0(L.shelfLow)} shelf`}
          />
        </div>

        <p className="mt-3 flex gap-2 rounded-xl bg-teal-500/5 px-3 py-2.5 text-[12px] leading-relaxed text-ink/75">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
          <span>{s.kaiRead}</span>
        </p>

        <p className="mt-2.5 text-[11px] leading-relaxed text-soft/70">
          Kai&apos;s read is educational analysis of price levels — not a recommendation to buy or
          sell, and not personalized advice. Levels are drawn from recent prices; you decide what to
          do with them.
        </p>
      </div>
    </div>
  );
}

function LevelRow({
  tone,
  label,
  value,
  note,
}: {
  tone: "entry" | "target" | "invalid";
  label: string;
  value: string;
  note: string;
}) {
  const dot = tone === "target" ? "bg-emerald-500" : tone === "invalid" ? "bg-red-500" : "bg-teal-500";
  const val = tone === "target" ? "text-emerald-700" : tone === "invalid" ? "text-red-600" : "text-ink";
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-2">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-soft/80 sm:w-24">
        {label}
      </span>
      <span className={`shrink-0 text-[13px] font-bold tabular-nums ${val}`}>{value}</span>
      <span className="min-w-0 flex-1 truncate text-right text-[11px] text-soft/70">{note}</span>
    </div>
  );
}

function PerfSince({ from, to }: { from: number | null; to: number | null }) {
  if (from == null || to == null || from <= 0) {
    return <span className="text-[12px] text-soft/60">tracking…</span>;
  }
  const pct = ((to - from) / from) * 100;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-bold tabular-nums ${up ? "text-emerald-600" : "text-red-600"}`}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function DirChip({ dir }: { dir: string }) {
  const map: Record<string, string> = {
    long: "bg-emerald-50 text-emerald-700",
    short: "bg-red-50 text-red-700",
    watch: "bg-sand text-soft",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${map[dir] || map.watch}`}>
      {dir}
    </span>
  );
}

function StateChip({ tone, label, live }: { tone: StateTone; label: string; live?: boolean }) {
  const tc = toneClasses(tone);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tc.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tc.dot} ${live ? tc.glow : ""}`} />
      {label}
    </span>
  );
}

function SetupStateChip({ state }: { state: SetupState }) {
  const meta = SETUP_STATE_META[state];
  if (!meta) return null;
  return <StateChip tone={meta.tone} label={meta.label} live={meta.live} />;
}

/* ============================================================================
 * MY KAI WATCH — "What Kai Is Watching" (NL-first, intentions, all management).
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
  isSolo,
  prefs,
  strategy,
  watchlistTickers,
}: {
  userId: string;
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
  stateByRule: Map<string, WatchState>;
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
    // Scroll the NL box into view.
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
    <div className="space-y-5">
      <SectionIntro
        title="Tell Kai what to watch"
        blurb="Say it in plain English — a stock, a price, a moment you care about. Kai turns it into a watch and tells you the moment it happens."
      />

      {/* Intentions — deterministic prefills (usable even if NL parse is offline). */}
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
        {INTENTIONS.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => prefill(it.prompt)}
              className="inline-flex items-center gap-1.5 rounded-full border border-sand bg-paper px-3 py-1.5 text-[12px] font-semibold text-soft transition hover:border-kai-blue hover:text-ink active:scale-[0.98]"
            >
              <Icon className="h-3.5 w-3.5 text-kai-blue" />
              {it.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-sand bg-paper px-3 py-1.5 text-[12px] font-semibold text-soft transition hover:border-kai-blue"
        >
          Advanced <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>
      </div>
      {showAdvanced && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {ADVANCED_INTENTIONS.map((it) => (
            <button
              key={it.id}
              onClick={() => prefill(it.prompt)}
              className="rounded-full border border-sand bg-paper px-2.5 py-1 text-[11px] font-medium text-soft transition hover:border-kai-blue hover:text-ink"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}

      {/* NL entry point */}
      <div id="kai-nl">
        <KaiWatch
          userId={userId}
          surface="strategy"
          presetText={seed.text || undefined}
          presetNonce={seed.nonce}
          onCreated={(created) => setRules((rs) => [...created, ...rs])}
        />
      </div>

      {/* Quick watches on a followed stock (deterministic, no LLM). */}
      <WatchlistPlays userId={userId} watchlistTickers={watchlistTickers} rules={rules} setRules={setRules} />

      {/* Manual builder — reachable, tucked. */}
      <div className="rounded-2xl border border-sand bg-paper/60 p-4">
        <button
          onClick={() => setShowManual((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <span className="text-[13px] font-bold text-ink">Or build one by hand</span>
          <ChevronDown className={`h-4 w-4 text-soft transition-transform ${showManual ? "rotate-180" : ""}`} />
        </button>
        {showManual && (
          <div className="mt-3">
            <p className="mb-3 text-[12px] text-soft">
              Enter a ticker to set a price, volume or technical watch on it.
            </p>
            <div className="flex items-center gap-2">
              <input
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g, ""))}
                placeholder="e.g. AAPL"
                maxLength={8}
                className="w-32 rounded-lg border border-sand bg-paper px-3 py-2 text-[14px] font-semibold text-ink outline-none focus:border-kai-blue"
              />
              {newTicker.length >= 1 ? (
                <span onClick={refresh}>
                  <SetAlertButton ticker={newTicker} surface="manual" variant="full" stopPropagation={false} />
                </span>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sand bg-paper px-3 py-1.5 text-[13px] font-semibold text-soft/50"
                >
                  <Plus className="h-4 w-4" /> Set watch
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* The living list — what Kai is watching, with real state + management. */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft/70">
            <Eye className="h-3.5 w-3.5" /> What Kai is watching
          </p>
          <span className="text-[11px] font-semibold text-soft">
            {activeCount}/{MAX_ACTIVE_RULES} active
          </span>
        </div>
        {rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sand bg-paper/60 px-5 py-8 text-center">
            <p className="text-[14px] font-semibold text-ink">Nothing on watch yet</p>
            <p className="mt-1 text-[13px] text-soft">
              Tell Kai what to watch above, or add one from any screener row, watchlist card or
              research page.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-sand/70 border-y border-sand/70">
            {rules.map((r) => (
              <WatchManageRow
                key={r.id}
                r={r}
                state={r.active ? stateByRule.get(r.id) ?? null : null}
                onToggle={() => toggle(r)}
                onDigest={(d) => setDigest(r, d)}
                onRemove={() => remove(r)}
              />
            ))}
          </div>
        )}
      </div>

      <DeliveryPrefs isSolo={isSolo} prefs={prefs} />

      {/* Fine-tuning (strategy profile) — reachable, tucked. */}
      <div className="rounded-2xl border border-sand bg-paper/60 p-4">
        <button onClick={() => setShowTune((v) => !v)} className="flex w-full items-center justify-between">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
            <Gauge className="h-4 w-4 text-gold-600" /> Tune what Kai suggests
          </span>
          <ChevronDown className={`h-4 w-4 text-soft transition-transform ${showTune ? "rotate-180" : ""}`} />
        </button>
        {showTune && (
          <div className="mt-4">
            <StrategyTuner userId={userId} strategy={strategy} rules={rules} setRules={setRules} />
          </div>
        )}
      </div>
    </div>
  );
}

function WatchManageRow({
  r,
  state,
  onToggle,
  onDigest,
  onRemove,
}: {
  r: AlertRule;
  state: WatchState | null;
  onToggle: () => void;
  onDigest: (d: boolean) => void;
  onRemove: () => void;
}) {
  const meta = state ? WATCH_STATE_META[state] : null;
  return (
    <div className={`flex items-center gap-3 py-3 ${r.active ? "" : "opacity-60"}`}>
      {r.ticker ? (
        <CompanyLogo symbol={r.ticker} name={r.ticker} size={30} />
      ) : (
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-chip-amber text-gold-700">
          <Sparkles className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold text-ink">
            {r.label || ruleLabel(r.kind, r.ticker, r.params)}
          </p>
          {meta && meta.tone !== "quiet" && <StateChip tone={meta.tone} label={meta.label} live={meta.live} />}
        </div>
        <p className="text-[11px] text-soft/70">
          <span className="rounded bg-sand/70 px-1 py-px font-medium text-soft">{KIND_DIMENSION[r.kind]}</span>{" "}
          {r.active ? (
            <span className="text-emerald-600">watching</span>
          ) : (
            <span>paused</span>
          )}
          {" · "}
          {r.last_checked_at ? freshnessLabel(r.last_checked_at).toLowerCase() : "queued"}
        </p>
      </div>
      {/* instant / digest */}
      <button
        onClick={() => onDigest(!r.digest)}
        title={r.digest ? "In daily digest — tap for instant" : "Instant — tap for daily digest"}
        className={`hidden shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition sm:inline-flex ${
          r.digest ? "border-sand bg-paper text-soft" : "border-kai-blue/30 bg-kai-blue-soft text-kai-blue"
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
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${r.active ? "kai-gradient" : "bg-sand"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            r.active ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
      <button
        onClick={onRemove}
        title="Delete"
        aria-label="Delete watch"
        className="shrink-0 rounded-lg border border-sand p-1.5 text-soft transition hover:border-red-300 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
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

  return (
    <div className="rounded-2xl border border-sand bg-paper/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-bold text-ink">How Kai reaches you</p>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
      <Row
        label="Kai Daily push"
        hint={isSolo ? "On by default for Club members" : "Opt-in for family accounts"}
        checked={briefing}
        onChange={(v) => {
          setBriefing(v);
          save({ briefing_enabled: v });
        }}
      />
      <Row
        label="Send everything as a daily digest"
        hint="One summary push instead of instant alerts"
        checked={digest}
        onChange={(v) => {
          setDigest(v);
          save({ digest: v });
        }}
      />
      <Row
        label="Respect quiet hours"
        hint="Hold non-urgent updates overnight"
        checked={quiet}
        onChange={(v) => {
          setQuiet(v);
          save({ quiet_hours: v });
        }}
      />
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-[13px] font-medium text-ink">Daily push limit</p>
          <p className="text-[11px] text-soft/70">Extra alerts roll into your digest</p>
        </div>
        <select
          value={cap}
          onChange={(e) => {
            const v = Number(e.target.value);
            setCap(v);
            save({ daily_cap: v });
          }}
          className="rounded-lg border border-sand bg-paper px-2.5 py-1.5 text-[13px] font-semibold text-ink outline-none"
        >
          {[5, 10, 15, 20, 30].map((n) => (
            <option key={n} value={n}>
              {n}/day
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Row({
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
    <label className="flex cursor-pointer items-center justify-between py-2">
      <div className="pr-3">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <p className="text-[11px] text-soft/70">{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-gold-500" : "bg-sand"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

/* ============================================================================
 * LIVE WATCHES — only what is actually developing right now.
 * ==========================================================================*/
function LiveWatchesTab({
  rules,
  stateByRule,
  followedSetups,
  priceMap,
}: {
  rules: AlertRule[];
  stateByRule: Map<string, WatchState>;
  followedSetups: AlertSetup[];
  priceMap: Record<string, number>;
}) {
  const developing = useMemo(
    () =>
      rules
        .map((r) => ({ r, state: stateByRule.get(r.id) }))
        .filter((x): x is { r: AlertRule; state: WatchState } => !!x.state && WATCH_STATE_META[x.state].developing),
    [rules, stateByRule]
  );
  const liveSetups = useMemo(
    () => followedSetups.filter((s) => SETUP_STATE_META[s.state]?.developing),
    [followedSetups]
  );

  if (developing.length === 0 && liveSetups.length === 0) {
    return (
      <div>
        <SectionIntro
          title="Live Watches"
          blurb="When one of your watches starts developing, it moves here so you can see it play out."
        />
        <div className="rounded-2xl border border-dashed border-sand bg-paper/60 px-5 py-12 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10 text-teal-600">
            <Activity className="h-6 w-6" />
          </span>
          <p className="font-display text-lg font-bold text-ink">Nothing developing right now</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-soft">
            Kai is watching quietly. The moment a setup starts to build, it shows up here — and you
            get a heads-up before it triggers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionIntro
        title="Live Watches"
        blurb="Setups that are actively developing — Kai is closest to speaking up on these."
      />

      {developing.length > 0 && (
        <div className="space-y-2.5">
          {developing.map(({ r, state }) => (
            <LiveWatchEntry key={r.id} r={r} state={state} current={r.ticker ? priceMap[r.ticker] ?? null : null} />
          ))}
        </div>
      )}

      {liveSetups.length > 0 && (
        <div>
          <p className="mb-2 mt-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft/70">
            <Eye className="h-3.5 w-3.5" /> Setups you&apos;re following
          </p>
          <div className="space-y-2.5">
            {liveSetups.map((s) => (
              <LiveSetupEntry key={s.id} s={s} current={priceMap[s.ticker] ?? null} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveWatchEntry({ r, state, current }: { r: AlertRule; state: WatchState; current: number | null }) {
  const meta = WATCH_STATE_META[state];
  const tc = toneClasses(meta.tone);
  const label = r.label || ruleLabel(r.kind, r.ticker, r.params);
  return (
    <div className={`club-field-pulse relative overflow-hidden rounded-2xl p-4 ${meta.live ? "" : ""}`}>
      <div className="flex items-center gap-3">
        {r.ticker ? (
          <CompanyLogo symbol={r.ticker} name={r.ticker} size={38} />
        ) : (
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-chip-amber text-gold-700">
            <Sparkles className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-sm font-bold text-ink">{r.ticker || "Screen"}</span>
            <StateChip tone={meta.tone} label={meta.label} live={meta.live} />
          </div>
          <p className="truncate text-[12px] text-soft">{label}</p>
        </div>
        {r.ticker && current != null && (
          <span className="shrink-0 text-[13px] font-bold tabular-nums text-ink">${money(current)}</span>
        )}
      </div>
      <p className={`mt-2 text-[13px] leading-snug ${meta.live ? "font-medium text-ink/90" : "text-ink/75"}`}>
        {meta.live && <Zap className="mr-1 inline h-3.5 w-3.5 text-volt-600" />}
        {watchStateLine(state, r.ticker || "this screen")}
      </p>
      {r.ticker && (
        <div className="mt-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] text-soft/70">
            <Clock className="h-3 w-3" /> {r.last_checked_at ? freshnessLabel(r.last_checked_at) : "queued"}
          </span>
          <Link
            href={`/research/${encodeURIComponent(r.ticker)}`}
            className={`inline-flex items-center gap-1 text-[12px] font-semibold ${tc.text}`}
          >
            See what Kai found <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

function LiveSetupEntry({ s, current }: { s: AlertSetup; current: number | null }) {
  const meta = SETUP_STATE_META[s.state];
  const tc = toneClasses(meta.tone);
  return (
    <div className="rounded-2xl border border-teal-500/25 bg-teal-500/[0.04] p-4">
      <div className="flex items-center gap-3">
        <CompanyLogo symbol={s.ticker} name={s.ticker} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-sm font-bold text-ink">{s.ticker}</span>
            <DirChip dir={s.direction} />
            <StateChip tone={meta.tone} label={meta.label} live={meta.live} />
          </div>
          {s.thesis && <p className="truncate text-[12px] text-soft">{s.thesis}</p>}
        </div>
        {current != null && (
          <span className="shrink-0 text-[13px] font-bold tabular-nums text-ink">${money(current)}</span>
        )}
      </div>
      <p className={`mt-2 text-[13px] leading-snug ${meta.live ? "font-medium" : ""} ${tc.text}`}>
        {setupStateLine(s.state, s.ticker)}
      </p>
    </div>
  );
}

/* ============================================================================
 * HISTORY — searchable feed of every event (all kinds, state-colored).
 * ==========================================================================*/
type FeedRow =
  | { type: "event"; at: string; ticker: string; e: AlertEvent }
  | { type: "broadcast"; at: string; ticker: string; b: TradeAlert };

function HistoryTab({
  events,
  broadcasts,
  priceMap,
}: {
  events: AlertEvent[];
  broadcasts: TradeAlert[];
  priceMap: Record<string, number>;
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

  return (
    <div className="space-y-4">
      <SectionIntro title="History" blurb="Everything Kai has told you — searchable by ticker." />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft/60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by ticker…"
          className="w-full rounded-xl border border-sand bg-paper py-2.5 pl-9 pr-3 text-[14px] text-ink outline-none focus:border-kai-blue"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand bg-paper/60 px-5 py-10 text-center">
          <p className="text-[14px] font-semibold text-ink">
            {q.trim() ? `Nothing for “${q.trim().toUpperCase()}” yet` : "No history yet"}
          </p>
          <p className="mt-1 text-[13px] text-soft">
            Kai&apos;s updates and alerts collect here as they happen.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-sand/70 border-y border-sand/70">
          {filtered.map((row) =>
            row.type === "broadcast" ? (
              <HistoryBroadcastRow key={`b-${row.b.id}`} b={row.b} current={priceMap[row.ticker] ?? null} />
            ) : (
              <HistoryEventRow key={`e-${row.e.id}`} e={row.e} current={priceMap[row.ticker] ?? null} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function HistoryEventRow({ e, current }: { e: AlertEvent; current: number | null }) {
  const isUpdate = e.kind === "kai_update" || e.kind === "setup_update";
  const state = e.payload?.state as WatchState | SetupState | undefined;
  const tone: StateTone = state
    ? (e.kind === "setup_update"
        ? SETUP_STATE_META[state as SetupState]?.tone
        : WATCH_STATE_META[state as WatchState]?.tone) ?? "quiet"
    : "quiet";
  const tc = toneClasses(tone);
  const snap = e.payload?.snapshot_price ?? null;

  const kindLabel =
    e.kind === "kai_update"
      ? "Kai update"
      : e.kind === "setup_update"
        ? "Setup update"
        : "Your alert";

  return (
    <Link href={`/alerts/e/${e.id}`} className="club-row flex items-center gap-3 py-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${tc.dot} ${tc.glow}`} />
      <CompanyLogo symbol={e.ticker} name={e.ticker} size={30} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[13px] font-bold text-ink">{e.ticker}</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
              isUpdate ? tc.chip : "bg-sand text-soft"
            }`}
          >
            {kindLabel}
          </span>
          {e.payload?.delayed && <span className="text-[9px] font-medium text-soft/60">delayed ~15m</span>}
        </div>
        <p className="truncate text-[12px] text-ink/80">{e.payload?.message || "Condition met"}</p>
      </div>
      {!isUpdate && snap != null ? (
        <div className="shrink-0 text-right">
          <PerfSince from={snap} to={current} />
          <p className="text-[10px] text-soft/60">since fired</p>
        </div>
      ) : (
        <span className="shrink-0 text-[11px] text-soft/60">{timeAgo(e.fired_at)}</span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-soft/50" />
    </Link>
  );
}

function HistoryBroadcastRow({ b, current }: { b: TradeAlert; current: number | null }) {
  return (
    <Link href={`/research/${encodeURIComponent(b.ticker)}`} className="club-row flex items-center gap-3 py-3">
      <span className="h-2 w-2 shrink-0 rounded-full bg-gold-500" />
      <CompanyLogo symbol={b.ticker} name={b.ticker} size={30} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[13px] font-bold text-ink">{b.ticker}</span>
          <span className="rounded-full bg-chip-amber px-1.5 py-0.5 text-[9px] font-bold uppercase text-gold-700">
            Kai Daily
          </span>
        </div>
        <p className="truncate text-[12px] text-ink/80">{b.setup_label || b.narrative || "Daily setup"}</p>
      </div>
      <div className="shrink-0 text-right">
        <PerfSince from={b.snapshot_price} to={current} />
        <p className="text-[10px] text-soft/60">since issued</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-soft/50" />
    </Link>
  );
}

/* ============================================================================
 * TRACK RECORD — honest split (graded W/L + observational follow-through).
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

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft/70">
          <Trophy className="h-3.5 w-3.5 text-gold-600" /> Kai Track Record · Last 30 days
        </p>
        <p className="mt-1 text-[12px] leading-snug text-soft">
          Signals issued: <span className="font-semibold text-ink">{signals}</span>. Kai Daily setups
          are graded by their <span className="font-semibold text-ink">peak move in their favor</span>;
          personal watches show what happened after — never a win or loss.
        </p>
        <div className="mt-3 grid grid-cols-4 divide-x divide-sand border-y border-sand py-3 text-center">
          <Stat label="Setups" value={empty ? "—" : String(graded)} />
          <Stat label="Avg peak" value={graded === 0 ? "—" : pctStr(track.avgPeak)} tone="up" />
          <Stat
            label="Worked"
            value={track.hitRate == null ? "—" : `${Math.round(track.hitRate * 100)}%`}
            sub="≥ +5%"
          />
          <Stat label="Best" value={graded === 0 ? "—" : pctStr(track.bestPeak)} tone="up" />
        </div>
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-sand bg-paper/60 px-5 py-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-chip-amber text-gold-700">
            <Trophy className="h-6 w-6" />
          </span>
          <p className="font-display text-lg font-bold text-ink">The ledger starts soon</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-soft">
            Once Kai&apos;s daily setups start going out, each one is tracked here by its peak favorable
            move — winners and misses in the open.
          </p>
          {sampleAlert && (
            <p className="mx-auto mt-3 max-w-sm text-[12px] text-soft/70">
              See <span className="font-semibold text-ink">Kai Daily</span> for a sample of a tracked setup.
            </p>
          )}
        </div>
      ) : (
        <>
          {graded > 0 && (
            <>
              {track.winners.length > 0 && (
                <LedgerSection
                  title="Top winners"
                  icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
                  outcomes={track.winners}
                  rank="win"
                />
              )}
              {track.losers.length > 0 && (
                <LedgerSection
                  title="Didn't work"
                  icon={<TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                  outcomes={track.losers}
                  rank="lose"
                />
              )}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-soft/70">
                  Every Kai Daily setup
                </p>
                <div className="divide-y divide-sand/70 border-y border-sand/70">
                  {track.outcomes.map((o) => (
                    <LedgerRow key={o.id} o={o} />
                  ))}
                </div>
              </div>
            </>
          )}

          {observational.length > 0 && <ObservationalLedger rows={observational} />}
        </>
      )}

      <p className="text-[11px] leading-relaxed text-soft/70">
        Peak favorable move is educational performance tracking of past analysis, measured from a
        setup&apos;s issue price to its best subsequent close. Follow-through figures for personal
        watches are neutral price context, not graded outcomes. Neither is a claim of realized gains,
        and past performance never guarantees future results.
      </p>
    </div>
  );
}

function ObservationalLedger({ rows }: { rows: ObservationalRow[] }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft/70">
        <Eye className="h-3.5 w-3.5 text-kai-blue" /> Your personal watches — what happened after
      </p>
      <p className="mb-2 text-[11px] leading-snug text-soft/70">
        Sentiment, activity and news watches have no set target, so they&apos;re never scored. Here&apos;s
        the neutral follow-through.
      </p>
      <div className="divide-y divide-sand/70 border-y border-sand/70">
        {/* header */}
        <div className="flex items-center gap-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-soft/60">
          <span className="w-[30px] shrink-0" />
          <span className="min-w-0 flex-1">Watch</span>
          <span className="w-14 shrink-0 text-right">+1 day</span>
          <span className="w-14 shrink-0 text-right">+5 days</span>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-2.5">
            <CompanyLogo symbol={r.ticker} name={r.ticker} size={30} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] font-bold text-ink">{r.ticker}</p>
              <p className="truncate text-[11px] text-soft/80">{r.message}</p>
            </div>
            <ObsPct value={r.plus1d} />
            <ObsPct value={r.plus5d} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ObsPct({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="w-14 shrink-0 text-right text-[12px] text-soft/50">—</span>;
  }
  const up = value >= 0;
  return (
    <span className={`w-14 shrink-0 text-right text-[13px] font-bold tabular-nums ${up ? "text-emerald-600" : "text-red-600"}`}>
      {up ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" }) {
  return (
    <div className="px-1">
      <p className={`font-display text-lg font-bold tabular-nums ${tone === "up" ? "text-emerald-600" : "text-ink"}`}>
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-soft/70">{label}</p>
      {sub && <p className="text-[9px] text-soft/50">{sub}</p>}
    </div>
  );
}

function LedgerSection({
  title,
  icon,
  outcomes,
  rank,
}: {
  title: string;
  icon: React.ReactNode;
  outcomes: AlertOutcome[];
  rank: "win" | "lose";
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft/70">
        {icon} {title}
      </p>
      <div className="divide-y divide-sand/70 border-y border-sand/70">
        {outcomes.map((o, i) => (
          <LedgerRow key={o.id} o={o} badge={rank === "win" ? `#${i + 1}` : undefined} />
        ))}
      </div>
    </div>
  );
}

function LedgerRow({ o, badge }: { o: AlertOutcome; badge?: string }) {
  const up = (o.peakPct ?? 0) >= 0;
  return (
    <Link href={`/research/${encodeURIComponent(o.ticker)}`} className="club-row flex items-center gap-3 py-2.5">
      {badge ? (
        <span className="w-6 shrink-0 text-center font-display text-[13px] font-bold text-gold-600">{badge}</span>
      ) : (
        <span className="w-6 shrink-0" />
      )}
      <CompanyLogo symbol={o.ticker} name={o.ticker} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[13px] font-bold text-ink">{o.ticker}</span>
          <DirChip dir={o.direction} />
        </div>
        {o.setup_label && <p className="truncate text-[11px] text-soft/80">{o.setup_label}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-[14px] font-bold tabular-nums ${up ? "text-emerald-600" : "text-red-600"}`}>
          {pctStr(o.peakPct)}
        </p>
        <p className="text-[10px] text-soft/60">{o.daysToPeak != null ? `peak in ${o.daysToPeak}d` : "tracking…"}</p>
      </div>
    </Link>
  );
}

/* ============================================================================
 * STRATEGY TUNER + WATCHLIST PLAYS (deterministic, no-LLM — kept, reframed).
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
    <div className="club-field-teal rounded-2xl p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
        <Crosshair className="h-4 w-4 text-teal-600" /> Or attach a quick watch to a stock you follow
      </p>
      <p className="mt-1 text-[12px] leading-snug text-soft">
        Pick a stock and a play — Kai watches for the setup and tells you when it triggers. Every play
        is a plain, rules-based signal to study, never advice.
      </p>

      <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {watchlistTickers.map((w) => {
          const on = selected === w.ticker;
          return (
            <button
              key={w.ticker}
              onClick={() => setSelected(w.ticker)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-bold transition ${
                on ? "border-teal-500 bg-teal-500/15 text-teal-700" : "border-sand bg-paper text-soft hover:border-teal-500/40"
              }`}
            >
              <CompanyLogo symbol={w.ticker} name={w.company_name} size={18} />
              {w.ticker}
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {STRATEGY_PLAYS.map((play) => {
          const Icon = PLAY_ICON[play.id] ?? Bell;
          const set = selected ? existing.has(`${selected}:${play.kind}`) : false;
          const isBusy = busy === play.id;
          return (
            <button
              key={play.id}
              disabled={set || isBusy || !selected}
              onClick={() => create(play)}
              className={`group relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                set ? "border-emerald-300 bg-emerald-50/60" : "border-sand bg-paper hover:border-teal-500/50 hover:bg-teal-500/5"
              } disabled:cursor-default`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink">
                  <Icon className="h-3.5 w-3.5 text-teal-600" />
                  {play.name}
                </span>
                {set ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
                ) : (
                  <Plus className="h-3.5 w-3.5 text-soft/60 group-hover:text-teal-600" />
                )}
              </div>
              <p className="text-[11px] font-medium text-soft">{play.tagline}</p>
              <p className="text-[10px] leading-snug text-soft/70">
                Alerts when {selected ?? "it"} {play.watchLine}
              </p>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>
      )}
    </div>
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
        Tell Kai how you like to study the market and he&apos;ll suggest watches that fit — you stay in
        control of what actually gets created.
      </p>

      <Section title="How long do you hold?">
        <div className="grid grid-cols-2 gap-2">
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
                className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                  on ? "border-gold-400 bg-chip-amber text-gold-700" : "border-sand bg-paper text-soft hover:border-gold-300"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Risk posture">
        <div className="grid grid-cols-3 gap-2">
          {RISK_OPTIONS.map((o) => (
            <Choice key={o.id} active={risk === o.id} onClick={() => setRisk(o.id)} label={o.label} />
          ))}
        </div>
      </Section>

      <button
        onClick={save}
        className="w-full rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 py-2.5 text-[14px] font-bold text-white shadow-soft transition hover:brightness-105 active:scale-[0.99]"
      >
        {saved ? "Saved ✓" : "Save"}
      </button>

      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-bold text-ink">Suggested watches for you</p>
          <div className="divide-y divide-sand/70 border-y border-sand/70">
            {suggestions.map((s) => {
              const added = existingPresetIds.has(s.presetId);
              return (
                <div key={s.key} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink">{s.label}</p>
                    <p className="text-[11px] leading-snug text-soft">{s.reason}</p>
                  </div>
                  {added ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-700">
                      <Check className="h-3.5 w-3.5" /> Added
                    </span>
                  ) : (
                    <button
                      onClick={() => addSuggestion(s)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gold-300/60 bg-chip-amber/50 px-2.5 py-1.5 text-[12px] font-semibold text-gold-700 hover:bg-chip-amber"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-soft/70">{title}</p>
      {children}
    </div>
  );
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition ${
        active ? "border-gold-400 bg-chip-amber text-gold-700" : "border-sand bg-paper text-soft hover:border-gold-300"
      }`}
    >
      {label}
    </button>
  );
}

/* ---------- shared bits ---------- */
function SectionIntro({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mt-0.5 text-[13px] leading-snug text-soft">{blurb}</p>
    </div>
  );
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
