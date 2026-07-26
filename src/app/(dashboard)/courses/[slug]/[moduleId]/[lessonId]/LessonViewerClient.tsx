"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { m } from "@/lib/motion";
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
  RotateCw,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, hasXpForRef, getUserXp } from "@/lib/xp";
import { useLessonBridge } from "@/lib/lesson-bridge";
import { deriveRegister, celebrateRegister, type Register } from "@/lib/register";
import VideoPlayer from "@/components/dashboard/VideoPlayer";
import QuizPanel from "@/components/dashboard/QuizPanel";
import AiCoachPanel from "@/components/dashboard/AiCoachPanel";
import LockedState from "@/components/dashboard/LockedState";
import Celebrate, {
  type CelebrateOptions,
} from "@/components/fic/Celebrate";
import { beltCelebrateFields } from "@/lib/belts";
import { Sparkles } from "lucide-react";
import PracticeInSimbotLink from "@/components/simulator/PracticeInSimbotLink";
import LessonEngine from "@/components/learn/LessonEngine/LessonEngine";
import { parseLessonSteps } from "@/lib/learn/schema";

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
  // Learning World P2: native interactive step sequence. Non-null => the lesson
  // renders in <LessonEngine>; null => the legacy video/html/iframe paths below.
  steps: unknown | null;
  // Learning World P5: DRAFT step sequence, admin-preview only (?draft=1).
  // Never rendered for members; only used when an admin appends ?draft=1.
  steps_draft: unknown | null;
  lesson_xp: number | null;
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
      steps: null,
      steps_draft: null,
      lesson_xp: null,
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

