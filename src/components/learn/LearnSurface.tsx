"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Lock, RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { canAccessCourse, getFamilyTier, type FamilyTier } from "@/lib/tier";
import { deriveRegister } from "@/lib/register";
import { getUserXp } from "@/lib/xp";
import type { LiveEventCardData } from "@/lib/live/types";
import {
  SectionRule,
  Ledger,
  LedgerRow,
  EmptyLine,
  TabRail,
  TextAction,
} from "@/components/f0/parts";
import {
  KIND_GLYPH,
  LearnWordmark,
  MonoEyebrow,
  StatRail,
  pathFieldStyle,
  pathGlyph,
  pathHue,
  pathInk,
  warmFieldStyle,
  type NodeGlyphKind,
} from "@/components/learn/kit";
import type { PathNodeKind } from "@/components/learn/LearnPath";
import { fetchStreak } from "@/lib/streak";
import { StreakFlame } from "@/components/art";

/* ══════════════════════════════════════════════════════════════════════════
   LEARN — route /courses (the Learn nav slot). Built to board 08
   (`light-r1-c0` + `light-r1-c1`, "08 LEARN"; dark twin `dark-r1-*`).

   The board, top to bottom: the script wordmark, YOUR PATHS as hue-washed
   rows carrying a real percentage, a CONTINUE card beside a YOUR STREAK card,
   then UP NEXT as two hairline rows. That is exactly what the Journey tab now
   renders — no obsidian hero, no meters, no ledger rows left over from the
   previous pass.

   Classes and Missions are not drawn on any board; they keep their working
   shape and their real reads.

   REAL DATA ONLY. The percentage is `lesson_progress` over `lessons`; the
   streak is THE canonical streak (src/lib/streak.ts) — consecutive local days
   carrying at least one XP award, the same number /progress and Home render;
   the XP is the sum of `xp_events`. A path with no lessons is dropped rather
   than padded.
   ══════════════════════════════════════════════════════════════════════════ */

type Tab = "journey" | "classes" | "missions";

interface LessonRef {
  courseSlug: string;
  moduleId: string;
  lessonId: string;
  title: string;
}

interface PathLine {
  slug: string;
  title: string;
  description: string | null;
  program: "fic" | "fta";
  /** null when the tier does not include this program — the row locks. */
  next: LessonRef | null;
  locked: boolean;
  done: number;
  total: number;
}

interface MissionLine {
  id: string;
  title: string;
  description: string | null;
  xp: number;
  done: boolean;
}

/** A course's lessons flattened into program order. */
interface OrderedLesson {
  id: string;
  title: string;
  is_free: boolean;
  moduleId: string;
  kind: PathNodeKind;
  durationSec: number | null;
}

/** One "UP NEXT" line on board 08 — glyph, title, and the honest minutes. */
interface UpNextLine {
  ref: LessonRef;
  glyph: string;
  meta: string | null;
}

interface RawLesson {
  id: string;
  title: string;
  sort_order: number;
  is_free: boolean;
  node_kind: string | null;
  video_duration_sec: number | null;
}

interface RawModule {
  id: string;
  title: string | null;
  track: string | null;
  sort_order: number;
  lessons: RawLesson[] | null;
}

interface RawCourse {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  program: "fic" | "fta";
  sort_order: number;
  modules: RawModule[] | null;
}

interface LearnState {
  tier: FamilyTier;
  isKid: boolean;
  /** The single most-recent unfinished lesson — the Continue target. */
  pickup: (LessonRef & { courseTitle: string; pct: number; index: number; total: number }) | null;
  paths: PathLine[];
  /** The two lessons queued behind the Continue target (board 08 "UP NEXT"). */
  upNext: UpNextLine[];
  /** Free tier only: the fully-playable sampler. */
  sampler: LessonRef[];
  lockedLessonCount: number;
  /** THE canonical streak (src/lib/streak.ts). 0 = no streak yet. */
  streak: number;
  /** Lifetime XP (sum of xp_events); null when it could not be read. */
  xp: number | null;
}

const EMPTY: LearnState = {
  tier: "fic",
  isKid: false,
  pickup: null,
  paths: [],
  upNext: [],
  sampler: [],
  lockedLessonCount: 0,
  streak: 0,
  xp: null,
};

