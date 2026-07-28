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
import { SectionRule } from "@/components/f0/parts";
import FtaDoor from "@/components/entitlements/FtaDoor";

/* ══════════════════════════════════════════════════════════════════════════
   LESSON VIEWER — /courses/[slug]/[moduleId]/[lessonId]

   Four render paths, one composition language:
     · <LessonEngine>   — a lesson with an authored `steps` sequence
     · HTML embed       — an interactive lesson iframed full-bleed
     · Video + sidebar  — the classic lesson
     · Not-ready / lock — the shared LockedState door

   The surface is EDITORIAL: a masthead, the media object, then prose set on a
   real reading measure (~65ch at 17px). No card containers; hairline rules and
   type scale carry the hierarchy.

   COLOUR LAW: volt orange (the themed `gold-*` ramp) = brand + ACTION, so it
   marks Mark-Complete, the active tab and the next-lesson affordance. Done is
   ink + a check — green/red belong to price. Kai blue is the AI coach's.

   SURFACES are semantic tokens only (paper/ink/soft/sand/card). The prior
   version hardcoded #FBF7EF for the iframe/loader/error stages, which painted a
   cream slab on the dark theme, and used `text-midnight-800` (a SURFACE token)
   as body text, which is invisible on paper in light.

   BEHAVIOUR IS UNCHANGED: same reads, same lesson_progress upsert, same XP /
   belt awards, same quiz_attempts write, same engagement gate, same admin
   draft preview, same register-correct copy.
   ══════════════════════════════════════════════════════════════════════════ */

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
          <div className="absolute inset-0 rounded-full border-2 border-sand" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-volt-500 animate-spin" />
          <BookOpen className="absolute inset-0 m-auto h-5 w-5 text-gold-700" />
        </div>
        <p className="font-display text-[15px] font-bold text-ink">
          Loading your lesson…
        </p>
        <p className="mt-1 text-[13px] text-soft">
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
      <div className="mx-auto max-w-2xl">
        {previewDraft && (
          <div className="mb-4 flex items-start gap-2.5 border-l-2 border-gold-500 py-1.5 pl-3.5">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-700" />
            <p className="max-w-[58ch] text-[13px] leading-snug text-ink">
              <span className="font-display font-bold">Draft preview</span> —
              unpublished content, visible to admins only. Members still see the
              current lesson.
            </p>
          </div>
        )}
        <Breadcrumb
          slug={slug}
          courseTitle={courseTitle}
          moduleTitle={currentModule.title}
        />
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
    { id: "coach", label: "Coach", icon: Bot },
    { id: "notes", label: "Notes", icon: StickyNote },
    { id: "lessons", label: "Lessons", icon: List },
  ];

  const isHtmlLesson = currentLesson.video_provider === "html" && currentLesson.video_id;

  /* ── HTML lesson: the embed IS the surface, full-bleed ───────────────── */
  if (isHtmlLesson) {
    return (
      <div className="mx-auto max-w-[1400px] pb-10">
        <Celebrate
          opts={celebrateQueue[0] ?? null}
          onDone={() => setCelebrateQueue((q) => q.slice(1))}
        />
        <Breadcrumb
          slug={slug}
          courseTitle={courseTitle}
          moduleTitle={currentModule.title}
          lessonTitle={currentLesson.title}
        />

        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <div
            className="relative w-full overflow-hidden rounded-2xl border border-sand"
            style={{ height: "calc(100vh - 180px)" }}
          >
            <iframe
              key={frameNonce}
              className="absolute inset-0 h-full w-full border-0"
              src={currentLesson.video_id!}
              allow="autoplay; microphone"
              allowFullScreen
              title={currentLesson.title}
              style={{ background: "var(--paper)" }}
              onLoad={() => setFrameState("ok")}
              onError={() => setFrameState("error")}
            />

            {/* Branded overlay while the embed boots — reliable but slow on
                phones, so the frame never reads as a dead blank (audit #25).
                Token surfaces only: this used to be a hardcoded #FBF7EF slab. */}
            {frameState === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper text-center">
                <div className="relative h-11 w-11">
                  <div className="absolute inset-0 rounded-full border-2 border-sand" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-volt-500 animate-spin" />
                  <BookOpen className="absolute inset-0 m-auto h-4 w-4 text-gold-700" />
                </div>
                <p className="font-display text-[15px] font-bold text-ink">
                  Loading the lesson…
                </p>
              </div>
            )}

            {/* Recover path if the embed genuinely fails to load. */}
            {frameState === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
                <BookOpen className="h-8 w-8 text-soft" />
                <p className="max-w-[46ch] text-[15px] leading-relaxed text-ink">
                  This lesson didn&apos;t load. Try again, or open it in a new
                  tab.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setFrameState("loading");
                      setFrameNonce((n) => n + 1);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-volt-500 px-4 py-2.5 font-display text-[14px] font-bold text-white transition-transform active:scale-[0.98]"
                  >
                    <RotateCw className="h-4 w-4" />
                    Try again
                  </button>
                  <a
                    href={currentLesson.video_id!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-sand px-4 py-2.5 font-display text-[14px] font-bold text-ink transition-colors hover:border-gold-500"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Action ledger under the embed */}
          <div className="f0-rule-top mt-4 flex flex-wrap items-center justify-between gap-4 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <CompleteControl
                completed={isCompleted}
                engaged={engaged}
                hint="Look through the lesson first"
                onMark={handleMarkComplete}
              />
              <PracticeInSimbotLink lessonId={lessonId} />
            </div>
            <LessonNav slug={slug} prev={prevLesson} next={nextLesson} />
          </div>
        </m.div>
      </div>
    );
  }

  /* ── Video lesson: reading column + companion rail ───────────────────── */
  return (
    <div className="mx-auto max-w-[1200px] pb-16">
      <Celebrate
        opts={celebrateQueue[0] ?? null}
        onDone={() => setCelebrateQueue((q) => q.slice(1))}
      />
      <Breadcrumb
        slug={slug}
        courseTitle={courseTitle}
        moduleTitle={currentModule.title}
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Main — masthead, media, prose */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="min-w-0 flex-1"
        >
          <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
            {currentModule.title}
          </p>
          <h1 className="mt-2 max-w-[26ch] font-display text-display-2 font-extrabold leading-[1.05] text-ink">
            {currentLesson.title}
          </h1>
          {currentLesson.video_duration_sec ? (
            <p className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[12px] tabular-nums text-soft">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(currentLesson.video_duration_sec)}
            </p>
          ) : null}

          <div className="mt-5">
            <VideoPlayer
              provider={(currentLesson.video_provider as "youtube" | "mux" | "bunny") || "placeholder"}
              videoId={currentLesson.video_id || undefined}
              title={currentLesson.title}
            />
          </div>

          {/* Action ledger */}
          <div className="f0-rule-top mt-5 flex flex-wrap items-center gap-3 pt-4">
            <CompleteControl
              completed={isCompleted}
              engaged={engaged}
              hint="Watch a bit of the lesson first"
              onMark={handleMarkComplete}
            />
            <PracticeInSimbotLink lessonId={lessonId} />
          </div>

          {/* THE MOMENT AFTER. A lesson just landed; this is when the longer
              road is worth naming — once, quietly, under the Completed pill.
              Never to kids (belt and braces over FtaDoor's own register check,
              which also excludes teens and existing FTA members). */}
          {isCompleted && register !== "kid" && (
            <FtaDoor line="You finished the lesson. FTA is the six-week version — live, coached, all the way to trade ready." />
          )}

          {/* Prose — a real reading measure, editorial scale */}
          {currentLesson.description && (
            <section className="mt-8 space-y-4">
              <SectionRule>About this lesson</SectionRule>
              <p className="max-w-[65ch] text-[17px] leading-[1.7] text-ink">
                {currentLesson.description}
              </p>
            </section>
          )}

          {/* Quiz — only when a real quiz row exists for this lesson */}
          {quiz && isCompleted && showQuiz && (
            <section className="mt-10 space-y-4">
              <SectionRule>Lesson quiz</SectionRule>
              <p className="max-w-[58ch] text-[13px] text-soft">
                Ten seconds of honesty about what stuck.
              </p>
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
            </section>
          )}
          {quiz && isCompleted && !showQuiz && (
            <div className="mt-6">
              <button
                onClick={() => setShowQuiz(true)}
                className="inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600"
              >
                <BookOpen className="h-4 w-4" />
                Take the lesson quiz
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Where next */}
          <div className="f0-rule-top mt-10 flex items-center justify-between gap-4 pt-4">
            <LessonNav slug={slug} prev={prevLesson} next={nextLesson} />
          </div>
        </m.div>

        {/* Companion rail — coach / notes / the rest of the path */}
        <m.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="shrink-0 lg:w-[340px] xl:w-[380px] lg:border-l lg:border-sand lg:pl-6"
        >
          <div
            className="flex flex-col lg:sticky lg:top-4"
            style={{ height: "calc(100vh - 120px)" }}
          >
            {/* Tabs — a hairline rail, not a segmented pill */}
            <div
              role="tablist"
              aria-label="Lesson companion"
              className="flex shrink-0 gap-6 border-b border-sand"
            >
              {sideTabs.map((tab) => {
                const on = sideTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={on}
                    onClick={() => setSideTab(tab.id)}
                    className={`relative -mb-px flex items-center gap-1.5 pb-3 font-display text-[13px] font-extrabold uppercase tracking-[0.08em] transition-colors ${
                      on ? "text-ink" : "text-soft hover:text-ink"
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {on && (
                      <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-volt-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="min-h-0 flex-1 overflow-hidden pt-3">
              {sideTab === "coach" && (
                <AiCoachPanel lessonTitle={currentLesson.title} lessonId={lessonId} courseTitle={courseTitle} sectionContent={currentLesson.description || ""} />
              )}

              {sideTab === "notes" && (
                <div className="flex h-full flex-col">
                  <p className="text-[13px] text-soft">
                    Personal notes for this lesson
                  </p>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Type your notes here…"
                    className="mt-2 w-full flex-1 resize-none rounded-xl border border-sand bg-card p-3 text-[14px] leading-relaxed text-ink placeholder:text-soft focus:border-gold-500 focus:outline-none"
                  />
                  <p className="mt-2 font-mono text-[11px] text-soft">
                    Saved locally in this session
                  </p>
                </div>
              )}

              {sideTab === "lessons" && (
                <div className="h-full overflow-y-auto pr-1">
                  {modules.map((mod) => (
                    <div key={mod.id} className="mb-4">
                      <p className="text-eyebrow font-display font-bold uppercase text-soft">
                        {mod.title}
                      </p>
                      <div className="f0-ledger mt-1">
                        {mod.lessons.map((lesson) => {
                          const isActive = lesson.id === lessonId;
                          return (
                            <Link
                              key={lesson.id}
                              href={`/courses/${slug}/${mod.id}/${lesson.id}`}
                              aria-current={isActive ? "true" : undefined}
                              className="f0-ledger-row"
                            >
                              <Play
                                className={`h-3 w-3 shrink-0 self-center ${
                                  isActive ? "text-gold-700" : "text-soft"
                                }`}
                              />
                              <span
                                className={`min-w-0 flex-1 truncate text-[14px] ${
                                  isActive
                                    ? "font-display font-bold text-ink"
                                    : "text-soft"
                                }`}
                              >
                                {lesson.title}
                              </span>
                              <span className="shrink-0 self-center font-mono text-[11px] tabular-nums text-soft">
                                {formatDuration(lesson.video_duration_sec)}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
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

/** The lesson's place in the path, as a mono trail. */
function Breadcrumb({
  slug,
  courseTitle,
  moduleTitle,
  lessonTitle,
}: {
  slug: string;
  courseTitle: string;
  moduleTitle: string;
  lessonTitle?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-4 flex flex-wrap items-center gap-1.5 font-mono text-[12px] text-soft"
    >
      <Link
        href={`/courses/${slug}`}
        className="inline-flex items-center gap-1.5 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {courseTitle || "Course"}
      </Link>
      <ChevronRight className="h-3 w-3" />
      <span>{moduleTitle}</span>
      {lessonTitle && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="text-ink">{lessonTitle}</span>
        </>
      )}
    </m.div>
  );
}

/** Mark-complete: the ACTION (volt) until it is done, then ink + a check.
 *  Gated on the engagement rule, exactly as before. */
function CompleteControl({
  completed,
  engaged,
  hint,
  onMark,
}: {
  completed: boolean;
  engaged: boolean;
  hint: string;
  onMark: () => void;
}) {
  if (completed) {
    return (
      <span className="inline-flex items-center gap-2 font-display text-[14px] font-bold text-ink">
        <Check className="h-4 w-4" />
        Completed
      </span>
    );
  }
  return (
    <button
      onClick={onMark}
      disabled={!engaged}
      title={engaged ? undefined : hint}
      className="inline-flex items-center gap-2 rounded-full bg-volt-500 px-5 py-2.5 font-display text-[14px] font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Check className="h-4 w-4" />
      Mark complete
    </button>
  );
}

/** Previous / next as a pair of text actions on a hairline — no button chrome. */
function LessonNav({
  slug,
  prev,
  next,
}: {
  slug: string;
  prev: { id: string; moduleId: string; title: string } | null;
  next: { id: string; moduleId: string; title: string } | null;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      {prev ? (
        <Link
          href={`/courses/${slug}/${prev.moduleId}/${prev.id}`}
          className="group inline-flex min-w-0 items-center gap-2 text-left"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-soft transition-colors group-hover:text-ink" />
          <span className="min-w-0">
            <span className="block text-eyebrow font-display font-bold uppercase text-soft">
              Previous
            </span>
            <span className="block truncate font-display text-[14px] font-bold text-ink">
              {prev.title}
            </span>
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`/courses/${slug}/${next.moduleId}/${next.id}`}
          className="group inline-flex min-w-0 items-center gap-2 text-right"
        >
          <span className="min-w-0">
            <span className="block text-eyebrow font-display font-bold uppercase text-gold-700">
              Next
            </span>
            <span className="block truncate font-display text-[14px] font-bold text-ink">
              {next.title}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-gold-700" />
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
