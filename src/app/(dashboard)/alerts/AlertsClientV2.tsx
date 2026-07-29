"use client";

/**
 * /alerts — KAI WATCH · v2 canvas (DESIGN-UX-SPEC + boards 18 "Watch · Kai
 * Alerts" and 19 "Alert · View Setup"). Rendered ONLY behind designV2Enabled()
 * (AlertsClient branches to it after the flag check). This is a STANDALONE
 * re-skin of ./AlertsClient — it takes the SAME props (same server reads, same
 * gating already applied upstream) and rebuilds the presentation on the cc
 * canvas. The v1 body is left untouched so its render path stays byte-identical
 * when the flag is off.
 *
 * ── REAL-DATA MAPPING (no invented types, no faked precision) ──────────────────
 * The C6 backend does NOT carry a BUY/SELL/HEADS-UP field. What it carries is a
 * DIRECTION on Kai's daily setups (trade_alerts.direction / alert_setups
 * .direction ∈ long|short|watch). Board 18's typed cards are derived HONESTLY
 * from it:  long → BUY (green edge) · short → SELL (pink edge) · watch → HEADS-UP
 * (yellow edge). A member's OWN fired watch (alert_events.kind="rule") has no
 * direction, so it is rendered as a NEUTRAL card — never assigned a type it
 * doesn't have. Kai/setup updates type themselves only when payload.direction is
 * present.
 *
 * Evidence chips are the setup's STORED levels (entry / resistance / stop /
 * issued-at price) as measured value chips — never a checkmark for a condition
 * the cron did not measure. Triggered-history "% since" is the real move from the
 * stored snapshot price to the current screener price; when either is missing the
 * % is omitted, never zero-filled.
 *
 * COLOUR LAW (§1-3): orange = brand + live + the ONE primary CTA (the "New Kai
 * Watch" button — the SMS-migration hero). Green/pink = market truth only.
 * Kai-blue rings Kai's own surfaces. Watch/setup lifecycle states carry a neutral
 * tone chip (word first), so the green/pink budget stays on price + typed edges.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Sparkles, Eye, ArrowRight, ChevronRight, Search, Plus, Trash2,
  Zap, Check, TrendingUp, TrendingDown, LineChart, RefreshCw, Trophy, Loader2,
  Share2, SlidersHorizontal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Kicker, ScriptTitle, Card, TickerBadge, EvidenceChip, ALERT_META, Ring,
  type AlertKind as CcAlertKind,
} from "@/components/cc/ui";
import { SubTabs } from "@/components/cc/interactive";
import KaiWatchV2 from "./KaiWatchV2";
import type { Props } from "./AlertsClient";
import {
  MAX_ACTIVE_RULES, ruleLabel, STRATEGY_PLAYS,
  SETUP_OPTIONS, TIMEFRAME_OPTIONS, RISK_OPTIONS, suggestedRulesFor,
  type TradeAlert, type AlertEvent, type AlertKind, type AlertRule,
  type AlertPrefs, type SampleAlert, type StrategyPlay, type AlertSetup,
  type StrategyProfile,
} from "@/lib/alerts/types";
import type { WatchState } from "@/lib/alerts/watch-state";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";
import type { TrackRecord, AlertOutcome } from "@/lib/alerts/history";
import {
  WATCH_STATE_META, SETUP_STATE_META, watchStateLine, marketStatus,
  freshnessLabel, readSetupLevels, type StateTone, type ObservationalRow,
} from "@/lib/alerts/watch-ui";

/* ── tone + format helpers ────────────────────────────────────────────────── */

type WatchDetail = { progress?: number; metric?: string | null } | null;

/** cc colour for a lifecycle StateTone (green/pink stay off state chips). */
function toneColor(t: StateTone): string {
  return t === "volt" ? "var(--cc-orange)" : t === "quiet" ? "var(--cc-soft)" : "var(--cc-blue)";
}

/** long→BUY, short→SELL, watch→HEADS_UP. null when the row carries no direction. */
function ccKindFor(dir?: string | null): CcAlertKind | null {
  if (dir === "long") return "BUY";
  if (dir === "short") return "SELL";
  if (dir === "watch") return "HEADS_UP";
  return null;
}

