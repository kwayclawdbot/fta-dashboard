"use client";

import Link from "next/link";
import { Heart, MessageCircle, Bookmark, BadgeCheck, PenLine } from "lucide-react";
import { SectionLabel } from "./parts";
import type { ThinkingPost, ThinkingResponse } from "@/lib/clubhome/contract";

/**
 * §7 Today's Best Thinking — the editorial feature. One lead piece in big
 * typography (ticker, author + credibility, saves/comments/votes) then 2–3
 * secondary pieces in a ruled list. Sourced from the community feed ranked by
 * engagement. Composed as an editorial masthead + hairline list — not cards.
 * Founding-thin → a warm invitation to publish the first research.
 */

function Metrics({ p, size = "sm" }: { p: ThinkingPost; size?: "sm" | "xs" }) {
  const cls = size === "xs" ? "text-[11px]" : "text-xs";
  return (
    <div className={`flex items-center gap-3 ${cls} text-soft`}>
      <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{p.votes}</span>
      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{p.comments}</span>
      <span className="inline-flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" />{p.saves}</span>
    </div>
  );
}

function Byline({ p }: { p: ThinkingPost }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-soft">
      by <span className="font-semibold text-ink">@{p.author.name}</span>
      {p.author.verified && <BadgeCheck className="h-3.5 w-3.5 text-teal-600" />}
      {p.author.badge && (
        <span className="ml-1 rounded-full bg-teal-400/12 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
          {p.author.badge}
        </span>
      )}
    </span>
  );
}

export default function BestThinking({ thinking }: { thinking: ThinkingResponse | null }) {
  const lead = thinking?.lead ?? null;
  const secondary = thinking?.secondary ?? [];

  return (
    <section aria-label="Today's Best Thinking">
      <SectionLabel
        action={
          <Link href="/community" className="text-xs font-semibold text-volt-700 hover:text-volt-800">
            All research →
          </Link>
        }
      >
        Today&apos;s Best Thinking
      </SectionLabel>

      {lead ? (
        <>
          {/* lead — editorial masthead */}
          <Link href={lead.href} className="group mt-3 block border-b border-sand pb-4">
            <div className="flex items-center gap-2">
              {lead.editorPick && (
                <span className="rounded-full bg-volt-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-volt-700">
                  Editor&apos;s pick
                </span>
              )}
              {lead.ticker && (
                <span className="font-mono text-xs font-bold text-ink">{lead.ticker}</span>
              )}
            </div>
            <h3 className="mt-2 font-display text-xl font-extrabold leading-snug tracking-tight text-ink group-hover:text-volt-700 sm:text-2xl">
              {lead.title}
            </h3>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <Byline p={lead} />
              <Metrics p={lead} />
            </div>
          </Link>

          {/* secondary — ruled list */}
          <ol className="divide-y divide-sand">
            {secondary.map((p) => (
              <li key={p.id}>
                <Link href={p.href} className="group flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {p.ticker && <span className="font-mono text-[11px] font-bold text-soft">{p.ticker}</span>}
                      <h4 className="truncate font-semibold text-ink group-hover:text-volt-700">{p.title}</h4>
                    </div>
                    <div className="mt-1"><Byline p={p} /></div>
                  </div>
                  <div className="shrink-0 pt-0.5"><Metrics p={p} size="xs" /></div>
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-sand bg-card/60 p-6 text-center">
          <PenLine className="mx-auto h-6 w-6 text-volt-600" />
          <p className="mt-2 font-display text-base font-bold text-ink">The first great idea is yours to write.</p>
          <p className="mt-1 text-sm text-soft">
            Publish your research and it leads this space — founding thinking shapes the whole Club.
          </p>
          <Link
            href="/community"
            className="cta-button mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
          >
            Share your research
          </Link>
        </div>
      )}
    </section>
  );
}
