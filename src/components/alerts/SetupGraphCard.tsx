"use client";

import Link from "next/link";
import CompanyLogo from "@/components/fic/CompanyLogo";
import AlertLevelChart from "@/components/alerts/AlertLevelChart";
import {
  GlowPct,
  KaiVoice,
  PlanRail,
  kaiSetupLine,
  money,
  tickerAccent,
} from "@/components/alerts/poster";
import { SETUP_STATE_META, readSetupLevels } from "@/lib/alerts/watch-ui";
import type { AlertSetup } from "@/lib/alerts/types";

/* ══════════════════════════════════════════════════════════════════════════
   SETUP POSTER — rebuilt 2026-08-10 on the owner-approved poster language
   (cheatcode-os ShareCard vocabulary on club tokens).

   The chart IS the card: the real 1-month close line drawn full-bleed as
   the card's own ground (AlertLevelChart "bg"), with the content floating
   ON it — logo + $TICKER top-left, ONE giant glowing move-% top-right
   (GlowPct, since-flagged, direction-coloured), Kai's one human line, and
   the plan as an Entry → Target rail with the stop beneath.

   NO state chips, NO lifecycle bars, NO distance meters — heat is glow: a
   live setup gets the per-ticker radial behind it breathing on a slow 3s
   cycle (.poster-breathe, motion-gated); quiet cards sit flat and dim.

   Two scales: `hero` (TODAY'S THREE) and quiet (the week's stack).
   The whole poster deep-links to the setup's story (/alerts/s/[id]).

   HONESTY LAW: the % is only drawn when snapshot + current both exist; a
   missing rail leg is a missing rail; no bars = no curve (the chart layer
   simply doesn't render).
   ══════════════════════════════════════════════════════════════════════════ */

export default function SetupGraphCard({
  s,
  current,
  hero = false,
  today = false,
}: {
  s: AlertSetup;
  current: number | null;
  /** TODAY'S THREE scale — bigger poster, bigger number. */
  hero?: boolean;
  /** The small "TODAY" mono tag (owner ruling — today's plays are marked). */
  today?: boolean;
}) {
  const meta = SETUP_STATE_META[s.state];
  const hue = tickerAccent(s.ticker);
  const live = meta.live;

  const L = readSetupLevels(s.levels);
  const entry = s.entry;
  const stop = L.stop ?? L.support;
  const target = L.resistance;

  const px = current ?? s.snapshot_price;
  const movePct =
    s.snapshot_price != null && s.snapshot_price > 0 && current != null
      ? ((current - s.snapshot_price) / s.snapshot_price) * 100
      : null;

  return (
    <Link
      href={`/alerts/s/${encodeURIComponent(s.id)}`}
      aria-label={`Open the ${s.ticker} ${meta.label.toLowerCase()} alert`}
      className={`f0-focus f0-press relative block overflow-hidden rounded-[16px] border bg-card transition ${
        live ? "" : "opacity-80"
      }`}
      style={{
        borderColor: live
          ? `color-mix(in srgb, ${hue} 38%, var(--sand))`
          : "var(--sand)",
        boxShadow: live
          ? `0 14px 44px -20px color-mix(in srgb, ${hue} 60%, transparent)`
          : undefined,
      }}
    >
      {/* heat by glow — the accent radial behind a live card, breathing */}
      {live && (
        <span
          aria-hidden
          className="poster-glow poster-breathe absolute -right-10 -top-16 h-48 w-48 rounded-full blur-3xl"
          style={{ background: hue }}
        />
      )}

      {/* the chart IS the card — full-bleed neon line as the ground */}
      <AlertLevelChart variant="bg" symbol={s.ticker} accent={hue} />

      <div
        className={`relative z-[1] flex flex-col ${hero ? "min-h-[212px] p-4" : "min-h-[150px] p-3.5"}`}
      >
        {/* identity floats top-left · the giant number top-right */}
        <div className="flex items-start gap-2.5">
          <CompanyLogo
            symbol={s.ticker}
            name={s.ticker}
            size={hero ? 32 : 26}
            rounded="rounded-[9px]"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-display font-extrabold leading-none tracking-tight text-ink ${
                  hero ? "text-[16px]" : "text-[13.5px]"
                }`}
              >
                ${s.ticker}
              </span>
              {today && (
                <span
                  className="rounded-[6px] px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.16em]"
                  style={{
                    background: `color-mix(in srgb, ${hue} 16%, var(--card))`,
                    color: hue,
                  }}
                >
                  Today
                </span>
              )}
            </div>
            {px != null && (
              <p className="mt-1 font-mono text-[10.5px] font-medium leading-none tabular-nums text-soft">
                {money(px)}
              </p>
            )}
          </div>
          <div className="ml-auto shrink-0 text-right">
            {movePct != null ? (
              <>
                <GlowPct value={movePct} size={hero ? 46 : 32} />
                <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-soft/70">
                  Since flagged
                </p>
              </>
            ) : null}
          </div>
        </div>

        {/* Kai's one human line — state as voice, never a chip */}
        <KaiVoice size={hero ? "md" : "sm"} className="mt-auto pt-4">
          {kaiSetupLine(s)}
        </KaiVoice>

        {/* the plan as a rail — only the legs this setup genuinely stores */}
        {entry != null && target != null && (
          <PlanRail
            className="mt-3"
            from={{ label: "Entry", value: entry }}
            to={{ label: "Target", value: target, color: "var(--color-price-up)" }}
            stop={stop}
            accent={hue}
          />
        )}

        <p className="mt-3 font-mono text-[8.5px] uppercase tracking-[0.14em] text-soft/60">
          Flagged{" "}
          {new Date(s.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
    </Link>
  );
}
