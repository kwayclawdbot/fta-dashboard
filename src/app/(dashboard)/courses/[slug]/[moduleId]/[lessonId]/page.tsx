"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Play,
  BookOpen,
  Bot,
  StickyNote,
  List,
  Bookmark,
  Share2,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import VideoPlayer from "@/components/dashboard/VideoPlayer";
import QuizPanel from "@/components/dashboard/QuizPanel";
import AiCoachPanel from "@/components/dashboard/AiCoachPanel";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  video_provider: string | null;
  video_id: string | null;
  video_duration_sec: number | null;
  has_quiz: boolean;
  sort_order: number;
  module_id: string;
}

interface Module {
  id: string;
  title: string;
  sort_order: number;
  lessons: Lesson[];
}

type SideTab = "coach" | "notes" | "lessons";

const PLACEHOLDER_QUIZ = [
  { question: "What does a long green candlestick indicate?", options: ["Strong selling pressure", "Strong buying pressure", "Market indecision", "Low volume"], correctIndex: 1 },
  { question: "What is the primary purpose of a stop loss?", options: ["Maximize profits", "Limit potential losses", "Increase position size", "Track trends"], correctIndex: 1 },
  { question: "What does 'support level' refer to?", options: ["Highest price reached", "Price where buying prevents decline", "200-day average", "Price where most sell"], correctIndex: 1 },
];

function formatDuration(sec: number | null) {
  if (!sec) return "";
  const m = Math.round(sec / 60);
  return `${m} min`;
}

