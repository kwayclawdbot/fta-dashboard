"use client";

/**
 * Club Newsroom — editorial entry + shared type registers (canvas rebuild B).
 *
 * The newsroom is the one surface where the natural register is EDITORIAL, so
 * the feed is a ruled broadsheet, not a stack of cards: a desk line (which desk
 * filed it + when), a display headline, a dek at a reading measure, and the
 * story's tickers as $CASHTAGs. The only chrome is the hairline the parent
 * ledger draws between entries.
 *
 * COLOUR LAW: nothing here carries green/red (no price on a feed row), no lime
 * (no sentiment here) and no Kai blue. The single accent is the brand orange on
 * headline hover, via the `gold-*` ramp — which IS volt orange in club mode and
 * flips for dark, unlike the frozen `volt-*` ramp.
 *
 * KindChip is kept verbatim: the research page's "Club Newsroom" group imports
 * it and is another lane's surface.
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

/** Legacy chip — still the register used by /research/[ticker]. Unchanged. */
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

/** The AI provenance tag. Compliance copy — the string itself is never edited. */
export function AiTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-soft ${className}`}
      title="Written by AI from public market data. Educational, not advice."
    >
      <Sparkles className="h-3 w-3" />
      {AI_GENERATED_TAG}
    </span>
  );
}

/* ── Desk line ─────────────────────────────────────────────────────────────
   A newspaper's "who filed it, when" line. The desk name is the small-caps
   display register; the timestamp is mono because it is a reading of a clock,
   and every reading in this app is mono. */
export function Dateline({
  kind,
  at,
  className = "",
}: {
  kind: NewsKind;
  at: string | null | undefined;
  className?: string;
}) {
  const stamp = timeAgo(at);
  return (
    <p
      className={`flex flex-wrap items-baseline gap-x-2 text-eyebrow font-display font-bold uppercase text-soft ${className}`}
    >
      <span>{KIND_META[kind].label}</span>
      {stamp && (
        <>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <time className="font-mono tracking-[0.1em] normal-case">{stamp}</time>
        </>
      )}
    </p>
  );
}

/* ── Cashtags ──────────────────────────────────────────────────────────────
   The story's tickers, written the way the club writes them. Each one is the
   door to that name's research page. */
export function CashTags({
  tickers,
  max = 6,
  className = "",
}: {
  tickers: string[];
  max?: number;
  className?: string;
}) {
  if (!tickers?.length) return null;
  const shown = tickers.slice(0, max);
  const extra = tickers.length - shown.length;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      {shown.map((t) => (
        <Link
          key={t}
          href={`/research/${t}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[12px] font-semibold tracking-[0.02em] text-soft transition-colors hover:text-gold-700"
        >
          <span className="opacity-50">$</span>
          {t}
        </Link>
      ))}
      {extra > 0 && (
        <span className="font-mono text-[12px] text-soft opacity-60">+{extra}</span>
      )}
    </div>
  );
}

/* ── The entry ─────────────────────────────────────────────────────────────
   `lead` promotes the top story to the display-2 voice so the feed opens with
   one dominant headline instead of a column of identical rows — the thing a
   front page does and a card grid cannot. */
export default function NewsEntry({
  article,
  lead = false,
}: {
  article: NewsCardData;
  lead?: boolean;
}) {
  return (
    <article className="group py-6 first:pt-1">
      <Dateline kind={article.kind} at={article.generated_at} />
      <Link href={`/news/${article.slug}`} className="mt-2.5 block">
        <h2
          className={`font-display font-extrabold text-ink transition-colors group-hover:text-gold-700 ${
            lead
              ? "max-w-[22ch] text-display-2 sm:max-w-[24ch]"
              : "max-w-[34ch] text-display-3"
          }`}
        >
          {article.title}
        </h2>
        {article.dek && (
          <p
            className={`mt-2 max-w-[58ch] leading-relaxed text-soft ${
              lead ? "text-[16px]" : "line-clamp-2 text-[15px]"
            }`}
          >
            {article.dek}
          </p>
        )}
      </Link>
      {article.tickers.length > 0 && <CashTags tickers={article.tickers} className="mt-3" />}
    </article>
  );
}
