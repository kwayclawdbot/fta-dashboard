"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { Card, StatePill, LifecycleBar } from "@/components/alerts/board";
import AlertLevelChart from "@/components/alerts/AlertLevelChart";
import { SETUP_STATE_META, readSetupLevels, setupStateLine } from "@/lib/alerts/watch-ui";
import type { AlertSetup } from "@/lib/alerts/types";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";

/* ══════════════════════════════════════════════════════════════════════════
   SETUP GRAPH CARD — the overview board's LIVE-SETUP object, graphically.

   Each live Kai Daily setup renders as one graphic card: real 1h CANDLES off
   the intraday tf feed (AlertLevelChart — the SMS-style marked-up plan:
   labelled ENTRY / STOP / TARGET level lines + shaded risk/reward zones),
   the lifecycle state chip + position bar, and a distance-to-trigger readout
   measured from the live (delayed) price against the stored entry.

   The card CLICKS THROUGH to the setup's own alert-detail page
   (/alerts/s/[id]) via a stretched link; the footer's "Open research" link
   keeps its original destination.

   HONESTY LAW: every line is a stored number — a missing leg is a missing
   line, never an invented one. No bars → a stated mono line, never a fake
   curve (all inside AlertLevelChart).
   ══════════════════════════════════════════════════════════════════════════ */

/** Fixed lifecycle positions (mirrors the setup ladder used across the hub). */
const SETUP_BAR: Record<SetupState, number> = {
  waiting: 18,
  confirmed: 78,
  triggered: 100,
  invalidated: 100,
  expired: 30,
};

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DIR_GLYPH: Record<string, string> = { long: "↑", short: "↓", watch: "•" };

export default function SetupGraphCard({
  s,
  current,
}: {
  s: AlertSetup;
  current: number | null;
}) {
  const meta = SETUP_STATE_META[s.state];
  const L = readSetupLevels(s.levels);
  const entry = s.entry;
  const stop = L.stop ?? L.support;
  const target = L.resistance;
  const px = current ?? s.snapshot_price;

  return (
    <Card className="relative rounded-[16px] transition hover:border-accent/45">
      {/* the whole card opens the setup's own alert-detail page; the research
          link below rides ABOVE this stretched layer and keeps working */}
      <Link
        href={`/alerts/s/${encodeURIComponent(s.id)}`}
        aria-label={`Open the ${s.ticker} ${meta.label.toLowerCase()} alert`}
        className="f0-focus absolute inset-0 z-[1] rounded-[16px]"
      />
      {/* identity row — logo · ticker · direction · following · state chip */}
      <div className="flex items-center gap-2.5">
        <CompanyLogo symbol={s.ticker} name={s.ticker} size={34} rounded="rounded-[10px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-[14px] font-extrabold leading-[1.15] tracking-tight text-ink">
              ${s.ticker}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-soft">
              <span aria-hidden>{DIR_GLYPH[s.direction] ?? DIR_GLYPH.watch}</span>
              {s.direction}
            </span>
            {s.subscribed && (
              <span className="inline-flex items-center rounded-full bg-kai-500/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-kai-600">
                Following
              </span>
            )}
          </div>
          {px != null && (
            <p className="mt-1 font-mono text-[11px] font-medium leading-none tabular-nums text-soft">
              {money(px)}
            </p>
          )}
        </div>
        <StatePill tone={meta.tone} label={meta.label} live={meta.live} />
      </div>

      {/* the SMS-style marked-up chart — 1h candles + ENTRY/STOP/TARGET lines
          + shaded risk/reward zones, all from stored numbers */}
      <div className="mt-3">
        <AlertLevelChart symbol={s.ticker} entry={entry} stop={stop} target={target} tf="1h" />
      </div>

      {/* lifecycle position — the house 5px bar */}
      <LifecycleBar
        className="mt-3"
        pct={SETUP_BAR[s.state]}
        tone={meta.tone}
        label={`Setup lifecycle: ${meta.label}`}
      />

      {/* distance to trigger — measured live price vs the stored entry */}
      {entry != null && px != null && (
        <TriggerDistance entry={entry} stop={stop} current={px} direction={s.direction} />
      )}

      <p className="mt-2.5 text-[12px] leading-[1.45] text-ink/85">
        {setupStateLine(s.state, s.ticker)}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-sand pt-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-soft/70">
          Expires{" "}
          {new Date(s.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
        <Link
          href={`/research/${encodeURIComponent(s.ticker)}`}
          className="relative z-[2] ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-gold-700 transition hover:text-gold-600"
        >
          Open research <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}

/* ── distance-to-trigger: live price measured against the stored entry ───── */
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

  // Position along the stop→entry approach leg (0 at stop, 1 at entry). The
  // ratio is direction-agnostic; only drawn when the stop leg is stored.
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
