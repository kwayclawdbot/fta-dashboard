"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Eye, LineChart, Sparkles } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import KaiChatShared from "@/components/kai/KaiChatShared";
import AlertLevelChart, {
  ALERT_CHART_TFS,
  type AlertChartTf,
} from "@/components/alerts/AlertLevelChart";
import WatchSetupButton from "@/components/alerts/WatchSetupButton";
import {
  Card,
  CardLink,
  StatePill,
  StatGrid,
  MetricChip,
  CondRow,
  LifecycleBar,
  Eyebrow as BoardEyebrow,
} from "@/components/alerts/board";
import { SETUP_STATE_META, setupStateLine, readSetupLevels } from "@/lib/alerts/watch-ui";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";
import type { AlertEvent, AlertSetup, TradeAlert } from "@/lib/alerts/types";
import { formatMove, moveToneClass } from "@/lib/format-move";

/**
 * SETUP DETAIL — the client surface for /alerts/s/[id].
 *
 * A ticker-detail-style page for ONE alert_setups lifecycle object: masthead
 * (logo · $TICKER · name · direction · state chip), the big SMS-style
 * marked-up chart (AlertLevelChart hero: candles + labelled ENTRY/STOP/TARGET
 * lines + shaded risk/reward zones), the plan's StatGrid, distance-to-trigger
 * while the setup is live, Kai's stored thesis in the quoted kai-blue voice,
 * the HONEST lifecycle record (current state + entered-at + whatever
 * setup_update steps were really fanned out to this member — never a
 * reconstructed history), the owning briefing narrative when linked, related
 * feed events for the ticker, and an inline Ask-Kai section seeded with this
 * setup's exact context.
 *
 * COMPLIANCE: the footer disclaimer is rendered VERBATIM from the event
 * detail screen. Kai keeps all its own caps/meters/guardrails — the embed is
 * the real KaiChatShared panel, not a fork.
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

function stampDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const DIR_GLYPH: Record<string, string> = { long: "↑", short: "↓", watch: "•" };

export default function SetupDetailClient({
  setup,
  broadcast,
  current,
  companyName,
  thread,
  related,
}: {
  setup: AlertSetup;
  broadcast: TradeAlert | null;
  current: number | null;
  companyName: string;
  thread: AlertEvent[];
  related: AlertEvent[];
}) {
  const [tf, setTf] = useState<AlertChartTf>("1h");
  const [kaiOpen, setKaiOpen] = useState(false);
  const [kaiNonce, setKaiNonce] = useState(0);

  const meta = SETUP_STATE_META[setup.state];
  const L = readSetupLevels(setup.levels);
  const entry = setup.entry ?? broadcast?.entry ?? null;
  const stop = L.stop ?? L.support;
  const target = broadcast?.targets?.[0]?.price ?? L.resistance;
  const px = current ?? setup.snapshot_price;

  const risk = entry != null && stop != null ? Math.abs(entry - stop) : null;
  const reward = entry != null && target != null ? Math.abs(target - entry) : null;
  const rr = risk != null && reward != null && risk > 0 ? reward / risk : null;

  const snap = setup.snapshot_price;
  const perfPct =
    snap != null && current != null && snap > 0 ? ((current - snap) / snap) * 100 : null;

  // The setup is a LIVE, still-developing thing in these states — that is when
  // distance-to-trigger is a reading, not archaeology.
  const isLive = setup.state === "waiting" || setup.state === "confirmed";

  // Machine-recorded conditions ("2 of 3") — rendered ONLY when present.
  const conditions = Array.isArray(setup.detail?.conditions)
    ? (setup.detail!.conditions as { label: string; met: boolean }[])
    : [];
  const metCount = conditions.filter((c) => c.met).length;

  const stats: { k: string; v: string; tone?: "up" | "down" }[] = [
    ...(entry != null ? [{ k: "Entry", v: money(entry) }] : []),
    ...(stop != null ? [{ k: "Stop", v: money(stop), tone: "down" as const }] : []),
    ...(target != null ? [{ k: "Target", v: money(target), tone: "up" as const }] : []),
    ...(rr != null ? [{ k: "R:R", v: `${rr.toFixed(1)}:1` }] : []),
    ...(snap != null ? [{ k: "Flagged at", v: money(snap) }] : []),
    ...(perfPct != null
      ? [
          {
            k: "Since",
            v: `${perfPct >= 0 ? "+" : ""}${perfPct.toFixed(1)}%`,
            ...(Math.abs(perfPct) >= 0.05
              ? { tone: (perfPct >= 0 ? "up" : "down") as "up" | "down" }
              : {}),
          },
        ]
      : []),
  ];

  // The seeded Ask-Kai context — names THIS setup: ticker, state, levels.
  const kaiChip = `${setup.ticker} · ${meta.label} setup`;
  const kaiQuery =
    `Walk me through the ${setup.direction} setup on ${setup.ticker} — it's currently "${meta.label}". ` +
    `${entry != null ? `Entry ${money(entry)}, ` : ""}${stop != null ? `stop ${money(stop)}, ` : ""}${
      target != null ? `target ${money(target)}. ` : ""
    }` +
    `What has to happen next, and what would tell me the read is wrong?`;

  function openKaiInline() {
    setKaiNonce((n) => n + 1);
    setKaiOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-[68ch] px-4 pb-16 pt-5 sm:px-6">
      {/* ── MASTHEAD — back · logo · $TICKER · name · direction · state ──── */}
      <div className="flex items-center gap-3">
        <Link
          href="/alerts"
          aria-label="Back to Kai Watch"
          className="f0-focus shrink-0 text-soft transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <CompanyLogo symbol={setup.ticker} name={companyName} size={40} rounded="rounded-[12px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-display text-[20px] font-extrabold leading-none tracking-tight text-ink">
              ${setup.ticker}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-soft">
              <span aria-hidden>{DIR_GLYPH[setup.direction] ?? DIR_GLYPH.watch}</span>
              {setup.direction}
            </span>
          </div>
          <p className="mt-1 truncate text-[11.5px] text-soft/85">{companyName}</p>
        </div>
        <StatePill tone={meta.tone} label={meta.label} live={meta.live} />
      </div>

      {/* ── THE SETUP ON THE CHART — the SMS-style marked-up hero ────────── */}
      <Card className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <BoardEyebrow accent>The setup on the chart</BoardEyebrow>
          {px != null && (
            <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-ink">
              {money(px)}
              {perfPct != null && (
                <span className={` ${moveToneClass(perfPct)}`}> {formatMove(perfPct)}</span>
              )}
            </span>
          )}
        </div>

        {/* timeframe pills — 15M/1H candles off the tf feed, 1M daily line */}
        <div className="mt-3 flex gap-1.5" role="group" aria-label="Chart timeframe">
          {ALERT_CHART_TFS.map((t) => {
            const on = t.key === tf;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => setTf(t.key)}
                className={`f0-focus f0-press shrink-0 rounded-[10px] border px-3 py-1.5 font-mono text-[10.5px] font-semibold transition ${
                  on
                    ? "border-ink bg-ink text-paper"
                    : "border-sand bg-card text-soft hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <AlertLevelChart
            symbol={setup.ticker}
            entry={entry}
            stop={stop}
            target={target}
            tf={tf}
            size="hero"
          />
        </div>

        {stats.length > 0 && <StatGrid className="mt-3" stats={stats} />}

        {risk != null && reward != null && risk > 0 && (
          <p className="mt-3 text-[13px] font-semibold tracking-[-0.01em] text-ink">
            Risk <span className="font-mono font-bold tabular-nums text-price-down">${money(risk)}</span>{" "}
            to make{" "}
            <span className="font-mono font-bold tabular-nums text-price-up">${money(reward)}</span> a
            share.
          </p>
        )}

        <div className="mt-2.5">
          <MetricChip>delayed ~15m</MetricChip>
        </div>
      </Card>

      {/* ── DISTANCE TO TRIGGER — only while the setup is genuinely live ─── */}
      {isLive && entry != null && px != null && (
        <Card className="mt-3">
          <BoardEyebrow>Distance to trigger</BoardEyebrow>
          <TriggerDistance entry={entry} stop={stop} current={px} direction={setup.direction} />
        </Card>
      )}

      {/* ── KAI'S READ — the stored thesis, quoted; never invented ───────── */}
      <Card className="mt-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-kai-500 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <BoardEyebrow>Kai&apos;s read</BoardEyebrow>
            <p className="mt-2 text-[14px] leading-relaxed">
              <span className="text-kai-blue">
                &ldquo;{setup.thesis || setupStateLine(setup.state, setup.ticker)}&rdquo;
              </span>
            </p>
            {conditions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
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
            {conditions.length > 0 && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-soft/70">
                {metCount} of {conditions.length} conditions met
              </p>
            )}
            <p className="mt-2 font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.14em] text-soft/60">
              An interpretation of what already happened — never a forecast.
            </p>
          </div>
        </div>
      </Card>

      {/* ── LIFECYCLE — what the machine actually recorded ───────────────── */}
      <Card className="mt-3">
        <BoardEyebrow accent>Lifecycle</BoardEyebrow>
        <div className="mt-3">
          <LifecycleBar
            pct={SETUP_BAR[setup.state]}
            tone={meta.tone}
            label={`Setup lifecycle: ${meta.label}`}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-soft/80">
          <span>
            {meta.label} since{" "}
            <span className="tabular-nums text-ink/80">
              {new Date(setup.state_entered_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </span>
          <span>Opened {stampDate(setup.created_at)}</span>
          <span>Expires {stampDate(setup.expires_at)}</span>
        </div>

        {thread.length > 0 ? (
          <ol className="mt-3 space-y-2 border-t border-sand pt-3">
            {thread.map((e) => {
              const st = (e.payload?.state as SetupState) || setup.state;
              const tm = SETUP_STATE_META[st];
              return (
                <li key={e.id}>
                  <CondRow
                    met
                    tone={tm?.tone ?? "quiet"}
                    label={e.payload?.message || setupStateLine(st, setup.ticker)}
                    value={timeAgo(e.fired_at)}
                  />
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 border-t border-sand pt-3 text-[12px] leading-relaxed text-soft">
            Only the current state is recorded here. Follow the setup and every step —
            confirmed, triggered or called off — lands in your feed as it happens.
          </p>
        )}
      </Card>

      {/* ── THE BRIEFING CALL — the owning trade_alert's own words ───────── */}
      {broadcast && (broadcast.setup_label || broadcast.narrative) && (
        <Card className="mt-3">
          <BoardEyebrow>Kai&apos;s briefing call</BoardEyebrow>
          <p className="mt-2.5 font-display text-[14.5px] font-bold leading-[1.3] tracking-[-0.01em] text-ink">
            {broadcast.setup_label && broadcast.narrative ? (
              <>
                <b className="text-gold-700">{broadcast.setup_label}.</b> {broadcast.narrative}
              </>
            ) : (
              broadcast.narrative || broadcast.setup_label
            )}
          </p>
          {(broadcast.targets ?? []).some((t) => t.label) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {broadcast.targets.map(
                (t, i) =>
                  t.label && (
                    <span
                      key={i}
                      className="rounded-full border border-sand bg-paper px-2.5 py-1 font-mono text-[10px] tabular-nums text-soft"
                    >
                      {t.label} · {money(t.price)}
                    </span>
                  )
              )}
            </div>
          )}
          <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.12em] text-soft/70">
            Issued {timeAgo(broadcast.issued_at)}
          </p>
        </Card>
      )}

      {/* ── ACTIONS — follow the thread · chart · research ───────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <WatchSetupButton setupId={setup.id} initialSubscribed={!!setup.subscribed} />
        <Link
          href={`/chart?symbol=${encodeURIComponent(setup.ticker)}`}
          className="f0-focus f0-press inline-flex items-center gap-2 rounded-[11px] border border-sand bg-card px-3 py-2 text-[12.5px] font-bold text-ink transition hover:border-accent/45 hover:bg-paper"
        >
          <LineChart className="h-[15px] w-[15px] text-soft" />
          Open chart
        </Link>
        <Link
          href={`/research/${encodeURIComponent(setup.ticker)}`}
          className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-gold-700 transition hover:text-gold-600"
        >
          Research {setup.ticker} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── RELATED EVENTS on this ticker (this member's own feed) ───────── */}
      {related.length > 0 && (
        <section className="mt-6">
          <BoardEyebrow className="mb-2">More on ${setup.ticker}</BoardEyebrow>
          <div className="space-y-2">
            {related.map((e) => (
              <CardLink key={e.id} href={`/alerts/e/${encodeURIComponent(e.id)}`}>
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {e.payload?.message || "Kai flagged something"}
                    </span>
                    <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-soft/70">
                      {e.kind === "broadcast"
                        ? "Kai briefing"
                        : e.kind === "kai_update"
                          ? "Kai update"
                          : e.kind === "setup_update"
                            ? "Setup update"
                            : "Your alert"}{" "}
                      · {timeAgo(e.fired_at)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-soft/70" />
                </div>
              </CardLink>
            ))}
          </div>
        </section>
      )}

      {/* ── ASK KAI ABOUT THIS ALERT — the real chat, inline, seeded ─────── */}
      <section className="mt-7">
        <BoardEyebrow accent className="mb-2">
          Ask Kai about this alert
        </BoardEyebrow>
        {kaiOpen ? (
          <div className="h-[min(70vh,560px)] overflow-hidden rounded-[16px] border border-sand bg-card">
            <KaiChatShared
              variant="panel"
              onClose={() => setKaiOpen(false)}
              contextChip={kaiChip}
              initialInput={kaiQuery}
              contextNonce={kaiNonce}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={openKaiInline}
            className="f0-focus f0-press flex w-full items-center gap-3 rounded-[26px] border border-sand bg-card px-4 py-3 text-left shadow-soft transition hover:border-[color:var(--kai-blue)]"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-kai-blue" />
            <span className="min-w-0 flex-1 truncate text-[14px] text-soft">
              Ask Kai about the {setup.ticker} {meta.label.toLowerCase()} setup…
            </span>
            <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-soft/70">
              <Eye className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden />
              Kai sees this setup
            </span>
          </button>
        )}
      </section>

      <p className="mt-6 text-[11px] leading-relaxed text-soft/70">
        This is educational market analysis, not financial advice or a recommendation to buy or sell.
        Prices may be delayed. Past performance never guarantees future results.
      </p>
    </div>
  );
}

/** Fixed lifecycle positions (mirrors the setup ladder used across the hub). */
const SETUP_BAR: Record<SetupState, number> = {
  waiting: 18,
  confirmed: 78,
  triggered: 100,
  invalidated: 100,
  expired: 30,
};

/* ── distance-to-trigger: live price measured against the stored entry ─────
   (SetupGraphCard's readout, copied per the copy-small-patterns rule.) */
function TriggerDistance({
  entry,
  stop,
  current,
  direction,
}: {
  entry: number;
  stop: number | null;
  current: number;
  direction: string;
}) {
  const past = direction === "short" ? current <= entry : current >= entry;
  const dist = Math.abs(entry - current);
  const awayPct = current > 0 ? (dist / current) * 100 : 0;

  let pos: number | null = null;
  if (stop != null && stop !== entry) {
    pos = Math.max(0, Math.min(1, (current - stop) / (entry - stop)));
  }

  return (
    <div className="mt-2.5">
      {pos != null && (
        <div
          role="img"
          aria-label={
            past
              ? "Price is at or past the trigger level"
              : `Price is ${Math.round(pos * 100)} percent of the way from the stop to the trigger level`
          }
          className="h-[5px] overflow-hidden rounded-[3px] bg-sand"
        >
          <span
            aria-hidden
            className="block h-full rounded-[3px] bg-volt-500"
            style={{ width: `${(past ? 1 : pos) * 100}%` }}
          />
        </div>
      )}
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-soft/80">
        {past
          ? "At the trigger level"
          : `$${money(dist)} to trigger · ${awayPct.toFixed(1)}% away`}
      </p>
    </div>
  );
}
