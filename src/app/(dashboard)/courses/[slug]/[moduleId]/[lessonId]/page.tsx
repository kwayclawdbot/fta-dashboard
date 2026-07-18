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
import { XP, awardXp, hasXpForRef } from "@/lib/xp";
import { useLessonBridge } from "@/lib/lesson-bridge";
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

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

// ── Mock data for when Supabase has no match ──
interface MockLesson {
  id: string;
  title: string;
  description: string;
  duration: string;
  durationSec: number;
}
interface MockModule {
  id: string;
  title: string;
  lessons: MockLesson[];
}
interface MockCourse {
  title: string;
  modules: MockModule[];
}

const MOCK_COURSES: Record<string, MockCourse> = {
  "stocks-options": {
    title: "Stocks & Options Mastery",
    modules: [
      {
        id: "m1", title: "Module 1: Getting Started", lessons: [
          { id: "l1", title: "What is the Stock Market?", description: "Learn the fundamentals of how stock markets operate, including exchanges, market makers, and how prices are determined through supply and demand.", duration: "8 min", durationSec: 480 },
          { id: "l2", title: "How Markets Work", description: "Understand market mechanics — order types, bid-ask spreads, market hours, and the role of different participants.", duration: "12 min", durationSec: 720 },
          { id: "l3", title: "Your Trading Account Setup", description: "Step-by-step guide to setting up your first brokerage account, understanding account types, and making your first deposit.", duration: "10 min", durationSec: 600 },
        ],
      },
      {
        id: "m2", title: "Module 2: Chart Reading Basics", lessons: [
          { id: "l4", title: "Candlestick Patterns", description: "Master the most important candlestick patterns — doji, hammer, engulfing — and what they tell you about market sentiment.", duration: "15 min", durationSec: 900 },
          { id: "l5", title: "Support & Resistance", description: "Identify key price levels where buying and selling pressure converge. Learn to draw and validate support/resistance zones.", duration: "14 min", durationSec: 840 },
          { id: "l6", title: "Trend Lines & Channels", description: "Draw accurate trend lines, identify channels, and use them to time entries and exits.", duration: "12 min", durationSec: 720 },
        ],
      },
      {
        id: "m3", title: "Module 3: Options Fundamentals", lessons: [
          { id: "l7", title: "What Are Options?", description: "Introduction to options contracts — calls, puts, strike prices, expiration, and how options derive their value.", duration: "11 min", durationSec: 660 },
          { id: "l8", title: "Calls vs Puts", description: "Deep dive into buying calls and puts, when to use each, and how to calculate breakeven and max risk.", duration: "13 min", durationSec: 780 },
          { id: "l9", title: "Risk-Reward Ratios", description: "Calculate risk-reward on every trade. Learn the golden ratios that professional traders use to stay profitable.", duration: "10 min", durationSec: 600 },
        ],
      },
    ],
  },
  "trading-foundations": {
    title: "Trading Foundations",
    modules: [
      {
        id: "m1", title: "Module 1: Getting Started", lessons: [
          { id: "l1", title: "Welcome to Trading", description: "An introduction to the world of trading and what you'll learn in this course.", duration: "8 min", durationSec: 480 },
          { id: "l2", title: "How Markets Work", description: "Understand market mechanics — order types, bid-ask spreads, and market hours.", duration: "12 min", durationSec: 720 },
          { id: "l3", title: "Your Trading Account Setup", description: "Step-by-step guide to setting up your first brokerage account.", duration: "10 min", durationSec: 600 },
        ],
      },
      {
        id: "m2", title: "Module 2: Chart Reading Basics", lessons: [
          { id: "l4", title: "Candlestick Patterns", description: "Master the most important candlestick patterns and what they tell you about market sentiment.", duration: "15 min", durationSec: 900 },
          { id: "l5", title: "Support & Resistance", description: "Identify key price levels where buying and selling pressure converge.", duration: "14 min", durationSec: 840 },
          { id: "l6", title: "Trend Lines & Channels", description: "Draw accurate trend lines, identify channels, and use them to time entries.", duration: "12 min", durationSec: 720 },
        ],
      },
    ],
  },
  "forex": {
    title: "Forex Trading",
    modules: [
      {
        id: "m1", title: "Module 1: Forex Fundamentals", lessons: [
          { id: "l1", title: "What is Forex?", description: "Introduction to the foreign exchange market — the largest financial market in the world.", duration: "8 min", durationSec: 480 },
          { id: "l2", title: "Major Currency Pairs", description: "Learn about EUR/USD, GBP/USD, USD/JPY and other major pairs you'll be trading.", duration: "10 min", durationSec: 600 },
          { id: "l3", title: "Understanding Pips & Lots", description: "Master the units of measurement in forex — pips, lots, and how to calculate position sizes.", duration: "12 min", durationSec: 720 },
        ],
      },
      {
        id: "m2", title: "Module 2: Trading Sessions", lessons: [
          { id: "l4", title: "Session Trading", description: "Understand the London, New York, and Asian sessions and when each pair is most volatile.", duration: "14 min", durationSec: 840 },
          { id: "l5", title: "Fundamental Analysis", description: "Read economic calendars, understand interest rate decisions, and trade the news.", duration: "16 min", durationSec: 960 },
        ],
      },
    ],
  },
  "futures": {
    title: "Futures & Commodities",
    modules: [
      {
        id: "m1", title: "Module 1: Futures 101", lessons: [
          { id: "l1", title: "What Are Futures?", description: "Introduction to futures contracts, margin, and how they differ from stocks.", duration: "10 min", durationSec: 600 },
          { id: "l2", title: "Contract Specifications", description: "Understand tick values, contract sizes, and expiration cycles for popular futures.", duration: "12 min", durationSec: 720 },
          { id: "l3", title: "Margin & Leverage", description: "Learn how margin works in futures, initial vs maintenance margin, and managing leverage.", duration: "14 min", durationSec: 840 },
        ],
      },
    ],
  },
  "crypto": {
    title: "Crypto & Digital Assets",
    modules: [
      {
        id: "m1", title: "Module 1: Crypto Basics", lessons: [
          { id: "l1", title: "What is Blockchain?", description: "Understand the technology behind cryptocurrencies — blocks, chains, and decentralization.", duration: "10 min", durationSec: 600 },
          { id: "l2", title: "Bitcoin & Ethereum", description: "Deep dive into the two largest cryptocurrencies and what makes each unique.", duration: "12 min", durationSec: 720 },
          { id: "l3", title: "Wallets & Security", description: "Set up your first crypto wallet, understand seed phrases, and keep your assets safe.", duration: "11 min", durationSec: 660 },
        ],
      },
    ],
  },
};

