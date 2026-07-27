export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Activity, Zap } from "lucide-react";
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
  freshnessLabel,
  type StateTone,
} from "@/lib/alerts/watch-ui";

/**
 * /alerts/e/[id] — the alert-detail STORY screen (Kai Watch, Lane B).
 *
 * CANVAS REBUILD: this is a piece of Kai's writing about one moment, so it is
 * built like one — Kai's identity leads, the thing that actually CHANGED is the
 * display headline (not a generic "Kai alerted you" label), and the body runs at
 * a real reading measure. The old screen stacked five rounded panels of equal
 * weight, so the reason for the alert carried no more authority than a chip.
 *
 * The one dark object is the Kai field at the top, tinted from the --color-kai-*
 * tokens: on a Kai surface, blue leads. Everything below is hairlines on cream.
 *
 * COPY LAW: Kai reports SIGNALS + INTERPRETATION. "Kai's read" stays strictly
 * DETERMINISTIC (no LLM) and is hidden entirely when nothing honest can be
 * derived — never an invented thesis, never a forecast.
 *
 * COMPLIANCE: both regulated strings — the club-figures line and the footer
 * disclaimer — are rendered VERBATIM, unchanged from the previous screen.
 */

/** Kai-blue text: #2563FF is heavy on near-black, so it steps up the ramp. */
const KAI_INK = "text-kai-600 dark:text-kai-300";

/** The Kai tint over `.f0-hero-field` — mixed from tokens, never a literal hex. */
const KAI_TINT: React.CSSProperties = {
  background: [
    "radial-gradient(118% 130% at 84% 2%, color-mix(in srgb, var(--color-kai-400) 52%, transparent) 0%, transparent 58%)",
    "radial-gradient(104% 124% at 2% 102%, color-mix(in srgb, var(--color-kai-600) 44%, transparent) 0%, transparent 62%)",
    "linear-gradient(155deg, color-mix(in srgb, var(--color-kai-700) 46%, transparent) 0%, transparent 72%)",
  ].join(", "),
};