const KIND_DIMENSION: Record<AlertKind, string> = {
  price_cross: "Price", pct_move: "Big moves", vol_surge: "Volume", rsi_cross: "Momentum",
  ema_cross: "Trend", w52_break: "52-week", preset_match: "Screen",
  sentiment_velocity: "Club sentiment", news_event: "News",
};

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function money0(n: number): string {
  return Math.round(n).toLocaleString();
}
function dateBucket(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const s = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((s(now) - s(then)) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Earlier this week";
  if (diff < 30) return "Earlier this month";
  return then.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const mm = Math.floor(d / 60000);
  if (mm < 1) return "just now";
  if (mm < 60) return `${mm}m ago`;
  const h = Math.floor(mm / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ── small shared atoms ───────────────────────────────────────────────────── */

function KickerLabel({ children }: { children: React.ReactNode }) {
  return <div className="cc-mono" style={{ color: "var(--cc-soft)" }}>{children}</div>;
}

function StatePill({ tone, label, live }: { tone: StateTone; label: string; live?: boolean }) {
  const c = toneColor(tone);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] font-bold uppercase tracking-[0.1em]"
      style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
    >
      {live && <span className="cc-ping inline-block h-1.5 w-1.5 rounded-full" style={{ background: c }} />}
      {label}
    </span>
  );
}

function PerfSince({ from, to, className = "" }: { from: number | null; to: number | null; className?: string }) {
  if (from == null || to == null || from <= 0) {
    return <span className={`text-[12px] ${className}`} style={{ color: "var(--cc-dim)" }}>tracking…</span>;
  }
  const pct = ((to - from) / from) * 100;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-[family-name:var(--font-plex-mono)] text-[12.5px] font-bold tabular-nums ${className}`}
      style={{ color: up ? "var(--cc-up)" : "var(--cc-down)" }}
    >
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function GhostAction({ href, onClick, children }: { href?: string; onClick?: () => void; children: React.ReactNode }) {
  const cls = "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors";
  const style = { background: "var(--cc-card2)", color: "var(--cc-ink)", border: "1px solid var(--cc-line)" } as const;
  if (href) return <Link href={href} className={cls} style={style}>{children}</Link>;
  return <button onClick={onClick} className={cls} style={style}>{children}</button>;
}

/* Follow / unfollow a Kai Daily setup (Lane B over /api/alerts/setups/[id]/subscribe). */
function CcFollowButton({ setupId, subscribed, onChange }: { setupId: string; subscribed: boolean; onChange: (s: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (busy) return;
    const next = !subscribed;
    setBusy(true);
    onChange(next);
    try {
      const res = await fetch(`/api/alerts/setups/${setupId}/subscribe`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscribe: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      onChange(!next);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={toggle}
      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition"
      style={subscribed
        ? { background: "color-mix(in srgb, var(--cc-blue) 12%, transparent)", color: "var(--cc-blue)", border: "1px solid color-mix(in srgb, var(--cc-blue) 40%, transparent)" }
        : { background: "color-mix(in srgb, var(--cc-blue) 90%, black 0%)", color: "#fff", border: "1px solid transparent" }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
      {subscribed ? "Following" : "Follow"}
    </button>
  );
}

/* ============================================================================
 * ROOT
 * ==========================================================================*/
type Tab = "alerts" | "watches" | "overview" | "record";

export default function AlertsClientV2({
  userId, isSolo, newSinceSeen, broadcasts, events,
  rules: initialRules, strategy, prefs, priceMap, marketEvents, sampleAlert,
  trackRecord, watchlistTickers, watchStates, setups: initialSetups, observational,
}: Props) {
  const [tab, setTab] = useState<Tab>("alerts");
  const [rules, setRules] = useState(initialRules);
  const [setups, setSetups] = useState(initialSetups);
  const [sheet, setSheet] = useState<{ open: boolean; text?: string; nonce: number }>({ open: false, nonce: 0 });

  // Deep-link (same shapes as v1: tab hashes + #kai-nl opens the create sheet).
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    if (hash === "kai-nl") { setSheet((s) => ({ open: true, nonce: s.nonce + 1 })); return; }
    if (hash === "watch") { setTab("watches"); return; }
    if (["alerts", "watches", "overview", "record"].includes(hash)) setTab(hash as Tab);
    if (hash === "daily" || hash === "history" || hash === "live") setTab("alerts");
  }, []);

  // Stamp the hub-seen watermark (migration 195) — fire-and-forget.
  useEffect(() => {
    const supabase = createClient();
    void supabase.from("alert_prefs")
      .upsert({ user_id: userId, hub_seen_at: new Date().toISOString() }, { onConflict: "user_id" })
      .then(() => undefined);
  }, [userId]);

  const activeRules = useMemo(() => rules.filter((r) => r.active), [rules]);
  const followedSetups = useMemo(() => setups.filter((s) => s.subscribed), [setups]);

  const stateByRule = useMemo(() => {
    const map = new Map<string, WatchState>();
    for (const w of watchStates) map.set(w.rule_id, w.state as WatchState);
    return map;
  }, [watchStates]);
  const detailByRule = useMemo(() => {
    const map = new Map<string, WatchDetail>();
    for (const w of watchStates) map.set(w.rule_id, (w.detail || {}) as WatchDetail);
    return map;
  }, [watchStates]);

  const lastChecked = useMemo(() => {
    let max: string | null = null;
    for (const r of activeRules) if (r.last_checked_at && (!max || r.last_checked_at > max)) max = r.last_checked_at;
    return max;
  }, [activeRules]);

  const watchingCount = activeRules.length + followedSetups.length;
  const developingCount = useMemo(() => {
    let n = 0;
    for (const r of activeRules) { const s = stateByRule.get(r.id); if (s && WATCH_STATE_META[s]?.developing) n++; }
    for (const s of followedSetups) if (SETUP_STATE_META[s.state]?.developing) n++;
    return n;
  }, [activeRules, stateByRule, followedSetups]);

  const mkt = marketStatus();
  const readings = [
    watchingCount === 1 ? "1 watch running" : `${watchingCount} watches running`,
    mkt.label,
    lastChecked ? freshnessLabel(lastChecked).toLowerCase() : "not checked yet",
  ].join(" · ");

  const openSheet = useCallback((text?: string) => {
    setTab("watches");
    setSheet((s) => ({ open: true, text, nonce: s.nonce + 1 }));
  }, []);

  const TABS = useMemo(() => ([
    { id: "alerts" as Tab, label: "Alerts" },
    { id: "watches" as Tab, label: activeRules.length ? `Watches · ${activeRules.length}` : "Watches" },
    { id: "overview" as Tab, label: "Overview" },
    { id: "record" as Tab, label: "Record" },
  ]), [activeRules.length]);

  return (
    <div className="mx-auto w-full max-w-[680px] px-4 pb-24 pt-6">
      {/* ── header (board 18 masthead) ─────────────────────────────────────── */}
      <header>
        <ScriptTitle>watch</ScriptTitle>

        {/* Kai identity row + N-new (honest, watermark-backed) */}
        <div className="mt-4 flex items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px]"
            style={{ background: "color-mix(in srgb, var(--cc-blue) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--cc-blue) 30%, transparent)" }}
            aria-hidden
          >🐋</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold" style={{ color: "var(--cc-ink)" }}>Kai&apos;s alerts for you</p>
            <p className="mt-px truncate text-[10.5px]" style={{ color: "var(--cc-soft)" }}>{readings}</p>
          </div>
          {developingCount > 0 && (
            <span className="hidden items-center gap-1 font-[family-name:var(--font-plex-mono)] text-[9.5px] font-semibold uppercase tracking-[0.12em] sm:inline-flex" style={{ color: "var(--cc-orange)" }}>
              <Zap className="h-3 w-3" /> {developingCount} developing
            </span>
          )}
          {newSinceSeen > 0 && (
            <span className="shrink-0 rounded-full px-2 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold" style={{ background: "var(--cc-card2)", color: "var(--cc-soft)", border: "1px solid var(--cc-line)" }}>
              {newSinceSeen} NEW
            </span>
          )}
        </div>

        {/* THE SMS-MIGRATION HERO — the one orange CTA on this screen. */}
        <button
          onClick={() => openSheet()}
          className="cc-halo mt-4 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-transform hover:-translate-y-px active:translate-y-0 motion-reduce:hover:translate-y-0"
          style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
        >
          <Sparkles className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-extrabold">New Kai Watch</span>
            <span className="block truncate text-[11.5px] font-semibold opacity-80">
              &ldquo;alert me if NVDA breaks 180 on volume&rdquo;
            </span>
          </span>
          <Plus className="h-5 w-5 shrink-0" />
        </button>
      </header>

      <SubTabs tabs={TABS} value={tab} onChange={setTab} className="mt-6" />

      <div className="mt-6">
        <AnimatePresence mode="wait">
          <m.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
            {tab === "alerts" && (
              <AlertsFeed
                broadcasts={broadcasts} events={events} setups={setups} setSetups={setSetups}
                priceMap={priceMap} sampleAlert={sampleAlert} marketEvents={marketEvents}
              />
            )}
            {tab === "watches" && (
              <WatchesTab
                userId={userId} rules={rules} setRules={setRules} stateByRule={stateByRule}
                detailByRule={detailByRule} isSolo={isSolo} prefs={prefs} strategy={strategy}
                watchlistTickers={watchlistTickers} onOpenSheet={openSheet}
              />
            )}
            {tab === "overview" && (
              <OverviewTab
                rules={activeRules} stateByRule={stateByRule} detailByRule={detailByRule}
                priceMap={priceMap} watchlistCount={watchlistTickers.length}
                onGoWatches={() => setTab("watches")} onOpenSheet={openSheet}
              />
            )}
            {tab === "record" && (
              <RecordTab track={trackRecord} observational={observational} sampleAlert={sampleAlert} />
            )}
          </m.div>
        </AnimatePresence>
      </div>

      <p className="mt-10 text-[11px] leading-relaxed" style={{ color: "var(--cc-dim)" }}>
        Kai&apos;s watches and briefings are educational market analysis, not financial advice or a
        recommendation to buy or sell. Intraday prices are delayed roughly 15 minutes. Past
        performance never guarantees future results.
      </p>

      <KaiWatchV2
        open={sheet.open}
        userId={userId}
        surface="strategy"
        presetText={sheet.text}
        presetNonce={sheet.nonce}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        onCreated={(created) => setRules((rs) => [...created, ...rs])}
      />
    </div>
  );
}

/* ============================================================================
 * ALERTS FEED — board 18: typed cards for TODAY, compact rows older.
 * ==========================================================================*/
type FeedRow =
  | { type: "broadcast"; at: string; ticker: string; b: TradeAlert }
  | { type: "event"; at: string; ticker: string; e: AlertEvent };

function AlertsFeed({
  broadcasts, events, setups, setSetups, priceMap, sampleAlert, marketEvents,
}: {
  broadcasts: TradeAlert[];
  events: AlertEvent[];
  setups: AlertSetup[];
  setSetups: React.Dispatch<React.SetStateAction<AlertSetup[]>>;
  priceMap: Record<string, number>;
  sampleAlert: SampleAlert | null;
  marketEvents: Props["marketEvents"];
}) {
  const [q, setQ] = useState("");

  const setupByAlert = useMemo(() => {
    const m = new Map<string, AlertSetup>();
    for (const s of setups) m.set(s.alert_id, s);
    return m;
  }, [setups]);

  const onSub = useCallback((setupId: string, subscribed: boolean) => {
    setSetups((ss) => ss.map((s) => (s.id === setupId ? { ...s, subscribed } : s)));
  }, [setSetups]);

  const rows = useMemo<FeedRow[]>(() => {
    const bs: FeedRow[] = broadcasts.map((b) => ({ type: "broadcast", at: b.issued_at, ticker: b.ticker, b }));
    const es: FeedRow[] = events.map((e) => ({ type: "event", at: e.fired_at, ticker: e.ticker, e }));
    return [...bs, ...es].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [broadcasts, events]);

  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return needle ? rows.filter((r) => r.ticker.toUpperCase().includes(needle)) : rows;
  }, [rows, q]);

  const groups = useMemo(() => {
    const out: { label: string; rows: FeedRow[] }[] = [];
    let cur: { label: string; rows: FeedRow[] } | null = null;
    for (const r of filtered) {
      const label = dateBucket(r.at);
      if (!cur || cur.label !== label) { cur = { label, rows: [] }; out.push(cur); }
      cur.rows.push(r);
    }
    return out;
  }, [filtered]);

  return (
    <div className="space-y-6">
      {rows.length > 4 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cc-dim)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by ticker…"
            className="w-full rounded-full py-2.5 pl-9 pr-3 text-[13.5px] outline-none"
            style={{ background: "var(--cc-card)", border: "1px solid var(--cc-line)", color: "var(--cc-ink)" }}
          />
        </div>
      )}

      {sampleAlert && <SampleTypedCard s={sampleAlert} />}

      {filtered.length === 0 ? (
        <>
          <Card className="px-4 py-6">
            <p className="cc-display text-[18px]" style={{ color: "var(--cc-ink)" }}>
              {q.trim() ? `Nothing for $${q.trim().toUpperCase()} yet` : "Kai Daily lands here"}
            </p>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
              Kai&apos;s daily setups and your fired watches collect here as they happen — typed,
              grouped by day, with the levels that define them.
            </p>
          </Card>
          {!q.trim() && marketEvents.length > 0 && (
            <section className="space-y-2">
              <KickerLabel>This week in the market</KickerLabel>
              {marketEvents.map((mkt, i) => (
                <Link
                  key={i}
                  href={mkt.ticker ? `/research/${encodeURIComponent(mkt.ticker)}` : `/news/${mkt.slug}`}
                  className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors hover:border-[var(--cc-orange)]"
                  style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}
                >
                  {mkt.ticker && <TickerBadge symbol={mkt.ticker} size={30} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold" style={{ color: "var(--cc-ink)" }}>{mkt.title}</p>
                    {mkt.dek && <p className="truncate text-[11.5px]" style={{ color: "var(--cc-soft)" }}>{mkt.dek}</p>}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--cc-dim)" }} />
                </Link>
              ))}
            </section>
          )}
        </>
      ) : (
        groups.map((g, gi) => (
          <section key={g.label} className="space-y-2.5">
            <KickerLabel>{g.label}</KickerLabel>
            {g.rows.map((row) =>
              gi === 0
                ? (row.type === "broadcast"
                    ? <BroadcastCard key={`b-${row.b.id}`} b={row.b} current={priceMap[row.ticker] ?? null} setup={setupByAlert.get(row.b.id)} onSub={onSub} />
                    : <EventCard key={`e-${row.e.id}`} e={row.e} current={priceMap[row.ticker] ?? null} />)
                : <CompactRow key={row.type === "broadcast" ? `b-${row.b.id}` : `e-${row.e.id}`} row={row} current={priceMap[row.ticker] ?? null} />
            )}
          </section>
        ))
      )}
    </div>
  );
}

/** A typed alert card shell — coloured left edge, mono header, evidence, actions. */
function TypedShell({
  kind, ticker, kicker, at, children,
}: {
  kind: CcAlertKind | null;
  ticker: string;
  kicker?: string;
  at: string;
  children: React.ReactNode;
}) {
  const meta = kind ? ALERT_META[kind] : null;
  const edge = meta?.edge ?? "var(--cc-line)";
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)", borderLeft: `3px solid ${edge}` }}
    >
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          {meta ? (
            <span
              className="rounded-lg px-2 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] font-bold uppercase tracking-[0.1em]"
              style={{ background: `color-mix(in srgb, ${edge} 14%, transparent)`, color: edge }}
            >{meta.label}</span>
          ) : (
            <span
              className="rounded-lg px-2 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] font-bold uppercase tracking-[0.1em]"
              style={{ background: "var(--cc-card2)", color: "var(--cc-soft)" }}
            >YOUR WATCH</span>
          )}
          <span className="font-[family-name:var(--font-plex-mono)] text-[12px] font-semibold" style={{ color: "var(--cc-ink)" }}>{ticker}</span>
          {kicker && (
            <span className="font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-soft)" }}>{kicker}</span>
          )}
          <span className="ml-auto font-[family-name:var(--font-plex-mono)] text-[9px]" style={{ color: "var(--cc-dim)" }}>{timeAgo(at)}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function BroadcastCard({
  b, current, setup, onSub,
}: {
  b: TradeAlert;
  current: number | null;
  setup: AlertSetup | undefined;
  onSub: (setupId: string, subscribed: boolean) => void;
}) {
  const kind = ccKindFor(b.direction);
  const L = readSetupLevels(setup?.levels ?? b.levels);
  const stateMeta = setup ? SETUP_STATE_META[setup.state] : null;
  const shareText = `$${b.ticker} — Kai flagged: ${b.setup_label || "a setup worth studying"}`;

  const chips: { label: string; value: string }[] = [];
  if (b.entry != null) chips.push({ label: "Entry", value: money(b.entry) });
  if (L.resistance != null) chips.push({ label: "Level", value: money(L.resistance) });
  if (L.stop != null) chips.push({ label: "Invalid", value: money(L.stop) });
  if (b.snapshot_price != null) chips.push({ label: "Issued", value: money(b.snapshot_price) });

  return (
    <TypedShell kind={kind} ticker={b.ticker} kicker={stateMeta?.label} at={b.issued_at}>
      <div className="mt-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {b.setup_label && <p className="text-[13.5px] font-bold leading-snug" style={{ color: "var(--cc-ink)" }}>{b.setup_label}</p>}
          {b.narrative && <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed" style={{ color: "var(--cc-ink)", opacity: 0.85 }}>{b.narrative}</p>}
        </div>
        <div className="shrink-0 text-right">
          <PerfSince from={b.snapshot_price} to={current} />
          <p className="font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>since issued</p>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) => <EvidenceChip key={c.label} label={c.label} state="value" value={c.value} />)}
        </div>
      )}

      <div className="mt-3.5 flex items-center gap-2">
        <GhostAction href={`/research/${encodeURIComponent(b.ticker)}`}>View setup</GhostAction>
        {setup
          ? <CcFollowButton setupId={setup.id} subscribed={!!setup.subscribed} onChange={(s) => onSub(setup.id, s)} />
          : <GhostAction href={`/community?compose=${encodeURIComponent(shareText)}`}><Share2 className="h-3.5 w-3.5" /> Share to Club</GhostAction>}
      </div>
    </TypedShell>
  );
}

function EventCard({ e, current }: { e: AlertEvent; current: number | null }) {
  const state = e.payload?.state as WatchState | SetupState | undefined;
  const meta = state
    ? (e.kind === "setup_update" ? SETUP_STATE_META[state as SetupState] : WATCH_STATE_META[state as WatchState])
    : null;
  const kind = ccKindFor(e.payload?.direction);
  const snap = e.payload?.snapshot_price ?? null;
  const isUpdate = e.kind === "kai_update" || e.kind === "setup_update";
  return (
    <TypedShell kind={kind} ticker={e.ticker} kicker={meta?.label} at={e.fired_at}>
      <div className="mt-2 flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed" style={{ color: "var(--cc-ink)", opacity: 0.85 }}>
          {e.payload?.message || "Condition met"}
        </p>
        {!isUpdate && snap != null ? (
          <div className="shrink-0 text-right">
            <PerfSince from={snap} to={current} />
            <p className="font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>since fired</p>
          </div>
        ) : null}
      </div>
      <div className="mt-3.5">
        <GhostAction href={`/alerts/e/${e.id}`}>View setup <ChevronRight className="h-3.5 w-3.5" /></GhostAction>
      </div>
    </TypedShell>
  );
}

function CompactRow({ row, current }: { row: FeedRow; current: number | null }) {
  const dir = row.type === "broadcast" ? row.b.direction : row.e.payload?.direction;
  const kind = ccKindFor(dir);
  const meta = kind ? ALERT_META[kind] : null;
  const edge = meta?.edge ?? "var(--cc-line)";
  const snap = row.type === "broadcast" ? row.b.snapshot_price : (row.e.payload?.snapshot_price ?? null);
  const state = row.type === "event" ? (row.e.payload?.state as WatchState | SetupState | undefined) : undefined;
  const sMeta = state
    ? (row.type === "event" && row.e.kind === "setup_update" ? SETUP_STATE_META[state as SetupState] : WATCH_STATE_META[state as WatchState])
    : null;
  const label = row.type === "broadcast" ? (row.b.setup_label || "Daily setup") : (sMeta?.label || "Watch");
  const href = row.type === "broadcast" ? `/research/${encodeURIComponent(row.ticker)}` : `/alerts/e/${row.e.id}`;
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors hover:border-[var(--cc-orange)]"
      style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)", borderLeft: `3px solid ${edge}`, opacity: 0.85 }}
    >
      <span
        className="rounded-md px-1.5 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9px] font-bold uppercase"
        style={{ background: `color-mix(in srgb, ${edge} 14%, transparent)`, color: meta ? edge : "var(--cc-soft)" }}
      >{meta?.label ?? "WATCH"}</span>
      <span className="font-[family-name:var(--font-plex-mono)] text-[11px]" style={{ color: "var(--cc-ink)" }}>{row.ticker}</span>
      <span className="min-w-0 flex-1 truncate text-[11.5px]" style={{ color: "var(--cc-soft)" }}>{label}</span>
      {snap != null && <PerfSince from={snap} to={current} className="!text-[11px]" />}
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--cc-dim)" }} />
    </Link>
  );
}

/** SAMPLE typed card — clearly labelled, built from real screener data. */
function SampleTypedCard({ s }: { s: SampleAlert }) {
  const L = s.levels;
  return (
    <div className="overflow-hidden rounded-2xl border border-dashed" style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)", borderLeft: `3px solid ${ALERT_META.BUY.edge}` }}>
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <span className="rounded-lg px-2 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ background: `color-mix(in srgb, ${ALERT_META.BUY.edge} 14%, transparent)`, color: ALERT_META.BUY.edge }}>BUY</span>
          <span className="font-[family-name:var(--font-plex-mono)] text-[12px] font-semibold" style={{ color: "var(--cc-ink)" }}>{s.ticker}</span>
          <span className="ml-auto font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>sample only</span>
        </div>
        <p className="mt-2 text-[13.5px] font-bold" style={{ color: "var(--cc-ink)" }}>{s.setup_label}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--cc-ink)", opacity: 0.82 }}>{s.thesis}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <EvidenceChip label="Entry" state="value" value={`${money0(L.entryLow)}–${money0(L.entryHigh)}`} />
          {L.targets[0] && <EvidenceChip label="Target" state="value" value={money0(L.targets[0].price)} />}
          <EvidenceChip label="Invalid" state="value" value={money0(L.invalidation)} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--cc-dim)" }}>
          A worked example of a Kai Daily setup — educational analysis of price levels, not a recommendation.
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
 * OVERVIEW — getting-close (Ring) + developing rows + nav links.
 * ==========================================================================*/
const WATCH_LADDER: WatchState[] = ["watching", "building", "near_trigger", "triggered"];

function OverviewTab({
  rules, stateByRule, detailByRule, priceMap, watchlistCount, onGoWatches, onOpenSheet,
}: {
  rules: AlertRule[];
  stateByRule: Map<string, WatchState>;
  detailByRule: Map<string, WatchDetail>;
  priceMap: Record<string, number>;
  watchlistCount: number;
  onGoWatches: () => void;
  onOpenSheet: (text?: string) => void;
}) {
  const developing = useMemo(() => {
    const rows = rules
      .map((r) => ({ r, state: stateByRule.get(r.id), detail: detailByRule.get(r.id) ?? null }))
      .filter((x): x is { r: AlertRule; state: WatchState; detail: WatchDetail } => !!x.state && WATCH_STATE_META[x.state].developing);
    return rows.sort((a, b) => (b.detail?.progress ?? 0) - (a.detail?.progress ?? 0));
  }, [rules, stateByRule, detailByRule]);

  const lead = developing[0] ?? null;
  const rest = developing.slice(1);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <NavRow href="/watchlist" icon={<LineChart className="h-4 w-4" />} title="My watchlist"
          sub={watchlistCount === 0 ? "Nothing on the board yet" : `${watchlistCount} ${watchlistCount === 1 ? "company" : "companies"}`} />
        <NavRow onClick={onGoWatches} icon={<Eye className="h-4 w-4" />} title="Kai Watch"
          sub={rules.length === 0 ? "Tell Kai what to watch" : `${rules.length} active ${rules.length === 1 ? "setup" : "setups"}`}
          badge={developing.length || undefined} />
        <NavRow href="/watchlist/community" icon={<RefreshCw className="h-4 w-4" />} title="Opinion changes"
          sub="Who the club re-thought in the last 24 hours" />
      </div>

      {lead ? (
        <GettingClose r={lead.r} state={lead.state} detail={lead.detail} current={lead.r.ticker ? priceMap[lead.r.ticker] ?? null : null} />
      ) : (
        <Card className="px-4 py-5">
          <Kicker tone="orange">Getting close</Kicker>
          <p className="mt-2 cc-display text-[18px]" style={{ color: "var(--cc-ink)" }}>Nothing at the doorstep</p>
          <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            Kai is watching quietly. The moment one of your conditions starts to build, it moves up
            here with how close it is — so you read it before it trips, not after.
          </p>
          <button onClick={() => onOpenSheet()} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
            Tell Kai what to watch <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </Card>
      )}

      {rest.length > 0 && (
        <section className="space-y-2">
          <KickerLabel>Also developing</KickerLabel>
          {rest.map(({ r, state, detail }) => (
            <DevelopingRow key={r.id} r={r} state={state} detail={detail} current={r.ticker ? priceMap[r.ticker] ?? null : null} />
          ))}
        </section>
      )}
    </div>
  );
}

function NavRow({ href, onClick, icon, title, sub, badge }: {
  href?: string; onClick?: () => void; icon: React.ReactNode; title: string; sub: string; badge?: number;
}) {
  const inner = (
    <div className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors hover:border-[var(--cc-orange)]" style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--cc-card2)", color: "var(--cc-soft)" }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold" style={{ color: "var(--cc-ink)" }}>{title}</p>
        <p className="truncate text-[11.5px]" style={{ color: "var(--cc-soft)" }}>{sub}</p>
      </div>
      {badge ? <span className="rounded-full px-2 py-0.5 font-[family-name:var(--font-plex-mono)] text-[10px] font-bold" style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}>{badge}</span>
        : <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--cc-dim)" }} />}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <button onClick={onClick} className="block w-full text-left">{inner}</button>;
}

function GettingClose({ r, state, detail, current }: { r: AlertRule; state: WatchState; detail: WatchDetail; current: number | null }) {
  const meta = WATCH_STATE_META[state];
  const condition = r.label || ruleLabel(r.kind, r.ticker, r.params);
  const idx = WATCH_LADDER.indexOf(state);
  const onLadder = idx >= 0;
  const step = onLadder ? idx + 1 : null;
  const progress = typeof detail?.progress === "number" && Number.isFinite(detail.progress)
    ? Math.min(1, Math.max(0, detail.progress))
    : onLadder ? (idx + 1) / WATCH_LADDER.length : 0.5;
  const c = toneColor(meta.tone);

  return (
    <Card className="p-4" style={{ boxShadow: "var(--cc-halo-soft)", borderColor: "color-mix(in srgb, var(--cc-orange) 30%, var(--cc-line))" }}>
      <div className="flex items-center gap-2">
        <Kicker tone="orange">Getting close</Kicker>
        <span className="ml-auto"><StatePill tone={meta.tone} label={meta.label} live={meta.live} /></span>
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        {r.ticker && <TickerBadge symbol={r.ticker} size={28} />}
        <p className="min-w-0 flex-1 truncate cc-display text-[16px]" style={{ color: "var(--cc-ink)" }}>
          {r.ticker ? `$${r.ticker}` : "Screen"} · {condition}
        </p>
        {current != null && <span className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[13px] font-semibold tabular-nums" style={{ color: "var(--cc-ink)" }}>{money(current)}</span>}
      </div>
      <div className="mt-4 flex items-center gap-4">
        <Ring value={progress * 100} size={84} stroke={7} color={c}>
          <span className="cc-display text-[16px]" style={{ color: "var(--cc-ink)" }}>{step ? `${step}/${WATCH_LADDER.length}` : meta.label.slice(0, 1)}</span>
        </Ring>
        <div className="min-w-0 flex-1 space-y-2">
          {onLadder ? WATCH_LADDER.map((s, i) => {
            const done = i <= idx;
            return (
              <div key={s} className="flex items-center gap-2 text-[12px]">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px]" style={{ background: done ? `color-mix(in srgb, ${c} 20%, transparent)` : "var(--cc-card2)", color: done ? c : "var(--cc-dim)" }}>{done ? "✓" : ""}</span>
                <span style={{ color: done ? "var(--cc-ink)" : "var(--cc-soft)" }}>{WATCH_STATE_META[s].label}</span>
                {i === idx && typeof detail?.metric === "string" && (
                  <span className="ml-auto font-[family-name:var(--font-plex-mono)] text-[10.5px]" style={{ color: c }}>{detail.metric}</span>
                )}
              </div>
            );
          }) : (
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--cc-ink)", opacity: 0.85 }}>{watchStateLine(state, r.ticker || "this screen")}</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4 border-t pt-3" style={{ borderColor: "var(--cc-line)" }}>
        <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-dim)" }}>
          {r.last_checked_at ? freshnessLabel(r.last_checked_at) : "Queued"}
        </span>
        {r.ticker && (
          <Link href={`/research/${encodeURIComponent(r.ticker)}`} className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
            See what Kai found <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </Card>
  );
}

function DevelopingRow({ r, state, detail, current }: { r: AlertRule; state: WatchState; detail: WatchDetail; current: number | null }) {
  const meta = WATCH_STATE_META[state];
  const label = r.label || ruleLabel(r.kind, r.ticker, r.params);
  const c = toneColor(meta.tone);
  const progress = typeof detail?.progress === "number" ? Math.min(1, Math.max(0, detail.progress)) : 0;
  return (
    <Card className="p-3" style={{ borderLeft: `3px solid ${c}` }}>
      <div className="flex items-center gap-3">
        {r.ticker ? <TickerBadge symbol={r.ticker} size={30} /> : <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg" style={{ background: "color-mix(in srgb, var(--cc-blue) 12%, transparent)", color: "var(--cc-blue)" }}><Sparkles className="h-3.5 w-3.5" /></span>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px]" style={{ color: "var(--cc-ink)" }}>
            <span className="cc-display text-[13px]">{r.ticker ? `$${r.ticker}` : "Screen"}</span> · {label}
          </p>
          <p className="mt-0.5 truncate font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-soft)" }}>{watchStateLine(state, r.ticker || "this screen")}</p>
        </div>
        {current != null && <span className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[12px] font-semibold tabular-nums" style={{ color: "var(--cc-ink)" }}>{money(current)}</span>}
        <StatePill tone={meta.tone} label={meta.label} live={meta.live} />
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full" style={{ background: "var(--cc-card2)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.round(progress * 100)}%`, background: c }} />
      </div>
    </Card>
  );
}

