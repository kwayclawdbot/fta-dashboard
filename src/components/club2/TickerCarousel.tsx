"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ClubCard from "./ClubCard";
import type { TrendingResponse, PulseResponse } from "@/lib/clubhome/contract";

/**
 * WHAT THE CLUB IS SEEING — horizontally swipeable ticker carousel.
 *
 * Owner note (round nine): the hero is a carousel, not a single card, so the
 * next card must visibly PEEK. That peek is the entire affordance — without it
 * nobody swipes. Implemented as scroll-snap with the track padded so card N+1
 * is always partially in frame, plus pagination dots driven by scroll position.
 *
 * Native scroll (not a JS carousel lib) so it keeps momentum, respects reduced
 * motion, and stays keyboard/screen-reader navigable for free.
 */
export default function TickerCarousel({
  trending,
  pulse,
  loading = false,
}: {
  trending?: TrendingResponse | null;
  pulse?: PulseResponse | null;
  /**
   * LOADING IS NOT EMPTY. The club data is client-fetched, so `trending` is null
   * during SSR and on the first client paint. Without this flag the component
   * took its founding branch on every single load and rendered ONE static card
   * claiming "the Club hasn't formed a read yet" — which is both false and the
   * exact reason Home read as un-scrollable. The caller passes useClubData's
   * `loading` so the two states stay distinct.
   */
  loading?: boolean;
}) {
  const rows = (trending?.rows ?? []).slice(0, 6);
  const total = trending?.rows?.length ?? 0;
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // Drives the edge fade: it must disappear at the end of the track, otherwise
  // it implies there is always more to scroll to.
  const [atEnd, setAtEnd] = useState(false);

  // Spark series live on Pulse; Trending only ranks. Join by ticker.
  const sparkBy = new Map<string, number[]>();
  for (const s of pulse?.signals ?? []) {
    if (s.ticker && s.spark) sparkBy.set(s.ticker, s.spark);
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const card = el.firstElementChild as HTMLElement | null;
        if (!card) return;
        const step = card.offsetWidth + 12; // card + gap
        setActive(Math.round(el.scrollLeft / step));
        setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // Measure once on mount. On a wide viewport a short board (2–3 cards) fits
    // entirely, so it is ALREADY at its end — without this the edge fade would
    // sit there promising a scroll that cannot happen. The rAF inside onScroll
    // keeps this off the synchronous effect path.
    onScroll();
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [rows.length]);

  // ── LOADING — shaped like the real track, claims nothing ──────────────────
  // Two skeleton cards, so the peek (and therefore the swipe affordance) is
  // present from the very first paint instead of appearing after hydration.
  if (loading) {
    return (
      <section aria-labelledby="club-seeing" aria-busy="true">
        <Header total={0} shown={0} active={0} />
        <div className="club2-track -mx-4 flex gap-3 overflow-hidden px-4 pb-1">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="club2-card f0-grain shrink-0 rounded-[22px] motion-safe:animate-pulse"
              style={{ minHeight: 156, opacity: 1 - i * 0.35 }}
            />
          ))}
        </div>
        <span className="sr-only">Loading what the Club is seeing</span>
      </section>
    );
  }

  if (rows.length === 0) {
    // Founding state — the club has genuinely ranked nothing yet (loaded, zero
    // rows). Forced to full width: at the default .club2-card 82% it read as a
    // clipped carousel and implied a swipe that does not exist.
    return (
      <section aria-labelledby="club-seeing">
        <Header total={0} shown={0} active={0} />
        <div
          className="club2-card f0-grain rounded-[22px] px-5 py-7 text-[13.5px] leading-relaxed text-[#F7F3EA]/70"
          style={{ width: "100%", maxWidth: "none" }}
        >
          The Club hasn&apos;t formed a read yet. Rate a ticker and you&apos;ll be the
          first signal on this board.
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="club-seeing">
      <Header total={total} shown={rows.length} active={active} />

      {/* `relative` anchors the edge fade; the track keeps its own -mx-4 bleed. */}
      <div className="relative">
        <div
          ref={trackRef}
          className="club2-track -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1"
          role="group"
          aria-label="Tickers the club is watching"
        >
          {rows.map((r) => (
            <ClubCard key={r.ticker} row={r} spark={sparkBy.get(r.ticker)} />
          ))}
        </div>

        {/* Edge fade — the peek alone was too subtle to read as "this scrolls".
            Fades to the live page colour so it works in both themes, and clears
            once the track is at its end so it never promises more than exists. */}
        {rows.length > 1 && (
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 -right-4 w-14 transition-opacity duration-300 ${
              atEnd ? "opacity-0" : "opacity-100"
            }`}
            style={{ background: "linear-gradient(90deg, transparent, var(--paper))" }}
          />
        )}
      </div>

      {rows.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {rows.map((r, i) => (
            <span
              key={r.ticker}
              // Inactive dots were bg-sand, which is #38322A on a #17120B page —
              // effectively invisible, so the carousel lost its position
              // indicator in dark. Lifted onto the text ramp, which inverts.
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-4 bg-volt-500" : "w-1.5 bg-sand dark:bg-midnight-600"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Header({
  total,
  shown,
  active,
}: {
  total: number;
  /** cards actually on the track — the denominator of the position counter */
  shown: number;
  active: number;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 id="club-seeing" className="f0-section-rule flex-1">
        <span className="font-display text-eyebrow font-bold uppercase text-ink">
          What the club is seeing
        </span>
      </h2>
      {/* Explicit position counter — the single clearest "there is more here"
          signal at a glance. Only ever rendered when there IS more than one
          card, so a one-card board never implies a swipe. */}
      {shown > 1 && (
        <span
          aria-hidden
          className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-soft"
        >
          {Math.min(shown, Math.max(1, active + 1))} / {shown}
        </span>
      )}
      {total > 6 && (
        <Link
          href="/discover"
          // gold-* IS volt orange in club mode AND flips with the theme
          // (--g700 #C24400 → #FF9A5C); the volt-* ramp is frozen and lands
          // ~2.5:1 on obsidian. Themed orange, no dark: variant needed.
          className="inline-flex shrink-0 items-center gap-1 font-display text-[13px] font-bold text-gold-700 hover:text-gold-600"
        >
          See all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
