"use client";

/**
 * Club Newsroom cards + shared chips (LANE 10). Presentational only.
 * NewsCard is the feed card; KindChip / TickerChips / AiTag are reused by the
 * article page and the research-page "Club Newsroom" group.
 */

import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  AI_GENERATED_TAG,
  KIND_META,
  timeAgo,
  type NewsCardData,
  type NewsKind,
} from "@/lib/news/types";

export function KindChip({ kind }: { kind: NewsKind }) {
  const meta = KIND_META[kind];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.accent}`}
    >
      {meta.label}
    </span>
  );
}

export function AiTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium text-soft ${className}`}
      title="Written by AI from public market data. Educational, not advice."
    >
      <Sparkles className="h-3 w-3" />
      {AI_GENERATED_TAG}
    </span>
  );
}

/** Ticker pills — each links straight to its research page. */
export function TickerChips({
  tickers,
  max = 6,
}: {
  tickers: string[];
  max?: number;
}) {
  if (!tickers?.length) return null;
  const shown = tickers.slice(0, max);
  const extra = tickers.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((t) => (
        <Link
          key={t}
          href={`/research/${t}`}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md border border-sand bg-paper px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink transition-colors hover:border-gold-400 hover:text-gold-700"
        >
          {t}
        </Link>
      ))}
      {extra > 0 && <span className="text-[11px] text-soft">+{extra}</span>}
    </div>
  );
}

export default function NewsCard({ article }: { article: NewsCardData }) {
  return (
    <article className="group rounded-2xl border border-sand bg-card p-4 transition-shadow hover:shadow-soft sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <KindChip kind={article.kind} />
        <span className="text-[11px] text-soft">{timeAgo(article.generated_at)}</span>
      </div>
      <Link href={`/news/${article.slug}`} className="block">
        <h2 className="font-display text-base font-bold leading-snug text-ink transition-colors group-hover:text-gold-700 sm:text-lg">
          {article.title}
        </h2>
        {article.dek && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-soft">{article.dek}</p>
        )}
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <TickerChips tickers={article.tickers} />
        <AiTag />
      </div>
    </article>
  );
}