export default function LessonViewerClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  // Admin-only draft preview: /courses/.../lessonId?draft=1 renders steps_draft
  // in the REAL engine so THE OWNER can review before publishing. Gated on
  // isAdmin below — a non-admin appending ?draft=1 sees the normal lesson.
  const draftMode = searchParams.get("draft") === "1";
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
  const [notFound, setNotFound] = useState(false);
  const [register, setRegister] = useState<Register>("adult");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [celebrateQueue, setCelebrateQueue] = useState<CelebrateOptions[]>([]);
  // HTML-lesson iframe resilience (audit #25): the embed is reliable but slow
  // to appear on phones; a bare frame reads as "failed to resolve". Track its
  // load so we can show a branded overlay while it boots and a recover path if
  // it errors, instead of a blank paper box.
  const [frameState, setFrameState] = useState<"loading" | "ok" | "error">(
    "loading"
  );
  const [frameNonce, setFrameNonce] = useState(0);
  // Reset the frame state whenever the lesson changes so the overlay re-arms.
  useEffect(() => {
    setFrameState("loading");
  }, [lessonId]);

  const enqueueCelebrate = useCallback(
    (o: CelebrateOptions) => setCelebrateQueue((q) => [...q, o]),
    []
  );

  const loadData = useCallback(async () => {
    // Who are we talking to? Drives the register-correct "unlocks soon" copy and
    // the completion celebration.
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) {
      setUserId(authUser.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, age_group, track, family_id")
        .eq("id", authUser.id)
        .maybeSingle();
      if (profile) {
        setRegister(deriveRegister(profile));
        setFamilyId((profile as { family_id?: string | null }).family_id ?? null);
        setIsAdmin((profile as { role?: string | null }).role === "admin");
      }
    }

    // Try Supabase first
    const { data: course } = await supabase
      .from("courses")
      .select("id, title")
      .eq("slug", slug)
      .maybeSingle();

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
            .select("id, title, description, video_provider, video_id, video_duration_sec, has_quiz, sort_order, module_id, steps, steps_draft, lesson_xp")
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
    } else {
      // Neither the DB nor the mock catalog has this lesson. The most common
      // real cause (verified for fic-kids-corner) is an UNPUBLISHED course: RLS
      // hides published=false courses/modules/lessons from members, so the query
      // returns nothing. That's a not-ready state, not an error — render a
      // register-correct "unlocks soon" screen instead of a dead "Lesson Not
      // Found" (audit #2).
      setNotFound(true);
    }

    setLoading(false);
  }, [supabase, slug, moduleId, lessonId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Light-touch engagement gate (audit #14): "Mark Complete" unlocks once the
  // member has actually spent a little time on the lesson or scrolled through it,
  // rather than being clickable the instant the page paints. Already-completed
  // lessons skip the gate.
  useEffect(() => {
    if (isCompleted) { setEngaged(true); return; }
    setEngaged(false);
    const dwell = setTimeout(() => setEngaged(true), 8000);
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (total > 0 && scrolled >= total * 0.5) setEngaged(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(dwell);
      window.removeEventListener("scroll", onScroll);
    };
  }, [lessonId, isCompleted]);

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
    if (isCompleted) return;
    setIsCompleted(true);

    // Celebrate the core action IMMEDIATELY (audit #4) — before the DB
    // round-trips — so the reward moment lands the instant you click, not a
    // second later. Kid gets confetti energy, teen/parent a quieter moment;
    // both get the +50 XP pop instead of a silent flip to "Completed".
    enqueueCelebrate({
      variant: "mission",
      register: celebrateRegister(register),
      title: register === "kid" ? "Lesson done!" : "Lesson complete",
      subtitle: currentLesson?.title,
      xp: XP.LESSON,
    });

    if (currentLesson?.has_quiz && quiz) setShowQuiz(true);

    // Persist + award XP in the background; enqueue a level-up moment if the
    // threshold was actually crossed.
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

        if (!(await hasXpForRef(supabase, user.id, "lesson", lessonId))) {
          const prevXp = await getUserXp(supabase, user.id);
          await awardXp(supabase, user.id, "lesson", XP.LESSON, lessonId);
          const belt = beltCelebrateFields(prevXp, prevXp + XP.LESSON, register === "kid");
          if (belt) {
            enqueueCelebrate({
              variant: "levelup",
              register: celebrateRegister(register),
              ...belt,
            });
          }
        }
      }
    }
  }

  if (loading) {
    // Branded lesson loader (audit #25): the course-data fetch can take a few
    // seconds on a phone; a titled loading state reads as "loading" rather than
    // "broken" during that window.
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="relative mb-4 h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-gold-400/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold-400 animate-spin" />
          <BookOpen className="absolute inset-0 m-auto h-5 w-5 text-gold-500" />
        </div>
        <p className="font-display text-sm font-semibold text-midnight-200">
          Loading your lesson…
        </p>
        <p className="mt-1 text-xs text-midnight-500">
          Getting the chart and narration ready.
        </p>
      </div>
    );
  }

  if (notFound || !currentModule || !currentLesson) {
    const kid = register === "kid";
    // Same unified LockedState the free / FTA doors use — but as a "not-ready"
    // (coming-soon) state: amber Sparkles badge, no lock stamp, register-correct
    // copy, and a "back to course" CTA instead of an upsell (audit #2, #22).
    return (
      <LockedState
        icon={Sparkles}
        tone="amber"
        lockBadge={false}
        title={kid ? "This adventure unlocks soon!" : "This lesson isn't ready yet"}
        body={
          kid
            ? "We're still polishing this one for you. Check back soon — there's so much cool stuff coming!"
            : "This lesson is still being prepared. It'll appear here as soon as it's published."
        }
        cta={{
          label: kid ? "Back to my lessons" : "Back to course",
          href: `/courses/${slug}`,
        }}
      />
    );
  }

  // ── Learning World P2: native interactive lesson ──
  // ONE top branch (proposal §3): a lesson with a non-null `steps` renders in
  // <LessonEngine>; everything else falls through to the legacy video/html/mock
  // paths below, untouched. Migration is lesson-by-lesson with zero dead URLs.
  // Admin draft preview picks steps_draft (176/177) instead of the live steps —
  // the same engine, so the owner reviews exactly what members would see once
  // published. Non-admins never reach this branch (draftMode is ignored).
  const previewDraft = draftMode && isAdmin;
  const stepsSource = previewDraft
    ? currentLesson.steps_draft
    : currentLesson.steps;
  const parsedLesson = !isMock
    ? parseLessonSteps(stepsSource, {
        title: currentLesson.title,
        xp: currentLesson.lesson_xp ?? XP.LESSON,
      })
    : null;
  if (parsedLesson) {
    return (
      <div className="max-w-[1400px] mx-auto">
        {previewDraft && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-body text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            DRAFT PREVIEW — this is unpublished draft content, visible to admins
            only. Members still see the current lesson.
          </div>
        )}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 flex items-center gap-2 text-xs text-midnight-500 font-body"
        >
          <Link
            href={`/courses/${slug}`}
            className="hover:text-midnight-300 transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {courseTitle}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-midnight-400">{currentModule.title}</span>
        </m.div>
        <LessonEngine
          lesson={parsedLesson}
          lessonId={lessonId}
          quizId={quizId}
          register={register}
          supabase={supabase}
          userId={userId}
          familyId={familyId}
          courseTitle={courseTitle}
          moduleTitle={currentModule.title}
          backHref={`/courses/${slug}`}
          nextHref={
            nextLesson
              ? `/courses/${slug}/${nextLesson.moduleId}/${nextLesson.id}`
              : null
          }
        />
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
        <Celebrate
          opts={celebrateQueue[0] ?? null}
          onDone={() => setCelebrateQueue((q) => q.slice(1))}
        />
        {/* Breadcrumb */}
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 flex items-center gap-2 text-xs text-midnight-500 font-body">
          <Link href={`/courses/${slug}`} className="hover:text-midnight-300 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            {courseTitle}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-midnight-400">{currentModule.title}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-midnight-300">{currentLesson.title}</span>
        </m.div>

        {/* Full-width embedded lesson */}
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <div className="relative w-full rounded-lg overflow-hidden border border-midnight-800" style={{ height: "calc(100vh - 160px)" }}>
            <iframe
              key={frameNonce}
              className="absolute inset-0 w-full h-full border-0"
              src={currentLesson.video_id!}
              allow="autoplay; microphone"
              allowFullScreen
              title={currentLesson.title}
              style={{ background: "#FBF7EF" }}
              onLoad={() => setFrameState("ok")}
              onError={() => setFrameState("error")}
            />

            {/* Branded overlay while the embed boots — reliable but slow on
                phones, so the frame never reads as a dead blank (audit #25). */}
            {frameState === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#FBF7EF] text-center">
                <div className="relative h-11 w-11">
                  <div className="absolute inset-0 rounded-full border-2 border-gold-400/25" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold-500 animate-spin" />
                  <BookOpen className="absolute inset-0 m-auto h-4 w-4 text-gold-600" />
                </div>
                <p className="font-display text-sm font-semibold text-midnight-800">
                  Loading the lesson…
                </p>
              </div>
            )}

            {/* Recover path if the embed genuinely fails to load. */}
            {frameState === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#FBF7EF] px-6 text-center">
                <BookOpen className="h-8 w-8 text-gold-600" />
                <p className="max-w-sm text-sm text-midnight-800">
                  This lesson didn&apos;t load. Try again, or open it in a new
                  tab.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setFrameState("loading");
                      setFrameNonce((n) => n + 1);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-sm font-display font-semibold text-white transition-colors hover:bg-gold-600"
                  >
                    <RotateCw className="h-4 w-4" />
                    Try again
                  </button>
                  <a
                    href={currentLesson.video_id!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sand px-4 py-2 text-sm font-medium text-midnight-800 transition-colors hover:bg-white/60"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {!isCompleted ? (
                <button
                  onClick={handleMarkComplete}
                  disabled={!engaged}
                  title={engaged ? undefined : "Look through the lesson first"}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-400 text-midnight-950 text-sm font-display font-semibold hover:bg-gold-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  Mark Complete
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-body">
                  <Check className="w-4 h-4" />
                  Completed
                </div>
              )}
              <PracticeInSimbotLink lessonId={lessonId} />
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
        </m.div>
      </div>
    );
  }

  // ── Video Lesson: standard layout with sidebar ──
  return (
    <div className="max-w-[1400px] mx-auto">
      <Celebrate
        opts={celebrateQueue[0] ?? null}
        onDone={() => setCelebrateQueue((q) => q.slice(1))}
      />
      {/* Breadcrumb */}
      <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 flex items-center gap-2 text-xs text-midnight-500 font-body">
        <Link href={`/courses/${slug}`} className="hover:text-midnight-300 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          {courseTitle}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-midnight-400">{currentModule.title}</span>
      </m.div>

      <div className="flex flex-col lg:flex-row gap-0">
        {/* Main — video + info */}
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex-1 min-w-0">
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
                <button
                  onClick={handleMarkComplete}
                  disabled={!engaged}
                  title={engaged ? undefined : "Watch a bit of the lesson first"}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-400 text-midnight-950 text-sm font-display font-semibold hover:bg-gold-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
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

          {/* Practice cross-link — only for lessons with a Simbot analogue */}
          <div className="mt-4 empty:mt-0">
            <PracticeInSimbotLink lessonId={lessonId} />
          </div>

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
                // Modest register-correct win on a pass (audit #21). Kid gets
                // confetti energy; teen/parent a quieter seal moment.
                if (passed) {
                  enqueueCelebrate({
                    variant: "mission",
                    register: celebrateRegister(register),
                    title: register === "kid" ? "Quiz aced!" : "Quiz passed",
                    subtitle: score >= 100 ? "Perfect score!" : `You scored ${score}%`,
                  });
                }
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
        </m.div>

        {/* Side Panel */}
        <m.aside
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
        </m.aside>
      </div>
    </div>
  );
}
