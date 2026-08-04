"use client";

import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Eye, LineChart, Sparkles, ChevronRight } from "lucide-react";
import Ticker from "@/components/ui/Ticker";
import PriceTrack from "@/components/alerts/PriceTrack";
import WatchSetupButton from "@/components/alerts/WatchSetupButton";
import SetAlertButton from "@/components/alerts/SetAlertButton";
import { StatePill, MetricChip, CondRow } from "@/components/alerts/board";
import { useKaiSheet } from "@/components/kai/KaiSheetProvider";
import type { TradeAlert, AlertEvent, AlertSetup } from "@/lib/alerts/types";
import {
  SETUP_STATE_META,
  setupStateLine,
  readSetupLevels,
  type StateTone,
} from "@/lib/alerts/watch-ui";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";

/**
 * PICK CARD — the plan-led Kai Watch pick, translated from the owner's canvas
 * (club-mockup v5) to the shipped Club light/dark system.
 *
 * Reads one `trade_alerts` row (+ its optional `alert_setups` lifecycle) and
 * lays it out as: identity + call → one-line plain-English read → THE PLAN as a
 * single integrated price track (PriceTrack) → reward-to-risk hero → the stake
 * as one sentence + fact pills → state row → actions (a primary state button and
 * two ghost buttons, "Open chart" and "Get context").
 *
 * HONESTY (inherited from board.tsx): the state word is the setup lifecycle's
 * own, never BUY/SELL; green/red is PRICE only; condition ticks light only from
 * the machine's recorded `detail.conditions`, never invented.
 */

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/** long/short/watch → the coloured call pill (price direction, per the canvas). */
function CallPill({ dir }: { dir: string }) {
  if (dir === "short") {
    return (
      <span
        className="flex shrink-0 items-center gap-1.5 rounded-[11px] px-3 py-2 text-[13px] font-extrabold uppercase tracking-[0.02em] text-white"
        style={{
          background: "linear-gradient(135deg, var(--color-price-down) 0%, color-mix(in srgb, var(--color-price-down) 78%, #000) 100%)",
          boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--color-price-down) 70%, transparent)",
        }}
      >
        <ArrowDownRight className="h-3.5 w-3.5" /> Short
      </span>
    );
  }
  if (dir === "watch") {
    return (
      <span
        className="flex shrink-0 items-center gap-1.5 rounded-[11px] px-3 py-2 text-[13px] font-extrabold uppercase tracking-[0.02em] text-white"
        style={{
          background: "linear-gradient(135deg, var(--color-teal-400) 0%, var(--color-teal-600) 100%)",
          boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--color-teal-500) 65%, transparent)",
        }}
      >
        <Eye className="h-3.5 w-3.5" /> Watch
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 rounded-[11px] px-3 py-2 text-[13px] font-extrabold uppercase tracking-[0.02em] text-white"
      style={{
        background: "linear-gradient(135deg, var(--color-price-up) 0%, color-mix(in srgb, var(--color-price-up) 78%, #000) 100%)",
        boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--color-price-up) 70%, transparent)",
      }}
    >
      <ArrowUpRight className="h-3.5 w-3.5" /> Long
    </span>
  );
}

/** The perf-since-issue delta, shown on the live line. */
function SinceIssued({ from, to }: { from: number | null; to: number | null }) {
  if (from == null || to == null || from <= 0) return null;
  const pct = ((to - from) / from) * 100;
  const up = pct >= 0;
  return (
    <span className={`font-semibold ${up ? "text-price-up" : "text-price-down"}`}>
      {up ? "+" : ""}
      {pct.toFixed(1)}% since issued
    </span>
  );
}

type DerivedState = { label: string; tone: StateTone; live: boolean; sub: string };

