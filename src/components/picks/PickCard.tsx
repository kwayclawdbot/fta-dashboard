"use client";

import Link from "next/link";
import { Heart, MessageCircle, PlayCircle, Newspaper } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import Sparkline from "@/components/fic/Sparkline";
import {
  changeTone,
  formatChangePct,
  formatPrice,
  type MarketQuote,
} from "@/lib/market/client";
import {
  statusMeta,
  sincePickPercent,
  formatSincePct,
  formatPickedDate,
  type Pick,
} from "@/lib/picks";

/**
 * One Team Pick, in card format. Company logo + LIVE price (day change) + the
 * %-since-pick move + status chip + headline + engagement counts. Purely
 * presentational — the grid fetches the batched quote and counts and passes
 * them in. Clicking opens the deep-linkable detail route.
 */
export default function PickCard({
  pick,
  quote,
  likeCount,
  commentCount,
  liked,
}: {
  pick: Pick;
  quote: MarketQuote | null | undefined;
  likeCount: number;
  commentCount: number;
  liked: boolean;
}) {
  const meta = statusMeta(pick.status);
  const tone = changeTone(quote?.changePercent);
  const toneCls =
    tone === "up" ? "text-green-600" : tone === "down" ? "text-red-600" : "text-soft";

  const since = sincePickPercent(quote?.price, pick.picked_price);
  const sinceTone = changeTone(since);
  const sinceCls =
    sinceTone === "up"
      ? "bg-green-500/10 text-green-700"
      : sinceTone === "down"
        ? "bg-red-500/10 text-red-700"
        : "bg-paper text-soft";

  const hasVideo = !!(pick.video_kind && (pick.video_path || pick.video_kind !== "upload"));

  return (
    <Link
      href={`/picks/${pick.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-sand bg-midnight-900 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-lg"
    >
      {/* Header: logo + identity + status */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <CompanyLogo symbol={pick.ticker} name={pick.company_name} size={44} />
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-bold text-ink">
              {pick.company_name}
            </h3>
            <p className="font-mono text-xs text-soft">{pick.ticker}</p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider ${meta.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>

      {/* Live price row */}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-4">
        {quote?.price != null ? (
          <>
            <span className="font-display text-xl font-bold tabular-nums text-ink">
              {formatPrice(quote.price)}
            </span>
            {quote.changePercent != null && (
              <span className={`text-sm font-semibold tabular-nums ${toneCls}`}>
                {formatChangePct(quote.changePercent)} today
              </span>
            )}
            {since != null && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${sinceCls}`}
                title={`Move since we picked it at ${formatPrice(pick.picked_price)}`}
              >
                {formatSincePct(since)} since pick
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-soft">Live price loading…</span>
        )}
      </div>

      {/* Headline */}
      {pick.headline && (
        <p className="mt-2.5 line-clamp-2 px-4 font-body text-[13px] leading-snug text-midnight-200">
          {pick.headline}
        </p>
      )}

      {/* Sparkline */}
      <div className="mt-3 px-4">
        <Sparkline symbol={pick.ticker} height={52} />
      </div>

      {/* Footer: media hints + engagement + picked date */}
      <div className="mt-auto flex items-center justify-between gap-3 px-4 py-3 pt-3">
        <div className="flex items-center gap-3 text-soft">
          <span className="inline-flex items-center gap-1 text-xs">
            <Heart
              className={`h-3.5 w-3.5 ${liked ? "fill-red-500 text-red-500" : ""}`}
            />
            {likeCount}
          </span>
          <span className="inline-flex items-center gap-1 text-xs">
            <MessageCircle className="h-3.5 w-3.5" />
            {commentCount}
          </span>
          {hasVideo && <PlayCircle className="h-3.5 w-3.5 text-gold-600" />}
          {pick.article_links.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs">
              <Newspaper className="h-3.5 w-3.5" />
              {pick.article_links.length}
            </span>
          )}
        </div>
        <span className="text-[11px] text-soft">
          Picked {formatPickedDate(pick.picked_at)}
        </span>
      </div>
    </Link>
  );
}
