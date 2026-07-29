"use client";

/**
 * /alerts/e/[id] — ALERT · VIEW SETUP · v2 canvas (board 19). Rendered ONLY
 * behind designV2Enabled() (the server page branches to it after computing the
 * SAME reads the v1 screen uses). A re-skin, not a re-fetch: every value here is
 * handed down from the server component; the only client work is loading the real
 * price series for the ZoneChart and toggling the owning rule's own honest fields.
 *
 * HONEST-DATA DECISIONS:
 *   · The chart draws the REAL 3-month closes (same /api/market/bars source the
 *     v1 Sparkline uses) with dashed level lines for what the watch actually
 *     carries — the price it was flagged at, and (for a price-cross rule) the
 *     level it watches. A fired personal watch has NO graded entry/invalidation
 *     zones, so none are drawn — the tinted bands appear only when the entity
 *     genuinely carries them.
 *   · CONDITIONS is the real watch_states transition log (the sequence Kai
 *     walked, with its measured closeness metric), never three invented ticks.
 *   · NOTIFY ME toggles write the owning rule's REAL fields (active = armed,
 *     digest = instant-vs-digest); with no owning rule the card is omitted, not
 *     faked. The bottom bar's armed state is the rule's real `active`.
 *   · "Kai's read" is the server's DETERMINISTIC line (no LLM); hidden when null.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Activity, Loader2, Share2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchBars } from "@/lib/market/client";
import { Card, Kicker, Ring } from "@/components/cc/ui";
import { ZoneChart, type ZoneLevel } from "@/components/cc/interactive";
import {
  WATCH_STATE_META, SETUP_STATE_META, freshnessLabel, type StateTone,
} from "@/lib/alerts/watch-ui";
import type { WatchState } from "@/lib/alerts/watch-state";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";

export interface DetailV2Props {
  ticker: string;
  companyName: string;
  whatChanged: string;
  headline: string;
  firedAt: string;
  stateLabel: string | null;
  tone: StateTone;
  isLive: boolean;
  snap: number | null;
  perfPct: number | null;
  current: number | null;
  conditionLabel: string | null;
  firedCount: number;
  kaiRead: string | null;
  rule: { id: string; active: boolean; digest: boolean; kind: string; price: number | null } | null;
  timeline: { state: string; entered_at: string; detail: { progress?: number; metric?: string | null } }[];
  intel: {
    club_score: number | null; rank: number | null; watchers: number | null;
    sentiment_bullish: number | null; sentiment_neutral: number | null; sentiment_bearish: number | null;
    unusual_activity: boolean | null;
  } | null;
}

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function money0(n: number): string {
  return Math.round(n).toLocaleString();
}
function toneColor(t: StateTone): string {
  return t === "volt" ? "var(--cc-orange)" : t === "quiet" ? "var(--cc-soft)" : "var(--cc-blue)";
}

export default function AlertDetailV2(props: DetailV2Props) {
  const {
    ticker, companyName, whatChanged, headline, firedAt, stateLabel, tone, isLive,
    snap, perfPct, current, conditionLabel, firedCount, kaiRead, rule, timeline, intel,
  } = props;

  const [series, setSeries] = useState<number[] | undefined>(undefined);
  useEffect(() => {
    const ctrl = new AbortController();
    fetchBars(ticker, "3m", ctrl.signal)
      .then((b) => { if (!ctrl.signal.aborted && b.length >= 2) setSeries(b.map((x) => x.c)); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [ticker]);

  const levels: ZoneLevel[] = [];
  if (snap != null) levels.push({ price: snap, label: `FLAGGED ${money0(snap)}`, kind: "level" });
  if (rule?.kind === "price_cross" && rule.price != null) levels.push({ price: rule.price, label: `LEVEL ${money0(rule.price)}`, kind: "target" });

  const c = toneColor(tone);

  return (
    <div className="mx-auto w-full max-w-[680px] px-4 pb-28 pt-5 sm:px-6">
      {/* ── header row: back · title · sub · state (board 19) ─────────────── */}
      <div className="flex items-start gap-3">
        <Link href="/alerts" aria-label="Back to Kai Watch" className="mt-0.5 shrink-0 transition" style={{ color: "var(--cc-soft)" }}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="cc-display text-[19px] leading-tight" style={{ color: "var(--cc-ink)" }}>{whatChanged}</h1>
          <p className="mt-1 text-[10.5px]" style={{ color: "var(--cc-soft)" }}>{headline} · {freshnessLabel(firedAt).toLowerCase()}</p>
        </div>
        {stateLabel && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] font-bold uppercase tracking-[0.1em]"
            style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}>
            {isLive && <span className="cc-ping inline-block h-1.5 w-1.5 rounded-full" style={{ background: c }} />}
            {stateLabel}
          </span>
        )}
      </div>

      {/* ── the setup on the chart (board 19) ────────────────────────────── */}
      <Card className="mt-5 p-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <Kicker tone="soft">The move since Kai flagged it</Kicker>
          {current != null && (
            <span className="font-[family-name:var(--font-plex-mono)] text-[11px] tabular-nums" style={{ color: "var(--cc-ink)" }}>
              {money(current)}
              {perfPct != null && Math.abs(perfPct) >= 0.05 && (
                <span style={{ color: perfPct >= 0 ? "var(--cc-up)" : "var(--cc-down)" }}> {perfPct >= 0 ? "▲" : "▼"}{Math.abs(perfPct).toFixed(1)}%</span>
              )}
            </span>
          )}
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="cc-display text-[15px]" style={{ color: "var(--cc-ink)" }}>${ticker}</p>
            <p className="truncate text-[11px]" style={{ color: "var(--cc-soft)" }}>{companyName}</p>
          </div>
        </div>
        <div className="mt-3">
          <ZoneChart series={series} levels={levels} height={130} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {snap != null && <Chip label="Flagged at" value={money(snap)} />}
          {perfPct != null && <Chip label="Since" value={`${perfPct >= 0 ? "+" : ""}${perfPct.toFixed(1)}%`} tone={perfPct >= 0 ? "up" : "down"} />}
        </div>
      </Card>

      {/* ── why Kai alerted you ──────────────────────────────────────────── */}
      <Card className="mt-3 p-3.5">
        <Kicker tone="orange">{isLive ? "Why Kai alerted you · live" : "Why Kai alerted you"}</Kicker>
        <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: "var(--cc-ink)" }}>{whatChanged}</p>
        {conditionLabel && (
          <div className="mt-3 flex items-center gap-2.5 border-t pt-3" style={{ borderColor: "var(--cc-line)" }}>
            <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[9px]" style={{ background: `color-mix(in srgb, ${c} 20%, transparent)`, color: c }}>✓</span>
            <span className="flex-1 text-[12.5px]" style={{ color: "var(--cc-ink)" }}>{conditionLabel}</span>
            {snap != null && <span className="font-[family-name:var(--font-plex-mono)] text-[10px]" style={{ color: c }}>{money(snap)}</span>}
          </div>
        )}
        {firedCount > 1 && (
          <p className="mt-3 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-dim)" }}>This watch has fired {firedCount} times</p>
        )}
      </Card>

      {/* ── conditions · how it got here (board 19 checklist) ─────────────── */}
      {timeline.length > 1 && (
        <Card className="mt-3 p-3.5">
          <Kicker tone="orange">Conditions · {timeline.length} steps recorded</Kicker>
          <ol className="mt-3 space-y-3">
            {timeline.map((t, i) => {
              const m = WATCH_STATE_META[t.state as WatchState] ?? SETUP_STATE_META[t.state as SetupState];
              const isNow = i === 0;
              const tc = toneColor(m?.tone ?? "quiet");
              const done = !isNow;
              const prog = typeof t.detail?.progress === "number" ? Math.min(1, Math.max(0, t.detail.progress)) : null;
              return (
                <li key={`${t.entered_at}-${i}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[9px]" style={{ background: done ? `color-mix(in srgb, ${tc} 20%, transparent)` : "var(--cc-card2)", color: done ? tc : "var(--cc-dim)" }}>{done ? "✓" : "•"}</span>
                    <span className="flex-1 text-[12.5px]" style={{ color: "var(--cc-ink)" }}>{m?.label ?? t.state}</span>
                    <span className="font-[family-name:var(--font-plex-mono)] text-[10px]" style={{ color: "var(--cc-soft)" }}>
                      {new Date(t.entered_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  {(prog != null || typeof t.detail?.metric === "string") && (
                    <div className="ml-7 mt-1.5 flex items-center gap-2">
                      {prog != null && (
                        <span className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--cc-card2)" }}>
                          <span className="block h-full rounded-full" style={{ width: `${Math.round(prog * 100)}%`, background: tc }} />
                        </span>
                      )}
                      {typeof t.detail?.metric === "string" && <span className="font-[family-name:var(--font-plex-mono)] text-[10px]" style={{ color: tc }}>{t.detail.metric}</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 border-t pt-3 text-[11px] leading-relaxed" style={{ borderColor: "var(--cc-line)", color: "var(--cc-dim)" }}>
            Every step Kai recorded on this watch, newest first. Closeness is how far the condition had come at that moment — a measurement, never a likelihood.
          </p>
        </Card>
      )}

      {/* ── notify me (board 19) — real rule toggles ─────────────────────── */}
      {rule && <NotifyMe rule={rule} />}

      {/* ── Kai's read (deterministic; hidden when null) ─────────────────── */}
      {kaiRead && (
        <Card className="mt-3 p-3.5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: "var(--cc-blue)", color: "#fff" }}><Sparkles className="h-4 w-4" /></span>
            <div className="min-w-0">
              <Kicker tone="soft">Kai&apos;s read</Kicker>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--cc-ink)" }}>{kaiRead}</p>
              <p className="mt-2 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase leading-relaxed tracking-[0.14em]" style={{ color: "var(--cc-dim)" }}>An interpretation of what already happened — never a forecast.</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── the club ─────────────────────────────────────────────────────── */}
      {intel && (
        <Card className="mt-3 p-3.5">
          <Kicker tone="soft">The club on ${ticker}</Kicker>
          <dl className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-4">
            <ClubStat label="Club score" value={intel.club_score != null ? String(Math.round(Number(intel.club_score))) : "—"} />
            <ClubStat label="Watching" value={intel.watchers != null ? String(intel.watchers) : "—"} />
            <ClubStat label="Rank" value={intel.rank != null ? `#${intel.rank}` : "—"} />
          </dl>
          {(intel.sentiment_bullish != null || intel.sentiment_bearish != null) && (
            <SentimentSplit bull={Number(intel.sentiment_bullish ?? 0)} neutral={Number(intel.sentiment_neutral ?? 0)} bear={Number(intel.sentiment_bearish ?? 0)} />
          )}
          {intel.unusual_activity && (
            <p className="mt-4 inline-flex items-center gap-1.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-orange-ink)" }}><Activity className="h-3.5 w-3.5" /> Unusual activity</p>
          )}
          <Link href={`/research/${encodeURIComponent(ticker)}`} className="mt-4 block text-[12.5px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>See the full club view →</Link>
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--cc-dim)" }}>
            Club figures reflect member attention and sentiment — a measure of what the community is watching, not a recommendation.
          </p>
        </Card>
      )}

      <p className="mt-6 text-[11px] leading-relaxed" style={{ color: "var(--cc-dim)" }}>
        This is educational market analysis, not financial advice or a recommendation to buy or sell. Prices may be delayed. Past performance never guarantees future results.
      </p>

      <BottomBar rule={rule} ticker={ticker} shareText={`$${ticker} — ${whatChanged}`} />
    </div>
  );
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  const c = tone === "up" ? "var(--cc-up)" : tone === "down" ? "var(--cc-down)" : "var(--cc-ink)";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-[family-name:var(--font-plex-mono)] text-[11px]" style={{ background: "var(--cc-card2)", border: "1px solid var(--cc-line)" }}>
      <span className="uppercase tracking-[0.1em]" style={{ color: "var(--cc-soft)" }}>{label}</span>
      <span style={{ color: c }}>{value}</span>
    </span>
  );
}

