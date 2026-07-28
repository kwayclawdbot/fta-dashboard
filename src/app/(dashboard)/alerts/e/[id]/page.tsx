export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClubTier } from "@/lib/tier";
import { deriveRegister } from "@/lib/register";
import CompanyLogo from "@/components/fic/CompanyLogo";
import Sparkline from "@/components/fic/Sparkline";
import ProximityMeter from "@/components/watch/ProximityMeter";
import {
  Card,
  StatePill,
  MetricChip,
  CondRow,
  Eyebrow as BoardEyebrow,
} from "@/components/alerts/board";
import DetailActions from "./DetailActions";
import type { AlertEvent, AlertRule } from "@/lib/alerts/types";
import type { WatchState } from "@/lib/alerts/watch-state";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";
import {
  WATCH_STATE_META,
  SETUP_STATE_META,
  watchStateLine,
  setupStateLine,
  freshnessLabel,
  type StateTone,
} from "@/lib/alerts/watch-ui";

/**
 * /alerts/e/[id] — the alert-detail screen. CANVAS BOARD 19.
 *
 * Board 19 is a stack of titled white cards under a plain header row: the back
 * arrow, the name of the thing, its sub-line and a state pill on the right —
 * then THE SETUP ON THE CHART, CONDITIONS, NOTIFY ME, a history strip, and a
 * two-button bar pinned to the bottom. That is what this builds. The obsidian
 * Kai field that used to open the screen is on no board and is gone.
 *
 * WHAT THE BOARD ASKS FOR THAT WE DO NOT HAVE: three named conditions with
 * ticks. A watch has no such triple — it has the machine's own transition log
 * (`watch_states`, written by the Lane-A cron since migration 157, with the
 * closeness and the measured metric at each step). So the CONDITIONS card draws
 * the real sequence Kai walked, ticked in order, and the board's checkmarks are
 * never invented for steps that did not happen.
 *
 * COPY LAW: Kai reports SIGNALS + INTERPRETATION. "Kai's read" stays strictly
 * DETERMINISTIC (no LLM) and is hidden entirely when nothing honest can be
 * derived — never an invented thesis, never a forecast.
 *
 * COMPLIANCE: both regulated strings — the club-figures line and the footer
 * disclaimer — are rendered VERBATIM, unchanged from the previous screen.
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
  // How this watch GOT here. `watch_states` is an append-only transition log the
  // Lane-A cron has been writing since migration 157 — every step, its measured
  // closeness and the metric behind it — and nothing in the app had ever read it
  // back. Canvas board 19 draws a conditions panel; this is the honest version
  // of that panel for the data we actually keep: not three invented checkboxes,
  // but the real sequence the machine walked, in order, with its own numbers.
  let timeline: {
    state: string;
    entered_at: string;
    detail: { progress?: number; metric?: string | null };
  }[] = [];
  // How many times this exact watch has fired before. A count of the member's
  // own events — never a hit rate, never a follow-through claim.
  let firedCount = 0;
  if (event.rule_id) {
    const [{ data: r }, { data: ts }, { count }] = await Promise.all([
      supabase.from("alert_rules").select("*").eq("id", event.rule_id).maybeSingle(),
      supabase
        .from("watch_states")
        .select("state, entered_at, detail")
        .eq("rule_id", event.rule_id)
        .order("entered_at", { ascending: false })
        .limit(8),
      supabase
        .from("alert_events")
        .select("id", { count: "exact", head: true })
        .eq("rule_id", event.rule_id)
        .eq("kind", "rule"),
    ]);
    rule = (r as AlertRule | null) ?? null;
    timeline = (ts || []) as typeof timeline;
    firedCount = count ?? 0;
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

  const stateLabel = stateStr
    ? isSetupUpdate
      ? SETUP_STATE_META[stateStr as SetupState]?.label
      : WATCH_STATE_META[stateStr as WatchState]?.label
    : null;

  return (
    <div className="mx-auto w-full max-w-[68ch] px-4 pb-28 pt-5 sm:px-6">
      {/* ── the board's header row: back · name · sub · state ───────────── */}
      <div className="flex items-start gap-3">
        <Link
          href="/alerts"
          aria-label="Back to Kai Watch"
          className="f0-focus mt-0.5 shrink-0 text-soft transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[17px] font-extrabold leading-snug tracking-tight text-ink">
            {whatChanged}
          </h1>
          <p className="mt-1 text-[10.5px] text-soft/85">
            {headline} · {freshnessLabel(event.fired_at).toLowerCase()}
          </p>
        </div>
        {stateLabel && (
          <span className="shrink-0">
            <StatePill tone={tone} label={stateLabel} live={isLive} />
          </span>
        )}
      </div>

      {/* ── THE MOVE SINCE KAI FLAGGED IT (board 19's chart card) ────────
          The board draws entry and invalidation bands on the chart. A fired
          personal watch has no graded entry zone — what it HAS is the price it
          was flagged at and what has happened since, so those are the two
          numbers the card carries, as chips beside the series. Nothing is drawn
          that we did not measure. */}
      <Card className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <BoardEyebrow>The move since Kai flagged it</BoardEyebrow>
          {current != null && (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink">
              {current.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              {perfPct != null && (
                <span className={perfPct >= 0 ? " text-price-up" : " text-price-down"}>
                  {" "}
                  {perfPct >= 0 ? "▲" : "▼"}
                  {Math.abs(perfPct).toFixed(1)}%
                </span>
              )}
            </span>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          <CompanyLogo symbol={ticker} name={companyName} size={34} rounded="rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-extrabold tracking-tight text-ink">
              ${ticker}
            </p>
            <p className="truncate text-[11px] text-soft/85">{companyName}</p>
          </div>
        </div>

        <div className="mt-3">
          <Sparkline symbol={ticker} height={104} />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {snap != null && (
            <MetricChip>
              <span className="uppercase tracking-[0.1em]">Flagged at</span>
              <span className="text-ink">
                {snap.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </MetricChip>
          )}
          {perfPct != null && (
            <MetricChip>
              <span className="uppercase tracking-[0.1em]">Since</span>
              <span className={perfPct >= 0 ? "text-price-up" : "text-price-down"}>
                {perfPct >= 0 ? "+" : ""}
                {perfPct.toFixed(1)}%
              </span>
            </MetricChip>
          )}
          {event.payload?.delayed && <MetricChip>delayed ~15m</MetricChip>}
        </div>
      </Card>

      {/* ── WHY KAI ALERTED YOU ──────────────────────────────────────────── */}
      <Card className="mt-3">
        <BoardEyebrow accent>
          {isLive ? "Why Kai alerted you · live" : "Why Kai alerted you"}
        </BoardEyebrow>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink">{whatChanged}</p>

        {conditionLabel && (
          <div className="mt-3 border-t border-sand pt-3">
            <CondRow
              met
              tone={tone}
              label={conditionLabel}
              value={
                snap != null
                  ? snap.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : null
              }
            />
          </div>
        )}

        {firedCount > 1 && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-soft/70">
            This watch has fired {firedCount} times
          </p>
        )}
      </Card>

      {/* ── CONDITIONS · how it got here (board 19's checklist card) ────── */}
      {timeline.length > 1 && (
        <Card className="mt-3">
          <BoardEyebrow accent>
            Conditions · {timeline.length} steps recorded
          </BoardEyebrow>
          <ol className="mt-3 space-y-3">
            {timeline.map((t, i) => {
              const m =
                WATCH_STATE_META[t.state as WatchState] ??
                SETUP_STATE_META[t.state as SetupState];
              const isNow = i === 0;
              return (
                <li key={`${t.entered_at}-${i}`}>
                  <div className="flex items-start gap-2.5">
                    <span className="min-w-0 flex-1">
                      <CondRow
                        met={!isNow}
                        tone={m?.tone ?? "quiet"}
                        label={m?.label ?? t.state}
                        value={new Date(t.entered_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      />
                      <ProximityMeter
                        className="ml-7 mt-1.5"
                        progress={t.detail?.progress}
                        tone={m?.tone ?? "quiet"}
                        label="Closeness then"
                        metric={typeof t.detail?.metric === "string" ? t.detail.metric : null}
                      />
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 border-t border-sand pt-3 text-[11px] leading-relaxed text-soft/70">
            Every step Kai recorded on this watch, newest first. Closeness is how
            far the condition had come at that moment — a measurement, never a
            likelihood.
          </p>
        </Card>
      )}

      {/* ── KAI'S READ — only when computable without an LLM ─────────────── */}
      {kaiRead && (
        <Card className="mt-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-kai-500 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <BoardEyebrow>Kai&apos;s read</BoardEyebrow>
              <p className="mt-2 text-[14px] leading-relaxed text-ink">{kaiRead}</p>
              <p className="mt-2 font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.14em] text-soft/60">
                An interpretation of what already happened — never a forecast.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── THE CLUB ─────────────────────────────────────────────────────── */}
      {intel && (
        <Card className="mt-3">
          <BoardEyebrow>The club on ${ticker}</BoardEyebrow>

          <dl className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-4">
            <ClubStat
              label="Club score"
              value={intel.club_score != null ? String(Math.round(Number(intel.club_score))) : "—"}
            />
            <ClubStat label="Watching" value={intel.watchers != null ? String(intel.watchers) : "—"} />
            <ClubStat label="Rank" value={intel.rank != null ? `#${intel.rank}` : "—"} />
          </dl>

          {(intel.sentiment_bullish != null || intel.sentiment_bearish != null) && (
            <SentimentSplit
              bull={Number(intel.sentiment_bullish ?? 0)}
              neutral={Number(intel.sentiment_neutral ?? 0)}
              bear={Number(intel.sentiment_bearish ?? 0)}
            />
          )}

          {intel.unusual_activity && (
            <p className="mt-4 inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-gold-700">
              <Activity className="h-3.5 w-3.5" /> Unusual activity
            </p>
          )}

          <Link
            href={`/research/${encodeURIComponent(ticker)}`}
            className="mt-4 block text-[12.5px] font-semibold text-gold-700 transition hover:text-gold-600"
          >
            See the full club view →
          </Link>

          <p className="mt-3 text-[11px] leading-relaxed text-soft/70">
            Club figures reflect member attention and sentiment — a measure of what the community is
            watching, not a recommendation.
          </p>
        </Card>
      )}

      <p className="mt-6 text-[11px] leading-relaxed text-soft/70">
        This is educational market analysis, not financial advice or a recommendation to buy or sell.
        Prices may be delayed. Past performance never guarantees future results.
      </p>

      {/* ── the board's pinned action bar ────────────────────────────────── */}
      <DetailActions ruleId={event.rule_id} ticker={ticker} />
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
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft/70">{label}</dt>
      <dd className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/**
 * Community sentiment — LIME by law, and lime ONLY. This used to render an
 * emerald/red split bar, which collided with the price move sitting a few
 * hundred pixels above it: two green/red readings on one screen meaning
 * completely different things. Conviction is now carried by how much of the
 * lime bar is lit; direction is carried by the words.
 */
function SentimentSplit({ bull, neutral, bear }: { bull: number; neutral: number; bear: number }) {
  const total = bull + neutral + bear;
  if (total <= 0) return null;
  const pb = Math.round((bull / total) * 100);
  const pn = Math.round((neutral / total) * 100);
  const pbear = 100 - pb - pn;
  return (
    <div className="mt-5 max-w-[42ch]">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft/70">
        Club sentiment
      </p>
      {/* Through the canonical sentiment tokens — the hand-written
          `dark:text-lime-400` pair was the same per-surface divergence the
          price tokens were introduced to end. */}
      <div className="mt-2 flex h-[3px] overflow-hidden rounded-full bg-sand">
        <span className="h-full bg-sentiment-fill" style={{ width: `${pb}%` }} />
        <span className="h-full bg-sentiment-fill/35" style={{ width: `${pn}%` }} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 font-mono text-[10.5px] uppercase tracking-[0.1em] tabular-nums">
        <span className="text-sentiment">{pb}% bullish</span>
        <span className="text-soft/70">{pn}% neutral</span>
        <span className="text-soft/70">{pbear}% bearish</span>
      </p>
    </div>
  );
}
