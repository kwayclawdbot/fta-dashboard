"use client";

/**
 * CLUB NEWSROOM — the story object, in the mockup's card language.
 *
 * The mockup canvas has no dedicated newsroom board, so this surface is built
 * from the vocabulary the boards DO draw: white rounded cards on the warm-sand
 * page (`BoardCard`), orange mono section marks, pill tabs, and the warm
 * gradient feature card board 01 uses for "TODAY IN 30 SECONDS"
 * (`linear-gradient(140deg,#FFE9D6 0%,#FFFFFF 62%)` over a #FFD3A8 hairline) —
 * which is exactly the shape a lead story wants.
 *
 * The previous pass drew this as a ruled broadsheet with no cards at all. That
 * is gone: the lead is the board's warm feature card, every following story is
 * a white card, and the only hairlines left are the ones inside a card.
 *
 * COLOUR LAW: the newsroom carries no price, no sentiment and no Kai, so its
 * only accent is brand orange — via `gold-*`, which is volt orange in club mode
 * and flips for the dark twin (frozen `volt-*` does not).
 *
 * KindChip is kept verbatim: /research/[ticker]'s "Club Newsroom" group imports
 * it and that is another lane's surface.
 */

import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  AI_GENERATED_TAG,
  KIND_META,
  type NewsCardData,
  type NewsKind,
} from "@/lib/news/types";
import { BoardCard } from "@/components/discover/board";
import { timeAgoAt, useNowHour } from "@/components/discover/clock";

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
   Which desk filed it, and when. The desk name takes the board's orange mono
   section-mark register; the timestamp is mono because every reading of a clock
   in this app is mono.

   The stamp comes from the HOUR-BUCKETED store, so nothing here calls
   `Date.now()` during render. Before the store primes there is no stamp and the
   line simply renders the desk — never a guessed "just now". */
export function Dateline({
  kind,
  at,
  className = "",
}: {
  kind: NewsKind;
  at: string | null | undefined;
  className?: string;
}) {
  const now = useNowHour();
  const stamp = timeAgoAt(at, now);
  return (
    <p
      className={`flex flex-wrap items-baseline gap-x-2 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-gold-700 ${className}`}
    >
      <span>{KIND_META[kind].label}</span>
      {stamp && (
        <>
          <span aria-hidden className="text-soft opacity-50">
            ·
          </span>
          <time className="font-normal normal-case tracking-[0.1em] text-soft">
            {stamp}
          </time>
        </>
      )}
    </p>
  );
}

/* ── Cashtags ──────────────────────────────────────────────────────────────
   The story's tickers as the board writes them: quiet outlined chips, each the
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
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {shown.map((t) => (
        <Link
          key={t}
          href={`/research/${t}`}
          onClick={(e) => e.stopPropagation()}
          className="f0-focus inline-flex items-center rounded-full border border-sand bg-card px-2.5 py-[4px] font-mono text-[10.5px] font-semibold text-ink transition-colors hover:border-accent hover:text-gold-700"
        >
          <span className="text-soft">$</span>
          {t}
        </Link>
      ))}
      {extra > 0 && (
        <span className="font-mono text-[10.5px] text-soft">+{extra}</span>
      )}
    </div>
  );
}

/* ── The entry ─────────────────────────────────────────────────────────────
   `lead` promotes the top story to board 01's warm FEATURE CARD — the same
   gradient, hairline and radius the canvas uses for its one dominant card on a
   screen — so the column opens with a single loud object instead of a run of
   identical rows. Everything after it is a plain white card. */
export default function NewsEntry({
  article,
  lead = false,
}: {
  article: NewsCardData;
  lead?: boolean;
}) {
  const body = (
    <>
      <Dateline kind={article.kind} at={article.generated_at} />
      <h2
        className={`mt-2 font-display font-extrabold leading-[1.15] tracking-[-0.02em] text-ink transition-colors group-hover:text-gold-700 ${
          lead ? "max-w-[24ch] text-[21px]" : "max-w-[34ch] text-[16px]"
        }`}
      >
        {article.title}
      </h2>
      {article.dek && (
        <p
          className={`mt-1.5 max-w-[58ch] leading-relaxed text-soft ${
            lead ? "text-[13px]" : "line-clamp-2 text-[12px]"
          }`}
        >
          {article.dek}
        </p>
      )}
    </>
  );

  if (lead) {
    return (
      <article className="group">
        <div
          className="rounded-[18px] border px-[15px] py-[14px]"
          style={{
            borderColor: "color-mix(in srgb, var(--accent-solid) 34%, transparent)",
            background:
              "linear-gradient(140deg, color-mix(in srgb, var(--accent-solid) 14%, var(--card)) 0%, var(--card) 62%)",
          }}
        >
          <Link href={`/news/${article.slug}`} className="f0-focus block rounded-lg">
            {body}
          </Link>
          {article.tickers.length > 0 && (
            <CashTags tickers={article.tickers} className="mt-3" />
          )}
        </div>
      </article>
    );
  }

  return (
    <BoardCard
      as="article"
      radius={16}
      className="group px-[15px] py-[14px] transition-colors hover:border-accent"
    >
      <Link href={`/news/${article.slug}`} className="f0-focus block rounded-lg">
        {body}
      </Link>
      {article.tickers.length > 0 && (
        <CashTags tickers={article.tickers} className="mt-3" />
      )}
    </BoardCard>
  );
}