/* ============================================================================
 * WATCHES — create hero + rules as compact setup rows + Notify me + plays.
 * ==========================================================================*/
const INTENTIONS = [
  { id: "price", label: "Price level", prompt: "Tell me if NVDA drops below $150" },
  { id: "momentum", label: "Momentum", prompt: "Ping me when AAPL gets oversold" },
  { id: "activity", label: "Unusual volume", prompt: "Watch TSLA for an unusual volume spike" },
  { id: "sentiment", label: "Club sentiment", prompt: "Tell me if the club turns bearish on PLTR" },
  { id: "news", label: "Big news", prompt: "Let me know if AMD has major news" },
];

function WatchesTab({
  userId, rules, setRules, stateByRule, detailByRule, isSolo, prefs, strategy, watchlistTickers, onOpenSheet,
}: {
  userId: string;
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
  stateByRule: Map<string, WatchState>;
  detailByRule: Map<string, WatchDetail>;
  isSolo: boolean;
  prefs: AlertPrefs;
  strategy: Props["strategy"];
  watchlistTickers: { ticker: string; company_name: string }[];
  onOpenSheet: (text?: string) => void;
}) {
  const activeCount = rules.filter((r) => r.active).length;

  const toggle = useCallback(async (r: AlertRule) => {
    const supabase = createClient();
    const next = !r.active;
    const { error } = await supabase.from("alert_rules").update({ active: next }).eq("id", r.id);
    if (!error) setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
  }, [setRules]);

  const remove = useCallback(async (r: AlertRule) => {
    const supabase = createClient();
    const { error } = await supabase.from("alert_rules").delete().eq("id", r.id);
    if (!error) setRules((rs) => rs.filter((x) => x.id !== r.id));
  }, [setRules]);

  return (
    <div className="space-y-6">
      <p className="max-w-lg text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
        Say it in plain English — a stock, a price, a moment you care about. Kai turns it into a watch
        and tells you the moment it happens.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {INTENTIONS.map((it) => (
          <button key={it.id} onClick={() => onOpenSheet(it.prompt)}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
            style={{ background: "var(--cc-card)", color: "var(--cc-soft)", border: "1px solid var(--cc-line)" }}>
            {it.label}
          </button>
        ))}
      </div>

      {watchlistTickers.length > 0 && (
        <WatchlistPlays userId={userId} watchlistTickers={watchlistTickers} rules={rules} setRules={setRules} />
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <KickerLabel>What Kai is watching</KickerLabel>
          <span className="font-[family-name:var(--font-plex-mono)] text-[10px] tabular-nums" style={{ color: "var(--cc-dim)" }}>{activeCount}/{MAX_ACTIVE_RULES} active</span>
        </div>
        {rules.length === 0 ? (
          <Card className="px-4 py-5">
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
              Nothing on watch yet. Hit <span className="font-semibold" style={{ color: "var(--cc-ink)" }}>New Kai Watch</span> above, or add one from any screener row, watchlist row or research page.
            </p>
          </Card>
        ) : (
          rules.map((r) => (
            <RuleRow key={r.id} r={r} state={r.active ? stateByRule.get(r.id) ?? null : null} detail={r.active ? detailByRule.get(r.id) ?? null : null} onToggle={() => toggle(r)} onRemove={() => remove(r)} />
          ))
        )}
      </section>

      <NotifyMe isSolo={isSolo} prefs={prefs} />
      <StrategyTuner userId={userId} strategy={strategy} rules={rules} setRules={setRules} />
    </div>
  );
}

function RuleRow({ r, state, detail, onToggle, onRemove }: {
  r: AlertRule; state: WatchState | null; detail: WatchDetail; onToggle: () => void; onRemove: () => void;
}) {
  const meta = state ? WATCH_STATE_META[state] : null;
  const condition = ruleLabel(r.kind, r.ticker, r.params);
  const headline = r.label || condition;
  const showCondition = condition && condition !== headline;
  const active = r.active;
  return (
    <Card className="p-3" style={{ opacity: active ? 1 : 0.6, borderLeft: meta && meta.tone !== "quiet" ? `3px solid ${toneColor(meta.tone)}` : undefined }}>
      <div className="flex items-start gap-3">
        {r.ticker ? <TickerBadge symbol={r.ticker} size={32} /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: "color-mix(in srgb, var(--cc-blue) 12%, transparent)", color: "var(--cc-blue)" }}><Sparkles className="h-4 w-4" /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="cc-display text-[14px]" style={{ color: "var(--cc-ink)" }}>{r.ticker ? `$${r.ticker}` : "Screen"}</span>
            <span className="font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-soft)" }}>{KIND_DIMENSION[r.kind]}</span>
            {meta && meta.tone !== "quiet" && <StatePill tone={meta.tone} label={meta.label} live={meta.live} />}
          </div>
          <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--cc-ink)", opacity: 0.85 }}>{headline}</p>
          {showCondition && <p className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[10.5px] leading-snug" style={{ color: "var(--cc-soft)" }}>Fires when {condition.toLowerCase()}</p>}
        </div>
        <button type="button" onClick={onToggle} title={active ? "Pause" : "Resume"} aria-label={active ? "Pause watch" : "Resume watch"}
          className="relative h-6 w-11 shrink-0 self-center rounded-full transition" style={{ background: active ? "var(--cc-blue)" : "var(--cc-card2)" }}>
          <span className="absolute top-0.5 h-5 w-5 rounded-full shadow transition-all" style={{ background: "var(--cc-card)", left: active ? 22 : 2 }} />
        </button>
        <button onClick={onRemove} title="Delete" aria-label="Delete watch" className="shrink-0 self-center p-0.5 transition" style={{ color: "var(--cc-dim)" }}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-2 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>
        {active ? "Watching" : "Paused"} · {r.last_checked_at ? freshnessLabel(r.last_checked_at).toLowerCase() : "queued"}
      </p>
    </Card>
  );
}

