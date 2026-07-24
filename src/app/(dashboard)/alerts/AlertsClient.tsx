"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Bell,
  Radio,
  SlidersHorizontal,
  Compass,
  ArrowRight,
  Trash2,
  Plus,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Info,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CompanyLogo from "@/components/fic/CompanyLogo";
import SetAlertButton from "@/components/alerts/SetAlertButton";
import KaiWatch from "@/components/kai/KaiWatch";
import {
  MAX_ACTIVE_RULES,
  ruleLabel,
  suggestedRulesFor,
  SETUP_OPTIONS,
  TIMEFRAME_OPTIONS,
  RISK_OPTIONS,
  type TradeAlert,
  type AlertEvent,
  type AlertRule,
  type StrategyProfile,
  type AlertPrefs,
} from "@/lib/alerts/types";

type Tab = "feed" | "rules" | "strategy";

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
}

const TABS: { id: Tab; label: string; icon: typeof Bell }[] = [
  { id: "feed", label: "Feed", icon: Radio },
  { id: "rules", label: "My Rules", icon: SlidersHorizontal },
  { id: "strategy", label: "Strategy", icon: Compass },
];

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
}: Props) {
  const [tab, setTab] = useState<Tab>("feed");
  const [rules, setRules] = useState(initialRules);
  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Header — Kai Alerts gradient band (matches the owner mockup). */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-sand shadow-soft">
        <div className="kai-header-gradient flex items-center gap-3 px-4 py-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur">
            <Bell className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-white">Kai Alerts</h1>
            <p className="text-[12px] leading-snug text-white/85">
              Kai&apos;s daily briefing plus your own alerts — analysis to research,
              never advice to buy or sell.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-sand bg-paper/90 px-4 pb-px backdrop-blur">
        <div className="flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold transition ${
                  active ? "text-gold-700" : "text-soft hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {t.id === "rules" && (
                  <span className="ml-0.5 rounded-full bg-sand px-1.5 py-px text-[10px] font-bold text-soft">
                    {activeCount}
                  </span>
                )}
                {active && (
                  <m.span
                    layoutId="alertsTab"
                    className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-gold-500"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <m.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "feed" && (
            <FeedTab
              broadcasts={broadcasts}
              events={events}
              priceMap={priceMap}
              marketEvents={marketEvents}
            />
          )}
          {tab === "rules" && (
            <RulesTab userId={userId} rules={rules} setRules={setRules} isSolo={isSolo} prefs={initialPrefs} />
          )}
          {tab === "strategy" && (
            <StrategyTab
              userId={userId}
              strategy={initialStrategy}
              rules={rules}
              setRules={setRules}
              onGoToRules={() => setTab("rules")}
            />
          )}
        </m.div>
      </AnimatePresence>

      {/* Standing compliance line */}
      <p className="mt-8 border-t border-sand pt-4 text-center text-[11px] leading-relaxed text-soft/70">
        Alerts and briefings are educational market analysis, not financial
        advice or a recommendation to buy or sell. Intraday-triggered prices are
        delayed roughly 15 minutes. Past performance never guarantees future
        results.
      </p>
    </div>
  );
}

/* ============================================================================
 * FEED
 * ==========================================================================*/
type FeedItem =
  | { type: "broadcast"; at: string; b: TradeAlert }
  | { type: "event"; at: string; e: AlertEvent };

