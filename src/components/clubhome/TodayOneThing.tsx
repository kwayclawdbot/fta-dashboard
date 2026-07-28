"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flame, Layers, Radar } from "lucide-react";

import type { TodayLoop } from "@/lib/club/today";

/**
 * TODAY'S ONE THING — the adult Club home's opening object, and the top of the
 * daily loop.
 *
 * WHY IT EXISTS. The teen home has answered "what do I do today?" since launch
 * with a single hero, and the adult home never did: it opened on TOP IN THE
 * CLUB — a ranked strip of what OTHER people are looking at. So the member's
 * own next lesson was invisible, their due flashcards were four taps deep, and
 * a triggered Kai Watch was three. This is the adult twin of that hero, in the
 * adult register: no mascot, no "you got this", no exclamation marks. One
 * lesson, the honest place it sits in the course, one button.
 *
 * TWO OBJECTS, ONE BLOCK:
 *
 *   1  THE ONE THING — a full-width tinted field carrying the member's REAL
 *      next lesson (`get_home_state`), the module it belongs to and "N of M
 *      done" for that course. One Start button. Nothing else competes.
 *
 *   2  THE DUE STRIP — the small things that are actually waiting, as chips:
 *      🔥 streak · N cards due → /flashcards · N watch triggered → /alerts.
 *      A chip renders ONLY when its number is real and non-zero, so the strip
 *      never manufactures work. With nothing due at all, the streak chip stands
 *      alone and says what starts one.
 *
 * REAL READS ONLY, and loading is not empty. `data == null && loading` draws a
 * skeleton; `data == null && !loading` (the read genuinely failed) draws
 * nothing rather than a zeroed loop. A `null` FIELD means that one read did not
 * land and its chip is simply absent — never rendered as 0.
 *
 * NO CLOCK IN RENDER. The streak, the due date and the trigger states are all
 * resolved on the server at request time (src/lib/club/today.ts) and arrive as
 * finished numbers.
 */

function useTodayLoop(seed?: TodayLoop | null): {
  data: TodayLoop | null;
  loading: boolean;
} {
  // A seed means the server already built it — first paint carries real data
  // and no fetch happens at all. Without one (client navigation into Home, the
  // family/teen fallback client) we fetch the same builder through its route.
  const [data, setData] = useState<TodayLoop | null>(seed ?? null);
  const [loading, setLoading] = useState(!seed);

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
        /* absent = the block renders nothing */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [seed]);

  return { data, loading };
}

/** One chip in the due strip. Renders as a link when it has somewhere to go. */
function Chip({
  href,
  icon,
  children,
  lead = false,
}: {
  href?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  /** The streak chip carries the accent; the work chips stay quiet. */
  lead?: boolean;
}) {
  const body = (
    <>
      <span className={lead ? "text-accent" : "text-soft"} aria-hidden>
        {icon}
      </span>
      <span className="whitespace-nowrap">{children}</span>
      {href && <ArrowRight className="h-3 w-3 shrink-0 text-soft" aria-hidden />}
    </>
  );
  const cls =
    "club-b-chip inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-semibold text-ink";
  if (!href) return <span className={cls}>{body}</span>;
  return (
    <Link href={href} className={`${cls} f0-focus f0-press`}>
      {body}
    </Link>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true">
      <div className="club-b-warm f0-grain px-5 py-5">
        <div className="h-2.5 w-24 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-3 h-4 w-3/5 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-2.5 h-2.5 w-2/5 rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
        <div className="mt-4 h-8 w-32 rounded-full bg-ink/10 motion-safe:animate-pulse" />
      </div>
      <span className="sr-only">Loading today</span>
    </div>
  );
}

export default function TodayOneThing({
  seed,
  isKid = false,
}: {
  seed?: TodayLoop | null;
  isKid?: boolean;
}) {
  const { data, loading } = useTodayLoop(seed);

  if (!data) return loading ? <Skeleton /> : null;

  const { lesson, streakDays, actedToday, cardsDue, watchTriggered } = data;

  const hasCards = typeof cardsDue === "number" && cardsDue > 0;
  const hasWatch = typeof watchTriggered === "number" && watchTriggered > 0;
  const hasStreak = typeof streakDays === "number" && streakDays > 0;
  // A failed streak read is `null` and shows nothing. A real 0 is a real
  // "no streak yet" and gets the one line that says how one starts.
  const streakKnown = typeof streakDays === "number";

  const nOfM =
    lesson && typeof lesson.done === "number" && typeof lesson.total === "number"
      ? `${lesson.done} of ${lesson.total} done`
      : null;

  return (
    <section aria-labelledby="today-one-thing" className="space-y-2.5">
      {/* ── 1. THE ONE THING ─────────────────────────────────────────────── */}
      {lesson ? (
        <div className="club-b-warm f0-grain flex items-center gap-4 px-5 py-[18px]">
          <div className="min-w-0 flex-1">
            <p
              id="today-one-thing"
              className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink"
            >
              Today
              <span className="text-accent"> · one thing</span>
            </p>
            <p className="mt-2 font-display text-[17px] font-extrabold leading-snug text-ink">
              {lesson.title}
            </p>
            <p className="mt-1 truncate text-[12px] leading-snug text-soft">
              {lesson.context}
              {nOfM && <span className="text-soft"> · {nOfM}</span>}
            </p>
          </div>
          <Link
            href={lesson.href}
            className="f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
          >
            Start
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="club-b-warm f0-grain px-5 py-[18px]">
          <p
            id="today-one-thing"
            className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink"
          >
            Today
            <span className="text-accent"> · one thing</span>
          </p>
          <p className="mt-2 font-display text-[17px] font-extrabold leading-snug text-ink">
            {isKid ? "Pick where you want to start" : "Nothing queued — pick your line"}
          </p>
          <p className="mt-1 max-w-[52ch] text-[12px] leading-relaxed text-soft">
            {isKid
              ? "Choose a path and the next thing to do shows up here every day."
              : "Start a path and this becomes the one thing waiting for you every morning."}
          </p>
          <Link
            href="/courses"
            className="f0-focus f0-press mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
          >
            Choose a path
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      )}

      {/* ── 2. THE DUE STRIP ─────────────────────────────────────────────── */}
      {streakKnown && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip lead icon={<Flame className="h-3 w-3" />}>
            {hasStreak
              ? `${streakDays}-day streak`
              : isKid
                ? "No streak yet"
                : "No streak yet"}
          </Chip>

          {hasCards && (
            <Chip href="/flashcards" icon={<Layers className="h-3 w-3" />}>
              {cardsDue} card{cardsDue === 1 ? "" : "s"} due
            </Chip>
          )}

          {hasWatch && !isKid && (
            <Chip href="/alerts" icon={<Radar className="h-3 w-3" />}>
              {watchTriggered} watch{watchTriggered === 1 ? "" : "es"} triggered
            </Chip>
          )}

          {/* ZERO STATE: the streak chip alone, with the one sentence that says
              how a streak begins. Never a row of zeroed chips. */}
          {!hasStreak && !hasCards && !hasWatch && (
            <span className="text-[11.5px] text-soft">One action starts it.</span>
          )}
          {hasStreak && actedToday && !hasCards && !hasWatch && (
            <span className="text-[11.5px] text-soft">Today is already logged.</span>
          )}
        </div>
      )}
    </section>
  );
}
