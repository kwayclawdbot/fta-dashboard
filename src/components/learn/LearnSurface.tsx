"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Lock, RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { canAccessCourse, getFamilyTier, type FamilyTier } from "@/lib/tier";
import { deriveRegister } from "@/lib/register";
import type { LiveEventCardData } from "@/lib/live/types";
import {
  DisplayHead,
  SectionRule,
  Ledger,
  LedgerRow,
  LedgerLink,
  Meter,
  EmptyLine,
  TabRail,
  TextAction,
} from "@/components/f0/parts";

/* ══════════════════════════════════════════════════════════════════════════
   LEARN — "Grow your edge". Route: /courses (the Learn nav slot).

   Three tabs, one surface:
     · JOURNEY  — the obsidian "continue learning" field (the single hero on
                  this surface), the next class as a line, then every path you
                  can open as hairline rows with a meter. Honest empty states.
     · CLASSES  — real live_events off /api/live (live · upcoming · replays),
                  with a working Remind Me write to /api/live/[id]/remind.
     · MISSIONS — real fic_missions + mission_completions. club_missions
                  (migrations 180/181) DO NOT EXIST on this branch, so nothing
                  here pretends they do.

   REAL DATA ONLY. Nothing renders a plausible-looking number: a path with no
   lessons is dropped, a tab with no rows states the absence and offers a way
   out. No card grids anywhere — rules and type carry the hierarchy.
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

interface RawCourse {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  program: "fic" | "fta";
  sort_order: number;
  modules:
    | {
        id: string;
        track: string | null;
        sort_order: number;
        lessons: { id: string; title: string; sort_order: number; is_free: boolean }[] | null;
      }[]
    | null;
}

interface LearnState {
  tier: FamilyTier;
  isKid: boolean;
  /** The single most-recent unfinished lesson — the Continue target. */
  pickup: (LessonRef & { courseTitle: string; pct: number; index: number; total: number }) | null;
  paths: PathLine[];
  /** Free tier only: the fully-playable sampler. */
  sampler: LessonRef[];
  lockedLessonCount: number;
}

const EMPTY: LearnState = {
  tier: "fic",
  isKid: false,
  pickup: null,
  paths: [],
  sampler: [],
  lockedLessonCount: 0,
};

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
            "id, slug, title, description, program, sort_order, modules(id, track, sort_order, lessons(id, title, sort_order, is_free))"
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

      for (const c of all) {
        // A kid never sees the FTA day-trading cohort above their own content.
        if (c.program === "fta" && isKid) continue;

        const modules = [...(c.modules ?? [])]
          .filter((m) => (c.program === "fta" ? true : Boolean(m.track)))
          .sort((a, b) => a.sort_order - b.sort_order);

        const ordered: { id: string; title: string; is_free: boolean }[] = [];
        for (const m of modules) {
          for (const l of [...(m.lessons ?? [])].sort((a, b) => a.sort_order - b.sort_order)) {
            ordered.push({ id: l.id, title: l.title, is_free: l.is_free });
          }
        }
        if (ordered.length === 0) continue;

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

      setState({ tier, isKid, pickup, paths, sampler, lockedLessonCount });
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
    <div className="mx-auto max-w-2xl space-y-8 pb-16">
      <DisplayHead
        eyebrow="Grow your edge"
        title="Learn"
        lede={
          state.isKid
            ? "Your adventures, your classes, and the missions that turn them into XP."
            : "One concept at a time, live classes when you want a room, and missions that put it to work."
        }
      />

      <TabRail tabs={TABS} value={tab} onChange={setTab} ariaLabel="Learn sections" />

      {tab === "journey" && <JourneyTab state={state} />}
      {tab === "classes" && <ClassesTab />}
      {tab === "missions" && <MissionsTab isKid={state.isKid} />}
    </div>
  );
}

/* ── JOURNEY ─────────────────────────────────────────────────────────────── */