export default function LessonViewerPage() {
  const params = useParams();
  const slug = params.slug as string;
  const moduleId = params.moduleId as string;
  const lessonId = params.lessonId as string;
  const supabase = createClient();

  const [modules, setModules] = useState<Module[]>([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [sideTab, setSideTab] = useState<SideTab>("coach");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    const { data: course } = await supabase
      .from("courses")
      .select("id, title")
      .eq("slug", slug)
      .single();

    if (!course) { setLoading(false); return; }
    setCourseTitle(course.title);

    const { data: mods } = await supabase
      .from("modules")
      .select("id, title, sort_order")
      .eq("course_id", course.id)
      .order("sort_order");

    if (!mods) { setLoading(false); return; }

    const modulesWithLessons: Module[] = [];
    for (const mod of mods) {
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, title, description, video_provider, video_id, video_duration_sec, has_quiz, sort_order, module_id")
        .eq("module_id", mod.id)
        .order("sort_order");
      modulesWithLessons.push({ ...mod, lessons: lessons || [] });
    }
    setModules(modulesWithLessons);

    // Check progress
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: progress } = await supabase
        .from("lesson_progress")
        .select("status")
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId)
        .single();
      if (progress?.status === "completed") setIsCompleted(true);
    }

    setLoading(false);
  }, [supabase, slug, lessonId]);

  useEffect(() => { loadData(); }, [loadData]);

  const currentModule = modules.find((m) => m.id === moduleId);
  const currentLesson = currentModule?.lessons.find((l) => l.id === lessonId);
  const allLessons = modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id, moduleTitle: m.title })));
  const currentIdx = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  async function handleMarkComplete() {
    setIsCompleted(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("lesson_progress").upsert({
        user_id: user.id,
        lesson_id: lessonId,
        status: "completed",
        progress_pct: 100,
        completed_at: new Date().toISOString(),
      }, { onConflict: "user_id,lesson_id" });
    }
    if (currentLesson?.has_quiz) setShowQuiz(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentModule || !currentLesson) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">Lesson Not Found</h2>
        <Link href={`/courses/${slug}`} className="text-gold-400 text-sm font-body hover:underline">Back to course</Link>
      </div>
    );
  }

  const sideTabs: { id: SideTab; label: string; icon: typeof Bot }[] = [
    { id: "coach", label: "AI Coach", icon: Bot },
    { id: "notes", label: "Notes", icon: StickyNote },
    { id: "lessons", label: "Lessons", icon: List },
  ];

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 flex items-center gap-2 text-xs text-midnight-500 font-body">
        <Link href={`/courses/${slug}`} className="hover:text-midnight-300 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          {courseTitle}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-midnight-400">{currentModule.title}</span>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-0">
        {/* Main — video + info */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex-1 min-w-0">
          {/* Title */}
          <h1 className="font-display text-lg font-bold text-midnight-100 mb-3">{currentLesson.title}</h1>

          {/* Video */}
          <VideoPlayer
            provider={currentLesson.video_provider === "youtube" ? "youtube" : "placeholder"}
            videoId={currentLesson.video_id || undefined}
            title={currentLesson.title}
          />

          {/* Below video bar */}
          <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {!isCompleted ? (
                <button onClick={handleMarkComplete} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-400 text-midnight-950 text-sm font-display font-semibold hover:bg-gold-300 transition-colors">
                  <Check className="w-4 h-4" />
                  Mark Complete
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-body">
                  <Check className="w-4 h-4" />
                  Completed
                </div>
              )}
              {currentLesson.video_duration_sec && (
                <span className="flex items-center gap-1 text-xs text-midnight-500 font-body">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(currentLesson.video_duration_sec)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg text-midnight-500 hover:text-midnight-300 hover:bg-midnight-800 transition-colors"><ThumbsUp className="w-4 h-4" /></button>
              <button className="p-2 rounded-lg text-midnight-500 hover:text-midnight-300 hover:bg-midnight-800 transition-colors"><Bookmark className="w-4 h-4" /></button>
              <button className="p-2 rounded-lg text-midnight-500 hover:text-midnight-300 hover:bg-midnight-800 transition-colors"><Share2 className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Description */}
          {currentLesson.description && (
            <p className="mt-4 text-sm text-midnight-400 font-body leading-relaxed border-t border-midnight-800 pt-4">
              {currentLesson.description}
            </p>
          )}

          {/* Navigation */}
          <div className="mt-4 pt-4 border-t border-midnight-800 flex items-center justify-between">
            {prevLesson ? (
              <Link href={`/courses/${slug}/${prevLesson.moduleId}/${prevLesson.id}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/50 transition-colors font-body">
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Link>
            ) : <div />}
            {nextLesson ? (
              <Link href={`/courses/${slug}/${nextLesson.moduleId}/${nextLesson.id}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/50 transition-colors font-body">
                Next
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : <div />}
          </div>

          {/* Quiz */}
          {currentLesson.has_quiz && isCompleted && showQuiz && (
            <div className="mt-6 border-t border-midnight-800 pt-6">
              <h3 className="font-display text-base font-semibold text-midnight-100 mb-1">Lesson Quiz</h3>
              <p className="text-xs text-midnight-500 font-body mb-4">Test your understanding</p>
              <QuizPanel questions={PLACEHOLDER_QUIZ} onComplete={() => {}} />
            </div>
          )}
          {currentLesson.has_quiz && isCompleted && !showQuiz && (
            <div className="mt-4">
              <button onClick={() => setShowQuiz(true)} className="flex items-center gap-2 text-sm text-gold-400 hover:text-gold-300 transition-colors font-body">
                <BookOpen className="w-4 h-4" />
                Take the lesson quiz
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>

        {/* Side Panel */}
        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="lg:w-[380px] xl:w-[420px] shrink-0 lg:ml-4 mt-6 lg:mt-0"
        >
          <div className="lg:sticky lg:top-4 border border-midnight-800 rounded-lg overflow-hidden bg-midnight-900/30 flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
            {/* Tabs */}
            <div className="flex border-b border-midnight-800 shrink-0">
              {sideTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSideTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-body transition-colors ${
                    sideTab === tab.id
                      ? "text-gold-400 border-b-2 border-gold-400 bg-gold-400/5"
                      : "text-midnight-500 hover:text-midnight-300"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {sideTab === "coach" && (
                <AiCoachPanel lessonTitle={currentLesson.title} courseTitle={courseTitle} />
              )}

              {sideTab === "notes" && (
                <div className="p-4 h-full flex flex-col">
                  <p className="text-xs text-midnight-500 font-body mb-2">Personal notes for this lesson</p>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Type your notes here..."
                    className="flex-1 w-full bg-midnight-800/50 border border-midnight-700 rounded-lg p-3 text-sm text-midnight-200 placeholder:text-midnight-600 font-body resize-none focus:outline-none focus:border-gold-400/40"
                  />
                  <p className="text-[10px] text-midnight-600 mt-2 font-body">Notes are saved locally in this session</p>
                </div>
              )}

              {sideTab === "lessons" && (
                <div className="overflow-y-auto h-full">
                  {modules.map((mod) => (
                    <div key={mod.id}>
                      <div className="px-4 py-2 bg-midnight-900/80 border-b border-midnight-800">
                        <p className="text-xs font-display font-semibold text-midnight-400 uppercase tracking-wider">{mod.title}</p>
                      </div>
                      {mod.lessons.map((lesson) => {
                        const isActive = lesson.id === lessonId;
                        return (
                          <Link
                            key={lesson.id}
                            href={`/courses/${slug}/${mod.id}/${lesson.id}`}
                            className={`flex items-center gap-3 px-4 py-2.5 border-b border-midnight-800/50 transition-colors ${
                              isActive ? "bg-gold-400/5 border-l-2 border-l-gold-400" : "hover:bg-midnight-800/30"
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isActive ? "bg-gold-400/20" : "bg-midnight-800"}`}>
                              {isActive ? <Play className="w-2.5 h-2.5 text-gold-400" /> : <Play className="w-2.5 h-2.5 text-midnight-500" />}
                            </div>
                            <span className={`text-xs font-body truncate flex-1 ${isActive ? "text-gold-400 font-medium" : "text-midnight-300"}`}>
                              {lesson.title}
                            </span>
                            <span className="text-[10px] text-midnight-600 font-body shrink-0">
                              {formatDuration(lesson.video_duration_sec)}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
