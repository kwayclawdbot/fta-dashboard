"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Lock,
  BookOpen,
  TrendingUp,
  BarChart3,
  Zap,
  GraduationCap,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  min_tier: string | null;
  sort_order: number;
  lessonCount: number;
  progress: number;
}

// Program structure matching the FTA curriculum
interface Program {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  icon: typeof BookOpen;
  color: string;
  bgColor: string;
  borderColor: string;
  tier: string;
  tracks: Track[];
}

interface Track {
  id: string;
  title: string;
  slugPrefixes: string[];
  courses: Course[];
}

const PROGRAMS: Omit<Program, "tracks">[] = [
  {
    id: "fundamentals",
    title: "Trading Fundamentals",
    subtitle: "Master the basics before risking real money",
    price: "FREE",
    icon: GraduationCap,
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    borderColor: "border-green-400/20",
    tier: "challenge",
  },
  {
    id: "investor",
    title: "Investor Track",
    subtitle: "Long-term investing, portfolio building & wealth accumulation",
    price: "$3,000",
    icon: TrendingUp,
    color: "text-gold-400",
    bgColor: "bg-gold-400/10",
    borderColor: "border-gold-400/20",
    tier: "academy",
  },
  {
    id: "swing",
    title: "Swing Trader Track",
    subtitle: "Hold 2-14 days — technical + fundamental analysis combined",
    price: "$4,000/concentration",
    icon: BarChart3,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/20",
    tier: "academy",
  },
  {
    id: "daytrader",
    title: "Day Trader Track",
    subtitle: "All positions closed same day — the fast-paced world of intraday",
    price: "$4,000/concentration",
    icon: Zap,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/20",
    tier: "academy",
  },
];

const TRACK_DEFINITIONS: Record<string, Track[]> = {
  fundamentals: [
    { id: "tf", title: "Core Courses", slugPrefixes: ["tf-"], courses: [] },
  ],
  investor: [
    { id: "inv", title: "Core Courses", slugPrefixes: ["inv-"], courses: [] },
  ],
  swing: [
    { id: "sw-core", title: "Core Courses", slugPrefixes: ["sw-1", "sw-2", "sw-3"], courses: [] },
    { id: "sw-so", title: "Stocks & Options", slugPrefixes: ["sw-so"], courses: [] },
    { id: "sw-fx", title: "Forex", slugPrefixes: ["sw-fx"], courses: [] },
    { id: "sw-fu", title: "Futures", slugPrefixes: ["sw-fu"], courses: [] },
    { id: "sw-cr", title: "Crypto", slugPrefixes: ["sw-cr"], courses: [] },
  ],
  daytrader: [
    { id: "dt-core", title: "Core Courses", slugPrefixes: ["dt-1", "dt-2", "dt-3"], courses: [] },
    { id: "dt-so", title: "Stocks & Options", slugPrefixes: ["dt-so"], courses: [] },
    { id: "dt-fx", title: "Forex", slugPrefixes: ["dt-fx"], courses: [] },
    { id: "dt-fu", title: "Futures", slugPrefixes: ["dt-fu"], courses: [] },
    { id: "dt-cr", title: "Crypto", slugPrefixes: ["dt-cr"], courses: [] },
  ],
};

function assignCourseToTrack(course: Course, tracks: Track[]) {
  for (const track of tracks) {
    if (track.slugPrefixes.some((p) => course.slug.startsWith(p))) {
      track.courses.push(course);
      return;
    }
  }
}