function NotifyMe({ isSolo, prefs }: { isSolo: boolean; prefs: AlertPrefs }) {
  const [briefing, setBriefing] = useState<boolean>(prefs.briefing_enabled ?? isSolo);
  const [digest, setDigest] = useState(prefs.digest);
  const [cap, setCap] = useState(prefs.daily_cap);
  const [quiet, setQuiet] = useState(prefs.quiet_hours);
  const [saved, setSaved] = useState(false);

  const save = useCallback(async (patch: Record<string, unknown>) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("alert_prefs").upsert({
      user_id: user.id,
      briefing_enabled: patch.briefing_enabled ?? briefing,
      digest: patch.digest ?? digest,
      daily_cap: patch.daily_cap ?? cap,
      quiet_hours: patch.quiet_hours ?? quiet,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [briefing, digest, cap, quiet]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <KickerLabel>Notify me</KickerLabel>
        {saved && <span className="inline-flex items-center gap-1 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-orange-ink)" }}><Check className="h-3.5 w-3.5" /> Saved</span>}
      </div>
      <div className="mt-3 space-y-3">
        <Switch label="Kai Daily push" hint={isSolo ? "On by default for Club members" : "Opt-in for family accounts"} checked={briefing} onChange={(v) => { setBriefing(v); save({ briefing_enabled: v }); }} />
        <Switch label="Send everything as a daily digest" hint="One summary push instead of instant alerts" checked={digest} onChange={(v) => { setDigest(v); save({ digest: v }); }} />
        <Switch label="Respect quiet hours" hint="Hold non-urgent updates overnight" checked={quiet} onChange={(v) => { setQuiet(v); save({ quiet_hours: v }); }} />
        <div className="flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--cc-line)" }}>
          <div>
            <p className="text-[12.5px] font-medium" style={{ color: "var(--cc-ink)" }}>Daily push limit</p>
            <p className="text-[11px]" style={{ color: "var(--cc-soft)" }}>Extra alerts roll into your digest</p>
          </div>
          <select value={cap} onChange={(e) => { const v = Number(e.target.value); setCap(v); save({ daily_cap: v }); }}
            className="rounded-full px-3 py-1.5 font-[family-name:var(--font-plex-mono)] text-[12px] font-semibold outline-none"
            style={{ background: "var(--cc-bg)", border: "1px solid var(--cc-line)", color: "var(--cc-ink)" }}>
            {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}/day</option>)}
          </select>
        </div>
      </div>
    </Card>
  );
}

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium" style={{ color: "var(--cc-ink)" }}>{label}</span>
        <span className="block text-[11px]" style={{ color: "var(--cc-soft)" }}>{hint}</span>
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className="relative h-[19px] w-[34px] shrink-0 rounded-full transition" style={{ background: checked ? "var(--cc-orange)" : "var(--cc-card2)" }}>
        <span className="absolute top-[2.5px] h-[14px] w-[14px] rounded-full shadow transition-all" style={{ background: checked ? "var(--cc-orange-deep)" : "var(--cc-soft)", left: checked ? 17 : 2.5 }} />
      </button>
    </label>
  );
}

