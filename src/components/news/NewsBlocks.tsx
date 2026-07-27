"use client";

/**
 * Renders an article's NewsBlock[] (canvas rebuild B). The model wrote the
 * prose; the data-driven blocks (movers with exact figures, attribution-only
 * source cards) are assembled by the generation lib — so nothing here can drift
 * from the ground-truth numbers.
 *
 * TYPOGRAPHY: prose is held to a ~65ch measure at 17px/1.7 — the article is the
 * one surface in the app that is genuinely read rather than scanned. Headings
 * step to display-3; nothing steps to display-1, which belongs to the headline.
 *
 * COLOUR LAW: the movers ledger is price, so it is the only coloured thing here
 * (`text-price-up` / `text-price-down`, both themes carried by the token). The
 * source line is attribution — quiet ink, brand orange only on hover.
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { signedPct, timeAgo, type NewsBlock } from "@/lib/news/types";
import { changeTone } from "@/lib/market/client";
import CompanyLogo from "@/components/fic/CompanyLogo";

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
          className={`pt-4 font-display text-display-3 font-extrabold text-ink ${MEASURE}`}
        >
          {block.text}
        </h2>
      );

    case "paragraph":
      return (
        <p className={`text-[17px] leading-[1.7] text-ink ${MEASURE}`}>{block.text}</p>
      );

    case "list":
      return (
        <ul
          className={`list-disc space-y-2 pl-5 text-[17px] leading-[1.7] text-ink marker:text-gold-500 ${MEASURE}`}
        >
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );

    /* The exact figures behind the story — a ruled ledger, never a chip cloud.
       Each name keeps its own logo so the row is an object with an identity. */
    case "movers":
      return (
        <div className={`f0-ledger my-2 ${MEASURE}`}>
          {block.items.map((m) => {
            const tone = changeTone(m.chg);
            return (
              <Link
                key={m.ticker}
                href={`/research/${m.ticker}`}
                className="f0-ledger-row justify-between"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <CompanyLogo symbol={m.ticker} name={m.name} size={26} rounded="rounded-md" />
                  <span className="font-mono text-[14px] font-bold text-ink">
                    <span className="opacity-50">$</span>
                    {m.ticker}
                  </span>
                  {m.name && (
                    <span className="hidden min-w-0 truncate text-[13px] text-soft sm:block">
                      {m.name}
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 font-mono text-[14px] font-semibold tabular-nums ${
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
            );
          })}
        </div>
      );

    /* Attribution only — headline, publisher, timestamp, and (when the feed
       supplies a real one) the publisher's own picture of the story. Never
       scraped body text. */
    case "source":
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`group my-2 flex items-start gap-4 py-3 f0-rule-top ${MEASURE}`}
        >
          {block.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.image}
              alt=""
              loading="lazy"
              className="h-16 w-24 shrink-0 rounded-md object-cover ring-1 ring-sand"
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
              {block.publisher || "Source"}
              {block.published ? ` · ${timeAgo(block.published)}` : ""}
            </span>
            <span className="mt-1 block font-display text-[15px] font-bold leading-snug text-ink transition-colors group-hover:text-gold-700">
              {block.title}
            </span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 self-center text-soft transition-colors group-hover:text-gold-700" />
        </a>
      );

    default:
      return null;
  }
}
