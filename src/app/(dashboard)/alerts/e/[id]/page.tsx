export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Activity, Users, TrendingUp, TrendingDown, Info, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClubTier } from "@/lib/tier";
import { deriveRegister } from "@/lib/register";
import CompanyLogo from "@/components/fic/CompanyLogo";
import Sparkline from "@/components/fic/Sparkline";
import DetailActions from "./DetailActions";
import type { AlertEvent, AlertRule } from "@/lib/alerts/types";
import type { WatchState } from "@/lib/alerts/watch-state";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";
import {
  WATCH_STATE_META,
  SETUP_STATE_META,
  watchStateLine,
  setupStateLine,
  toneClasses,
  freshnessLabel,
  type StateTone,
} from "@/lib/alerts/watch-ui";

/**
 * /alerts/e/[id] — the alert-detail STORY screen (Kai Watch, Lane B).
 *
 * Why Kai alerted you (the changed condition, with numbers) → a derived "Kai's
 * read" ONLY when it is computable without a language model (hidden otherwise —
 * no fake AI) → a compact price chart → The Club block (attention + sentiment
 * from the ticker intel snapshot) → actions. Member-gated + adults-only, same
 * posture as the hub; the event RLS scopes it to the viewer's own alerts.
 */
export default async function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track, family_id")
    .eq("id", user.id)
    .single();
  if (deriveRegister(profile) !== "adult") redirect("/dashboard");

  const tier = await getClubTier(supabase, profile?.family_id);
  if (tier === "free") redirect("/alerts");

  const { data: eventData } = await supabase
    .from("alert_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!eventData) notFound();
  const event = eventData as AlertEvent;

  const ticker = event.ticker;

  // Owning rule (for edit/mute + the human condition label). null for broadcast.
  let rule: AlertRule | null = null;
  if (event.rule_id) {
    const { data: r } = await supabase.from("alert_rules").select("*").eq("id", event.rule_id).maybeSingle();
    rule = (r as AlertRule | null) ?? null;
  }

  // Current price (perf-since context) — reuse nightly screener metrics, no API.
  const { data: mx } = await supabase
    .from("screener_metrics")
    .select("price, name")
    .eq("ticker", ticker)
    .maybeSingle();
  const current = (mx?.price as number | null) ?? null;
  const companyName = (mx?.name as string | null) ?? ticker;

  const snap = event.payload?.snapshot_price ?? null;
  const perfPct = snap != null && current != null && snap > 0 ? ((current - snap) / snap) * 100 : null;

  // State + tone.
  const isSetupUpdate = event.kind === "setup_update";
  const stateStr = event.payload?.state as string | undefined;
  const tone: StateTone = stateStr
    ? (isSetupUpdate
        ? SETUP_STATE_META[stateStr as SetupState]?.tone
        : WATCH_STATE_META[stateStr as WatchState]?.tone) ?? "quiet"
    : "quiet";
  const tc = toneClasses(tone);
  const isLive = stateStr
    ? (isSetupUpdate
        ? SETUP_STATE_META[stateStr as SetupState]?.live
        : WATCH_STATE_META[stateStr as WatchState]?.live) ?? false
    : false;

  const headline =
    event.kind === "kai_update"
      ? "Kai has an update"
      : event.kind === "setup_update"
        ? "Your followed setup moved"
        : "Kai alerted you";

  const whatChanged = event.payload?.message || "Kai flagged a change worth a look.";
  const conditionLabel = event.payload?.condition || (rule ? rule.label : null);

  // ── Kai's read — DETERMINISTIC only (no LLM). Built from the state machine +
  // measured perf. Hidden entirely when nothing honest can be said.
  const kaiRead = deriveKaiRead({
    kind: event.kind,
    ticker,
    stateStr,
    isSetupUpdate,
    perfPct,
  });

  // ── The Club block — attention + sentiment from the ticker intel snapshot.
  const { data: intel } = await supabase
    .from("ticker_intel_snapshots")
    .select(
      "club_score, rank, watchers, participants, sentiment_bullish, sentiment_neutral, sentiment_bearish, unusual_activity"
    )
    .eq("ticker", ticker)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link
        href="/alerts"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-soft transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Kai Watch
      </Link>

      {/* Header */}
      <div className={`overflow-hidden rounded-2xl p-5 ${tone === "quiet" ? "border border-sand bg-paper" : "club-field-pulse"}`}>
        <div className="flex items-center gap-3">
          <CompanyLogo symbol={ticker} name={companyName} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-display text-lg font-bold text-ink">{ticker}</span>
              {stateStr && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tc.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${tc.dot} ${isLive ? tc.glow : ""}`} />
                  {isSetupUpdate
                    ? SETUP_STATE_META[stateStr as SetupState]?.label
                    : WATCH_STATE_META[stateStr as WatchState]?.label}
                </span>
              )}
            </div>
            <p className="truncate text-[12px] text-soft">{companyName}</p>
          </div>
          {current != null && (
            <div className="text-right">
              <p className="text-[16px] font-bold tabular-nums text-ink">
                ${current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {perfPct != null && (
                <p className={`inline-flex items-center gap-0.5 text-[12px] font-bold tabular-nums ${perfPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {perfPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {perfPct >= 0 ? "+" : ""}
                  {perfPct.toFixed(1)}% since
                </p>
              )}
            </div>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-soft/70">
          {headline} · {freshnessLabel(event.fired_at)}
        </p>
      </div>

      {/* Why Kai alerted you */}
      <section className="mt-6">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft/70">
          {isLive ? <Zap className="h-3.5 w-3.5 text-volt-600" /> : <Info className="h-3.5 w-3.5" />} Why Kai alerted you
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">{whatChanged}</p>
        {conditionLabel && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="rounded-lg bg-sand/70 px-2 py-1 font-mono text-[11px] text-soft">{conditionLabel}</span>
            {snap != null && (
              <span className="text-soft/80">
                flagged near ${snap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        )}
      </section>

      {/* Kai's read — only when computable without an LLM */}
      {kaiRead && (
        <section className="mt-5">
          <div className="flex items-start gap-2.5 rounded-2xl bg-kai-blue-soft p-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-kai-blue text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-kai-blue">Kai&apos;s read</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink/85">{kaiRead}</p>
            </div>
          </div>
        </section>
      )}

      {/* Compact chart */}
      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-soft/70">Recent price</h2>
        <Sparkline symbol={ticker} height={90} />
      </section>

      {/* The Club */}
      {intel && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft/70">
            <Users className="h-3.5 w-3.5 text-teal-600" /> The Club on {ticker}
          </h2>
          <div className="club-field-teal rounded-2xl p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <ClubStat label="Club Score" value={intel.club_score != null ? String(Math.round(Number(intel.club_score))) : "—"} />
              <ClubStat label="Watching" value={intel.watchers != null ? String(intel.watchers) : "—"} />
              <ClubStat
                label="Rank"
                value={intel.rank != null ? `#${intel.rank}` : "—"}
              />
            </div>
            {(intel.sentiment_bullish != null || intel.sentiment_bearish != null) && (
              <SentimentSplit
                bull={Number(intel.sentiment_bullish ?? 0)}
                neutral={Number(intel.sentiment_neutral ?? 0)}
                bear={Number(intel.sentiment_bearish ?? 0)}
              />
            )}
            {intel.unusual_activity && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-volt-500/12 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-volt-700">
                <Activity className="h-3.5 w-3.5" /> Unusual activity
              </p>
            )}
            <Link
              href={`/research/${encodeURIComponent(ticker)}`}
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-teal-700 hover:underline"
            >
              See the full Club view →
            </Link>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-soft/70">
            Club figures reflect member attention and sentiment — a measure of what the community is
            watching, not a recommendation.
          </p>
        </section>
      )}

      {/* Actions */}
      <section className="mt-7">
        <DetailActions ruleId={event.rule_id} ticker={ticker} />
      </section>

      <p className="mt-8 border-t border-sand pt-4 text-center text-[11px] leading-relaxed text-soft/70">
        This is educational market analysis, not financial advice or a recommendation to buy or sell.
        Prices may be delayed. Past performance never guarantees future results.
      </p>
    </div>
  );
}