/** State colours INSIDE the dark field — the light step of each ramp. */
function fieldTone(tone: StateTone): { text: string; dot: string } {
  switch (tone) {
    case "volt":
      return { text: "text-volt-300", dot: "bg-volt-400" };
    case "teal":
      return { text: "text-teal-300", dot: "bg-teal-400" };
    case "kai":
      return { text: "text-kai-300", dot: "bg-kai-400" };
    default:
      return { text: "opacity-60", dot: "bg-current opacity-40" };
  }
}

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
  const ft = fieldTone(tone);
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
    <div className="mx-auto w-full max-w-[72ch] px-4 pb-16 pt-5 sm:px-6">
      <Link
        href="/alerts"
        className="inline-flex items-center gap-1.5 font-mono text-eyebrow font-semibold uppercase text-soft transition hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kai Watch
      </Link>

      {/* ── The one dark object: Kai's own field ──────────────────────────── */}
      <header className="f0-hero-field f0-grain mt-4 px-5 py-7 sm:px-7">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-90 dark:opacity-100"
          style={KAI_TINT}
        />

        {/* attribution — Kai is the author of this page */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span aria-hidden className="relative flex h-2.5 w-2.5 items-center justify-center">
            {isLive && (
              <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-kai-400/50 motion-safe:animate-ping" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-kai-400" />
          </span>
          <span className="font-mono text-eyebrow font-semibold uppercase text-kai-300">
            {headline}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-55">
            {freshnessLabel(event.fired_at)}
          </span>
          {stateLabel && (
            <span
              className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] ${ft.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${ft.dot}`} />
              {stateLabel}
            </span>
          )}
        </div>

        {/* the display headline IS the thing that changed */}
        <h1 className="mt-3.5 max-w-[46ch] font-display text-display-2 font-extrabold leading-tight tracking-tight">
          {whatChanged}
        </h1>

        {/* the instrument line: which company, at what price */}
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
          <span className="flex items-center gap-2.5">
            <CompanyLogo symbol={ticker} name={companyName} size={34} rounded="rounded-lg" />
            <span className="min-w-0">
              <span className="block font-display text-[15px] font-extrabold tracking-tight">
                ${ticker}
              </span>
              <span className="block truncate text-[11.5px] opacity-60">{companyName}</span>
            </span>
          </span>

          {current != null && (
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] opacity-55">
                Now
              </span>
              <span className="mt-0.5 block font-mono text-[19px] font-semibold tabular-nums">
                {current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </span>
          )}

          {perfPct != null && (
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] opacity-55">
                Since Kai flagged it
              </span>
              <span
                className={`mt-0.5 block font-mono text-[19px] font-semibold tabular-nums ${
                  perfPct >= 0 ? "text-price-up" : "text-price-down"
                }`}
              >
                {perfPct >= 0 ? "+" : ""}
                {perfPct.toFixed(1)}%
              </span>
            </span>
          )}
        </div>
      </header>

      {/* ── Why Kai alerted you ───────────────────────────────────────────── */}
      <section className="mt-9">
        <div className="f0-section-rule">
          <span className="flex items-center gap-1.5 font-display text-eyebrow font-bold uppercase text-ink">
            {isLive && <Zap className="h-3.5 w-3.5 text-gold-700" />}
            Why Kai alerted you
          </span>
        </div>
        <p className="mt-3 max-w-[65ch] text-[15px] leading-relaxed text-ink">{whatChanged}</p>

        {conditionLabel && (
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft/70">
              Your condition
            </span>
            <span className="font-mono text-[12.5px] text-ink">{conditionLabel}</span>
            {snap != null && (
              <span className="font-mono text-[11.5px] tabular-nums text-soft/80">
                flagged near{" "}
                {snap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </p>
        )}
      </section>

      {/* ── Kai's read — only when computable without an LLM ───────────────── */}
      {kaiRead && (
        <section className="f0-rule-top mt-8 pt-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-kai-500 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className={`font-mono text-eyebrow font-semibold uppercase ${KAI_INK}`}>
                Kai&apos;s read
              </p>
              <p className="mt-2 max-w-[65ch] text-[15px] leading-relaxed text-ink">{kaiRead}</p>
              <p className="mt-2.5 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-soft/60">
                An interpretation of what already happened — never a forecast.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Recent price ──────────────────────────────────────────────────── */}
      <section className="mt-9">
        <div className="f0-section-rule">
          <span className="font-display text-eyebrow font-bold uppercase text-ink">
            Recent price
          </span>
        </div>
        <div className="mt-3">
          <Sparkline symbol={ticker} height={90} />
        </div>
      </section>

      {/* ── The Club ──────────────────────────────────────────────────────── */}
      {intel && (
        <section className="mt-9">
          <div className="f0-section-rule">
            <span className="font-display text-eyebrow font-bold uppercase text-ink">
              The club on ${ticker}
            </span>
          </div>

          <dl className="mt-4 flex flex-wrap items-end gap-x-9 gap-y-4">
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
            <p className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold-700">
              <Activity className="h-3.5 w-3.5" /> Unusual activity
            </p>
          )}

          <Link
            href={`/research/${encodeURIComponent(ticker)}`}
            className="mt-4 block text-[13px] font-semibold text-gold-700 transition hover:text-gold-600"
          >
            See the full club view →
          </Link>

          <p className="mt-3 max-w-[65ch] text-[11px] leading-relaxed text-soft/70">
            Club figures reflect member attention and sentiment — a measure of what the community is
            watching, not a recommendation.
          </p>
        </section>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <section className="f0-rule-top mt-9 pt-6">
        <DetailActions ruleId={event.rule_id} ticker={ticker} />
      </section>

      <p className="mt-10 max-w-[65ch] border-t border-sand pt-4 text-[11px] leading-relaxed text-soft/70">
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
      <div className="mt-2 flex h-[3px] overflow-hidden rounded-full bg-sand">
        <span className="h-full bg-lime-500" style={{ width: `${pb}%` }} />
        <span className="h-full bg-lime-500/35" style={{ width: `${pn}%` }} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 font-mono text-[10.5px] uppercase tracking-[0.1em] tabular-nums">
        <span className="text-lime-700 dark:text-lime-400">{pb}% bullish</span>
        <span className="text-soft/70">{pn}% neutral</span>
        <span className="text-soft/70">{pbear}% bearish</span>
      </p>
    </div>
  );
}