const NODE_KINDS: PathNodeKind[] = ["lesson", "game", "challenge", "boss", "mission"];

function toNodeKind(raw: unknown): PathNodeKind {
  return NODE_KINDS.includes(raw as PathNodeKind) ? (raw as PathNodeKind) : "lesson";
}

const TABS: { id: Tab; label: string }[] = [
  { id: "journey", label: "Journey" },
  { id: "classes", label: "Classes" },
  { id: "missions", label: "Missions" },
];

export default function LearnSurface() {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>("journey");
  const [state, setState] = useState<LearnState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, age_group, track, family_id")
        .eq("id", user.id)
        .maybeSingle();

      const userTrack =
        (profile?.age_group as string | null) || (profile?.track as string | null) || "adults";
      const isKid = deriveRegister(profile ?? {}) === "kid";
      const tier = await getFamilyTier(supabase, profile?.family_id as string | undefined);

      const [{ data: courses }, { data: prog }] = await Promise.all([
        supabase
          .from("courses")
          .select(
            "id, slug, title, description, program, sort_order, modules(id, title, track, sort_order, lessons(id, title, sort_order, is_free, node_kind, video_duration_sec))"
          )
          .in("program", ["fic", "fta"])
          .eq("published", true)
          .order("sort_order"),
        supabase
          .from("lesson_progress")
          .select("lesson_id, completed_at")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false }),
      ]);

      const completedRows = (prog ?? []) as { lesson_id: string; completed_at: string | null }[];
      const completed = new Set(completedRows.map((r) => r.lesson_id));
      const all = (courses ?? []) as unknown as RawCourse[];

      const paths: PathLine[] = [];
      const sampler: LessonRef[] = [];
      let lockedLessonCount = 0;
      let pickup: LearnState["pickup"] = null;
      /** The path whose most recent completion is newest wins the Continue slot. */
      let pickupRank = Number.POSITIVE_INFINITY;
      /** Ordered lessons per course slug — the source of the UP NEXT queue. */
      const orderedBySlug = new Map<string, OrderedLesson[]>();
      /** Lessons a free family can see listed but not open. */
      const gatedLessonIds = new Set<string>();

      for (const c of all) {
        // A kid never sees the FTA day-trading cohort above their own content.
        if (c.program === "fta" && isKid) continue;

        const modules = [...(c.modules ?? [])]
          .filter((m) => (c.program === "fta" ? true : Boolean(m.track)))
          .sort((a, b) => a.sort_order - b.sort_order);

        const ordered: OrderedLesson[] = [];
        for (const m of modules) {
          for (const l of [...(m.lessons ?? [])].sort((a, b) => a.sort_order - b.sort_order)) {
            ordered.push({
              id: l.id,
              title: l.title,
              is_free: l.is_free,
              moduleId: m.id,
              kind: toNodeKind(l.node_kind),
              durationSec: l.video_duration_sec,
            });
          }
        }
        if (ordered.length === 0) continue;

        orderedBySlug.set(c.slug, ordered);

        const moduleOfLesson = new Map<string, string>();
        for (const m of modules) for (const l of m.lessons ?? []) moduleOfLesson.set(l.id, m.id);

        const done = ordered.filter((l) => completed.has(l.id)).length;
        const nextIdx = ordered.findIndex((l) => !completed.has(l.id));
        const nextLesson = nextIdx >= 0 ? ordered[nextIdx] : null;
        const locked = !canAccessCourse(tier, c.program);

        const next: LessonRef | null =
          nextLesson && !locked
            ? {
                courseSlug: c.slug,
                moduleId: moduleOfLesson.get(nextLesson.id) ?? "",
                lessonId: nextLesson.id,
                title: nextLesson.title,
              }
            : null;

        // Free tier: the is_free lessons are genuinely playable; the rest is the
        // locked library, counted honestly rather than described vaguely.
        if (tier === "free" && c.program === "fic") {
          for (const l of ordered) {
            if (l.is_free) {
              sampler.push({
                courseSlug: c.slug,
                moduleId: moduleOfLesson.get(l.id) ?? "",
                lessonId: l.id,
                title: l.title,
              });
            } else {
              lockedLessonCount += 1;
              gatedLessonIds.add(l.id);
            }
          }
        }

        paths.push({
          slug: c.slug,
          title: c.title,
          description: c.description,
          program: c.program,
          next,
          locked,
          done,
          total: ordered.length,
        });

        // Continue = the unfinished path this member touched most recently.
        if (next && done > 0) {
          const rank = completedRows.findIndex((r) => moduleOfLesson.has(r.lesson_id));
          const score = rank < 0 ? Number.POSITIVE_INFINITY : rank;
          if (score < pickupRank) {
            pickupRank = score;
            pickup = {
              ...next,
              courseTitle: c.title,
              pct: Math.round((done / ordered.length) * 100),
              index: done + 1,
              total: ordered.length,
            };
          }
        }
      }

      // Nothing started yet → offer the member's own-track path as the opener.
      if (!pickup) {
        const opener =
          paths.find(
            (p) =>
              !p.locked &&
              p.next &&
              p.program === "fic" &&
              all
                .find((c) => c.slug === p.slug)
                ?.modules?.some((m) => m.track === userTrack)
          ) ?? paths.find((p) => !p.locked && p.next);
        if (opener?.next) {
          pickup = {
            ...opener.next,
            courseTitle: opener.title,
            pct: opener.total > 0 ? Math.round((opener.done / opener.total) * 100) : 0,
            index: opener.done + 1,
            total: opener.total,
          };
        }
      }

      /* ── UP NEXT (board 08) ──────────────────────────────────────────
         The two unfinished lessons queued behind the Continue target, in
         the same path. Real rows only — when there is nothing behind it,
         the section states that rather than padding the list. */
      const upNext: UpNextLine[] = [];
      if (pickup) {
        const ordered = orderedBySlug.get(pickup.courseSlug) ?? [];
        const at = ordered.findIndex((l) => l.id === pickup!.lessonId);
        for (let i = at + 1; i < ordered.length && upNext.length < 2; i++) {
          const l = ordered[i];
          if (completed.has(l.id) || gatedLessonIds.has(l.id)) continue;
          upNext.push({
            ref: {
              courseSlug: pickup.courseSlug,
              moduleId: l.moduleId,
              lessonId: l.id,
              title: l.title,
            },
            glyph: KIND_GLYPH[l.kind as NodeGlyphKind] ?? KIND_GLYPH.lesson,
            meta: l.durationSec ? `${Math.max(1, Math.round(l.durationSec / 60))} min` : null,
          });
        }
      }

      /* ── The streak + the XP (board 08 / board 20 header) ────────────
         Both are measured, never decorative. THE STREAK IS THE CANONICAL ONE
         (src/lib/streak.ts): consecutive local days carrying at least one
         `xp_events` award. It used to be computed here from `lesson_progress`
         completions alone, which is why this surface said 0 for a member whose
         /progress screen said 1 — flashcards, games and Club reps are days the
         member showed up, and the Learn header was silently refusing to count
         them. The clock is read HERE, in the fetch — never during a render. */
      const streakRes = await fetchStreak(supabase, user.id, Date.now());
      const streak = streakRes?.days ?? 0;
      let xp: number | null = null;
      try {
        xp = await getUserXp(supabase, user.id);
      } catch {
        xp = null;
      }

      setState({
        tier,
        isKid,
        pickup,
        paths,
        upNext,
        sampler,
        lockedLessonCount,
        streak,
        xp,
      });
      setLoading(false);
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }, [supabase]);

  // Fetch is kicked off AFTER the first paint, so the skeleton is on screen
  // before any state lands (and React never sees a synchronous cascade).
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (loading) return <LearnSkeleton />;

  if (failed) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <EmptyLine
          title="Learn didn't load"
          body="Something hiccuped on our end — none of your progress is affected. Give it another go."
          action={
            <TextAction
              onClick={() => {
                setFailed(false);
                setLoading(true);
                void load();
              }}
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </TextAction>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      {/* Board 08 head: the script wordmark alone, with board 20's stat rail
          carrying the streak and the lifetime XP. */}
      <div className="flex items-center justify-between gap-4">
        <h1>
          <LearnWordmark>learn</LearnWordmark>
          <span className="sr-only">Learn</span>
        </h1>
        <StatRail streak={state.streak} xp={state.xp} />
      </div>

      <TabRail tabs={TABS} value={tab} onChange={setTab} ariaLabel="Learn sections" />

      {tab === "journey" && <JourneyTab state={state} />}
      {tab === "classes" && <ClassesTab />}
      {tab === "missions" && <MissionsTab isKid={state.isKid} />}
    </div>
  );
}

