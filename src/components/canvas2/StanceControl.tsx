"use client";

import SegmentedRail from "./Segmented";
import { SOCIAL_FLOORS } from "@/lib/social/reactions";
import type { Stance } from "@/lib/social/stance";

/* ══════════════════════════════════════════════════════════════════════════
   STANCE CONTROL — canvas v2 §1.2 (Club Screens 05 "What's your call on NVDA?").

   A member's stance on a ticker: Bearish / Neutral / Bullish. Bound to the
   EXISTING `Stance` union from @/lib/social/stance ("bear" | "neutral" | "bull")
   and therefore to ticker_stances / stance_events (migration 151) — this is a
   new presentation of a model that already ships, not a second stance system.

   ── COLOUR ────────────────────────────────────────────────────────────────
   The canvas fills the selected stance with GREEN (#1BA94C). That cannot ship:
   `green/red = PRICE only`. A green "Bullish" pill sitting one row above an
   actual price delta makes the two indistinguishable at a glance, which is the
   precise failure SentimentDots was rebuilt to fix.

   So the control is LIME-keyed — lime is community sentiment and nothing else.
   And because lime is ONE colour, direction cannot be carried by hue here:
     • DIRECTION is carried by the LABEL ("Bearish"/"Bullish") and by POSITION —
       the three cells are a left-to-right axis, so the reading order IS the
       direction. Colour never disambiguates it.
     • CONVICTION is carried by WEIGHT — the chosen cell goes ink-extrabold
       against soft neighbours, plus the lime bar.
   Strip the colour entirely and the control still reads correctly. That is the
   test it was built to pass.

   NOTE for the L2 lane: `STANCE_META` in src/lib/social/stance.ts still carries
   `bg-chip-green text-green-700` / `bg-red-500/12 text-red-600` chips, which is
   the same colour-law violation in the shared lib. Left in place deliberately —
   changing it re-renders three shipped surfaces (ChangedMyMind,
   ResearchObjectCard/Compose, ThesisObjectClient) and that belongs to the lane
   that owns those surfaces, not to the foundation. Use this control instead of
   `STANCE_META[s].chip` for any new selector.

   ── BELOW FLOOR ───────────────────────────────────────────────────────────
   Production is 9 tickers with 1–2 participants each. A club split rendered as
   "1 · 0 · 1" is not a signal, it is a fabricated one — so counts are withheld
   entirely under SOCIAL_FLOORS.debateStance and the control reads as a plain
   selector until there is a real split to show.
   ══════════════════════════════════════════════════════════════════════════ */

/** Left → right IS the direction axis. Do not reorder. */
const ORDER: Stance[] = ["bear", "neutral", "bull"];

const LABEL: Record<Stance, string> = {
  bear: "Bearish",
  neutral: "Neutral",
  bull: "Bullish",
};

export interface StanceControlProps {
  value: Stance | null;
  onChange: (s: Stance) => void;
  /** The club's split. Withheld under `floor` — see the file header. */
  counts?: Partial<Record<Stance, number>> | null;
  /** Total votes required before the split is shown. */
  floor?: number;
  disabled?: boolean;
  loading?: boolean;
  size?: "sm" | "md";
  /** Accessible name — "Your stance on NVDA" reads far better than "Stance". */
  ariaLabel?: string;
  /** Shown when nothing is chosen yet. Set to null to suppress. */
  emptyHint?: string | null;
  className?: string;
}

export default function StanceControl({
  value,
  onChange,
  counts,
  floor = SOCIAL_FLOORS.debateStance,
  disabled = false,
  loading = false,
  size = "md",
  ariaLabel = "Your stance",
  emptyHint = "Pick a stance. You can change it later — the Club rewards the update.",
  className = "",
}: StanceControlProps) {
  // ── LOADING — the rail's shape, no claim about what is selected ──────────
  if (loading) {
    return (
      <div className={className} aria-busy="true">
        <div className="flex border-b border-sand">
          {ORDER.map((s) => (
            <div key={s} className="flex-1 px-1 pb-3">
              <div className="mx-auto h-2.5 w-14 rounded-full bg-sand motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading stance</span>
      </div>
    );
  }

  const total = ORDER.reduce((n, s) => n + (counts?.[s] ?? 0), 0);
  const showSplit = !!counts && total >= floor;

  const options = ORDER.map((s) => ({
    id: s,
    label: LABEL[s],
    meta: showSplit ? (
      <span className="font-mono text-[10px] font-semibold tabular-nums text-lime-700 dark:text-lime-400">
        {Math.round(((counts?.[s] ?? 0) / total) * 100)}%
      </span>
    ) : undefined,
  }));

  return (
    <div className={className}>
      <SegmentedRail
        options={options}
        value={value}
        onChange={onChange}
        ariaLabel={ariaLabel}
        disabled={disabled}
        fill
        size={size}
        // Lime: community sentiment. Never the price ramp, never the volt ramp.
        barClassName="bg-lime-500"
        activeTextClassName="text-ink"
      />
      {!value && emptyHint && (
        <p className="mt-2 text-[12.5px] leading-snug text-soft">{emptyHint}</p>
      )}
      {showSplit && (
        <p className="mt-2 text-[11px] text-soft">
          <span className="font-semibold tabular-nums">{total.toLocaleString()}</span> members
          have taken a position.
        </p>
      )}
    </div>
  );
}
