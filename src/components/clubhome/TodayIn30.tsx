"use client";

import Link from "next/link";
import { Sparkles, ArrowUpRight } from "lucide-react";

import type { BriefResponse } from "@/lib/clubhome/contract";

/**
 * TODAY IN 30 SECONDS — canvas v2, board 01, the day's read.
 *
 * The canvas draws this as a warm brand-tinted banner with an oversized title, a
 * one-line summary and an audio play button. We have no audio, so the play
 * affordance is replaced by the thing it stood for: Kai. The object is the Kai
 * brief, given the presentation the canvas gave the digest.
 *
 * WHY IT MOVED OUT OF THE ORANGE BAND. Before this pass the brief's lead line
 * was a chip on the full-bleed action band, which meant the single richest
 * paragraph on Home was rendered as ~40 characters of pill text. The band now
 * carries only things that have FIRED (an alert, a catalyst, a mission) and this
 * carries the read. Two objects, two jobs.
 *
 * COLOUR LAW:
 *   · the field is BRAND (accent-tinted paper) → nothing here may carry a price.
 *     Every line is prose and $CASHTAGS; no percentage lands on the tint.
 *   · Kai is kai blue and only Kai is (.f0-kai-mark).
 *   · the marked word in the title rides --accent-solid via .f0-underline-mark,
 *     so it is gold in Family, orange in Club, metallic on the FTA desk.
 *
 * STATES, all three distinct:
 *   loading    → shimmer lines inside the real field (it claims content is coming)
 *   degraded   → `available:false`, the verbatim "temporarily unavailable" line,
 *                and the derived deltas are still shown (they are real)
 *   founding   → no items at all: the honest "your brief fills in" line
 *
 * KID: the caller strips sentiment items before they reach here (ClubHomeV2), so
 * no bull/bear read can arrive on this surface.
 */

function Line({ ticker, text }: { ticker?: string | null; text: string }) {
  const body = (
    <>
      {ticker && (
        <span className="mr-1.5 font-mono text-[12.5px] font-bold text-ink">
          ${ticker}
        </span>
      )}
      <span className="text-[13.5px] leading-relaxed text-soft">{text}</span>
    </>
  );
  if (!ticker) return <div className="py-2.5">{body}</div>;
  return (
    <Link
      href={`/research/${encodeURIComponent(ticker)}`}
      className="f0-focus block rounded-md py-2.5 transition-colors hover:text-ink"
    >
      {body}
    </Link>
  );
}

export default function TodayIn30({
  brief,
  loading = false,
}: {
  brief?: BriefResponse | null;
  /** LOADING ≠ EMPTY — see the header. */
  loading?: boolean;
}) {
  const items = brief?.items ?? [];
  const available = brief?.available ?? true;
  const derived = brief?.source === "derived";
  const lead = items[0] ?? null;
  const rest = items.slice(1, 4);

  return (
    <section
      className="f0-brief-field f0-grain px-5 py-5"
      aria-labelledby="club-today"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-soft">
            Kai&apos;s read
          </p>
          <h2
            id="club-today"
            className="mt-2 font-display text-display-3 font-extrabold uppercase tracking-tight text-ink"
          >
            Today in{" "}
            <span className="f0-underline-mark">30 seconds</span>
          </h2>
        </div>
        <span className="f0-kai-mark h-10 w-10 shrink-0" aria-hidden>
          <Sparkles className="h-5 w-5" />
        </span>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2.5" aria-busy="true">
          <div className="h-3.5 w-[88%] rounded-full bg-ink/10 motion-safe:animate-pulse" />
          <div className="h-3.5 w-[64%] rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
          <span className="sr-only">Loading today&apos;s read</span>
        </div>
      ) : (
        <>
          {!available && (
            <p className="mt-3 text-[13px] font-semibold text-kai-600">
              Kai is temporarily unavailable — here&apos;s what the Club&apos;s
              activity shows.
            </p>
          )}

          {lead ? (
            <>
              <p className="mt-3 font-display text-[16.5px] font-bold leading-snug text-ink">
                {lead.ticker && (
                  <span className="mr-1.5 font-mono text-[15px]">${lead.ticker}</span>
                )}
                {lead.text}
              </p>
              {rest.length > 0 && (
                <div className="f0-ledger mt-3">
                  {rest.map((it, i) => (
                    <Line key={`${it.ticker ?? "x"}-${i}`} ticker={it.ticker} text={it.text} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-[14px] leading-relaxed text-soft">
              Check back after the Club logs a little more activity — your brief
              fills in as the network moves.
            </p>
          )}
        </>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link
          href="/kai"
          className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-md font-display text-[14px] font-bold text-kai-600 hover:text-kai-500"
        >
          Ask Kai anything
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
        {derived && (
          <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft">
            derived from Club activity
          </span>
        )}
      </div>
    </section>
  );
}
