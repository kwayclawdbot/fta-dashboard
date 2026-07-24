"use client";

/**
 * Renders an article's NewsBlock[] (LANE 10). The model wrote the prose; the
 * data-driven blocks (movers with exact figures, attribution-only source
 * cards) are assembled by the generation lib — so nothing here can drift from
 * the ground-truth numbers.
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { signedPct, timeAgo, type NewsBlock } from "@/lib/news/types";
import { changeTone } from "@/lib/market/client";

export default function NewsBlocks({ blocks }: { blocks: NewsBlock[] }) {
  return (
    <div className="space-y-4">
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
        <h2 className="pt-2 font-display text-lg font-bold text-ink">{block.text}</h2>
      );
    case "paragraph":
      return <p className="text-[15px] leading-relaxed text-midnight-200">{block.text}</p>;
    case "list":
      return (
        <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-midnight-200">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "movers":
      return (
        <div className="flex flex-wrap gap-2">
          {block.items.map((m) => {
            const tone = changeTone(m.chg);
            const toneCls =
              tone === "up"
                ? "text-green-600"
                : tone === "down"
                  ? "text-red-600"
                  : "text-soft";
            return (
              <Link
                key={m.ticker}
                href={`/research/${m.ticker}`}
                className="flex items-center gap-2 rounded-xl border border-sand bg-paper px-3 py-2 transition-colors hover:border-gold-400"
              >
                <span className="font-mono text-sm font-bold text-ink">{m.ticker}</span>
                {m.name && (
                  <span className="hidden max-w-[9rem] truncate text-xs text-soft sm:inline">
                    {m.name}
                  </span>
                )}
                <span className={`text-sm font-bold tabular-nums ${toneCls}`}>
                  {signedPct(m.chg)}
                </span>
              </Link>
            );
          })}
        </div>
      );
    case "source":
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 rounded-xl border border-sand bg-paper p-3 transition-colors hover:border-gold-400"
        >
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-soft" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-snug text-ink">
              {block.title}
            </span>
            <span className="mt-0.5 block text-[11px] text-soft">
              {block.publisher || "Source"}
              {block.published ? ` · ${timeAgo(block.published)}` : ""}
            </span>
          </span>
        </a>
      );
    default:
      return null;
  }
}
