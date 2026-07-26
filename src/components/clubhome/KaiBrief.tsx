"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { SectionLabel } from "./parts";
import type { BriefResponse } from "@/lib/clubhome/contract";

/**
 * §5 Kai Brief — "Here's what changed since your last check-in." 3–5 delta items
 * derived from Club data, with an Ask-Kai CTA. Kai blue is used HERE and only
 * here (AI surface). LLM-optional: items are data-derived; when live Kai is down
 * the section degrades gracefully ("temporarily unavailable") but still shows the
 * derived deltas so the brief is never blank.
 */

export default function KaiBrief({ brief }: { brief: BriefResponse | null }) {
  const items = brief?.items ?? [];
  const available = brief?.available ?? true;
  const derived = brief?.source === "derived";

  return (
    <section
      aria-label="Kai Brief"
      className="club-field-kai rounded-2xl p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-kai-500 text-white shadow-soft">
            <Sparkles className="h-4 w-4" />
          </span>
          <SectionLabel tone="kai">Kai Brief</SectionLabel>
        </div>
        {brief?.updatedAt && (
          <span className="font-mono text-[11px] text-soft">Updated {brief.updatedAt}</span>
        )}
      </div>

      <h3 className="mt-3 font-display text-lg font-bold leading-snug text-ink">
        Here&apos;s what changed since your last check-in.
      </h3>

      {!available && (
        <p className="mt-2 text-[13px] font-medium text-kai-600">
          Kai is temporarily unavailable — here&apos;s what the Club&apos;s activity shows.
        </p>
      )}

      {items.length > 0 ? (
        <ul className="mt-3 space-y-0 divide-y divide-kai-500/12">
          {items.map((it, i) => {
            const row = (
              <>
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-kai-500" aria-hidden />
                <span className="text-[14px] leading-relaxed text-ink">
                  {it.ticker && (
                    <span className="mr-1 font-mono text-[13px] font-bold text-kai-600">{it.ticker}</span>
                  )}
                  {it.text}
                </span>
              </>
            );
            return (
              <li key={i} className="py-2.5">
                {it.ticker ? (
                  <Link href={`/research/${encodeURIComponent(it.ticker)}`} className="flex gap-2.5 group">
                    {row}
                  </Link>
                ) : (
                  <div className="flex gap-2.5">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-soft">
          Check back after the Club logs a little more activity — your brief fills in as the network moves.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link
          href="/kai"
          className="inline-flex items-center gap-2 rounded-xl bg-kai-500 px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:bg-kai-600 active:scale-[0.97]"
        >
          Ask Kai anything
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        {derived && (
          <span className="font-mono text-[10px] uppercase tracking-wide text-soft">
            derived from Club activity
          </span>
        )}
      </div>
    </section>
  );
}
