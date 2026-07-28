"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { m as mm } from "@/lib/motion";
import { Check, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getUserXp } from "@/lib/xp";
import { EmptyLine, TextAction } from "@/components/f0/parts";
import { CourseMarkRing } from "@/components/art";
import {
  LearnWordmark,
  MonoEyebrow,
  StatRail,
  dayStreak,
  pathMark,
  pathTone,
  warmFieldStyle,
} from "@/components/learn/kit";
import LearnPath, {
  LearnPathSkeleton,
  PathUnitBand,
  type PathNode,
  type PathNodeKind,
} from "@/components/learn/LearnPath";

/* ══════════════════════════════════════════════════════════════════════════
   COURSE DETAIL — /courses/[slug]. Built to board 20 (`light-r3-*`,
   "20 LEARN · PATH"; dark twin `dark-r3-*`).

   The board's screen, exactly: the script wordmark with 🔥 streak and ⚡ XP on
   the right, the warm UNIT band, then the unit as a winding dotted strand of
   bubbles — orange with a ✓ behind you, the pinging ★ where you stand, white
   hairline bubbles with 🔒 / 🏆 ahead — plus the off-strand side tiles. One
   band + one strand per unit, because a course page has to show the whole
   syllabus, not just the unit you are standing in.

   BEHAVIOUR IS UNCHANGED — same Supabase reads (courses → modules → lessons →
   lesson_progress), same drip lock rule, same mock-catalog fallback, same
   lesson hrefs. No progress or XP write lives on this route; it only reads.
   ══════════════════════════════════════════════════════════════════════════ */

