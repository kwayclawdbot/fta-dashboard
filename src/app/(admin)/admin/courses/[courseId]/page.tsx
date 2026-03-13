"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Save,
  ChevronDown,
  ChevronRight,
  GripVertical,
  X,
  FileText,
  Video,
  HelpCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface LessonData {
  id: string;
  title: string;
  description: string | null;
  video_provider: string | null;
  video_id: string | null;
  video_duration_sec: number | null;
  drip_week: number | null;
  has_quiz: boolean;
  sort_order: number;
  module_id: string;
}

interface ModuleData {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  track: string | null;
  course_id: string;
  lessons: LessonData[];
}

interface CourseData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  min_tier: string | null;
  sort_order: number;
  published: boolean;
}

export default function CourseEditorPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const supabase = createClient();

  const [course, setCourse] = useState<CourseData | null>(null);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Course edit form
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editThumbnail, setEditThumbnail] = useState("");
  const [editTier, setEditTier] = useState("challenge");
  const [editPublished, setEditPublished] = useState(false);

  // Expanded modules
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set()
  );

  // Module form modal
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleFormTitle, setModuleFormTitle] = useState("");
  const [moduleFormDescription, setModuleFormDescription] = useState("");
  const [moduleFormTrack, setModuleFormTrack] = useState("adults");
  const [moduleFormSort, setModuleFormSort] = useState(0);

  // Lesson form modal
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonFormModuleId, setLessonFormModuleId] = useState("");
  const [lessonFormTitle, setLessonFormTitle] = useState("");
  const [lessonFormDescription, setLessonFormDescription] = useState("");
  const [lessonFormVideoProvider, setLessonFormVideoProvider] = useState("youtube");
  const [lessonFormVideoId, setLessonFormVideoId] = useState("");
  const [lessonFormDuration, setLessonFormDuration] = useState(0);
  const [lessonFormDripWeek, setLessonFormDripWeek] = useState(0);
  const [lessonFormHasQuiz, setLessonFormHasQuiz] = useState(false);
  const [lessonFormSort, setLessonFormSort] = useState(0);

  // Quiz editor modal
  const [showQuizEditor, setShowQuizEditor] = useState(false);
  const [quizLessonId, setQuizLessonId] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizPassingScore, setQuizPassingScore] = useState(70);

  const loadCourse = useCallback(async () => {
    const { data: courseData } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();

    if (!courseData) {
      router.push("/admin/courses");
      return;
    }

    setCourse(courseData);
    setEditTitle(courseData.title);
    setEditSlug(courseData.slug);
    setEditDescription(courseData.description || "");
    setEditThumbnail(courseData.thumbnail_url || "");
    setEditTier(courseData.min_tier || "challenge");
    setEditPublished(courseData.published);

    const { data: mods } = await supabase
      .from("modules")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order");

    if (mods) {
      const withLessons: ModuleData[] = [];
      for (const mod of mods) {
        const { data: lessons } = await supabase
          .from("lessons")
          .select("*")
          .eq("module_id", mod.id)
          .order("sort_order");
        withLessons.push({ ...mod, lessons: lessons || [] });
      }
      setModules(withLessons);
      if (withLessons.length > 0) {
        setExpandedModules(new Set([withLessons[0].id]));
      }
    }

    setLoading(false);
  }, [supabase, courseId, router]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  async function handleSaveCourse() {
    setSaving(true);
    await supabase
      .from("courses")
      .update({
        title: editTitle,
        slug: editSlug,
        description: editDescription || null,
        thumbnail_url: editThumbnail || null,
        min_tier: editTier,
        published: editPublished,
      })
      .eq("id", courseId);
    setSaving(false);
  }

  function toggleModule(id: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Module CRUD
  function openAddModule() {
    setEditingModuleId(null);
    setModuleFormTitle("");
    setModuleFormDescription("");
    setModuleFormTrack("adults");
    setModuleFormSort(modules.length);
    setShowModuleForm(true);
  }

  function openEditModule(mod: ModuleData) {
    setEditingModuleId(mod.id);
    setModuleFormTitle(mod.title);
    setModuleFormDescription(mod.description || "");
    setModuleFormTrack(mod.track || "adults");
    setModuleFormSort(mod.sort_order);
    setShowModuleForm(true);
  }

  async function handleSaveModule() {
    setSaving(true);
    const payload = {
      course_id: courseId,
      title: moduleFormTitle,
      description: moduleFormDescription || null,
      track: moduleFormTrack,
      sort_order: moduleFormSort,
    };

    if (editingModuleId) {
      await supabase.from("modules").update(payload).eq("id", editingModuleId);
    } else {
      await supabase.from("modules").insert(payload);
    }

    setSaving(false);
    setShowModuleForm(false);
    setLoading(true);
    loadCourse();
  }

  async function handleDeleteModule(id: string) {
    if (!confirm("Delete this module and all its lessons?")) return;
    await supabase.from("lessons").delete().eq("module_id", id);
    await supabase.from("modules").delete().eq("id", id);
    setLoading(true);
    loadCourse();
  }

  // Lesson CRUD
  function openAddLesson(moduleId: string) {
    const mod = modules.find((m) => m.id === moduleId);
    setEditingLessonId(null);
    setLessonFormModuleId(moduleId);
    setLessonFormTitle("");
    setLessonFormDescription("");
    setLessonFormVideoProvider("youtube");
    setLessonFormVideoId("");
    setLessonFormDuration(0);
    setLessonFormDripWeek(0);
    setLessonFormHasQuiz(false);
    setLessonFormSort(mod?.lessons.length ?? 0);
    setShowLessonForm(true);
  }

  function openEditLesson(lesson: LessonData) {
    setEditingLessonId(lesson.id);
    setLessonFormModuleId(lesson.module_id);
    setLessonFormTitle(lesson.title);
    setLessonFormDescription(lesson.description || "");
    setLessonFormVideoProvider(lesson.video_provider || "youtube");
    setLessonFormVideoId(lesson.video_id || "");
    setLessonFormDuration(lesson.video_duration_sec || 0);
    setLessonFormDripWeek(lesson.drip_week || 0);
    setLessonFormHasQuiz(lesson.has_quiz);
    setLessonFormSort(lesson.sort_order);
    setShowLessonForm(true);
  }

  async function handleSaveLesson() {
    setSaving(true);
    const payload = {
      module_id: lessonFormModuleId,
      title: lessonFormTitle,
      description: lessonFormDescription || null,
      video_provider: lessonFormVideoProvider || null,
      video_id: lessonFormVideoId || null,
      video_duration_sec: lessonFormDuration || null,
      drip_week: lessonFormDripWeek || null,
      has_quiz: lessonFormHasQuiz,
      sort_order: lessonFormSort,
    };

    if (editingLessonId) {
      await supabase.from("lessons").update(payload).eq("id", editingLessonId);
    } else {
      await supabase.from("lessons").insert(payload);
    }

    setSaving(false);
    setShowLessonForm(false);
    setLoading(true);
    loadCourse();
  }

  async function handleDeleteLesson(id: string) {
    if (!confirm("Delete this lesson?")) return;
    // Delete quiz if exists
    await supabase.from("quizzes").delete().eq("lesson_id", id);
    await supabase.from("lessons").delete().eq("id", id);
    setLoading(true);
    loadCourse();
  }

  // Quiz CRUD
  async function openQuizEditor(lessonId: string) {
    setQuizLessonId(lessonId);
    const { data: quiz } = await supabase
      .from("quizzes")
      .select("*")
      .eq("lesson_id", lessonId)
      .single();

    if (quiz) {
      setQuizQuestions(quiz.questions as QuizQuestion[]);
      setQuizPassingScore(quiz.passing_score);
    } else {
      setQuizQuestions([
        { question: "", options: ["", "", "", ""], correctIndex: 0 },
      ]);
      setQuizPassingScore(70);
    }
    setShowQuizEditor(true);
  }

  function addQuizQuestion() {
    setQuizQuestions([
      ...quizQuestions,
      { question: "", options: ["", "", "", ""], correctIndex: 0 },
    ]);
  }

  function removeQuizQuestion(idx: number) {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== idx));
  }

  function updateQuizQuestion(idx: number, field: string, value: string | number) {
    setQuizQuestions(
      quizQuestions.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    );
  }

  function updateQuizOption(qIdx: number, oIdx: number, value: string) {
    setQuizQuestions(
      quizQuestions.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) }
          : q
      )
    );
  }

  async function handleSaveQuiz() {
    setSaving(true);
    // Check if quiz exists
    const { data: existing } = await supabase
      .from("quizzes")
      .select("id")
      .eq("lesson_id", quizLessonId)
      .single();

    const payload = {
      lesson_id: quizLessonId,
      questions: quizQuestions,
      passing_score: quizPassingScore,
    };

    if (existing) {
      await supabase.from("quizzes").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("quizzes").insert(payload);
    }

    setSaving(false);
    setShowQuizEditor(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!course) return null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/admin/courses"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to courses
      </Link>

      {/* Course details form */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-8">
        <h2 className="text-lg font-bold text-zinc-100 mb-4">
          Course Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Slug</label>
            <input
              type="text"
              value={editSlug}
              onChange={(e) => setEditSlug(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-zinc-400 mb-1">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Thumbnail URL
            </label>
            <input
              type="text"
              value={editThumbnail}
              onChange={(e) => setEditThumbnail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
            />
          </div>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1">
                Min Tier
              </label>
              <select
                value={editTier}
                onChange={(e) => setEditTier(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
              >
                <option value="challenge">Challenge</option>
                <option value="academy">Academy</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={editPublished}
                onChange={(e) => setEditPublished(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-800 text-amber-400 focus:ring-amber-400/50"
              />
              <span className="text-sm text-zinc-300">Published</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveCourse}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Course"}
          </button>
        </div>
      </div>

      {/* Modules & Lessons */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-zinc-100">
          Modules & Lessons
        </h2>
        <button
          onClick={openAddModule}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm transition-colors border border-zinc-700"
        >
          <Plus className="w-4 h-4" />
          Add Module
        </button>
      </div>

      {modules.length === 0 ? (
        <div className="text-center py-12 border border-zinc-800 rounded-xl">
          <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">
            No modules yet. Add your first module to start building the course.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {modules.map((mod, mi) => {
            const isExpanded = expandedModules.has(mod.id);
            return (
              <div
                key={mod.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden"
              >
                {/* Module header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <GripVertical className="w-4 h-4 text-zinc-600 shrink-0" />
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="flex-1 flex items-center gap-2 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        {mod.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {mod.lessons.length} lesson
                        {mod.lessons.length !== 1 ? "s" : ""}
                        {mod.track ? ` | ${mod.track}` : ""}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModule(mod)}
                      className="p-1.5 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteModule(mod.id)}
                      className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Lessons */}
                {isExpanded && (
                  <div className="border-t border-zinc-800/50">
                    {mod.lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/20 transition-colors"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-zinc-700 shrink-0 ml-4" />
                        <Video className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-200 truncate">
                            {lesson.title}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-0.5">
                            {lesson.video_provider && (
                              <span>{lesson.video_provider}</span>
                            )}
                            {lesson.video_duration_sec && (
                              <span>
                                {Math.round(lesson.video_duration_sec / 60)} min
                              </span>
                            )}
                            {lesson.drip_week && lesson.drip_week > 0 && (
                              <span>Week {lesson.drip_week}</span>
                            )}
                            {lesson.has_quiz && (
                              <span className="text-amber-400">Has quiz</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {lesson.has_quiz && (
                            <button
                              onClick={() => openQuizEditor(lesson.id)}
                              className="p-1.5 rounded text-zinc-400 hover:text-purple-400 hover:bg-zinc-800 transition-colors"
                              title="Edit quiz"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditLesson(lesson)}
                            className="p-1.5 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add lesson button */}
                    <div className="px-4 py-2">
                      <button
                        onClick={() => openAddLesson(mod.id)}
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add lesson
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Module Form Modal */}
      {showModuleForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-100">
                {editingModuleId ? "Edit Module" : "Add Module"}
              </h2>
              <button
                onClick={() => setShowModuleForm(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={moduleFormTitle}
                  onChange={(e) => setModuleFormTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  placeholder="Module 1: Getting Started"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  value={moduleFormDescription}
                  onChange={(e) => setModuleFormDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Track
                  </label>
                  <select
                    value={moduleFormTrack}
                    onChange={(e) => setModuleFormTrack(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  >
                    <option value="kids">Kids</option>
                    <option value="adults">Adults</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={moduleFormSort}
                    onChange={(e) =>
                      setModuleFormSort(parseInt(e.target.value) || 0)
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModuleForm(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModule}
                disabled={saving || !moduleFormTitle}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editingModuleId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Form Modal */}
      {showLessonForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-100">
                {editingLessonId ? "Edit Lesson" : "Add Lesson"}
              </h2>
              <button
                onClick={() => setShowLessonForm(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={lessonFormTitle}
                  onChange={(e) => setLessonFormTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  placeholder="What is the Stock Market?"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  value={lessonFormDescription}
                  onChange={(e) => setLessonFormDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Video Provider
                  </label>
                  <select
                    value={lessonFormVideoProvider}
                    onChange={(e) =>
                      setLessonFormVideoProvider(e.target.value)
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="bunny">Bunny</option>
                    <option value="mux">Mux</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Video ID
                  </label>
                  <input
                    type="text"
                    value={lessonFormVideoId}
                    onChange={(e) => setLessonFormVideoId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                    placeholder="dQw4w9WgXcQ"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Duration (sec)
                  </label>
                  <input
                    type="number"
                    value={lessonFormDuration}
                    onChange={(e) =>
                      setLessonFormDuration(parseInt(e.target.value) || 0)
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Drip Week
                  </label>
                  <input
                    type="number"
                    value={lessonFormDripWeek}
                    onChange={(e) =>
                      setLessonFormDripWeek(parseInt(e.target.value) || 0)
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={lessonFormSort}
                    onChange={(e) =>
                      setLessonFormSort(parseInt(e.target.value) || 0)
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lessonFormHasQuiz}
                  onChange={(e) => setLessonFormHasQuiz(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-amber-400 focus:ring-amber-400/50"
                />
                <span className="text-sm text-zinc-300">Has Quiz</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowLessonForm(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLesson}
                disabled={saving || !lessonFormTitle}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editingLessonId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Editor Modal */}
      {showQuizEditor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-100">Quiz Editor</h2>
              <button
                onClick={() => setShowQuizEditor(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-zinc-400 mb-1">
                Passing Score (%)
              </label>
              <input
                type="number"
                value={quizPassingScore}
                onChange={(e) =>
                  setQuizPassingScore(parseInt(e.target.value) || 70)
                }
                min={0}
                max={100}
                className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
              />
            </div>

            <div className="space-y-6">
              {quizQuestions.map((q, qIdx) => (
                <div
                  key={qIdx}
                  className="border border-zinc-800 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-zinc-400">
                      Question {qIdx + 1}
                    </p>
                    {quizQuestions.length > 1 && (
                      <button
                        onClick={() => removeQuizQuestion(qIdx)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) =>
                      updateQuizQuestion(qIdx, "question", e.target.value)
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 mb-3"
                    placeholder="Enter the question..."
                  />
                  <div className="space-y-2">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuizQuestion(qIdx, "correctIndex", oIdx)
                          }
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            q.correctIndex === oIdx
                              ? "border-green-400 bg-green-400/20"
                              : "border-zinc-600 hover:border-zinc-400"
                          }`}
                        >
                          {q.correctIndex === oIdx && (
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                          )}
                        </button>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) =>
                            updateQuizOption(qIdx, oIdx, e.target.value)
                          }
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                          placeholder={`Option ${oIdx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addQuizQuestion}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-amber-400 transition-colors mt-4"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowQuizEditor(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuiz}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Quiz"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
