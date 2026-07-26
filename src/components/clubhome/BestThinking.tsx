"use client";

import Link from "next/link";
import { Heart, MessageCircle, Bookmark, BadgeCheck, PenLine } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { Card, CardHead, Badge, Thumb } from "./parts";
import type { ThinkingPost, ThinkingResponse } from "@/lib/clubhome/contract";

/**
 * §7 Today's Best Thinking — the editorial feature, mock-faithful: one lead piece
 * with a chart thumbnail, big title, author + credibility and engagement metrics,
 * then 2–3 secondary pieces (also thumbed) in a ruled list. Sourced from the
 * community feed ranked by engagement. Founding-thin → a warm invite to publish.
 */

// self-contained thumbnail series (no external images) — cycles for variety
const THUMB_SERIES = [
  [40, 42, 41, 45, 48, 47, 53, 58, 61],
  [52, 50, 54, 51, 56, 60, 58, 63, 66],
  [30, 33, 32, 36, 40, 44, 47, 46, 51],
  [45, 44, 47, 49, 48, 52, 55, 59, 62],
];
function seriesFor(i: number) {
  return THUMB_SERIES[i % THUMB_SERIES.length];
}

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
    <span className="inline-flex items-center gap-1 text-[12px] text-soft">
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
    <Card aria-label="Today's Best Thinking">
      <CardHead
        title="Today's Best Thinking"
        badge={lead?.editorPick ? <Badge tone="pick">Editor&apos;s Pick</Badge> : undefined}
        action={
          <Link href="/community" className="text-xs font-semibold text-volt-700 hover:text-volt-800">
            All research
          </Link>
        }
      />

      {lead ? (
        <>
          {/* lead — thumbnail + editorial masthead */}
          <Link href={lead.href} className="group mt-4 flex gap-4 border-b border-sand pb-4">
            <Thumb series={seriesFor(0)} tone="teal" size={64} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              {lead.ticker && (
                <span className="inline-flex items-center gap-1.5">
                  <CompanyLogo symbol={lead.ticker} name={lead.company} size={16} rounded="rounded-md" />
                  <span className="font-mono text-[11px] font-bold text-soft">{lead.ticker}</span>
                </span>
              )}
              <h4 className="mt-0.5 font-display text-lg font-extrabold leading-snug tracking-tight text-ink group-hover:text-volt-700">
                {lead.title}
              </h4>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <Byline p={lead} />
                <div className="flex items-center gap-3">
                  <Metrics p={lead} />
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-soft">
                    <Bookmark className="h-3.5 w-3.5" />Save
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* secondary — thumbed ruled list */}
          <ol className="divide-y divide-sand">
            {secondary.map((p, i) => (
              <li key={p.id}>
                <Link href={p.href} className="group club-row -mx-2 flex items-center gap-3 rounded-lg px-2 py-3">
                  <Thumb series={seriesFor(i + 1)} tone={i % 2 ? "volt" : "teal"} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {p.ticker && (
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <CompanyLogo symbol={p.ticker} name={p.company} size={14} rounded="rounded" />
                          <span className="font-mono text-[11px] font-bold text-soft">{p.ticker}</span>
                        </span>
                      )}
                      <h5 className="truncate font-semibold text-ink group-hover:text-volt-700">{p.title}</h5>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <Byline p={p} />
                      <Metrics p={p} size="xs" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>

          <Link
            href="/community"
            className="mt-3 inline-block text-[13px] font-semibold text-volt-700 hover:text-volt-800"
          >
            View all top research →
          </Link>
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-sand bg-paper/50 p-6 text-center">
          <PenLine className="mx-auto h-6 w-6 text-volt-600" />
          <p className="mt-2 font-display text-base font-bold text-ink">The first great idea is yours to write.</p>
          <p className="mt-1 text-sm text-soft">
            Publish your research and it leads this space — founding thinking shapes the whole Club.
          </p>
          <Link href="/community" className="cta-button mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm">
            Share your research
          </Link>
        </div>
      )}
    </Card>
  );
}