interface Lesson {
  id: string;
  title: string;
  duration: string;
  status: "completed" | "available" | "locked";
  dripDays?: number;
  /** lessons.node_kind (migration 162) — drives the node glyph on the path.
   *  Absent on the mock catalog, which has no node kinds → falls back to
   *  "lesson", exactly the column's own default. */
  kind?: PathNodeKind;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface CourseData {
  title: string;
  description: string;
  modules: Module[];
}

// ── Mock data kept as fallback ──
const MOCK_COURSES: Record<string, CourseData> = {
  "stocks-options": {
    title: "Stocks & Options Mastery",
    description: "Master the foundations of stock trading and options strategies. The essential starting point for every family trader.",
    modules: [
      {
        id: "m1", title: "Module 1: Getting Started",
        lessons: [
          { id: "l1", title: "What is the Stock Market?", duration: "8 min", status: "completed" },
          { id: "l2", title: "How Markets Work", duration: "12 min", status: "completed" },
          { id: "l3", title: "Your Trading Account Setup", duration: "10 min", status: "available" },
        ],
      },
      {
        id: "m2", title: "Module 2: Chart Reading Basics",
        lessons: [
          { id: "l4", title: "Candlestick Patterns", duration: "15 min", status: "available" },
          { id: "l5", title: "Support & Resistance", duration: "14 min", status: "locked", dripDays: 2 },
          { id: "l6", title: "Trend Lines & Channels", duration: "12 min", status: "locked", dripDays: 3 },
        ],
      },
      {
        id: "m3", title: "Module 3: Options Fundamentals",
        lessons: [
          { id: "l7", title: "What Are Options?", duration: "11 min", status: "locked", dripDays: 5 },
          { id: "l8", title: "Calls vs Puts", duration: "13 min", status: "locked", dripDays: 5 },
          { id: "l9", title: "Risk-Reward Ratios", duration: "10 min", status: "locked", dripDays: 7 },
        ],
      },
    ],
  },
  "forex": {
    title: "Forex Trading",
    description: "Navigate the global currency markets with confidence. Currency pairs, pips, and macro analysis.",
    modules: [
      {
        id: "m1", title: "Module 1: Forex Fundamentals",
        lessons: [
          { id: "l1", title: "What is Forex?", duration: "8 min", status: "available" },
          { id: "l2", title: "Major Currency Pairs", duration: "10 min", status: "available" },
          { id: "l3", title: "Understanding Pips & Lots", duration: "12 min", status: "locked", dripDays: 2 },
        ],
      },
      {
        id: "m2", title: "Module 2: Trading Sessions",
        lessons: [
          { id: "l4", title: "Session Trading", duration: "14 min", status: "locked", dripDays: 3 },
          { id: "l5", title: "Fundamental Analysis", duration: "16 min", status: "locked", dripDays: 5 },
        ],
      },
    ],
  },
  "futures": {
    title: "Futures & Commodities",
    description: "Trade futures contracts across commodities and indices.",
    modules: [
      {
        id: "m1", title: "Module 1: Futures 101",
        lessons: [
          { id: "l1", title: "What Are Futures?", duration: "10 min", status: "available" },
          { id: "l2", title: "Contract Specifications", duration: "12 min", status: "available" },
          { id: "l3", title: "Margin & Leverage", duration: "14 min", status: "locked", dripDays: 2 },
        ],
      },
    ],
  },
  "crypto": {
    title: "Crypto & Digital Assets",
    description: "Understand blockchain technology and crypto trading strategies.",
    modules: [
      {
        id: "m1", title: "Module 1: Crypto Basics",
        lessons: [
          { id: "l1", title: "What is Blockchain?", duration: "10 min", status: "available" },
          { id: "l2", title: "Bitcoin & Ethereum", duration: "12 min", status: "available" },
          { id: "l3", title: "Wallets & Security", duration: "11 min", status: "locked", dripDays: 2 },
        ],
      },
    ],
  },
  "trading-foundations": {
    title: "Trading Foundations",
    description: "Master the basics of market structure, chart reading, and risk management.",
    modules: [
      {
        id: "m1", title: "Module 1: Getting Started",
        lessons: [
          { id: "l1", title: "Welcome to Trading", duration: "8 min", status: "completed" },
          { id: "l2", title: "How Markets Work", duration: "12 min", status: "completed" },
          { id: "l3", title: "Your Trading Account Setup", duration: "10 min", status: "available" },
        ],
      },
      {
        id: "m2", title: "Module 2: Chart Reading Basics",
        lessons: [
          { id: "l4", title: "Candlestick Patterns", duration: "15 min", status: "available" },
          { id: "l5", title: "Support & Resistance", duration: "14 min", status: "locked", dripDays: 2 },
          { id: "l6", title: "Trend Lines & Channels", duration: "12 min", status: "locked", dripDays: 3 },
        ],
      },
    ],
  },
};

const DEFAULT_COURSE: CourseData = {
  title: "Course",
  description: "Course content is being prepared.",
  modules: [],
};

function formatDuration(sec: number | null) {
  if (!sec) return "";
  const m = Math.round(sec / 60);
  return `${m} min`;
}

const NODE_KINDS: PathNodeKind[] = ["lesson", "game", "challenge", "boss", "mission"];

function toNodeKind(raw: unknown): PathNodeKind {
  return NODE_KINDS.includes(raw as PathNodeKind) ? (raw as PathNodeKind) : "lesson";
}

export default function CourseDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();

  const [course, setCourse] = useState<CourseData>(DEFAULT_COURSE);
  const [loading, setLoading] = useState(true);
  /** Board 20's header rail. Measured, never decorative — the streak is
   *  consecutive local days with a real completion, the XP is the sum of
   *  `xp_events`. Read here, in the fetch: never off the clock in render. */
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState<number | null>(null);

