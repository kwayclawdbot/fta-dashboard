"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { Card, StatePill, LifecycleBar } from "@/components/alerts/board";
import { SETUP_STATE_META, readSetupLevels, setupStateLine } from "@/lib/alerts/watch-ui";
import type { AlertSetup } from "@/lib/alerts/types";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";
import { fetchBars, type MarketBar } from "@/lib/market/client";

/* ══════════════════════════════════════════════════════════════════════════
   SETUP GRAPH CARD — the overview board's LIVE-SETUP object, graphically.

   Each live Kai Daily setup renders as one graphic card: the real one-month
   price series (the /api/market/bars daily-close path, the exact same feed
   the screener's expanded row draws) with the setup's STORED entry / stop /
   target levels drawn ON the chart as dashed level lines, the lifecycle
   state chip + position bar, and a distance-to-trigger readout measured from
   the live (delayed) price against the stored entry.

   HONESTY LAW: every line is a stored number — a missing leg is a missing
   line, never an invented one. No bars → a stated mono line, never a fake
   curve. The chart vocabulary (dotted grid horizontals, right price rail,
   session stamps, drift-coloured curve) is ClubStockHead / screener
   DetailChart's, copied not reinvented.
   ══════════════════════════════════════════════════════════════════════════ */

/** Fixed lifecycle positions (mirrors the setup ladder used across the hub). */
const SETUP_BAR: Record<SetupState, number> = {
  waiting: 18,
  confirmed: 78,
  triggered: 100,
  invalidated: 100,
  expired: 30,
};

/* On-expand month bars, deduplicated through a module promise cache so the
   same ticker never refetches across cards or revisits. */
const monthBarCache = new Map<string, Promise<MarketBar[]>>();

function loadMonthBars(symbol: string): Promise<MarketBar[]> {
  const key = symbol.toUpperCase();
  let p = monthBarCache.get(key);
  if (!p) {
    p = fetchBars(key, "1m").catch(() => []);
    monthBarCache.set(key, p);
  }
  return p;
}

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBound(v: number): string {
  return v >= 1000 ? v.toFixed(0) : v.toFixed(2);
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
    <Card className="rounded-[16px]">
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

      {/* the mini chart with the setup's stored levels drawn on it */}
      <div className="mt-3">
        <LevelChart symbol={s.ticker} entry={entry} stop={stop} target={target} />
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
          className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-gold-700 transition hover:text-gold-600"
        >
          Open research <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}

/* ── the chart itself: real 1m closes + dashed stored level lines ────────── */
function LevelChart({
  symbol,
  entry,
  stop,
  target,
}: {
  symbol: string;
  entry: number | null;
  stop: number | null;
  target: number | null;
}) {
  const gid = `sgc-${useId().replace(/:/g, "")}`;
  // null = still loading; [] = the feed had nothing for this window.
  const [bars, setBars] = useState<MarketBar[] | null>(null);

  useEffect(() => {
    let live = true;
    loadMonthBars(symbol).then((b) => {
      if (live) setBars(b);
    });
    return () => {
      live = false;
    };
  }, [symbol]);

  if (bars === null) {
    return (
      <div className="h-[128px] rounded-[12px] bg-sand/60 motion-safe:animate-pulse">
        <span className="sr-only">Loading the price series</span>
      </div>
    );
  }
  if (bars.length < 2) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        No price series for this window
      </p>
    );
  }

  const W = 332;
  const H = 120;
  const padY = 8;
  const closes = bars.map((b) => b.c);
  // y-domain includes the stored levels so every drawn line sits inside.
  let lo = Math.min(...closes);
  let hi = Math.max(...closes);
  for (const v of [entry, stop, target]) {
    if (v == null) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  const y = (v: number) => padY + (H - padY * 2) * (1 - (v - lo) / span);
  const n = bars.length;
  const step = W / n;

  const up = closes[closes.length - 1] >= closes[0];
  const stroke = up ? "var(--color-price-up)" : "var(--color-price-down)";

  const linePts = bars
    .map((b, i) => `${(i * step + step / 2).toFixed(1)},${y(b.c).toFixed(1)}`)
    .join(" ");
  const area = `${(step / 2).toFixed(1)},${H} ${linePts} ${(W - step / 2).toFixed(1)},${H}`;

  // The stored levels this setup genuinely carries — nothing else is drawn.
  const levels: { v: number; label: string; color: string; text: string }[] = [];
  if (entry != null)
    levels.push({ v: entry, label: "Entry", color: "var(--ink)", text: "text-ink" });
  if (stop != null)
    levels.push({ v: stop, label: "Stop", color: "var(--color-price-down)", text: "text-price-down" });
  if (target != null)
    levels.push({ v: target, label: "Target", color: "var(--color-price-up)", text: "text-price-up" });

  // The right-hand rail — four values off the drawn range, as the mockup rails.
  const axis = [hi, lo + (span * 2) / 3, lo + span / 3, lo];
  const stamp = (t: number) =>
    new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <>
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-[120px] w-full"
            role="img"
            aria-label={`${symbol.toUpperCase()} one-month price trend with the setup's entry, stop and target levels`}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* dotted grid — the mockup's faint horizontals */}
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1="0"
                x2={W}
                y1={padY + (H - padY * 2) * f}
                y2={padY + (H - padY * 2) * f}
                stroke="var(--color-sand)"
                strokeWidth="1"
                strokeDasharray="1 5"
              />
            ))}

            {/* the wash under the closes, then the line itself */}
            <polygon points={area} fill={`url(#${gid})`} />
            <polyline
              points={linePts}
              fill="none"
              stroke={stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* stored level lines — dashed, one per leg the setup carries */}
            {levels.map((l) => (
              <line
                key={l.label}
                x1="0"
                x2={W}
                y1={y(l.v)}
                y2={y(l.v)}
                stroke={l.color}
                strokeOpacity={l.label === "Entry" ? 0.55 : 0.75}
                strokeWidth="1.4"
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {/* level tags — HTML overlays so the text never distorts */}
          {levels.map((l) => {
            const topPct = (y(l.v) / H) * 100;
            return (
              <span
                key={l.label}
                aria-hidden
                className={`absolute left-1 -translate-y-1/2 rounded-[5px] bg-card/90 px-1 py-px font-mono text-[8.5px] font-semibold tabular-nums leading-[1.2] ${l.text}`}
                style={{ top: `${topPct}%` }}
              >
                {l.label} {money(l.v)}
              </span>
            );
          })}
        </div>

        {/* the price rail on the right, as drawn */}
        <div
          className="flex shrink-0 flex-col justify-between py-1 text-right font-mono text-[9.5px] tabular-nums text-soft"
          aria-hidden
        >
          {axis.map((v, i) => (
            <span key={i}>{fmtBound(v)}</span>
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex justify-between pr-9 font-mono text-[9.5px] tabular-nums text-soft">
        <span>{stamp(bars[0].t)}</span>
        <span>{stamp(bars[n - 1].t)}</span>
      </div>
    </>
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