/* ── JOURNEY — board 08 ──────────────────────────────────────────────────
   YOUR PATHS · CONTINUE + YOUR STREAK · UP NEXT. Drawn in that order, with
   the board's own objects. */

function JourneyTab({ state }: { state: LearnState }) {
  const { pickup, paths, tier, sampler, lockedLessonCount, upNext, streak } = state;
  const started = pickup ? pickup.index > 1 : false;

  return (
    <div className="space-y-7">
      {/* ── YOUR PATHS ───────────────────────────────────────────────── */}
      <section>
        <MonoEyebrow tone="ink">{state.isKid ? "Your adventures" : "Your paths"}</MonoEyebrow>
        {paths.length === 0 ? (
          <div className="mt-3">
            <EmptyLine
              title="No paths published yet"
              body="Lessons appear here as they're published — nothing is hidden behind a placeholder."
            />
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {paths.map((p, i) => (
              <PathRow key={p.slug} path={p} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* ── CONTINUE + YOUR STREAK ───────────────────────────────────── */}
      <section className="flex gap-3">
        {pickup ? (
          <div className="min-w-0 flex-[1.3] rounded-2xl border border-sand bg-card p-4 sm:p-5">
            <MonoEyebrow>Continue</MonoEyebrow>
            <p className="mt-2.5 truncate text-[12px] text-soft">{pickup.courseTitle}</p>
            <p className="mt-0.5 font-display text-[17px] font-extrabold leading-tight text-ink">
              {pickup.title}
            </p>
            <p className="mt-1 font-mono text-[11px] tabular-nums text-soft">
              Lesson {pickup.index} of {pickup.total} · {pickup.pct}%
            </p>
            <Link
              href={`/courses/${pickup.courseSlug}/${pickup.moduleId}/${pickup.lessonId}`}
              className="f0-press f0-focus mt-4 block rounded-full bg-accent py-2.5 text-center font-display text-[13px] font-extrabold text-[#1A1614]"
            >
              {started ? "Continue" : "Start"}
            </Link>
          </div>
        ) : (
          <div className="min-w-0 flex-[1.3] rounded-2xl border border-sand bg-card p-4 sm:p-5">
            <MonoEyebrow>Continue</MonoEyebrow>
            <p className="mt-2.5 text-[13px] leading-relaxed text-soft">
              Your place in a path shows up here the moment you open a lesson — with the
              exact lesson to pick back up on.
            </p>
            {tier === "free" && (
              <div className="mt-3">
                <TextAction href="/upgrade">
                  See what the Club opens <ArrowRight className="h-3.5 w-3.5" />
                </TextAction>
              </div>
            )}
          </div>
        )}

        <div
          className="min-w-0 flex-1 rounded-2xl border p-4 text-center sm:p-5"
          style={warmFieldStyle("160deg")}
        >
          <MonoEyebrow>Your streak</MonoEyebrow>
          {/* THE streak surface, so this is where the ignite plays: the ember
              strikes once as the card paints instead of appearing fully lit.
              The count lives in the numeral below, so the mark carries none. */}
          <div className="mt-2.5 flex justify-center leading-none">
            <StreakFlame streak={streak} size={30} showCount={false} ignite />
          </div>
          <div className="mt-1.5 font-display text-[30px] font-extrabold leading-none tabular-nums tracking-tight text-ink">
            {streak}
          </div>
          <p className="mt-1.5 text-[11px] text-soft">
            {streak === 0
              ? "Finish a lesson to start it"
              : streak === 1
                ? "Day in a row"
                : "Days in a row"}
          </p>
        </div>
      </section>

      {/* ── UP NEXT ──────────────────────────────────────────────────── */}
      {pickup && (
        <section>
          <MonoEyebrow>Up next</MonoEyebrow>
          {upNext.length === 0 ? (
            <p className="mt-3 text-[13px] leading-relaxed text-soft">
              Nothing queued behind this one — it&apos;s the last open lesson on the path.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {upNext.map((l) => (
                <NextRow key={l.ref.lessonId} line={l} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── FREE SAMPLER ─────────────────────────────────────────────── */}
      {tier === "free" && sampler.length > 0 && (
        <section>
          <MonoEyebrow>Free lessons — yours to keep</MonoEyebrow>
          <div className="mt-3 flex flex-col gap-2">
            {sampler.map((l) => (
              <NextRow
                key={l.lessonId}
                line={{ ref: l, glyph: KIND_GLYPH.lesson, meta: null }}
              />
            ))}
          </div>
          {lockedLessonCount > 0 && (
            <p className="mt-3 text-[13px] leading-relaxed text-soft">
              {lockedLessonCount} more lesson{lockedLessonCount === 1 ? "" : "s"} open when
              you join the Club.{" "}
              <Link href="/upgrade" className="font-display font-bold text-gold-700">
                See the plans
              </Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/* One path as board 08 draws it: a hue wash whose width IS the percentage,
   the path glyph, the real done/total, and the numeral in that hue. */
function PathRow({ path, index }: { path: PathLine; index: number }) {
  const pct = path.total > 0 ? Math.round((path.done / path.total) * 100) : 0;
  const hue = pathHue(index);
  const href = path.locked
    ? "/upgrade"
    : path.next
      ? `/courses/${path.slug}/${path.next.moduleId}/${path.next.lessonId}`
      : `/courses/${path.slug}`;

  return (
    <Link
      href={href}
      className="f0-press f0-focus relative block overflow-hidden rounded-2xl border px-4 py-3"
      style={pathFieldStyle(hue)}
    >
      {/* The progress wash — its width is the real percentage, nothing else. */}
      {!path.locked && pct > 0 && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, color-mix(in srgb, ${hue} 22%, transparent), transparent)`,
          }}
        />
      )}
      <span className="relative flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="text-[15px] leading-none">
            {pathGlyph(index)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[14px] font-bold text-ink">
              {path.title}
            </span>
            <span className="mt-px block truncate text-[10.5px] text-soft">
              {path.locked
                ? path.program === "fta"
                  ? "Opens with enrollment"
                  : "Opens in the Club"
                : `${path.done} of ${path.total} lesson${path.total === 1 ? "" : "s"}`}
            </span>
          </span>
        </span>
        {path.locked ? (
          <Lock className="h-3.5 w-3.5 shrink-0 text-soft" />
        ) : (
          <span
            className="shrink-0 font-mono text-[13px] font-semibold tabular-nums"
            style={pathInk(hue)}
          >
            {pct}%
          </span>
        )}
      </span>
    </Link>
  );
}

/** An UP NEXT / sampler line: glyph, title, minutes, chevron. */
function NextRow({ line }: { line: UpNextLine }) {
  return (
    <Link
      href={`/courses/${line.ref.courseSlug}/${line.ref.moduleId}/${line.ref.lessonId}`}
      className="f0-press f0-focus flex items-center gap-2.5 rounded-xl border border-sand bg-card px-3 py-2.5"
    >
      <span aria-hidden className="text-[13px] leading-none">
        {line.glyph}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
        {line.ref.title}
        {line.meta && <span className="text-soft"> · {line.meta}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-soft" />
    </Link>
  );
}

/* ── CLASSES ─────────────────────────────────────────────────────────────── */

interface LiveBuckets {
  live: LiveEventCardData[];
  upcoming: LiveEventCardData[];
  replays: LiveEventCardData[];
}

function ClassesTab() {
  const [data, setData] = useState<LiveBuckets | null>(null);
  const [error, setError] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as LiveBuckets;
      setData({
        live: json.live ?? [],
        upcoming: json.upcoming ?? [],
        replays: json.replays ?? [],
      });
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void fetchClasses();
  }, [fetchClasses]);

  if (error) {
    return (
      <EmptyLine
        title="The calendar didn't load"
        body="We couldn't reach the class schedule just now."
        action={
          <TextAction
            onClick={() => {
              setError(false);
              setData(null);
              void fetchClasses();
            }}
          >
            <RotateCcw className="h-4 w-4" /> Try again
          </TextAction>
        }
      />
    );
  }

  if (!data) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded bg-sand/40" />
        ))}
      </div>
    );
  }

  const total = data.live.length + data.upcoming.length + data.replays.length;
  if (total === 0) {
    return (
      <EmptyLine
        title="No classes on the calendar"
        body="Live classes appear here the moment one is scheduled — we don't list a class until it has a real date."
        action={
          <TextAction href="/live-sessions">
            Past sessions <ArrowRight className="h-3.5 w-3.5" />
          </TextAction>
        }
      />
    );
  }

  return (
    <div className="space-y-10">
      {data.live.length > 0 && (
        <section className="space-y-4">
          <SectionRule>Happening now</SectionRule>
          <Ledger>
            {data.live.map((e) => (
              <ClassRow key={e.id} event={e} />
            ))}
          </Ledger>
        </section>
      )}

      {data.upcoming.length > 0 && (
        <section className="space-y-4">
          <SectionRule>On the calendar</SectionRule>
          <Ledger>
            {data.upcoming.map((e) => (
              <ClassRow key={e.id} event={e} />
            ))}
          </Ledger>
        </section>
      )}

      {data.replays.length > 0 && (
        <section className="space-y-4">
          <SectionRule action={<TextAction href="/live-sessions">All recordings</TextAction>}>
            Replays
          </SectionRule>
          <Ledger>
            {data.replays.map((e) => (
              <ClassRow key={e.id} event={e} />
            ))}
          </Ledger>
        </section>
      )}
    </div>
  );
}

function formatStart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * One class as a hairline row. The Remind Me control writes for real
 * (POST /api/live/[id]/remind, own-row RLS) and is optimistic, so the row never
 * lags the tap. A class with no join link yet says so — it does not fake a URL.
 */
function ClassRow({ event }: { event: LiveEventCardData }) {
  const [interested, setInterested] = useState(Boolean(event.interested));
  const [busy, setBusy] = useState(false);

  async function toggleRemind() {
    const next = !interested;
    setInterested(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/live/${event.id}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interested: next }),
      });
      if (!res.ok) setInterested(!next);
    } catch {
      setInterested(!next);
    } finally {
      setBusy(false);
    }
  }

  const isLive = event.status === "live" || event.status === "starting_soon";
  const isReplay = event.status === "ended" || event.status === "replay_ready";

  return (
    <div className="f0-ledger-row justify-between">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-eyebrow font-display font-bold uppercase text-soft">
          {isLive && (
            <span className="inline-flex items-center gap-1.5 text-gold-700">
              <span className="h-1.5 w-1.5 rounded-full bg-volt-500 motion-safe:animate-pulse" />
              {event.status === "live" ? "Live now" : "Starting soon"}
            </span>
          )}
          {!isLive && (isReplay ? "Replay" : formatStart(event.starts_at))}
        </p>
        <p className="mt-1 font-display text-[15px] font-bold leading-snug text-ink">
          {event.title}
        </p>
        <p className="mt-0.5 text-[13px] text-soft">
          {event.host.name}
          {event.duration_min ? ` · ${event.duration_min} min` : ""}
        </p>
      </div>

      <div className="shrink-0">
        {isLive &&
          (event.join_url ? (
            <TextAction href={event.join_url} external>
              Join room <ArrowRight className="h-3.5 w-3.5" />
            </TextAction>
          ) : (
            <span className="font-mono text-[12px] text-soft">Link coming</span>
          ))}

        {isReplay &&
          (event.replay_url ? (
            <TextAction href={event.replay_url} external>
              Watch <ArrowRight className="h-3.5 w-3.5" />
            </TextAction>
          ) : (
            <span className="font-mono text-[12px] text-soft">Posting soon</span>
          ))}

        {!isLive && !isReplay && (
          <button
            type="button"
            onClick={() => void toggleRemind()}
            disabled={busy}
            aria-pressed={interested}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-display text-[13px] font-bold transition-colors disabled:opacity-60 ${
              interested
                ? "border-volt-500 text-gold-700"
                : "border-sand text-soft hover:border-volt-500 hover:text-gold-700"
            }`}
          >
            {interested ? (
              <>
                <Check className="h-3.5 w-3.5" /> Reminder on
              </>
            ) : (
              "Remind me"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── MISSIONS ────────────────────────────────────────────────────────────── */

/**
 * Missions read fic_missions + mission_completions — the mission system that
 * actually exists on this branch. club_missions (migrations 180/181) is NOT in
 * this tree; it lives only on lane/canvas-rebuild-a, so nothing here references
 * it. Playing a mission (evidence, XP award, celebration) stays on /missions,
 * which owns that flow; this tab is the honest index + your completion state.
 */
function MissionsTab({ isKid }: { isKid: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [missions, setMissions] = useState<MissionLine[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMissions([]);
        return;
      }
      const [listRes, mineRes] = await Promise.all([
        supabase
          .from("fic_missions")
          .select("id, title, description, xp_reward, sort")
          .order("sort"),
        supabase.from("mission_completions").select("mission_id").eq("user_id", user.id),
      ]);
      if (listRes.error) {
        setError(true);
        return;
      }
      const done = new Set(
        ((mineRes.data ?? []) as { mission_id: string }[]).map((r) => r.mission_id)
      );
      setMissions(
        (
          (listRes.data ?? []) as {
            id: string;
            title: string;
            description: string | null;
            xp_reward: number;
          }[]
        ).map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          xp: m.xp_reward,
          done: done.has(m.id),
        }))
      );
    } catch {
      setError(true);
    }
  }, [supabase]);

  // Fetch is kicked off AFTER the first paint, so the skeleton is on screen
  // before any state lands (and React never sees a synchronous cascade).
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (error) {
    return (
      <EmptyLine
        title="Missions didn't load"
        body="We couldn't reach the mission board just now."
        action={
          <TextAction
            onClick={() => {
              setError(false);
              setMissions(null);
              void load();
            }}
          >
            <RotateCcw className="h-4 w-4" /> Try again
          </TextAction>
        }
      />
    );
  }

  if (missions == null) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded bg-sand/40" />
        ))}
      </div>
    );
  }

  if (missions.length === 0) {
    return (
      <EmptyLine
        title="No missions on the board"
        body="Missions turn a lesson into something you actually do — find a company you already live with, work out how it earns. None are published right now; this fills in the moment one is."
        action={
          <TextAction href="/watchlist">
            Go build the watchlist instead <ArrowRight className="h-3.5 w-3.5" />
          </TextAction>
        }
      />
    );
  }

  const doneCount = missions.filter((m) => m.done).length;

  return (
    <div className="space-y-4">
      <SectionRule action={<TextAction href="/missions">Play</TextAction>}>
        {doneCount} of {missions.length} done
      </SectionRule>
      <Ledger>
        {missions.map((m) => (
          <LedgerRow
            key={m.id}
            label={m.title}
            sub={m.description ?? undefined}
            value={m.done ? undefined : `+${m.xp} XP`}
          >
            {m.done ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 font-display text-[13px] font-bold text-ink">
                <Check className="h-4 w-4" /> Done
              </span>
            ) : undefined}
          </LedgerRow>
        ))}
      </Ledger>
      <p className="text-[13px] leading-relaxed text-soft">
        {isKid
          ? "Head to the mission board to write up what you found and claim your XP."
          : "Missions are played on the board — write up what you found there and the XP posts to your level."}
      </p>
    </div>
  );
}

/* ── skeleton ────────────────────────────────────────────────────────────── */

function LearnSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-6 pb-16" aria-hidden>
      <div className="flex items-center justify-between">
        <div className="h-9 w-32 rounded bg-sand/60" />
        <div className="h-3 w-24 rounded bg-sand/40" />
      </div>
      <div className="h-10 rounded bg-sand/40" />
      {/* Board 08's silhouette: four path rows, the two-up, then the queue —
          loading must never be mistaken for an empty Learn. */}
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[58px] rounded-2xl bg-sand/40" />
        ))}
      </div>
      <div className="flex gap-3">
        <div className="h-[168px] flex-[1.3] rounded-2xl bg-sand/40" />
        <div className="h-[168px] flex-1 rounded-2xl bg-sand/30" />
      </div>
      <div className="space-y-2">
        <div className="h-11 rounded-xl bg-sand/30" />
        <div className="h-11 rounded-xl bg-sand/30" />
      </div>
    </div>
  );
}