function JourneyTab({ state }: { state: LearnState }) {
  const { pickup, paths, tier, sampler, lockedLessonCount } = state;
  const started = pickup ? pickup.index > 1 : false;

  return (
    <div className="space-y-10">
      {/* ── CONTINUE — the one obsidian field on this surface ─────────────
          f0-hero-field is deliberately obsidian in BOTH themes, so its own
          type is theme-invariant cream (the same rule as type on the orange
          band). Every colour OUTSIDE this field is a semantic token. */}
      {pickup ? (
        <section className="f0-hero-field f0-grain p-6 sm:p-7">
          <p className="text-eyebrow font-display font-bold uppercase text-volt-400">
            {started ? "Continue learning" : "Start here"}
          </p>
          <h2 className="mt-2 font-display text-display-2 font-extrabold leading-[1.08] text-[#F7F3EA]">
            {pickup.title}
          </h2>
          <p className="mt-2 font-mono text-[12px] text-[#F7F3EA]/60">
            {pickup.courseTitle} · Lesson {pickup.index} of {pickup.total}
          </p>

          <Meter pct={pickup.pct} onDark className="mt-5" />
          <p className="mt-2 font-mono text-[12px] text-[#F7F3EA]/60">
            {pickup.pct}% of this path complete
          </p>

          <Link
            href={`/courses/${pickup.courseSlug}/${pickup.moduleId}/${pickup.lessonId}`}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-volt-500 px-5 py-2.5 font-display text-[14px] font-bold text-white transition-transform active:scale-[0.98]"
          >
            {started ? "Continue lesson" : "Open the first lesson"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <EmptyLine
          title="Nothing open yet"
          body="Your place in a path shows up here the moment you open a lesson — with the exact lesson to pick back up on."
          action={
            tier === "free" ? (
              <TextAction href="/upgrade">
                See what the Club opens <ArrowRight className="h-3.5 w-3.5" />
              </TextAction>
            ) : undefined
          }
        />
      )}

      {/* ── FREE SAMPLER ─────────────────────────────────────────────────── */}
      {tier === "free" && sampler.length > 0 && (
        <section className="space-y-4">
          <SectionRule>Free lessons — yours to keep</SectionRule>
          <Ledger>
            {sampler.map((l) => (
              <LedgerLink
                key={l.lessonId}
                href={`/courses/${l.courseSlug}/${l.moduleId}/${l.lessonId}`}
                label={l.title}
                sub="Full lesson, quiz and XP — no card needed"
                tone="volt"
              />
            ))}
          </Ledger>
          {lockedLessonCount > 0 && (
            <p className="text-[13px] leading-relaxed text-soft">
              {lockedLessonCount} more lesson{lockedLessonCount === 1 ? "" : "s"} open when
              you join the Club.{" "}
              <Link
                href="/upgrade"
                className="font-display font-bold text-volt-700 dark:text-volt-400"
              >
                See the plans
              </Link>
            </p>
          )}
        </section>
      )}

      {/* ── PATHS ────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionRule>{state.isKid ? "Your adventures" : "Your paths"}</SectionRule>
        {paths.length === 0 ? (
          <EmptyLine
            title="No paths published yet"
            body="Lessons appear here as they're published — nothing is hidden behind a placeholder."
          />
        ) : (
          <Ledger>
            {paths.map((p) => (
              <PathRow key={p.slug} path={p} />
            ))}
          </Ledger>
        )}
      </section>
    </div>
  );
}

function PathRow({ path }: { path: PathLine }) {
  const pct = path.total > 0 ? Math.round((path.done / path.total) * 100) : 0;
  const complete = path.total > 0 && path.done === path.total;

  const body = (
    <>
      <div className="flex w-full items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold text-ink">{path.title}</p>
          {path.program === "fta" && (
            <p className="mt-0.5 text-[13px] text-soft">The live 6-week program</p>
          )}
        </div>
        {path.locked ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 font-display text-[13px] font-bold text-soft">
            <Lock className="h-3.5 w-3.5" />
            {path.program === "fta" ? "Enrollment" : "In the Club"}
          </span>
        ) : complete ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 font-display text-[13px] font-bold text-ink">
            <Check className="h-4 w-4" /> Complete
          </span>
        ) : (
          <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-soft">
            {path.done}/{path.total}
          </span>
        )}
      </div>
      {!path.locked && <Meter pct={pct} className="mt-2 w-full" />}
    </>
  );

  if (path.locked) {
    return (
      <Link href="/upgrade" className="f0-ledger-row group block">
        {body}
      </Link>
    );
  }
  const href = path.next
    ? `/courses/${path.slug}/${path.next.moduleId}/${path.next.lessonId}`
    : `/courses/${path.slug}`;
  return (
    <Link href={href} className="f0-ledger-row group block">
      {body}
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
            <span className="inline-flex items-center gap-1.5 text-volt-700 dark:text-volt-400">
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
                ? "border-volt-500 text-volt-700 dark:text-volt-400"
                : "border-sand text-soft hover:border-volt-500 hover:text-volt-700 dark:hover:text-volt-400"
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
    <div className="mx-auto max-w-2xl animate-pulse space-y-8 pb-16">
      <div className="space-y-3">
        <div className="h-3 w-32 rounded bg-sand/60" />
        <div className="h-11 w-44 rounded bg-sand/60" />
      </div>
      <div className="h-10 rounded bg-sand/40" />
      <div className="h-56 rounded-[1.5rem] bg-sand/40" />
      <div className="h-32 rounded bg-sand/30" />
    </div>
  );
}