const PLAY_META: Record<string, { title: string; line: (t: string) => string }> = {
  breakout: { title: "Breakout watch", line: (t) => `${t} reaches a new 52-week high` },
  oversold: { title: "Oversold bounce", line: (t) => `${t} RSI drops below 30 (oversold)` },
  momentum: { title: "Momentum surge", line: (t) => `${t} trades on 3×+ its average volume` },
  pullback: { title: "Pullback to trend", line: (t) => `${t} keeps closing above its 20-day average` },
};

function WatchlistPlays({ userId, watchlistTickers, rules, setRules }: {
  userId: string;
  watchlistTickers: { ticker: string; company_name: string }[];
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
}) {
  const [selected, setSelected] = useState<string>(watchlistTickers[0]?.ticker ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existing = useMemo(() => {
    const set = new Set<string>();
    for (const r of rules) if (r.ticker) set.add(`${r.ticker.toUpperCase()}:${r.kind}`);
    return set;
  }, [rules]);

  const create = useCallback(async (play: StrategyPlay) => {
    if (!selected) return;
    setBusy(play.id);
    setError(null);
    const supabase = createClient();
    const label = ruleLabel(play.kind, selected, play.params);
    const { data, error: err } = await supabase.from("alert_rules")
      .insert({ user_id: userId, kind: play.kind, ticker: selected, params: play.params, label, surface: "watchlist", active: true })
      .select("*").single();
    setBusy(null);
    if (err) {
      setError(/cap reached/i.test(err.message) ? `You've hit the ${MAX_ACTIVE_RULES}-watch limit. Pause one first.` : "Could not set that watch. Try again.");
      return;
    }
    if (data) setRules((rs) => [data as AlertRule, ...rs]);
  }, [selected, userId, setRules]);

  return (
    <Card className="p-4">
      <KickerLabel>Or attach a ready-made watch</KickerLabel>
      <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
        Pick a stock you follow and a play. Kai watches for that condition and tells you when it trips.
      </p>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {watchlistTickers.map((w) => {
          const on = selected === w.ticker;
          return (
            <button key={w.ticker} onClick={() => setSelected(w.ticker)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 font-[family-name:var(--font-plex-mono)] text-[11.5px] font-semibold transition"
              style={on
                ? { background: "color-mix(in srgb, var(--cc-blue) 12%, transparent)", color: "var(--cc-blue)", border: "1px solid color-mix(in srgb, var(--cc-blue) 40%, transparent)" }
                : { background: "var(--cc-card2)", color: "var(--cc-soft)", border: "1px solid var(--cc-line)" }}>
              <TickerBadge symbol={w.ticker} size={18} /> ${w.ticker}
            </button>
          );
        })}
      </div>
      <div className="mt-3 space-y-2">
        {STRATEGY_PLAYS.map((play) => {
          const pm = PLAY_META[play.id];
          const set = selected ? existing.has(`${selected}:${play.kind}`) : false;
          const isBusy = busy === play.id;
          return (
            <button key={play.id} disabled={set || isBusy || !selected} onClick={() => create(play)}
              className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-default"
              style={{ background: "var(--cc-bg)", borderColor: "var(--cc-line)" }}>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-bold" style={{ color: "var(--cc-ink)" }}>{pm.title}</span>
                <span className="block font-[family-name:var(--font-plex-mono)] text-[10px] leading-snug" style={{ color: "var(--cc-soft)" }}>Fires when {pm.line(selected || "it")}</span>
              </span>
              {set ? <span className="inline-flex shrink-0 items-center gap-1 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-soft)" }}><Check className="h-3.5 w-3.5" /> Set</span>
                : isBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "var(--cc-blue)" }} />
                : <Plus className="h-4 w-4 shrink-0" style={{ color: "var(--cc-dim)" }} />}
            </button>
          );
        })}
      </div>
      {error && <p role="status" className="mt-3 border-t pt-2.5 text-[12px] font-semibold" style={{ borderColor: "var(--cc-line)", color: "var(--cc-ink)" }}>{error}</p>}
    </Card>
  );
}

