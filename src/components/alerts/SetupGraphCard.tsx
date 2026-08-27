"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { StatePill } from "@/components/alerts/board";
import AlertLevelChart from "@/components/alerts/AlertLevelChart";
import { GlowPct, KaiVoice, money } from "@/components/alerts/poster";
import { SETUP_STATE_META, readSetupLevels, setupStateLine } from "@/lib/alerts/watch-ui";
import type { AlertSetup } from "@/lib/alerts/types";

/* ══════════════════════════════════════════════════════════════════════════
   SETUP POSTER — poster language WITH the full trade plan (owner correction
   2026-08-10: the first poster pass stripped the information out; the card
   was "practically empty". The aesthetic stays, the plan comes back).

   Poster kit kept: the glowing since-flagged % (GlowPct), Kai's voice as
   typography, the Entry → Target rail. Poster kit DROPPED after the visual
   pass on the family theme: the per-ticker hue zoo, the breathing radial,
   the hue-tinted card frame — the card frame is neutral; the chart takes
   the app's price colours off the real since-flagged move.

   Information restored:
     • the SMS-style marked-up chart (owner directive: the chart members
       know from the Kai SMS/MMS alerts) — real 1h CANDLES with labelled
       ENTRY / STOP / TARGET level lines and shaded risk/reward zones
       (AlertLevelChart, restored), honest loading / no-bars states;
     • the thesis — Kai's actual reason for the flag, as the KaiVoice line
       (state line fallback when no thesis is stored);
     • direction (long/short), Following, and the state pill;
     • the machine-recorded "2 of 3" condition ticks when the cron stored
       them (never fabricated);
     • distance-to-trigger measured from the live (delayed) price;
     • Flagged + Expires dates and the Open research link.

   The whole poster deep-links to the setup's story (/alerts/s/[id]) via a
   stretched link; Open research rides above it and keeps its destination.

   HONESTY LAW: every number is a stored number — a missing leg is a missing
   object; the % is only drawn when snapshot + current both exist; no bars =
   the stated mono line inside the chart band, never a fake curve.
   ══════════════════════════════════════════════════════════════════════════ */

const DIR_GLYPH: Record<string, string> = { long: "↑", short: "↓", watch: "•" };

