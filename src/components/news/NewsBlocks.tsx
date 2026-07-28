"use client";

/**
 * Renders an article's NewsBlock[]. The model wrote the prose; the data-driven
 * blocks (movers with exact figures, attribution-only source cards) are
 * assembled by the generation lib — so nothing here can drift from the
 * ground-truth numbers.
 *
 * TYPOGRAPHY: prose stays UNCARDED at a ~65ch measure — the article is the one
 * surface in the app that is genuinely read rather than scanned, and a card
 * around a paragraph is a box around a sentence. The data blocks around it DO
 * take the board's card: each mover is a row card, each source an attribution
 * card, exactly the objects boards 02/15 draw.
 *
 * COLOUR LAW: the movers block is price, so it is the only coloured thing here
 * (`text-price-up` / `text-price-down`, both themes carried by the token). The
 * source line is attribution — quiet ink, brand orange only on hover.
 *
 * PURITY: the source timestamp comes from the hour-bucketed store, never from a
 * `Date.now()` call during render.
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { signedPct, type NewsBlock } from "@/lib/news/types";
import { changeTone } from "@/lib/market/client";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { BoardCard } from "@/components/discover/board";
import { timeAgoAt, useNowHour } from "@/components/discover/clock";

/** The article's reading measure. Every prose block is held to it. */
const MEASURE = "max-w-[65ch]";

export default function NewsBlocks({ blocks }: { blocks: NewsBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: NewsBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h2
          className={`pt-4 font-display text-[19px] font-extrabold tracking-[-0.02em] text-ink ${MEASURE}`}
        >
          {block.text}
        </h2>
      );

    case "paragraph":
      return (
        <p className={`text-[16px] leading-[1.7] text-ink ${MEASURE}`}>{block.text}</p>
      );

    case "list":
      return (
        <ul
          className={`list-disc space-y-2 pl-5 text-[16px] leading-[1.7] text-ink marker:text-gold-500 ${MEASURE}`}
        >
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );

    /* The exact figures behind the story — board 15's row card, so a mover
       inside an article is the same object as a match on the screener. Each
       name keeps its own mark, so the row has an identity. */
    case "movers":
      return (
        <div className={`my-3 flex flex-col gap-[7px] ${MEASURE}`}>
          {block.items.map((m) => {
            const tone = changeTone(m.chg);
            return (
              <BoardCard
                key={m.ticker}
                radius={12}
                className="transition-colors hover:border-accent"
              >
                <Link
                  href={`/research/${m.ticker}`}
                  className="f0-focus flex items-center justify-between gap-3 rounded-[12px] px-[11px] py-[9px]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <CompanyLogo
                      symbol={m.ticker}
                      name={m.name}
                      size={26}
                      rounded="rounded-[8px]"
                    />
                    <span className="font-mono text-[12px] font-semibold text-ink">
                      <span className="text-soft">$</span>
                      {m.ticker}
                    </span>
                    {m.name && (
                      <span className="hidden min-w-0 truncate text-[12px] text-soft sm:block">
                        {m.name}
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 font-mono text-[12px] font-semibold tabular-nums ${
                      tone === "up"
                        ? "text-price-up"
                        : tone === "down"
                          ? "text-price-down"
                          : "text-soft"
                    }`}
                  >
                    {signedPct(m.chg)}
                  </span>
                </Link>
              </BoardCard>
            );
          })}
        </div>
      );

    /* Attribution only — headline, publisher, timestamp, and (when the feed
       supplies a real one) the publisher's own picture of the story. Never
       scraped body text. */
    case "source":
      return <SourceCard block={block} />;

    default:
      return null;
  }
}

function SourceCard({ block }: { block: Extract<NewsBlock, { type: "source" }> }) {
  const now = useNowHour();
  const stamp = timeAgoAt(block.published, now);
  return (
    <BoardCard
      radius={14}
      className={`group my-3 transition-colors hover:border-accent ${MEASURE}`}
    >
      <a
        href={block.url}
        target="_blank"
        rel="noopener noreferrer"
        className="f0-focus flex items-start gap-3.5 rounded-[14px] p-3"
      >
        {block.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={block.image}
            alt=""
            loading="lazy"
            className="h-16 w-24 shrink-0 rounded-[8px] object-cover ring-1 ring-sand"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft">
            {block.publisher || "Source"}
            {stamp ? ` · ${stamp}` : ""}
          </span>
          <span className="mt-1 block font-display text-[14px] font-bold leading-snug text-ink transition-colors group-hover:text-gold-700">
            {block.title}
          </span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 self-center text-soft transition-colors group-hover:text-gold-700" />
      </a>
    </BoardCard>
  );
}