function StrategyTuner({ userId, strategy, rules, setRules }: {
  userId: string;
  strategy: Props["strategy"];
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2 text-[12.5px] font-bold" style={{ color: "var(--cc-ink)" }}>
          <SlidersHorizontal className="h-3.5 w-3.5" style={{ color: "var(--cc-orange-ink)" }} /> Tune what Kai suggests
        </span>
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} style={{ color: "var(--cc-soft)" }} />
      </button>
      {open && <StrategyTunerBody userId={userId} strategy={strategy} rules={rules} setRules={setRules} />}
    </Card>
  );
}

function StrategyTunerBody({ userId, strategy, rules, setRules }: {
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
      { onConflict: "user_id" });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [userId, timeframe, setups, risk]);

  const suggestions = useMemo(() => suggestedRulesFor({ timeframe, setup_prefs: setups, risk_posture: risk }), [timeframe, setups, risk]);
  const existingPresetIds = new Set(rules.filter((r) => r.kind === "preset_match").map((r) => (r.params as { presetId?: string }).presetId));

  const addSuggestion = useCallback(async (s: { presetId: string; presetLabel: string; label: string }) => {
    const supabase = createClient();
    const { data, error } = await supabase.from("alert_rules")
      .insert({ user_id: userId, kind: "preset_match", ticker: null, params: { presetId: s.presetId, presetLabel: s.presetLabel }, label: s.label, surface: "strategy", active: true })
      .select("*").single();
    if (!error && data) setRules((rs) => [data as AlertRule, ...rs]);
  }, [userId, setRules]);

  const Chip = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
    <button onClick={onClick} className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition"
      style={active ? { background: "color-mix(in srgb, var(--cc-orange) 12%, transparent)", color: "var(--cc-orange-ink)", border: "1px solid color-mix(in srgb, var(--cc-orange) 40%, transparent)" } : { background: "var(--cc-card2)", color: "var(--cc-soft)", border: "1px solid var(--cc-line)" }}>
      {label}
    </button>
  );

  return (
    <div className="mt-4 space-y-4 border-t pt-4" style={{ borderColor: "var(--cc-line)" }}>
      <p className="text-[12px] leading-snug" style={{ color: "var(--cc-soft)" }}>
        Tell Kai how you like to study the market and he&apos;ll suggest watches that fit — you stay in control of what gets created.
      </p>
      <div>
        <p className="cc-mono mb-2 !text-[9.5px] !tracking-[0.16em]" style={{ color: "var(--cc-soft)" }}>How long do you hold?</p>
        <div className="flex flex-wrap gap-2">{TIMEFRAME_OPTIONS.map((o) => <Chip key={o.id} active={timeframe === o.id} onClick={() => setTimeframe(o.id)} label={o.label} />)}</div>
      </div>
      <div>
        <p className="cc-mono mb-2 !text-[9.5px] !tracking-[0.16em]" style={{ color: "var(--cc-soft)" }}>What setups interest you?</p>
        <div className="flex flex-wrap gap-2">{SETUP_OPTIONS.map((o) => { const on = setups.includes(o.id); return <Chip key={o.id} active={on} onClick={() => setSetups((s) => on ? s.filter((x) => x !== o.id) : [...s, o.id])} label={o.label} />; })}</div>
      </div>
      <div>
        <p className="cc-mono mb-2 !text-[9.5px] !tracking-[0.16em]" style={{ color: "var(--cc-soft)" }}>Risk posture</p>
        <div className="flex flex-wrap gap-2">{RISK_OPTIONS.map((o) => <Chip key={o.id} active={risk === o.id} onClick={() => setRisk(o.id)} label={o.label} />)}</div>
      </div>
      <button onClick={save} className="w-full rounded-full py-2.5 text-[14px] font-bold" style={{ background: "var(--cc-card2)", color: "var(--cc-ink)", border: "1px solid var(--cc-line)" }}>{saved ? "Saved ✓" : "Save"}</button>
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <KickerLabel>Suggested watches for you</KickerLabel>
          {suggestions.map((s) => {
            const added = existingPresetIds.has(s.presetId);
            return (
              <div key={s.key} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ background: "var(--cc-bg)", borderColor: "var(--cc-line)" }}>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold" style={{ color: "var(--cc-ink)" }}>{s.label}</p>
                  <p className="text-[11px] leading-snug" style={{ color: "var(--cc-soft)" }}>{s.reason}</p>
                </div>
                {added ? <span className="inline-flex shrink-0 items-center gap-1 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-soft)" }}><Check className="h-3.5 w-3.5" /> Added</span>
                  : <button onClick={() => addSuggestion(s)} className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ color: "var(--cc-orange-ink)", border: "1px solid color-mix(in srgb, var(--cc-orange) 40%, transparent)" }}><Plus className="h-3.5 w-3.5" /> Add</button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * RECORD — honest split (graded W/L + observational follow-through).
 * ==========================================================================*/