function FeedTab({
  broadcasts,
  events,
  priceMap,
  marketEvents,
}: {
  broadcasts: TradeAlert[];
  events: AlertEvent[];
  priceMap: Record<string, number>;
  marketEvents: Props["marketEvents"];
}) {
  const items = useMemo<FeedItem[]>(() => {
    const bs: FeedItem[] = broadcasts.map((b) => ({ type: "broadcast", at: b.issued_at, b }));
    // Only surface a member's OWN rule fires here (broadcast events already show
    // as their own broadcast card, so we don't double them).
    const es: FeedItem[] = events
      .filter((e) => e.kind === "rule")
      .map((e) => ({ type: "event", at: e.fired_at, e }));
    return [...bs, ...es].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [broadcasts, events]);

  if (items.length === 0) {
    return (
      <div>
        <div className="rounded-2xl border border-dashed border-sand bg-paper/60 px-5 py-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-chip-amber text-gold-700">
            <Radio className="h-6 w-6" />
          </span>
          <p className="font-display text-lg font-bold text-ink">No alerts yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-soft">
            Kai&apos;s daily briefing alerts land here as soon as they go out. In the
            meantime, set up your own price, volume and screen alerts in{" "}
            <span className="font-semibold text-ink">My Rules</span> — they work
            right away.
          </p>
        </div>

        {marketEvents.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft/70">
              <Info className="h-3.5 w-3.5" /> This week in the market
            </p>
            <div className="space-y-2">
              {marketEvents.map((mkt, i) => (
                <Link
                  key={i}
                  href={mkt.ticker ? `/research/${encodeURIComponent(mkt.ticker)}` : `/news/${mkt.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-sand bg-paper p-3 transition hover:border-gold-300"
                >
                  {mkt.ticker && <CompanyLogo symbol={mkt.ticker} name={mkt.ticker} size={32} />}
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
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((it, i) =>
        it.type === "broadcast" ? (
          <BroadcastCard key={`b-${it.b.id}`} b={it.b} current={priceMap[it.b.ticker] ?? null} />
        ) : (
          <EventCard key={`e-${it.e.id}`} e={it.e} current={priceMap[it.e.ticker] ?? null} index={i} />
        )
      )}
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

function BroadcastCard({ b, current }: { b: TradeAlert; current: number | null }) {
  return (
    <Link
      href={`/research/${encodeURIComponent(b.ticker)}`}
      className="block rounded-2xl border border-sand bg-paper p-4 transition hover:border-gold-300"
    >
      <div className="flex items-center gap-3">
        <CompanyLogo symbol={b.ticker} name={b.ticker} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-sm font-bold text-ink">{b.ticker}</span>
            <DirChip dir={b.direction} />
            <span className="rounded-full bg-chip-amber px-1.5 py-0.5 text-[9px] font-bold text-gold-700">
              {b.source === "kai_intraday" ? "KAI · INTRADAY" : "KAI · BRIEFING"}
            </span>
          </div>
          {b.setup_label && <p className="truncate text-[13px] font-medium text-soft">{b.setup_label}</p>}
        </div>
        <div className="text-right">
          <PerfSince from={b.snapshot_price} to={current} />
          <p className="text-[10px] text-soft/60">since issued</p>
        </div>
      </div>
      {b.narrative && <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-ink/80">{b.narrative}</p>}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-soft/70">{timeAgo(b.issued_at)}</span>
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-gold-700">
          Research <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function EventCard({ e, current }: { e: AlertEvent; current: number | null; index: number }) {
  const snap = e.payload?.snapshot_price ?? null;
  return (
    <Link
      href={`/research/${encodeURIComponent(e.ticker)}`}
      className="block rounded-2xl border border-sand bg-paper p-4 transition hover:border-gold-300"
    >
      <div className="flex items-center gap-3">
        <CompanyLogo symbol={e.ticker} name={e.ticker} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-sm font-bold text-ink">{e.ticker}</span>
            <span className="rounded-full bg-sand px-1.5 py-0.5 text-[9px] font-bold uppercase text-soft">
              Your alert
            </span>
            {e.payload?.delayed && (
              <span className="text-[9px] font-medium text-soft/60">delayed ~15m</span>
            )}
          </div>
          <p className="truncate text-[13px] font-medium text-ink/80">
            {e.payload?.message || "Condition met"}
          </p>
        </div>
        {snap != null && (
          <div className="text-right">
            <PerfSince from={snap} to={current} />
            <p className="text-[10px] text-soft/60">since fired</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-soft/70">{timeAgo(e.fired_at)}</span>
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-gold-700">
          Research <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

/* ============================================================================
 * MY RULES
 * ==========================================================================*/
function RulesTab({
  userId,
  rules,
  setRules,
  isSolo,
  prefs,
}: {
  userId: string;
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
  isSolo: boolean;
  prefs: AlertPrefs;
}) {
  const activeCount = rules.filter((r) => r.active).length;
  const [newTicker, setNewTicker] = useState("");

  const toggle = useCallback(
    async (r: AlertRule) => {
      const supabase = createClient();
      const next = !r.active;
      const { error } = await supabase
        .from("alert_rules")
        .update({ active: next })
        .eq("id", r.id);
      if (!error) setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
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
    <div className="space-y-4">
      {/* Kai Watch — the natural-language entry point (R4). */}
      <KaiWatch
        userId={userId}
        surface="strategy"
        onCreated={(created) => setRules((rs) => [...created, ...rs])}
      />

      <DeliveryPrefs isSolo={isSolo} prefs={prefs} />

      {/* Create (manual) */}
      <div className="rounded-2xl border border-sand bg-paper/60 p-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[13px] font-bold text-ink">Or build one by hand</p>
          <span className="text-[11px] font-semibold text-soft">
            {activeCount}/{MAX_ACTIVE_RULES} active
          </span>
        </div>
        <p className="mb-3 text-[12px] text-soft">
          Enter a ticker to set a price, volume or technical alert on it.
        </p>
        <div className="flex items-center gap-2">
          <input
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g, ""))}
            placeholder="e.g. AAPL"
            maxLength={8}
            className="w-32 rounded-lg border border-sand bg-paper px-3 py-2 text-[14px] font-semibold text-ink outline-none focus:border-gold-300"
          />
          {newTicker.length >= 1 ? (
            <span onClick={refresh}>
              <SetAlertButton
                ticker={newTicker}
                surface="manual"
                variant="full"
                stopPropagation={false}
              />
            </span>
          ) : (
            <button
              disabled
              className="inline-flex items-center gap-1.5 rounded-lg border border-sand bg-paper px-3 py-1.5 text-[13px] font-semibold text-soft/50"
            >
              <Plus className="h-4 w-4" /> Set alert
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand bg-paper/60 px-5 py-8 text-center">
          <p className="text-[14px] font-semibold text-ink">No custom alerts yet</p>
          <p className="mt-1 text-[13px] text-soft">
            Add one above, or from any screener row, watchlist card or research page.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                r.active ? "border-sand bg-paper" : "border-sand bg-paper/50 opacity-70"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  r.active ? "bg-chip-amber text-gold-700" : "bg-sand text-soft"
                }`}
              >
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {r.label || ruleLabel(r.kind, r.ticker, r.params)}
                </p>
                <p className="text-[11px] text-soft/70">
                  {r.digest ? "Daily digest" : "Instant push"} · added {timeAgo(r.created_at)}
                  {r.surface !== "manual" ? ` · from ${r.surface}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(r)}
                title={r.active ? "Pause" : "Resume"}
                aria-label={r.active ? "Pause alert" : "Resume alert"}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  r.active ? "kai-gradient" : "bg-sand"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    r.active ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
              <button
                onClick={() => remove(r)}
                title="Delete"
                aria-label="Delete alert"
                className="rounded-lg border border-sand p-1.5 text-soft transition hover:border-red-300 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryPrefs({ isSolo, prefs }: { isSolo: boolean; prefs: AlertPrefs }) {
  const [briefing, setBriefing] = useState<boolean>(
    prefs.briefing_enabled ?? isSolo // club default ON, family-adult default OFF
  );
  const [digest, setDigest] = useState(prefs.digest);
  const [cap, setCap] = useState(prefs.daily_cap);
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
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
    [briefing, digest, cap]
  );

  return (
    <div className="rounded-2xl border border-sand bg-paper/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-bold text-ink">Delivery</p>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
      <Row
        label="Kai daily briefing push"
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
 * STRATEGY
 * ==========================================================================*/
function StrategyTab({
  userId,
  strategy,
  rules,
  setRules,
  onGoToRules,
}: {
  userId: string;
  strategy: StrategyProfile | null;
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
  onGoToRules: () => void;
}) {
  const [timeframe, setTimeframe] = useState<StrategyProfile["timeframe"]>(
    strategy?.timeframe ?? "swing"
  );
  const [setups, setSetups] = useState<string[]>(strategy?.setup_prefs ?? []);
  const [risk, setRisk] = useState<StrategyProfile["risk_posture"]>(
    strategy?.risk_posture ?? "balanced"
  );
  const [saved, setSaved] = useState(false);

  const save = useCallback(async () => {
    const supabase = createClient();
    await supabase.from("strategy_profiles").upsert(
      {
        user_id: userId,
        timeframe,
        setup_prefs: setups,
        risk_posture: risk,
        updated_at: new Date().toISOString(),
      },
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
    <div className="space-y-5">
      <div className="rounded-2xl border border-gold-300/40 bg-chip-amber/30 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
          <Sparkles className="h-4 w-4 text-gold-600" /> Build your strategy profile
        </p>
        <p className="mt-1 text-[12px] leading-snug text-soft">
          Tell us how you like to study the market and we&apos;ll suggest alerts that
          fit — you stay in control of what actually gets created.
        </p>
      </div>

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
                onClick={() =>
                  setSetups((s) => (on ? s.filter((x) => x !== o.id) : [...s, o.id]))
                }
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
        className="w-full rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 py-2.5 text-[14px] font-bold text-white shadow-soft transition hover:brightness-105"
      >
        {saved ? "Saved ✓" : "Save my strategy"}
      </button>

      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-bold text-ink">Suggested alerts for you</p>
          <div className="space-y-2">
            {suggestions.map((s) => {
              const added = existingPresetIds.has(s.presetId);
              return (
                <div key={s.key} className="flex items-center gap-3 rounded-xl border border-sand bg-paper p-3">
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
          <button
            onClick={onGoToRules}
            className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-gold-700 hover:underline"
          >
            Manage all my alerts <ArrowRight className="h-3.5 w-3.5" />
          </button>
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

/* ---------- utils ---------- */
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