function NotifyMe({ rule }: { rule: NonNullable<DetailV2Props["rule"]> }) {
  const [active, setActive] = useState(rule.active);
  const [instant, setInstant] = useState(!rule.digest);

  const setField = async (patch: { active?: boolean; digest?: boolean }) => {
    const supabase = createClient();
    await supabase.from("alert_rules").update(patch).eq("id", rule.id);
  };

  return (
    <Card className="mt-3 p-3.5">
      <Kicker tone="soft">Notify me</Kicker>
      <div className="mt-3 space-y-3">
        <Toggle label="Push the moment this watch triggers" checked={active} onChange={(v) => { setActive(v); setField({ active: v }); }} />
        <Toggle label="Send it instantly (off = roll into my daily digest)" checked={instant} onChange={(v) => { setInstant(v); setField({ digest: !v }); }} />
      </div>
    </Card>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <span className="flex-1 text-[12.5px]" style={{ color: checked ? "var(--cc-ink)" : "var(--cc-soft)" }}>{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className="relative h-[19px] w-[34px] shrink-0 rounded-full transition" style={{ background: checked ? "var(--cc-orange)" : "var(--cc-card2)" }}>
        <span className="absolute top-[2.5px] h-[14px] w-[14px] rounded-full shadow transition-all" style={{ background: checked ? "var(--cc-orange-deep)" : "var(--cc-soft)", left: checked ? 17 : 2.5 }} />
      </button>
    </label>
  );
}

function BottomBar({ rule, ticker, shareText }: { rule: DetailV2Props["rule"]; ticker: string; shareText: string }) {
  const [active, setActive] = useState(rule?.active ?? false);
  const [busy, setBusy] = useState(false);

  const toggleArmed = async () => {
    if (!rule || busy) return;
    setBusy(true);
    const next = !active;
    const supabase = createClient();
    const { error } = await supabase.from("alert_rules").update({ active: next }).eq("id", rule.id);
    setBusy(false);
    if (!error) setActive(next);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t" style={{ borderColor: "var(--cc-line)", background: "color-mix(in srgb, var(--cc-bg) 92%, transparent)", backdropFilter: "blur(8px)" }}>
      <div className="mx-auto flex w-full max-w-[680px] items-center gap-2.5 px-4 py-3 sm:px-6">
        {rule ? (
          <button onClick={toggleArmed} disabled={busy}
            className={`inline-flex flex-[1.4] items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-extrabold transition ${active ? "cc-halo" : ""}`}
            style={active ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" } : { background: "var(--cc-card2)", color: "var(--cc-ink)", border: "1px solid var(--cc-line)" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <Check className="h-4 w-4" /> : null}
            {active ? "Alert armed" : "Arm alert"}
          </button>
        ) : (
          <Link href={`/research/${encodeURIComponent(ticker)}`}
            className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-extrabold" style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}>
            Research ${ticker}
          </Link>
        )}
        <Link href={`/community?compose=${encodeURIComponent(shareText)}`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[13px] font-bold" style={{ background: "var(--cc-card2)", color: "var(--cc-ink)", border: "1px solid var(--cc-line)" }}>
          <Share2 className="h-4 w-4" /> Share
        </Link>
      </div>
    </div>
  );
}

function ClubStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--cc-soft)" }}>{label}</dt>
      <dd className="mt-1 font-[family-name:var(--font-plex-mono)] text-[20px] font-semibold tabular-nums" style={{ color: "var(--cc-ink)" }}>{value}</dd>
    </div>
  );
}

function SentimentSplit({ bull, neutral, bear }: { bull: number; neutral: number; bear: number }) {
  const total = bull + neutral + bear;
  if (total <= 0) return null;
  const pb = Math.round((bull / total) * 100);
  const pn = Math.round((neutral / total) * 100);
  const pbear = 100 - pb - pn;
  return (
    <div className="mt-5 max-w-[42ch]">
      <p className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--cc-soft)" }}>Club sentiment</p>
      <div className="mt-2 flex h-[3px] overflow-hidden rounded-full" style={{ background: "var(--cc-card2)" }}>
        <span className="h-full" style={{ width: `${pb}%`, background: "var(--cc-blue)" }} />
        <span className="h-full" style={{ width: `${pn}%`, background: "color-mix(in srgb, var(--cc-blue) 35%, transparent)" }} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 font-[family-name:var(--font-plex-mono)] text-[10.5px] uppercase tracking-[0.1em] tabular-nums">
        <span style={{ color: "var(--cc-blue)" }}>{pb}% bullish</span>
        <span style={{ color: "var(--cc-soft)" }}>{pn}% neutral</span>
        <span style={{ color: "var(--cc-soft)" }}>{pbear}% bearish</span>
      </p>
    </div>
  );
}