function pctStr(n: number | null): string {
  return n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function RecordTab({ track, observational, sampleAlert }: {
  track: TrackRecord;
  observational: ObservationalRow[];
  sampleAlert: SampleAlert | null;
}) {
  const graded = track.total;
  const signals = graded + observational.length;
  const empty = signals === 0;
  const hit = track.hitRate;

  return (
    <div className="space-y-5">
      <Card className="p-4" style={{ boxShadow: "var(--cc-halo-soft)", borderColor: "color-mix(in srgb, var(--cc-orange) 30%, var(--cc-line))" }}>
        <Kicker tone="orange">Track record · last 30 days</Kicker>
        <div className="mt-3 flex items-center gap-4">
          <Ring value={(hit ?? 0) * 100} size={72} stroke={6} color={hit == null ? "var(--cc-dim)" : "var(--cc-up)"}>
            <span className="cc-display text-[14px]" style={{ color: "var(--cc-ink)" }}>{hit == null ? "—" : `${Math.round(hit * 100)}%`}</span>
          </Ring>
          <dl className="flex min-w-0 flex-1 flex-wrap items-end gap-x-7 gap-y-3">
            <Stat label="Signals" value={empty ? "—" : String(signals)} />
            <Stat label="Graded" value={graded === 0 ? "—" : String(graded)} />
            <Stat label="Avg peak" value={graded === 0 ? "—" : pctStr(track.avgPeak)} up />
            <Stat label="Best" value={graded === 0 ? "—" : pctStr(track.bestPeak)} up />
          </dl>
        </div>
        <p className="mt-3.5 border-t pt-3 text-[11.5px] leading-relaxed" style={{ borderColor: "var(--cc-line)", color: "var(--cc-soft)" }}>
          Kai Daily setups are graded by their peak move in their favour (worked = reached +5%). Personal watches show what happened after — never a win or a loss.
        </p>
      </Card>

      {empty ? (
        <Card className="px-4 py-5">
          <p className="flex items-center gap-2 cc-display text-[16px]" style={{ color: "var(--cc-ink)" }}>
            <Trophy className="h-4 w-4" style={{ color: "var(--cc-orange-ink)" }} aria-hidden /> The record starts soon
          </p>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            Once Kai&apos;s daily setups start going out, each one is tracked here by its peak favourable move — winners and misses in the open.
          </p>
          {sampleAlert && <p className="mt-2 max-w-md text-[12px]" style={{ color: "var(--cc-dim)" }}>See <span className="font-semibold" style={{ color: "var(--cc-ink)" }}>Alerts</span> for a sample of a tracked setup.</p>}
        </Card>
      ) : (
        <>
          {track.winners.length > 0 && <OutcomeSection title="Furthest ahead" outcomes={track.winners} rank />}
          {track.losers.length > 0 && <OutcomeSection title="Didn't work" outcomes={track.losers} />}
          {observational.length > 0 && <ObservationalCards rows={observational} />}
        </>
      )}

      <p className="text-[11px] leading-relaxed" style={{ color: "var(--cc-dim)" }}>
        Peak favourable move is educational performance tracking of past analysis, measured from a setup&apos;s issue price to its best subsequent close. Follow-through figures for personal watches are neutral price context, not graded outcomes. Past performance never guarantees future results.
      </p>
    </div>
  );
}

function Stat({ label, value, up }: { label: string; value: string; up?: boolean }) {
  const priced = up && value !== "—" && !value.startsWith("-");
  return (
    <div>
      <dt className="font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.16em]" style={{ color: "var(--cc-soft)" }}>{label}</dt>
      <dd className="mt-1 font-[family-name:var(--font-plex-mono)] text-[19px] font-semibold leading-none tabular-nums" style={{ color: priced ? "var(--cc-up)" : "var(--cc-ink)" }}>{value}</dd>
    </div>
  );
}

function OutcomeSection({ title, outcomes, rank = false }: { title: string; outcomes: AlertOutcome[]; rank?: boolean }) {
  return (
    <section className="space-y-2">
      <KickerLabel>{title}</KickerLabel>
      {outcomes.map((o, i) => {
        const up = (o.peakPct ?? 0) >= 0;
        return (
          <Link key={o.id} href={`/research/${encodeURIComponent(o.ticker)}`}
            className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors hover:border-[var(--cc-orange)]" style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}>
            {rank && <span className="w-5 shrink-0 text-center font-[family-name:var(--font-plex-mono)] text-[12px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>#{i + 1}</span>}
            <TickerBadge symbol={o.ticker} size={30} />
            <div className="min-w-0 flex-1">
              <span className="cc-display text-[13.5px]" style={{ color: "var(--cc-ink)" }}>${o.ticker}</span>
              {o.setup_label && <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--cc-soft)" }}>{o.setup_label}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-[family-name:var(--font-plex-mono)] text-[14px] font-semibold tabular-nums" style={{ color: up ? "var(--cc-up)" : "var(--cc-down)" }}>{pctStr(o.peakPct)}</p>
              <p className="font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>{o.daysToPeak != null ? `peak in ${o.daysToPeak}d` : "tracking…"}</p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

function ObservationalCards({ rows }: { rows: ObservationalRow[] }) {
  return (
    <section className="space-y-2">
      <KickerLabel>Your watches — what happened after</KickerLabel>
      <p className="max-w-lg text-[11.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
        Sentiment, activity and news watches have no set target, so they&apos;re never scored. This is neutral follow-through, not a result.
      </p>
      {rows.map((r) => (
        <Card key={r.id} className="p-3">
          <div className="flex items-center gap-3">
            <TickerBadge symbol={r.ticker} size={30} />
            <div className="min-w-0 flex-1">
              <p className="cc-display text-[13px]" style={{ color: "var(--cc-ink)" }}>${r.ticker}</p>
              <p className="truncate text-[11.5px]" style={{ color: "var(--cc-soft)" }}>{r.message}</p>
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
      <dt className="font-[family-name:var(--font-plex-mono)] text-[8.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-dim)" }}>{label}</dt>
      <dd className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[13px] font-bold tabular-nums" style={{ color: value == null ? "var(--cc-dim)" : up ? "var(--cc-up)" : "var(--cc-down)" }}>
        {value == null ? "—" : `${up ? "+" : ""}${value.toFixed(1)}%`}
      </dd>
    </div>
  );
}