function mockToModules(slug: string, moduleId: string, lessonId: string): { courseTitle: string; modules: Module[]; found: boolean } {
  const mock = MOCK_COURSES[slug];
  if (!mock) return { courseTitle: "", modules: [], found: false };

  const modules: Module[] = mock.modules.map((m, mi) => ({
    id: m.id,
    title: m.title,
    sort_order: mi,
    lessons: m.lessons.map((l, li) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      video_provider: null,
      video_id: null,
      video_duration_sec: l.durationSec,
      has_quiz: li === m.lessons.length - 1,
      sort_order: li,
      module_id: m.id,
    })),
  }));

  const hasMatch = modules.some((m) => m.id === moduleId && m.lessons.some((l) => l.id === lessonId));
  return { courseTitle: mock.title, modules, found: hasMatch };
}

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
  const [isMock, setIsMock] = useState(false);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    // Try Supabase first
    const { data: course } = await supabase
      .from("courses")
      .select("id, title")
      .eq("slug", slug)
      .single();

    if (course) {
      setCourseTitle(course.title);

      const { data: mods } = await supabase
        .from("modules")
        .select("id, title, sort_order")
        .eq("course_id", course.id)
        .order("sort_order");

      if (mods && mods.length > 0) {
        const modulesWithLessons: Module[] = [];
        for (const mod of mods) {
          const { data: lessons } = await supabase
            .from("lessons")
            .select("id, title, description, video_provider, video_id, video_duration_sec, has_quiz, sort_order, module_id")
            .eq("module_id", mod.id)
            .order("sort_order");
          modulesWithLessons.push({ ...mod, lessons: lessons || [] });
        }

        // Check if the requested lesson actually exists in DB results
        const dbHasLesson = modulesWithLessons.some(
          (m) => m.id === moduleId && m.lessons.some((l) => l.id === lessonId)
        );

        if (dbHasLesson) {
          setModules(modulesWithLessons);

          // Load the real quiz for this lesson (if any). No placeholders.
          const { data: quizRow } = await supabase
            .from("quizzes")
            .select("id, questions")
            .eq("lesson_id", lessonId)
            .maybeSingle();
          const qs = (quizRow?.questions as QuizQuestion[] | undefined) || [];
          const hasQuiz = Array.isArray(qs) && qs.length > 0;
          setQuiz(hasQuiz ? qs : null);
          setQuizId(hasQuiz ? quizRow!.id : null);

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
          return;
        }
      }
    }

    // Fallback to mock data
    const mock = mockToModules(slug, moduleId, lessonId);
    if (mock.found) {
      setCourseTitle(mock.courseTitle);
      setModules(mock.modules);
      setIsMock(true);
    }

    setLoading(false);
  }, [supabase, slug, moduleId, lessonId]);

  useEffect(() => { loadData(); }, [loadData]);

  const currentModule = modules.find((m) => m.id === moduleId);
  const currentLesson = currentModule?.lessons.find((l) => l.id === lessonId);
  const allLessons = modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id, moduleTitle: m.title })));
  const currentIdx = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  // Bridge embedded interactive HTML lessons -> platform (XP, quiz_attempts, progress).
  // Origin-validated inside the hook; only active for html-embed lessons.
  const isHtmlEmbed = currentLesson?.video_provider === "html" && !!currentLesson?.video_id;
  useLessonBridge({
    supabase,
    lessonId,
    quizId,
    isMock,
    enabled: !!isHtmlEmbed,
    onComplete: () => setIsCompleted(true),
  });

  async function handleMarkComplete() {
    setIsCompleted(true);
    if (!isMock) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("lesson_progress").upsert({
          user_id: user.id,
          lesson_id: lessonId,
          status: "completed",
          progress_pct: 100,
          completed_at: new Date().toISOString(),
        }, { onConflict: "user_id,lesson_id" });

        // +50 XP for completing a lesson (once per lesson).
        if (!(await hasXpForRef(supabase, user.id, "lesson", lessonId))) {
          await awardXp(supabase, user.id, "lesson", XP.LESSON, lessonId);
        }
      }
    }
    if (currentLesson?.has_quiz && quiz) setShowQuiz(true);
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

  const isHtmlLesson = currentLesson.video_provider === "html" && currentLesson.video_id;

  // ── HTML Lesson: full-width embedded, no sidebar ──
  if (isHtmlLesson) {
    return (
      <div className="max-w-[1600px] mx-auto">
        {/* Breadcrumb */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 flex items-center gap-2 text-xs text-midnight-500 font-body">
          <Link href={`/courses/${slug}`} className="hover:text-midnight-300 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            {courseTitle}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-midnight-400">{currentModule.title}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-midnight-300">{currentLesson.title}</span>
        </motion.div>

        {/* Full-width embedded lesson */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <div className="relative w-full rounded-lg overflow-hidden border border-midnight-800" style={{ height: "calc(100vh - 160px)" }}>
            <iframe
              className="absolute inset-0 w-full h-full border-0"
              src={currentLesson.video_id!}
              allow="autoplay; microphone"
              allowFullScreen
              title={currentLesson.title}
              style={{ background: "#FBF7EF" }}
            />
          </div>

          {/* Bottom bar */}
          <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
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
            </div>
            <div className="flex items-center gap-2">
              {prevLesson && (
                <Link href={`/courses/${slug}/${prevLesson.moduleId}/${prevLesson.id}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/50 transition-colors font-body">
                  <ArrowLeft className="w-4 h-4" /> Previous
                </Link>
              )}
              {nextLesson && (
                <Link href={`/courses/${slug}/${nextLesson.moduleId}/${nextLesson.id}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-400/10 text-gold-400 hover:bg-gold-400/20 text-sm transition-colors font-body">
                  Next <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Video Lesson: standard layout with sidebar ──
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
            provider={(currentLesson.video_provider as "youtube" | "mux" | "bunny") || "placeholder"}
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

          {/* Quiz — only when a real quiz row exists for this lesson */}
          {quiz && isCompleted && showQuiz && (
            <div className="mt-6 border-t border-midnight-800 pt-6">
              <h3 className="font-display text-base font-semibold text-midnight-100 mb-1">Lesson Quiz</h3>
              <p className="text-xs text-midnight-500 font-body mb-4">Test your understanding</p>
              <QuizPanel questions={quiz} onComplete={async (score, passed, answers) => {
                // Persist the attempt (report-card data) — real users only.
                if (!isMock && quizId) {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      await supabase.from("quiz_attempts").insert({
                        user_id: user.id,
                        quiz_id: quizId,
                        score,
                        passed,
                        answers: quiz.map((q, i) => ({
                          question: q.question,
                          selected: answers?.[i] ?? null,
                          correct_index: q.correctIndex,
                          is_correct: answers?.[i] === q.correctIndex,
                        })),
                      });

                      // XP: +30 for a pass, +20 bonus at 100% (once per quiz).
                      if (passed && !(await hasXpForRef(supabase, user.id, "quiz", quizId))) {
                        await awardXp(supabase, user.id, "quiz", XP.QUIZ_PASS, quizId);
                        if (score >= 100) {
                          await awardXp(supabase, user.id, "bonus", XP.QUIZ_PERFECT_BONUS, `${quizId}-perfect`);
                        }
                      }
                    }
                  } catch (e) { console.warn("[Quiz] attempt save error:", e); }
                }
                try {
                  const correct = Math.round((score * quiz.length) / 100);
                  const res = await fetch("/api/coach", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "feedback",
                      lesson_id: lessonId,
                      score: correct,
                      total: quiz.length,
                      answers: quiz.map((q, i) => ({ question: q.question, is_correct: i < correct })),
                      audio: true,
                    }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    if (data.audio_url) {
                      const audio = new Audio(data.audio_url);
                      audio.volume = 0.9;
                      audio.play().catch(() => {});
                    }
                  }
                } catch (e) { console.warn("[Coach] Feedback error:", e); }
              }} />
            </div>
          )}
          {quiz && isCompleted && !showQuiz && (
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
                <AiCoachPanel lessonTitle={currentLesson.title} lessonId={lessonId} courseTitle={courseTitle} sectionContent={currentLesson.description || ""} />
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
                  <p className="text-[11px] text-midnight-600 mt-2 font-body">Notes are saved locally in this session</p>
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
                            <span className="text-[11px] text-midnight-600 font-body shrink-0">
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