/* ── deterministic "Kai's read" (no LLM) ─────────────────────────────────── */
function deriveKaiRead({
  kind,
  ticker,
  stateStr,
  isSetupUpdate,
  perfPct,
}: {
  kind: AlertEvent["kind"];
  ticker: string;
  stateStr: string | undefined;
  isSetupUpdate: boolean;
  perfPct: number | null;
}): string | null {
  const parts: string[] = [];

  // State interpretation (templated, same voice as the machine copy).
  if (stateStr) {
    if (isSetupUpdate) {
      parts.push(setupStateLine(stateStr as SetupState, ticker));
    } else if (stateStr !== "watching") {
      parts.push(watchStateLine(stateStr as WatchState, ticker));
    }
  }

  // Measured follow-through — only when we actually have the number.
  if (perfPct != null) {
    const dir = perfPct >= 0 ? "up" : "down";
    parts.push(
      `Since Kai flagged it, ${ticker} is ${dir} ${Math.abs(perfPct).toFixed(1)}%.`
    );
  }

  if (parts.length === 0) return null;
  // Keep it honest and short — no invented thesis.
  return parts.join(" ");
}

function ClubStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-lg font-bold tabular-nums text-ink">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-soft/70">{label}</p>
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
    <div className="mt-3">
      <div className="flex h-2 overflow-hidden rounded-full bg-sand">
        <span className="h-full bg-emerald-500" style={{ width: `${pb}%` }} />
        <span className="h-full bg-soft/40" style={{ width: `${pn}%` }} />
        <span className="h-full bg-red-500" style={{ width: `${pbear}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-soft/70">
        <span className="text-emerald-600">{pb}% bullish</span>
        <span>{pn}% neutral</span>
        <span className="text-red-600">{pbear}% bearish</span>
      </div>
    </div>
  );
}
