"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { TodayLoop } from "@/lib/club/today";
import type { LearningPickup } from "./ClubHomeV2";

/**
 * HIGHEST-CONVICTION IDEA — the CCDoors hero card.
 *
 * The prototype's focus object, verbatim: an uppercase section label, one
 * rounded-[18px] card on the card ground with a 96px accent-soft art band
 * (diagonal accent stripes + a centered mono label), the title in Sora, one
 * soft description line, a slim progress bar with the honest "N of M" beside
 * it, and a full-width accent-gradient CTA.
 *
 * DATA. This is the member's current lesson pickup — the same `learning`
 * object /dashboard already resolves (title/href/context), enriched with the
 * REAL course progress from the TODAY loop (src/lib/club/today.ts: `lesson.done
 * / lesson.total`, the same numbers /courses shows). Server seed absent
 * (client navigation, the family fallback) → the loop is fetched from
 * /api/club/today, exactly as the old opening object did. No progress read →
 * no bar, never a fabricated percentage. No pickup anywhere → the Foundations
 * fallback into /courses.
 */

function useTodayLoop(seed?: TodayLoop | null): TodayLoop | null {
  const [data, setData] = useState<TodayLoop | null>(seed ?? null);

  useEffect(() => {
    if (seed) return;
    const ctrl = new AbortController();
    let mounted = true;
    void (async () => {
      try {
        const res = await fetch("/api/club/today", {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const json = (await res.json()) as TodayLoop;
        if (mounted) setData(json);
      } catch {
        /* absent = the card renders without progress */
      }
    })();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [seed]);

  return data;
}

export default function HighestConviction({
  pickup,
  seed,
}: {
  pickup: LearningPickup | null;
  /** Server-built TODAY loop (progress source). Absent → client fetch. */
  seed?: TodayLoop | null;
}) {
  const today = useTodayLoop(seed);
  const lesson = today?.lesson ?? null;

  // The pickup /dashboard resolved wins; the loop's own lesson (same RPC) is
  // the fallback for the client-navigation path; then the Foundations door.
  const title = pickup?.title ?? lesson?.title ?? "The Foundations";
  const href = pickup?.href ?? lesson?.href ?? "/courses";
  const context =
    pickup?.context ?? lesson?.context ?? "One concept, one company, every week.";
  const artLabel = (lesson?.courseTitle ?? pickup?.context ?? "Foundations")
    .split("·")
    .pop()
    ?.trim();

  // REAL progress only: the loop's done/total for the lesson's course.
  const hasProgress =
    typeof lesson?.done === "number" &&
    typeof lesson?.total === "number" &&
    lesson.total > 0;
  const pct = hasProgress
    ? Math.max(0, Math.min(100, Math.round((lesson.done! / lesson.total!) * 100)))
    : null;

  return (
    <section aria-labelledby="conviction-idea">
      {/* the board's section labels are white bold caps, not soft gray */}
      <h2
        id="conviction-idea"
        className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink"
      >
        Highest-conviction idea
      </h2>

      <div className="overflow-hidden rounded-[16px] border border-sand bg-card">
        {/* art band — accent-soft ground, diagonal accent stripes */}
        <div
          className="relative grid h-[96px] place-items-center overflow-hidden"
          style={{
            background: "color-mix(in srgb, var(--accent-solid) 16%, transparent)",
          }}
        >
          <svg
            width="100%"
            height="100%"
            className="absolute inset-0 opacity-50"
            aria-hidden
          >
            <defs>
              <pattern
                id="hc-stripe"
                width="9"
                height="9"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="9"
                  stroke="var(--accent-solid)"
                  strokeWidth="2.5"
                  opacity="0.28"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hc-stripe)" />
          </svg>
          {artLabel && (
            <span className="relative max-w-[85%] truncate font-mono text-[10.5px] uppercase leading-none tracking-[0.08em] text-accent">
              {artLabel}
            </span>
          )}
        </div>

        <div className="px-4 pb-4 pt-4">
          <p className="font-display text-[16px] font-bold leading-[1.25] text-ink">
            {title}
          </p>
          <p className="mt-[6px] text-[12.5px] leading-normal text-soft">{context}</p>

          {hasProgress && (
            <div className="mt-[13px] flex items-center gap-3">
              <div className="h-[6px] flex-1 overflow-hidden rounded-[3px] bg-sand">
                <div
                  className="h-full rounded-[3px]"
                  style={{
                    width: `${pct}%`,
                    background: "var(--accent-gradient)",
                  }}
                />
              </div>
              <span className="shrink-0 font-mono text-[11px] leading-none text-soft tabular-nums">
                {lesson!.done} of {lesson!.total}
              </span>
            </div>
          )}

          <Link
            href={href}
            className="f0-focus f0-press mt-4 block w-full rounded-[12px] p-3.5 text-center font-display text-[13.5px] font-bold leading-none"
            style={{
              background: "var(--accent-gradient)",
              color: "var(--accent-on)",
            }}
          >
            {pickup || lesson ? "Read it" : "Pick up the Foundations"}
          </Link>
        </div>
      </div>
    </section>
  );
}