export default function SetupGraphCard({
  s,
  current,
  hero = false,
  today = false,
}: {
  s: AlertSetup;
  current: number | null;
  /** TODAY'S THREE scale — bigger poster, bigger number, taller chart. */
  hero?: boolean;
  /** The small "TODAY" mono tag (owner ruling — today's plays are marked). */
  today?: boolean;
}) {
  const meta = SETUP_STATE_META[s.state];

  const L = readSetupLevels(s.levels);
  const entry = s.entry;
  const stop = L.stop ?? L.support;
  const target = L.resistance;

  const px = current ?? s.snapshot_price;
  const movePct =
    s.snapshot_price != null && s.snapshot_price > 0 && current != null
      ? ((current - s.snapshot_price) / s.snapshot_price) * 100
      : null;

  // A stored thesis is only spoken as Kai's quote when it reads like a
  // sentence — a bare tag like "BREAKOUT" is not a voice line.
  const rawThesis = s.thesis?.trim() ?? "";
  const speakableThesis =
    rawThesis.includes(" ") && /[a-z]/.test(rawThesis) ? rawThesis : null;

  // Machine-recorded conditions ("2 of 3") — rendered ONLY when present.
  const conditions = Array.isArray(s.detail?.conditions)
    ? (s.detail!.conditions as { label: string; met: boolean }[])
    : [];
  const metCount = conditions.filter((c) => c.met).length;

  const pad = hero ? "p-4" : "p-3.5";

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-sand bg-card transition hover:border-accent/45">
      {/* the whole poster opens the setup's story; Open research rides above */}
      <Link
        href={`/alerts/s/${encodeURIComponent(s.id)}`}
        aria-label={`Open the ${s.ticker} ${meta.label.toLowerCase()} alert`}
        className="f0-focus absolute inset-0 z-[1] rounded-[16px]"
      />

      <div className={`relative flex flex-col ${pad}`}>
        {/* identity · direction · state — the giant number top-right */}
        <div className="flex items-start gap-2.5">
          <CompanyLogo
            symbol={s.ticker}
            name={s.ticker}
            size={hero ? 32 : 26}
            rounded="rounded-[9px]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={`font-display font-extrabold leading-none tracking-tight text-ink ${
                  hero ? "text-[16px]" : "text-[13.5px]"
                }`}
              >
                ${s.ticker}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-paper px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-soft">
                <span aria-hidden>{DIR_GLYPH[s.direction] ?? DIR_GLYPH.watch}</span>
                {s.direction}
              </span>
              {today && (
                <span className="rounded-[6px] bg-gold-700/10 px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.16em] text-gold-700">
                  Today
                </span>
              )}
              {s.subscribed && (
                <span className="inline-flex items-center rounded-full bg-kai-500/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-kai-600">
                  Following
                </span>
              )}
              <StatePill tone={meta.tone} label={meta.label} live={meta.live} />
            </div>
            {px != null && (
              <p className="mt-1 font-mono text-[10.5px] font-medium leading-none tabular-nums text-soft">
                {money(px)}
              </p>
            )}
          </div>
          {movePct != null && (
            <div className="ml-auto shrink-0 pl-3 text-right">
              <GlowPct value={movePct} size={hero ? 34 : 26} />
              <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-soft/70">
                Since flagged
              </p>
            </div>
          )}
        </div>

        {/* Kai's reason for the flag — quoted ONLY when the stored thesis
            actually reads like a sentence; a raw tag ("BREAKOUT") falls back
            to the human state line, unquoted */}
        {speakableThesis ? (
          <KaiVoice
            size={hero ? "md" : "sm"}
            className={`mt-3 ${hero ? "line-clamp-3" : "line-clamp-2"}`}
          >
            {speakableThesis}
          </KaiVoice>
        ) : (
          <p className={`mt-3 text-ink/85 ${hero ? "text-[13px]" : "text-[12px]"} leading-[1.5]`}>
            {setupStateLine(s.state, s.ticker)}
          </p>
        )}

        {/* the SMS-style marked-up chart — 1h candles + labelled ENTRY/STOP/
            TARGET lines + shaded risk/reward zones, all from stored numbers */}
        <div className="mt-3">
          <AlertLevelChart
            symbol={s.ticker}
            entry={entry}
            stop={stop}
            target={target}
            tf="1h"
          />
        </div>

        {/* the machine-recorded conditions — the honest "2 of 3", ticks only
            when the cron genuinely stored them */}
        {conditions.length > 0 && (
          <div className="mt-3">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-soft/80">
              {metCount} of {conditions.length} conditions
            </p>
            <ul className="mt-1.5 space-y-1">
              {conditions.map((c) => (
                <li
                  key={c.label}
                  className={`flex items-center gap-1.5 text-[11.5px] leading-[1.35] ${
                    c.met ? "text-ink/90" : "text-soft"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`font-mono text-[10px] ${c.met ? "text-price-up" : "text-soft/60"}`}
                  >
                    {c.met ? "✓" : "○"}
                  </span>
                  {c.label}
                  <span className="sr-only">{c.met ? " — met" : " — not yet"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* distance to trigger — live price measured against the stored entry */}
        {meta.developing && entry != null && px != null && (
          <TriggerDistance entry={entry} stop={stop} current={px} direction={s.direction} />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-sand pt-2.5">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-soft/60">
            Flagged{" "}
            {new Date(s.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-soft/60">
            Expires{" "}
            {new Date(s.expires_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          <Link
            href={`/research/${encodeURIComponent(s.ticker)}`}
            className="relative z-[2] ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-gold-700 transition hover:text-gold-600"
          >
            Open research <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
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