export default function PickCard({
  b,
  current,
  setup,
  thread,
  onSub,
  sample = false,
}: {
  b: TradeAlert;
  current: number | null;
  setup?: AlertSetup;
  thread?: AlertEvent[];
  onSub?: (setupId: string, subscribed: boolean) => void;
  /** A clearly-labelled example (built from real screener data), not a live pick. */
  sample?: boolean;
}) {
  const { openKai } = useKaiSheet();

  const L = readSetupLevels(b.levels);
  const live = current ?? b.snapshot_price ?? b.entry;
  const entry = b.entry ?? b.snapshot_price;
  const stop = L.stop ?? L.support;
  const target = b.targets?.[0]?.price ?? L.resistance;

  // The plan track needs three real, distinct price anchors.
  const canPlan =
    entry != null &&
    stop != null &&
    target != null &&
    live != null &&
    Number.isFinite(entry) &&
    Number.isFinite(stop) &&
    Number.isFinite(target) &&
    Math.abs(target - stop) > 1e-9;

  const risk = entry != null && stop != null ? Math.abs(entry - stop) : null;
  const reward = entry != null && target != null ? Math.abs(target - entry) : null;
  const rr = risk != null && reward != null && risk > 0 ? reward / risk : null;

  // State — the setup's own lifecycle word when we have it, otherwise a state
  // DERIVED from real numbers (live vs entry), never an invented verdict.
  const meta = setup ? SETUP_STATE_META[setup.state] : null;
  const derived: DerivedState = (() => {
    if (setup && meta) {
      return {
        label: meta.label,
        tone: meta.tone,
        live: meta.live,
        sub: setupStateLine(setup.state, b.ticker),
      };
    }
    if (b.direction === "watch" || entry == null || live == null) {
      return {
        label: "Watching",
        tone: "teal",
        live: true,
        sub: `Kai wants confirmation before this arms${entry != null ? ` — a push through ${money(entry)}` : ""}.`,
      };
    }
    const triggered = b.direction === "short" ? live <= entry : live >= entry;
    return triggered
      ? {
          label: "Triggered",
          tone: "volt",
          live: true,
          sub: `Price cleared the ${money(entry)} entry.`,
        }
      : {
          label: "Approaching",
          tone: "teal",
          live: true,
          sub: `Needs a ${b.direction === "short" ? "break under" : "close over"} ${money(entry)} to arm the entry.`,
        };
  })();
  const edgeColor = derived.tone === "teal" ? "var(--color-teal-600)" : "var(--color-volt-500)";

  // Machine-recorded conditions (e.g. "2 of 3") — rendered ONLY when present.
  const conditions = Array.isArray(setup?.detail?.conditions)
    ? (setup!.detail!.conditions as { label: string; met: boolean }[])
    : [];
  const metCount = conditions.filter((c) => c.met).length;

  const kaiQuery =
    `Walk me through the ${b.direction} setup on ${b.ticker}` +
    (b.setup_label ? ` (${b.setup_label})` : "") +
    `. ${entry != null ? `Entry ${money(entry)}, ` : ""}${stop != null ? `stop ${money(stop)}, ` : ""}${target != null ? `target ${money(target)}. ` : ""}` +
    `What has to happen, and what would tell me the read is wrong?`;

  return (
    <div
      className={`relative overflow-hidden rounded-[20px] border bg-card shadow-sm ${
        sample ? "border-dashed border-sand" : "border-sand"
      }`}
    >
      {/* at-a-glance state rail down the left edge */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: edgeColor }} />

      <div className="px-5 pb-5 pl-6 pt-5">
        {sample && (
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-kai-500/12 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-kai-600">
              Example
            </span>
            <span className="text-[11.5px] text-soft">What a live Kai pick looks like</span>
          </div>
        )}
        {/* 1 · IDENTITY + CALL */}
        <div className="flex items-center gap-3">
          <Ticker symbol={b.ticker} variant="logo-only" size="lg" href={`/research/${encodeURIComponent(b.ticker)}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              {/* Big hero symbol — identity carried by the logo tile beside it. */}
              <span className="font-display text-[21px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                {b.ticker}
              </span>
              {b.setup_label && (
                <span className="min-w-0 truncate text-[12px] font-medium text-soft">
                  {b.setup_label}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-soft">
              {live != null && (
                <span>
                  Live <span className="font-mono font-bold tabular-nums text-ink">{money(live)}</span>
                </span>
              )}
              <SinceIssued from={b.snapshot_price} to={current} />
            </div>
          </div>
          <CallPill dir={b.direction} />
        </div>

        {/* 2 · THE ONE-LINE READ */}
        {(b.setup_label || b.narrative) && (
          <p className="mt-4 text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink">
            {b.setup_label && b.narrative ? (
              <>
                <b className="font-bold text-gold-700">{b.setup_label}.</b> {b.narrative}
              </>
            ) : (
              b.narrative || b.setup_label
            )}
          </p>
        )}

        {/* 3 · THE PLAN — one integrated price track */}
        {canPlan ? (
          <div className="mt-5">
            <div className="mb-3 flex items-end justify-between">
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.11em] text-soft/80">
                {setup?.state === "waiting" || b.direction === "watch" ? "If it triggers" : "The plan"}
              </span>
              {rr != null && (
                <span className="flex items-baseline gap-1.5 text-[13px] font-extrabold tracking-[-0.02em] text-ink">
                  Reward to risk{" "}
                  <span className="text-[18px] text-price-up">{rr.toFixed(1)}:1</span>
                </span>
              )}
            </div>
            <PriceTrack stop={stop!} entry={entry!} live={live!} target={target!} direction={b.direction} />
          </div>
        ) : (
          // No full plan geometry — fall back to honest level chips.
          (entry != null || stop != null || target != null) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {entry != null && (
                <MetricChip>
                  <span className="uppercase tracking-[0.1em]">Entry</span>
                  <span className="text-ink">{money(entry)}</span>
                </MetricChip>
              )}
              {target != null && (
                <MetricChip>
                  <span className="uppercase tracking-[0.1em]">Target</span>
                  <span className="text-price-up">{money(target)}</span>
                </MetricChip>
              )}
              {stop != null && (
                <MetricChip>
                  <span className="uppercase tracking-[0.1em]">Stop</span>
                  <span className="text-price-down">{money(stop)}</span>
                </MetricChip>
              )}
            </div>
          )
        )}

        {/* 4 · THE STAKE — one sentence + fact pills */}
        {risk != null && reward != null && risk > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[13px] border border-sand bg-paper px-4 py-3">
            <p className="min-w-[180px] flex-1 text-[14px] font-semibold tracking-[-0.01em] text-ink">
              Risk <span className="font-extrabold text-price-down">${money(risk)}</span> to make{" "}
              <span className="font-extrabold text-price-up">${money(reward)}</span> a share.
            </p>
            <div className="flex items-center gap-2">
              {rr != null && (
                <span className="rounded-full border border-sand bg-card px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-ink">
                  {rr.toFixed(1)}:1
                </span>
              )}
              {b.targets?.[0]?.label && (
                <span className="rounded-full border border-sand bg-card px-2.5 py-1 text-[11px] font-semibold text-soft">
                  {b.targets[0].label}
                </span>
              )}
            </div>
          </div>
        )}

        {/* condition ticks — only when the machine recorded them */}
        {conditions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {conditions.map((c, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[10.5px] font-bold ${
                  c.met
                    ? "border-price-up/30 bg-price-up/10 text-price-up"
                    : "border-sand bg-paper text-soft"
                }`}
              >
                <span aria-hidden>{c.met ? "✓" : "○"}</span>
                {c.label}
              </span>
            ))}
          </div>
        )}

        {/* 5 · STATE ROW */}
        <div className="mt-4 flex items-center gap-2.5 border-t border-sand pt-4">
          <StatePill tone={derived.tone} label={derived.label} live={derived.live} />
          <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink/85">
            {conditions.length > 0 && (
              <span className="font-semibold text-ink">
                {metCount} of {conditions.length} conditions met.{" "}
              </span>
            )}
            <span className="text-soft">{derived.sub}</span>
          </p>
        </div>

        {/* ACTIONS — primary state button (follow/alert) + two ghost buttons */}
        {sample ? (
          <p className="mt-3 text-[11.5px] leading-relaxed text-soft/80">
            Built from today&apos;s real screener data — not a recommendation to buy or sell. Live
            picks arrive here with a Follow button.
          </p>
        ) : (
          <div className="mt-3">
            {setup ? (
              <WatchSetupButton
                setupId={setup.id}
                initialSubscribed={!!setup.subscribed}
                onChange={(sub) => onSub?.(setup.id, sub)}
              />
            ) : (
              <SetAlertButton ticker={b.ticker} surface="research" variant="full" />
            )}
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <Link
            href={`/chart?symbol=${encodeURIComponent(b.ticker)}`}
            className="f0-focus f0-press flex flex-1 items-center justify-center gap-2 rounded-[11px] border border-sand bg-card px-3 py-2.5 text-[12.5px] font-bold text-ink transition hover:border-accent/45 hover:bg-paper"
          >
            <LineChart className="h-[15px] w-[15px] text-soft" />
            Open chart
          </Link>
          <button
            type="button"
            onClick={() => openKai({ chip: b.ticker, query: kaiQuery })}
            className="f0-focus f0-press flex flex-1 items-center justify-center gap-2 rounded-[11px] border border-sand bg-card px-3 py-2.5 text-[12.5px] font-bold text-ink transition hover:border-accent/45 hover:bg-paper"
          >
            <Sparkles className="h-[15px] w-[15px] text-kai-600" />
            Get context
          </button>
        </div>

        {/* followed-setup lifecycle thread (opt-ins only) */}
        {!sample && setup?.subscribed && (
          <div className="mt-4 border-t border-sand pt-3">
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-kai-600">
              <Eye className="h-3.5 w-3.5" /> You&apos;re following this setup
            </p>
            {(thread ?? []).length === 0 ? (
              <p className="text-[12px] leading-snug text-soft">
                {setupStateLine(setup.state, b.ticker)} You&apos;ll get every step — confirmed,
                triggered or called off.
              </p>
            ) : (
              <ol className="space-y-2">
                {(thread ?? []).map((e) => {
                  const st = (e.payload?.state as SetupState) || "waiting";
                  const tm = SETUP_STATE_META[st];
                  return (
                    <li key={e.id}>
                      <CondRow
                        met
                        tone={tm?.tone ?? "quiet"}
                        label={e.payload?.message || setupStateLine(st, b.ticker)}
                        value={timeAgo(e.fired_at)}
                      />
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </div>

      {/* footer — the issued-at freshness, quietly */}
      <div className="flex items-center justify-between border-t border-sand px-6 py-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-soft/60">
          {sample ? "Example · today's data" : `Issued ${timeAgo(b.issued_at)}`}
        </span>
        <Link
          href={`/research/${encodeURIComponent(b.ticker)}`}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-gold-700 transition hover:text-gold-600"
        >
          Research {b.ticker} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
