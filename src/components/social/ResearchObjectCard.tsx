"use client";

/**
 * ResearchObjectCard (SOCIAL OBJECTS S1) — the card renderer for a structured
 * thesis on feeds and ticker pages. A thesis is an OBJECT WITH IDENTITY (stance
 * rail + hook + author + horizon + live move), not a generic content card. Links
 * to the full object page. % move since publish is computed live from a passed
 * current price.
 */

import Link from "next/link";
import { FileText, TrendingUp, ArrowRight } from "lucide-react";
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

const RAIL: Record<string, string> = {
  bull: "bg-green-500",
  bear: "bg-red-500",
  neutral: "bg-soft",
};

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
  const moveTone = pct == null ? "text-soft" : pct >= 0 ? "text-green-600" : "text-red-600";

  return (
    <Link
      href={`/research/thesis/${obj.id}`}
      className="group flex items-stretch gap-3 rounded-2xl border border-sand bg-card p-3.5 transition-colors hover:border-gold-300"
    >
      <span className={`w-1 shrink-0 rounded-full ${RAIL[obj.stance] ?? "bg-soft"}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-gold-600" />
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${stance.chip}`}>
            {stance.label}
          </span>
          {showTicker && (
            <span className="font-mono text-[11px] font-bold text-ink">{obj.ticker.toUpperCase()}</span>
          )}
          {obj.time_horizon && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-soft">
              {TIME_HORIZON_META[obj.time_horizon].label}
            </span>
          )}
          {pct != null && (
            <span className={`ml-auto inline-flex items-center gap-1 font-mono text-[11px] font-bold tabular-nums ${moveTone}`}>
              <TrendingUp className="h-3 w-3" />
              {formatPctMove(pct)}
            </span>
          )}
        </div>

        <h3 className="mt-1.5 font-display text-[15px] font-bold leading-snug text-ink group-hover:text-gold-700">
          {obj.headline}
        </h3>

        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-soft">
          <Avatar name={obj.author?.display_name} avatarUrl={obj.author?.avatar_url} role={obj.author?.role} size="xs" />
          <span className="font-semibold text-ink">{obj.author?.display_name || "Member"}</span>
          <AgeBadge role={obj.author?.role} ageGroup={obj.author?.age_group} />
          <span>· {timeAgo(obj.created_at)}</span>
          {obj.update_count > 0 && (
            <span className="ml-1 rounded-full bg-chip-amber px-1.5 py-0.5 text-[10px] font-bold text-gold-800">
              {obj.update_count} update{obj.update_count === 1 ? "" : "s"}
            </span>
          )}
          <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  );
}