  const loadCourse = useCallback(async () => {
    // Try Supabase first
    const { data: dbCourse } = await supabase
      .from("courses")
      .select("id, title, description")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (dbCourse) {
      const { data: mods } = await supabase
        .from("modules")
        .select("id, title, sort_order")
        .eq("course_id", dbCourse.id)
        .order("sort_order");

      if (mods && mods.length > 0) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Get all completed lesson IDs for this user
        let completedSet = new Set<string>();
        if (user) {
          const allModIds = mods.map((m: { id: string }) => m.id);
          const { data: allLessonsForIds } = await supabase
            .from("lessons")
            .select("id")
            .in("module_id", allModIds);

          if (allLessonsForIds && allLessonsForIds.length > 0) {
            const lessonIds = allLessonsForIds.map(
              (l: { id: string }) => l.id
            );
            const { data: progressRows } = await supabase
              .from("lesson_progress")
              .select("lesson_id")
              .eq("user_id", user.id)
              .in("lesson_id", lessonIds)
              .eq("status", "completed");

            if (progressRows) {
              completedSet = new Set(
                progressRows.map((r: { lesson_id: string }) => r.lesson_id)
              );
            }
          }
        }

        const modules: Module[] = [];
        for (const mod of mods) {
          const { data: lessons } = await supabase
            .from("lessons")
            .select(
              "id, title, video_duration_sec, drip_week, sort_order, node_kind"
            )
            .eq("module_id", mod.id)
            .order("sort_order");

          const moduleLessons: Lesson[] = (lessons || []).map(
            (l: {
              id: string;
              title: string;
              video_duration_sec: number | null;
              drip_week: number | null;
              sort_order: number;
              node_kind: string | null;
            }) => {
              // Determine status
              let status: "completed" | "available" | "locked" = "available";
              if (completedSet.has(l.id)) {
                status = "completed";
              } else if (l.drip_week && l.drip_week > 1) {
                // Simple drip logic: if drip_week > 1, treat as locked for now
                // A full implementation would check family join date
                status = "locked";
              }

              return {
                id: l.id,
                title: l.title,
                duration: formatDuration(l.video_duration_sec),
                status,
                dripDays: l.drip_week ? l.drip_week * 7 : undefined,
                kind: toNodeKind(l.node_kind),
              };
            }
          );

          modules.push({
            id: mod.id,
            title: mod.title,
            lessons: moduleLessons,
          });
        }

        setCourse({
          title: dbCourse.title,
          description: dbCourse.description || "",
          modules,
        });
        setLoading(false);
        return;
      }
    }

    // Fallback to mock data
    const mock = MOCK_COURSES[slug];
    if (mock) setCourse(mock);
    setLoading(false);
  }, [supabase, slug]);

  const loadStats = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: rows } = await supabase
        .from("lesson_progress")
        .select("completed_at")
        .eq("user_id", user.id)
        .eq("status", "completed");
      setStreak(
        dayStreak(
          ((rows ?? []) as { completed_at: string | null }[]).map((r) => r.completed_at),
          Date.now()
        )
      );
      setXp(await getUserXp(supabase, user.id));
    } catch {
      /* the rail simply doesn't draw — it never invents a number */
    }
  }, [supabase]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  // Kicked off AFTER the first paint so the header rail never makes React see
  // a synchronous state cascade on mount.
  useEffect(() => {
    const t = setTimeout(() => void loadStats(), 0);
    return () => clearTimeout(t);
  }, [loadStats]);

  const totalLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.length,
    0
  );

  const allLessons = course.modules.flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleId: m.id }))
  );
  const nextUp = allLessons.find((l) => l.status === "available");

  // Completion for the whole path, off the same `status` the strand reads.
  // No lessons means no percentage to claim — 0, not a divide by zero.
  const coursePct =
    totalLessons > 0
      ? Math.round(
          (allLessons.filter((l) => l.status === "completed").length /
            totalLessons) *
            100
        )
      : 0;

  if (loading) return <CourseSkeleton />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      {/* ── Header — board 20 ─────────────────────────────────────────── */}
      <mm.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <Link
          href="/courses"
          className="inline-flex items-center gap-1.5 font-display text-[13px] font-bold text-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All paths
        </Link>

        <div className="mt-4 flex items-center justify-between gap-4">
          <h1 className="flex min-w-0 items-center gap-3">
            {/* The path's own mark, ringed by how much of THIS path is done —
                counted off the same lesson statuses the strand below draws, so
                the header and the units can never disagree. It is also the
                only thing that tells one path's header from another's: the
                wordmark is "learn" on every one of them. */}
            <CourseMarkRing
              pct={coursePct}
              mark={pathMark(slug)}
              tone={pathTone(slug.startsWith("fta-") ? "fta" : "fic")}
              size={46}
              className="shrink-0"
            />
            <span className="min-w-0">
              <LearnWordmark>learn</LearnWordmark>
              <span className="sr-only">{course.title}</span>
            </span>
          </h1>
          <StatRail streak={streak} xp={xp} />
        </div>

        {course.description && (
          <p className="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed text-soft">
            {course.description}
          </p>
        )}
      </mm.div>

      {/* ── Every lesson complete ─────────────────────────────────────── */}
      {!nextUp && totalLessons > 0 && (
        <div
          className="flex items-center gap-3 rounded-2xl border px-4 py-3.5"
          style={warmFieldStyle()}
        >
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#1A1614]"
            style={{
              background: "var(--accent-solid)",
              boxShadow: "0 3px 0 color-mix(in srgb, var(--accent-solid) 68%, #000)",
            }}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <MonoEyebrow>Path complete</MonoEyebrow>
            <p className="mt-[3px] font-display text-[15px] font-extrabold text-ink">
              Every lesson on this path is done
            </p>
          </div>
          <TextAction href="/courses">
            Learn <ArrowRight className="h-3.5 w-3.5" />
          </TextAction>
        </div>
      )}

      {/* ── The units ────────────────────────────────────────────────────
          One warm band + one strand per unit. Every node is a real lesson
          row and opens the same URL the ledger opened; locked nodes stay
          drawn (a drip lock is information, not an absence). */}
      {course.modules.length > 0 && (
        <div className="space-y-8">
          {course.modules.map((module, mi) => {
            const moduleProgress = module.lessons.filter(
              (l) => l.status === "completed"
            ).length;

            const nodes: PathNode[] = module.lessons.map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              href:
                lesson.status === "locked"
                  ? null
                  : `/courses/${slug}/${module.id}/${lesson.id}`,
              kind: lesson.kind ?? "lesson",
              state:
                lesson.status === "completed"
                  ? "done"
                  : lesson.status === "locked"
                    ? "locked"
                    : nextUp && lesson.id === nextUp.id
                      ? "current"
                      : "open",
              meta:
                lesson.status === "locked" && lesson.dripDays
                  ? `Unlocks in ${lesson.dripDays} days`
                  : lesson.duration || undefined,
            }));

            return (
              <mm.section
                key={module.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: mi * 0.04, duration: 0.28 }}
              >
                <PathUnitBand
                  index={mi + 1}
                  title={module.title}
                  eyebrow={course.title}
                  done={moduleProgress}
                  total={module.lessons.length}
                />
                {module.lessons.length === 0 ? (
                  <p className="pt-4 text-[13px] text-soft">
                    No lessons published in this unit yet.
                  </p>
                ) : (
                  <LearnPath
                    nodes={nodes}
                    ariaLabel={`${module.title} lessons`}
                    className="mt-4"
                  />
                )}
              </mm.section>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {course.modules.length === 0 && (
        <EmptyLine
          title="Nothing published yet"
          body="This path is still being written. Lessons appear here the moment they're published — nothing is hidden behind a placeholder."
          action={
            <TextAction href="/courses">
              Back to Learn <ArrowRight className="h-3.5 w-3.5" />
            </TextAction>
          }
        />
      )}
    </div>
  );
}

function CourseSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-6 pb-16" aria-hidden>
      <div className="h-3 w-20 rounded bg-sand/40" />
      <div className="flex items-center justify-between">
        <div className="h-9 w-32 rounded bg-sand/60" />
        <div className="h-3 w-24 rounded bg-sand/40" />
      </div>
      {/* Board 20's silhouette: the unit band, then the strand. Loading is
          never mistaken for an empty path. */}
      <div className="h-[62px] rounded-2xl bg-sand/40" />
      <LearnPathSkeleton count={4} />
    </div>
  );
}
