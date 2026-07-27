"use client";

/**
 * ResearchObjectCard (SOCIAL OBJECTS S1) — the card renderer for a structured
 * thesis on feeds and ticker pages. A thesis is an OBJECT WITH IDENTITY (stance
 * rail + hook + author + horizon + live move), not a generic content card. Links
 * to the full object page. % move since publish is computed live from a passed
 * current price.
 *
 * ── CANVAS V2 (lane L2) ──────────────────────────────────────────────────────
 * Two colour-law repairs and one container repair:
 *   · the stance RAIL was bg-green-500 / bg-red-500 — the PRICE ramp standing in
 *     for an OPINION, one line above a real price move rendered in the same two
 *     colours. Stance is community sentiment, so the rail is the lime ramp and
 *     direction is carried by STANCE_META's ▲▼ mark and the word, never by hue.
 *   · the % move used text-green-600 / text-red-600, the raw ramp rather than the
 *     semantic price tokens; it is text-price-up / text-price-down now (and never
 *     with a `dark:` variant — those tokens flip themselves).
 *   · the object was wrapped in `rounded-2xl border bg-card` — a card container.
 *     It is a ledger row now: hairline-ruled, chrome-free, hierarchy from type.
 */

import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { timeAgo } from "@/lib/feed";
import { STANCE_META } from "@/lib/social/stance";
import {
  TIME_HORIZON_META,
  pctSincePublish,
  formatPctMove,
  type ResearchObjectCard as CardData,
} from "@/lib/social/research-object";

export default function ResearchObjectCard({
  obj,
  currentPrice,
  showTicker = false,
}: {
  obj: CardData;
  currentPrice?: number | null;
  showTicker?: boolean;
}) {
  const stance = STANCE_META[obj.stance];
  const pct = pctSincePublish(obj.price_at_publish, currentPrice);
  const moveTone = pct == null ? "text-soft" : pct >= 0 ? "text-price-up" : "text-price-down";

  return (
    <Link
      href={`/research/thesis/${obj.id}`}
      className="group f0-ledger-row f0-focus gap-3 transition-colors hover:bg-volt-500/[0.05]"
    >
      {/* The stance rail: lime when the author took a side, sand when they did
          not. Direction is the mark + the word beside it, so the rail survives
          greyscale and never competes with the price delta on the same row. */}
      <span className={`w-[3px] shrink-0 self-stretch rounded-full ${stance.dot}`} aria-hidden />
      <div className="min-w-0 flex-1 self-start">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <FileText className="h-3.5 w-3.5 shrink-0 text-gold-600" aria-hidden />
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${stance.chip}`}
          >
            <span aria-hidden>{stance.mark}</span>
            {stance.label}
          </span>
          {showTicker && (
            <span className="font-mono text-[11px] font-bold text-ink">
              {obj.ticker.toUpperCase()}
            </span>
          )}
          {obj.time_horizon && (
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-soft">
              {TIME_HORIZON_META[obj.time_horizon].label}
            </span>
          )}
          {pct != null && (
            <span className={`ml-auto font-mono text-[11px] font-bold tabular-nums ${moveTone}`}>
              {formatPctMove(pct)}
            </span>
          )}
        </div>

        <h3 className="mt-1.5 font-display text-[15px] font-bold leading-snug text-ink transition-colors group-hover:text-gold-700">
          {obj.headline}
        </h3>

        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-soft">
          <Avatar
            name={obj.author?.display_name}
            avatarUrl={obj.author?.avatar_url}
            role={obj.author?.role}
            size="xs"
          />
          <span className="font-semibold text-ink">{obj.author?.display_name || "Member"}</span>
          <AgeBadge role={obj.author?.role} ageGroup={obj.author?.age_group} />
          <span>· {timeAgo(obj.created_at)}</span>
          {obj.update_count > 0 && (
            <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-gold-700">
              {obj.update_count} update{obj.update_count === 1 ? "" : "s"}
            </span>
          )}
          <ArrowRight
            className="ml-auto h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        </div>
      </div>
    </Link>
  );
}