export default function CoursesPage() {
  const supabase = createClient();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProgram, setExpandedProgram] = useState<string | null>("fundamentals");
  const userTier: string = "academy";

  const loadCourses = useCallback(async () => {
    const { data: rawCourses } = await supabase
      .from("courses")
      .select("*")
      .eq("published", true)
      .order("sort_order");

    if (!rawCourses || rawCourses.length === 0) {
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Enrich courses with lesson counts and progress
    const enriched: Course[] = [];
    for (const c of rawCourses) {
      const { data: mods } = await supabase.from("modules").select("id").eq("course_id", c.id);
      let lessonCount = 0;
      let completedCount = 0;

      if (mods && mods.length > 0) {
        const modIds = mods.map((m: { id: string }) => m.id);
        const { data: lessons } = await supabase.from("lessons").select("id").in("module_id", modIds);
        lessonCount = lessons?.length ?? 0;

        if (user && lessons && lessons.length > 0) {
          const lessonIds = lessons.map((l: { id: string }) => l.id);
          const { count } = await supabase
            .from("lesson_progress")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .in("lesson_id", lessonIds)
            .eq("status", "completed");
          completedCount = count ?? 0;
        }
      }

      enriched.push({
        id: c.id, slug: c.slug, title: c.title, description: c.description,
        min_tier: c.min_tier, sort_order: c.sort_order, lessonCount,
        progress: lessonCount > 0 ? Math.round((completedCount / lessonCount) * 100) : 0,
      });
    }

    // Organize into programs → tracks → courses
    const built: Program[] = PROGRAMS.map((p) => {
      const tracks = JSON.parse(JSON.stringify(TRACK_DEFINITIONS[p.id] || [])) as Track[];
      // Clear courses arrays (deep clone doesn't help if empty)
      tracks.forEach((t) => (t.courses = []));
      enriched.forEach((c) => assignCourseToTrack(c, tracks));
      return { ...p, tracks };
    });

    setPrograms(built);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <h2 className="font-display text-2xl font-bold text-midnight-100">FTA University</h2>
        <p className="text-midnight-400 text-sm mt-1 font-body">
          Choose your track. Master your market. Get certified.
        </p>
      </motion.div>

      <div className="space-y-4">
        {programs.map((program, pi) => {
          const Icon = program.icon;
          const isExpanded = expandedProgram === program.id;
          const totalLessons = program.tracks.reduce((sum, t) => sum + t.courses.reduce((s, c) => s + c.lessonCount, 0), 0);
          const totalCourses = program.tracks.reduce((sum, t) => sum + t.courses.length, 0);
          const isLocked = program.tier === "academy" && userTier === "challenge";

          return (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pi * 0.05, duration: 0.3 }}
            >
              {/* Program header — clickable to expand */}
              <button
                onClick={() => setExpandedProgram(isExpanded ? null : program.id)}
                className={`w-full text-left rounded-xl border ${program.borderColor} ${isExpanded ? "bg-midnight-900/60" : "bg-midnight-900/30"} p-5 transition-all hover:border-opacity-60 ${isLocked ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${program.bgColor} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-6 h-6 ${program.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-display text-lg font-bold text-midnight-100">{program.title}</h3>
                      <span className={`text-[11px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded ${program.bgColor} ${program.color}`}>
                        {program.price}
                      </span>
                      {isLocked && <Lock className="w-3.5 h-3.5 text-midnight-500" />}
                    </div>
                    <p className="text-xs text-midnight-400 font-body">{program.subtitle}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-midnight-500 font-body">
                      <span>{totalCourses} courses</span>
                      <span>{totalLessons} lessons</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-midnight-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </div>
              </button>

              {/* Expanded: tracks + courses */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.2 }}
                  className="mt-1 pl-4 border-l-2 border-midnight-800 ml-8"
                >
                  {program.tracks.map((track) => (
                    <div key={track.id} className="mb-4">
                      {/* Track label (only show if there are multiple tracks) */}
                      {program.tracks.length > 1 && (
                        <div className="flex items-center gap-2 py-2 px-3 mb-2">
                          <Sparkles className={`w-3.5 h-3.5 ${program.color}`} />
                          <span className="text-xs font-display font-semibold text-midnight-300 uppercase tracking-wider">
                            {track.title}
                          </span>
                          {track.id !== program.tracks[0].id && (
                            <span className="text-[11px] text-midnight-600 font-body">Concentration</span>
                          )}
                        </div>
                      )}

                      {/* Courses in this track */}
                      <div className="space-y-2">
                        {track.courses.map((course) => (
                          <Link
                            key={course.id}
                            href={`/courses/${course.slug}`}
                            className={`block rounded-lg border border-midnight-800/60 bg-midnight-900/20 p-4 transition-all hover:border-midnight-700 hover:bg-midnight-900/40 ${isLocked ? "pointer-events-none" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${program.bgColor} flex items-center justify-center shrink-0`}>
                                <BookOpen className={`w-4 h-4 ${program.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-display text-sm font-semibold text-midnight-100">{course.title}</h4>
                                {course.description && (
                                  <p className="text-xs text-midnight-500 font-body mt-0.5 line-clamp-1">{course.description}</p>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                {course.lessonCount > 0 ? (
                                  <>
                                    <div className="w-20 h-1 rounded-full bg-midnight-800 overflow-hidden mb-1">
                                      <div className="h-full rounded-full bg-gold-400" style={{ width: `${course.progress}%` }} />
                                    </div>
                                    <span className="text-[11px] text-midnight-500 font-body">
                                      {course.lessonCount} lessons
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[11px] text-midnight-600 font-body italic">Coming soon</span>
                                )}
                              </div>
                              <ChevronRight className="w-4 h-4 text-midnight-600" />
                            </div>
                          </Link>
                        ))}

                        {track.courses.length === 0 && (
                          <div className="px-4 py-3 text-xs text-midnight-600 font-body italic">
                            Courses coming soon
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Certification callout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 p-6 rounded-xl border border-gold-400/15 bg-gold-400/5 text-center"
      >
        <GraduationCap className="w-8 h-8 text-gold-400 mx-auto mb-2" />
        <h3 className="font-display text-base font-bold text-midnight-100 mb-1">FTA Certifications</h3>
        <p className="text-xs text-midnight-400 font-body max-w-md mx-auto">
          Complete any track and pass the final exam to earn your FTA Certification — Certified Investor, Certified Swing Trader, or Certified Day Trader.
        </p>
      </motion.div>
    </div>
  );
}
