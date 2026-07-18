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
  Download,
  Link2,
  Image,
  BookOpen,
  ClipboardCheck,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ── Types ────────────────────────────────────────────────────── */

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface ResourceData {
  id: string;
  lesson_id: string;
  type: string;
  title: string;
  description: string | null;
  video_provider: string | null;
  video_id: string | null;
  video_duration_sec: number | null;
  file_url: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  file_type: string | null;
  external_url: string | null;
  sort_order: number;
  is_primary: boolean;
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
  resources: ResourceData[];
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

interface TestData {
  id: string;
  course_id: string | null;
  module_id: string | null;
  title: string;
  description: string | null;
  type: string;
  questions: QuizQuestion[];
  passing_score: number;
  time_limit_min: number | null;
  max_attempts: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_answers_after: boolean;
  published: boolean;
  sort_order: number;
}

/* ── Helpers ──────────────────────────────────────────────────── */

const RESOURCE_ICONS: Record<string, typeof Video> = {
  video: Video,
  document: FileText,
  study_guide: BookOpen,
  download: Download,
  link: Link2,
  image: Image,
};

const RESOURCE_LABELS: Record<string, string> = {
  video: "Video",
  document: "Document / PDF",
  study_guide: "Study Guide",
  download: "Downloadable File",
  link: "External Link",
  image: "Image",
};

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50";
const btnPrimary =
  "flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors disabled:opacity-50";
const btnSecondary =
  "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm transition-colors border border-zinc-700";

/* ── Page ─────────────────────────────────────────────────────── */

export default function CourseEditorPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const supabase = createClient();

  const [course, setCourse] = useState<CourseData | null>(null);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [tests, setTests] = useState<TestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "tests">("content");

  // Course edit
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editThumbnail, setEditThumbnail] = useState("");
  const [editTier, setEditTier] = useState("challenge");
  const [editPublished, setEditPublished] = useState(false);

  // UI state
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());

  // Module form
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", track: "adults", sort_order: 0 });

  // Lesson form
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonFormModuleId, setLessonFormModuleId] = useState("");
  const [lessonForm, setLessonForm] = useState({
    title: "", description: "", video_provider: "youtube", video_id: "",
    duration: 0, drip_week: 0, has_quiz: false, sort_order: 0,
  });

  // Resource form
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [resourceFormLessonId, setResourceFormLessonId] = useState("");
  const [resourceForm, setResourceForm] = useState({
    type: "document" as string, title: "", description: "",
    video_provider: "youtube", video_id: "", video_duration_sec: 0,
    file_url: "", file_name: "", file_type: "", external_url: "",
    sort_order: 0, is_primary: false,
  });

  // Quiz editor
  const [showQuizEditor, setShowQuizEditor] = useState(false);
  const [quizLessonId, setQuizLessonId] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizPassingScore, setQuizPassingScore] = useState(70);

  // Test form
  const [showTestForm, setShowTestForm] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [testForm, setTestForm] = useState({
    title: "", description: "", type: "test", passing_score: 70,
    time_limit_min: null as number | null, max_attempts: 3 as number | null,
    shuffle_questions: false, shuffle_options: false,
    show_answers_after: true, published: false, sort_order: 0,
    module_id: "" as string,
  });
  const [testQuestions, setTestQuestions] = useState<QuizQuestion[]>([]);

  /* ── Load ──────────────────────────────────────────────────── */

  const loadCourse = useCallback(async () => {
    const { data: courseData } = await supabase.from("courses").select("*").eq("id", courseId).single();
    if (!courseData) { router.push("/admin/courses"); return; }

    setCourse(courseData);
    setEditTitle(courseData.title);
    setEditSlug(courseData.slug);
    setEditDescription(courseData.description || "");
    setEditThumbnail(courseData.thumbnail_url || "");
    setEditTier(courseData.min_tier || "challenge");
    setEditPublished(courseData.published);

    // Modules + lessons + resources
    const { data: mods } = await supabase.from("modules").select("*").eq("course_id", courseId).order("sort_order");
    if (mods) {
      const withLessons: ModuleData[] = [];
      for (const mod of mods) {
        const { data: lessons } = await supabase.from("lessons").select("*").eq("module_id", mod.id).order("sort_order");
        const lessonsWithResources: LessonData[] = [];
        for (const lesson of lessons || []) {
          const { data: resources } = await supabase.from("lesson_resources").select("*").eq("lesson_id", lesson.id).order("sort_order");
          lessonsWithResources.push({ ...lesson, resources: resources || [] });
        }
        withLessons.push({ ...mod, lessons: lessonsWithResources });
      }
      setModules(withLessons);
      if (withLessons.length > 0) setExpandedModules(new Set([withLessons[0].id]));
    }

    // Tests
    const { data: courseTests } = await supabase.from("tests").select("*").eq("course_id", courseId).order("sort_order");
    setTests((courseTests as TestData[]) || []);

    setLoading(false);
  }, [supabase, courseId, router]);

  useEffect(() => { loadCourse(); }, [loadCourse]);

  /* ── Course CRUD ───────────────────────────────────────────── */

  async function handleSaveCourse() {
    setSaving(true);
    await supabase.from("courses").update({
      title: editTitle, slug: editSlug, description: editDescription || null,
      thumbnail_url: editThumbnail || null, min_tier: editTier, published: editPublished,
    }).eq("id", courseId);
    setSaving(false);
  }

  /* ── Module CRUD ───────────────────────────────────────────── */

  function openAddModule() {
    setEditingModuleId(null);
    setModuleForm({ title: "", description: "", track: "adults", sort_order: modules.length });
    setShowModuleForm(true);
  }
  function openEditModule(mod: ModuleData) {
    setEditingModuleId(mod.id);
    setModuleForm({ title: mod.title, description: mod.description || "", track: mod.track || "adults", sort_order: mod.sort_order });
    setShowModuleForm(true);
  }
  async function handleSaveModule() {
    setSaving(true);
    const payload = { course_id: courseId, ...moduleForm, description: moduleForm.description || null };
    if (editingModuleId) await supabase.from("modules").update(payload).eq("id", editingModuleId);
    else await supabase.from("modules").insert(payload);
    setSaving(false); setShowModuleForm(false); setLoading(true); loadCourse();
  }
  async function handleDeleteModule(id: string) {
    if (!confirm("Delete this module and all its lessons?")) return;
    await supabase.from("lesson_resources").delete().in("lesson_id", (await supabase.from("lessons").select("id").eq("module_id", id)).data?.map(l => l.id) || []);
    await supabase.from("lessons").delete().eq("module_id", id);
    await supabase.from("modules").delete().eq("id", id);
    setLoading(true); loadCourse();
  }

  /* ── Lesson CRUD ───────────────────────────────────────────── */

  function openAddLesson(moduleId: string) {
    const mod = modules.find(m => m.id === moduleId);
    setEditingLessonId(null); setLessonFormModuleId(moduleId);
    setLessonForm({ title: "", description: "", video_provider: "youtube", video_id: "", duration: 0, drip_week: 0, has_quiz: false, sort_order: mod?.lessons.length ?? 0 });
    setShowLessonForm(true);
  }
  function openEditLesson(lesson: LessonData) {
    setEditingLessonId(lesson.id); setLessonFormModuleId(lesson.module_id);
    setLessonForm({
      title: lesson.title, description: lesson.description || "",
      video_provider: lesson.video_provider || "youtube", video_id: lesson.video_id || "",
      duration: lesson.video_duration_sec || 0, drip_week: lesson.drip_week || 0,
      has_quiz: lesson.has_quiz, sort_order: lesson.sort_order,
    });
    setShowLessonForm(true);
  }
  async function handleSaveLesson() {
    setSaving(true);
    const payload = {
      module_id: lessonFormModuleId, title: lessonForm.title,
      description: lessonForm.description || null, video_provider: lessonForm.video_provider || null,
      video_id: lessonForm.video_id || null, video_duration_sec: lessonForm.duration || null,
      drip_week: lessonForm.drip_week || null, has_quiz: lessonForm.has_quiz, sort_order: lessonForm.sort_order,
    };
    if (editingLessonId) await supabase.from("lessons").update(payload).eq("id", editingLessonId);
    else await supabase.from("lessons").insert(payload);
    setSaving(false); setShowLessonForm(false); setLoading(true); loadCourse();
  }
  async function handleDeleteLesson(id: string) {
    if (!confirm("Delete this lesson and all its resources?")) return;
    await supabase.from("lesson_resources").delete().eq("lesson_id", id);
    await supabase.from("quizzes").delete().eq("lesson_id", id);
    await supabase.from("lessons").delete().eq("id", id);
    setLoading(true); loadCourse();
  }

  /* ── Resource CRUD ─────────────────────────────────────────── */

  function openAddResource(lessonId: string) {
    setEditingResourceId(null); setResourceFormLessonId(lessonId);
    setResourceForm({ type: "document", title: "", description: "", video_provider: "youtube", video_id: "", video_duration_sec: 0, file_url: "", file_name: "", file_type: "", external_url: "", sort_order: 0, is_primary: false });
    setShowResourceForm(true);
  }
  function openEditResource(r: ResourceData) {
    setEditingResourceId(r.id); setResourceFormLessonId(r.lesson_id);
    setResourceForm({
      type: r.type, title: r.title, description: r.description || "",
      video_provider: r.video_provider || "youtube", video_id: r.video_id || "",
      video_duration_sec: r.video_duration_sec || 0, file_url: r.file_url || "",
      file_name: r.file_name || "", file_type: r.file_type || "",
      external_url: r.external_url || "", sort_order: r.sort_order, is_primary: r.is_primary,
    });
    setShowResourceForm(true);
  }
  async function handleSaveResource() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      lesson_id: resourceFormLessonId, type: resourceForm.type,
      title: resourceForm.title, description: resourceForm.description || null,
      sort_order: resourceForm.sort_order, is_primary: resourceForm.is_primary,
    };
    if (resourceForm.type === "video") {
      payload.video_provider = resourceForm.video_provider; payload.video_id = resourceForm.video_id;
      payload.video_duration_sec = resourceForm.video_duration_sec || null;
    }
    if (["document", "study_guide", "download", "image"].includes(resourceForm.type)) {
      payload.file_url = resourceForm.file_url || null; payload.file_name = resourceForm.file_name || null;
      payload.file_type = resourceForm.file_type || null;
    }
    if (resourceForm.type === "link") { payload.external_url = resourceForm.external_url || null; }

    if (editingResourceId) await supabase.from("lesson_resources").update(payload).eq("id", editingResourceId);
    else await supabase.from("lesson_resources").insert(payload);
    setSaving(false); setShowResourceForm(false); setLoading(true); loadCourse();
  }
  async function handleDeleteResource(id: string) {
    if (!confirm("Delete this resource?")) return;
    await supabase.from("lesson_resources").delete().eq("id", id);
    setLoading(true); loadCourse();
  }

  /* ── Quiz CRUD ─────────────────────────────────────────────── */

  async function openQuizEditor(lessonId: string) {
    setQuizLessonId(lessonId);
    const { data: quiz } = await supabase.from("quizzes").select("*").eq("lesson_id", lessonId).single();
    if (quiz) { setQuizQuestions(quiz.questions as QuizQuestion[]); setQuizPassingScore(quiz.passing_score); }
    else { setQuizQuestions([{ question: "", options: ["", "", "", ""], correctIndex: 0 }]); setQuizPassingScore(70); }
    setShowQuizEditor(true);
  }
  async function handleSaveQuiz() {
    setSaving(true);
    const { data: existing } = await supabase.from("quizzes").select("id").eq("lesson_id", quizLessonId).single();
    const payload = { lesson_id: quizLessonId, questions: quizQuestions, passing_score: quizPassingScore };
    if (existing) await supabase.from("quizzes").update(payload).eq("id", existing.id);
    else await supabase.from("quizzes").insert(payload);
    setSaving(false); setShowQuizEditor(false);
  }

  /* ── Test CRUD ─────────────────────────────────────────────── */

  function openAddTest() {
    setEditingTestId(null);
    setTestForm({ title: "", description: "", type: "test", passing_score: 70, time_limit_min: null, max_attempts: 3, shuffle_questions: false, shuffle_options: false, show_answers_after: true, published: false, sort_order: tests.length, module_id: "" });
    setTestQuestions([{ question: "", options: ["", "", "", ""], correctIndex: 0 }]);
    setShowTestForm(true);
  }
  function openEditTest(t: TestData) {
    setEditingTestId(t.id);
    setTestForm({
      title: t.title, description: t.description || "", type: t.type,
      passing_score: t.passing_score, time_limit_min: t.time_limit_min,
      max_attempts: t.max_attempts, shuffle_questions: t.shuffle_questions,
      shuffle_options: t.shuffle_options, show_answers_after: t.show_answers_after,
      published: t.published, sort_order: t.sort_order, module_id: t.module_id || "",
    });
    setTestQuestions(t.questions || [{ question: "", options: ["", "", "", ""], correctIndex: 0 }]);
    setShowTestForm(true);
  }
  async function handleSaveTest() {
    setSaving(true);
    const payload = {
      course_id: courseId, module_id: testForm.module_id || null,
      title: testForm.title, description: testForm.description || null,
      type: testForm.type, questions: testQuestions, passing_score: testForm.passing_score,
      time_limit_min: testForm.time_limit_min, max_attempts: testForm.max_attempts,
      shuffle_questions: testForm.shuffle_questions, shuffle_options: testForm.shuffle_options,
      show_answers_after: testForm.show_answers_after, published: testForm.published,
      sort_order: testForm.sort_order,
    };
    if (editingTestId) await supabase.from("tests").update(payload).eq("id", editingTestId);
    else await supabase.from("tests").insert(payload);
    setSaving(false); setShowTestForm(false); setLoading(true); loadCourse();
  }
  async function handleDeleteTest(id: string) {
    if (!confirm("Delete this test?")) return;
    await supabase.from("test_attempts").delete().eq("test_id", id);
    await supabase.from("tests").delete().eq("id", id);
    setLoading(true); loadCourse();
  }

  /* ── Render helpers ────────────────────────────────────────── */

  function toggleModule(id: string) {
    setExpandedModules(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleLesson(id: string) {
    setExpandedLessons(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /></div>;
  if (!course) return null;

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalResources = modules.reduce((sum, m) => sum + m.lessons.reduce((s, l) => s + l.resources.length, 0), 0);

  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/admin/courses" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to courses
      </Link>

      {/* Course Details */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
        <h2 className="text-lg font-bold text-zinc-100 mb-4">Course Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label="Title"><input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputClass} /></InputField>
          <InputField label="Slug"><input type="text" value={editSlug} onChange={e => setEditSlug(e.target.value)} className={inputClass} /></InputField>
          <div className="md:col-span-2"><InputField label="Description"><textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} className={`${inputClass} resize-none`} /></InputField></div>
          <InputField label="Thumbnail URL"><input type="text" value={editThumbnail} onChange={e => setEditThumbnail(e.target.value)} className={inputClass} /></InputField>
          <div className="flex items-end gap-4">
            <div className="flex-1"><InputField label="Min Tier">
              <select value={editTier} onChange={e => setEditTier(e.target.value)} className={inputClass}>
                <option value="challenge">Challenge</option><option value="academy">Academy</option>
              </select>
            </InputField></div>
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input type="checkbox" checked={editPublished} onChange={e => setEditPublished(e.target.checked)} className="rounded border-zinc-700 bg-zinc-800 text-amber-400 focus:ring-amber-400/50" />
              <span className="text-sm text-zinc-300">Published</span>
            </label>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-zinc-500">{modules.length} modules · {totalLessons} lessons · {totalResources} resources · {tests.length} tests</p>
          <button onClick={handleSaveCourse} disabled={saving} className={btnPrimary}><Save className="w-4 h-4" />{saving ? "Saving..." : "Save Course"}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-zinc-800 pb-px">
        {(["content", "tests"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab ? "bg-zinc-800 text-amber-400 border-b-2 border-amber-400" : "text-zinc-400 hover:text-zinc-200"}`}>
            {tab === "content" ? "Modules & Lessons" : "Tests & Exams"}
          </button>
        ))}
      </div>

      {/* ── Content Tab ──────────────────────────────────────── */}
      {activeTab === "content" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-100">Modules & Lessons</h2>
            <button onClick={openAddModule} className={btnSecondary}><Plus className="w-4 h-4" />Add Module</button>
          </div>

          {modules.length === 0 ? (
            <div className="text-center py-12 border border-zinc-800 rounded-xl">
              <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">No modules yet. Add your first module.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {modules.map(mod => {
                const isExpanded = expandedModules.has(mod.id);
                return (
                  <div key={mod.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                    {/* Module header */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <GripVertical className="w-4 h-4 text-zinc-600 shrink-0" />
                      <button onClick={() => toggleModule(mod.id)} className="flex-1 flex items-center gap-2 text-left">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{mod.title}</p>
                          <p className="text-xs text-zinc-500">{mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}{mod.track ? ` · ${mod.track}` : ""}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditModule(mod)} className="p-1.5 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteModule(mod.id)} className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>

                    {/* Lessons */}
                    {isExpanded && (
                      <div className="border-t border-zinc-800/50">
                        {mod.lessons.map(lesson => {
                          const ResourceIcon = RESOURCE_ICONS[lesson.resources[0]?.type] || Video;
                          const lessonExpanded = expandedLessons.has(lesson.id);
                          return (
                            <div key={lesson.id} className="border-b border-zinc-800/30 last:border-0">
                              {/* Lesson row */}
                              <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/20 transition-colors">
                                <GripVertical className="w-3.5 h-3.5 text-zinc-700 shrink-0 ml-4" />
                                <button onClick={() => toggleLesson(lesson.id)} className="shrink-0">
                                  {lessonExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
                                </button>
                                <Video className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-zinc-200 truncate">{lesson.title}</p>
                                  <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-0.5">
                                    {lesson.video_provider && <span>{lesson.video_provider}</span>}
                                    {lesson.video_duration_sec && <span>{Math.round(lesson.video_duration_sec / 60)} min</span>}
                                    {lesson.drip_week && lesson.drip_week > 0 && <span>Week {lesson.drip_week}</span>}
                                    {lesson.has_quiz && <span className="text-amber-400">Quiz</span>}
                                    {lesson.resources.length > 0 && <span className="text-blue-400">{lesson.resources.length} resource{lesson.resources.length !== 1 ? "s" : ""}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => openAddResource(lesson.id)} className="p-1.5 rounded text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors" title="Add resource"><Plus className="w-3.5 h-3.5" /></button>
                                  {lesson.has_quiz && <button onClick={() => openQuizEditor(lesson.id)} className="p-1.5 rounded text-zinc-400 hover:text-purple-400 hover:bg-zinc-800 transition-colors" title="Edit quiz"><HelpCircle className="w-3.5 h-3.5" /></button>}
                                  <button onClick={() => openEditLesson(lesson)} className="p-1.5 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleDeleteLesson(lesson.id)} className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>

                              {/* Resources (expanded) */}
                              {lessonExpanded && lesson.resources.length > 0 && (
                                <div className="ml-16 mr-4 mb-2 space-y-1">
                                  {lesson.resources.map(r => {
                                    const Icon = RESOURCE_ICONS[r.type] || FileText;
                                    return (
                                      <div key={r.id} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/30 rounded-lg">
                                        <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                        <span className="text-xs text-zinc-300 flex-1 truncate">{r.title}</span>
                                        <span className="text-[11px] text-zinc-500">{RESOURCE_LABELS[r.type]}</span>
                                        {r.is_primary && <span className="text-[11px] text-amber-400">Primary</span>}
                                        <button onClick={() => openEditResource(r)} className="p-1 text-zinc-500 hover:text-amber-400"><Pencil className="w-3 h-3" /></button>
                                        <button onClick={() => handleDeleteResource(r.id)} className="p-1 text-zinc-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className="px-4 py-2">
                          <button onClick={() => openAddLesson(mod.id)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 transition-colors"><Plus className="w-3.5 h-3.5" />Add lesson</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Tests Tab ────────────────────────────────────────── */}
      {activeTab === "tests" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-100">Tests & Exams</h2>
            <button onClick={openAddTest} className={btnSecondary}><Plus className="w-4 h-4" />Add Test</button>
          </div>
          {tests.length === 0 ? (
            <div className="text-center py-12 border border-zinc-800 rounded-xl">
              <ClipboardCheck className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">No tests yet. Add module tests, course exams, or practice assessments.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tests.map(t => {
                const mod = modules.find(m => m.id === t.module_id);
                return (
                  <div key={t.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
                    <ClipboardCheck className="w-5 h-5 text-zinc-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-100">{t.title}</p>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-0.5">
                        <span className="capitalize">{t.type}</span>
                        <span>{t.questions.length} question{t.questions.length !== 1 ? "s" : ""}</span>
                        <span>Pass: {t.passing_score}%</span>
                        {t.time_limit_min && <span><Clock className="w-3 h-3 inline" /> {t.time_limit_min}min</span>}
                        {mod && <span>Module: {mod.title}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.published ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4 text-zinc-600" />}
                      <button onClick={() => openEditTest(t)} className="p-1.5 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteTest(t.id)} className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODALS                                                     */}
      {/* ══════════════════════════════════════════════════════════ */}

      {/* Module Form */}
      {showModuleForm && (
        <Modal title={editingModuleId ? "Edit Module" : "Add Module"} onClose={() => setShowModuleForm(false)}>
          <div className="space-y-4">
            <InputField label="Title"><input type="text" value={moduleForm.title} onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })} className={inputClass} placeholder="Module 1: Getting Started" /></InputField>
            <InputField label="Description"><textarea value={moduleForm.description} onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })} rows={2} className={`${inputClass} resize-none`} /></InputField>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Track"><select value={moduleForm.track} onChange={e => setModuleForm({ ...moduleForm, track: e.target.value })} className={inputClass}><option value="kids">Kids</option><option value="adults">Adults</option></select></InputField>
              <InputField label="Sort Order"><input type="number" value={moduleForm.sort_order} onChange={e => setModuleForm({ ...moduleForm, sort_order: parseInt(e.target.value) || 0 })} className={inputClass} /></InputField>
            </div>
          </div>
          <ModalActions onCancel={() => setShowModuleForm(false)} onSave={handleSaveModule} saving={saving} disabled={!moduleForm.title} label={editingModuleId ? "Update" : "Create"} />
        </Modal>
      )}

      {/* Lesson Form */}
      {showLessonForm && (
        <Modal title={editingLessonId ? "Edit Lesson" : "Add Lesson"} onClose={() => setShowLessonForm(false)}>
          <div className="space-y-4">
            <InputField label="Title"><input type="text" value={lessonForm.title} onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })} className={inputClass} /></InputField>
            <InputField label="Description"><textarea value={lessonForm.description} onChange={e => setLessonForm({ ...lessonForm, description: e.target.value })} rows={3} className={`${inputClass} resize-none`} /></InputField>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Primary Video Provider"><select value={lessonForm.video_provider} onChange={e => setLessonForm({ ...lessonForm, video_provider: e.target.value })} className={inputClass}><option value="youtube">YouTube</option><option value="bunny">Bunny</option><option value="mux">Mux</option><option value="vimeo">Vimeo</option></select></InputField>
              <InputField label="Video ID"><input type="text" value={lessonForm.video_id} onChange={e => setLessonForm({ ...lessonForm, video_id: e.target.value })} className={inputClass} placeholder="dQw4w9WgXcQ" /></InputField>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Duration (sec)"><input type="number" value={lessonForm.duration} onChange={e => setLessonForm({ ...lessonForm, duration: parseInt(e.target.value) || 0 })} className={inputClass} /></InputField>
              <InputField label="Drip Week"><input type="number" value={lessonForm.drip_week} onChange={e => setLessonForm({ ...lessonForm, drip_week: parseInt(e.target.value) || 0 })} className={inputClass} /></InputField>
              <InputField label="Sort Order"><input type="number" value={lessonForm.sort_order} onChange={e => setLessonForm({ ...lessonForm, sort_order: parseInt(e.target.value) || 0 })} className={inputClass} /></InputField>
            </div>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={lessonForm.has_quiz} onChange={e => setLessonForm({ ...lessonForm, has_quiz: e.target.checked })} className="rounded border-zinc-700 bg-zinc-800 text-amber-400" /><span className="text-sm text-zinc-300">Has Quiz</span></label>
          </div>
          <ModalActions onCancel={() => setShowLessonForm(false)} onSave={handleSaveLesson} saving={saving} disabled={!lessonForm.title} label={editingLessonId ? "Update" : "Create"} />
        </Modal>
      )}

      {/* Resource Form */}
      {showResourceForm && (
        <Modal title={editingResourceId ? "Edit Resource" : "Add Resource"} onClose={() => setShowResourceForm(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Resource Type">
                <select value={resourceForm.type} onChange={e => setResourceForm({ ...resourceForm, type: e.target.value })} className={inputClass}>
                  {Object.entries(RESOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </InputField>
              <InputField label="Title"><input type="text" value={resourceForm.title} onChange={e => setResourceForm({ ...resourceForm, title: e.target.value })} className={inputClass} /></InputField>
            </div>
            <InputField label="Description"><textarea value={resourceForm.description} onChange={e => setResourceForm({ ...resourceForm, description: e.target.value })} rows={2} className={`${inputClass} resize-none`} /></InputField>

            {resourceForm.type === "video" && (
              <div className="grid grid-cols-3 gap-4">
                <InputField label="Provider"><select value={resourceForm.video_provider} onChange={e => setResourceForm({ ...resourceForm, video_provider: e.target.value })} className={inputClass}><option value="youtube">YouTube</option><option value="bunny">Bunny</option><option value="mux">Mux</option><option value="vimeo">Vimeo</option></select></InputField>
                <InputField label="Video ID"><input type="text" value={resourceForm.video_id} onChange={e => setResourceForm({ ...resourceForm, video_id: e.target.value })} className={inputClass} /></InputField>
                <InputField label="Duration (sec)"><input type="number" value={resourceForm.video_duration_sec} onChange={e => setResourceForm({ ...resourceForm, video_duration_sec: parseInt(e.target.value) || 0 })} className={inputClass} /></InputField>
              </div>
            )}

            {["document", "study_guide", "download", "image"].includes(resourceForm.type) && (
              <div className="grid grid-cols-3 gap-4">
                <InputField label="File URL"><input type="text" value={resourceForm.file_url} onChange={e => setResourceForm({ ...resourceForm, file_url: e.target.value })} className={inputClass} placeholder="https://..." /></InputField>
                <InputField label="File Name"><input type="text" value={resourceForm.file_name} onChange={e => setResourceForm({ ...resourceForm, file_name: e.target.value })} className={inputClass} placeholder="study-guide.pdf" /></InputField>
                <InputField label="File Type"><input type="text" value={resourceForm.file_type} onChange={e => setResourceForm({ ...resourceForm, file_type: e.target.value })} className={inputClass} placeholder="pdf" /></InputField>
              </div>
            )}

            {resourceForm.type === "link" && (
              <InputField label="External URL"><input type="text" value={resourceForm.external_url} onChange={e => setResourceForm({ ...resourceForm, external_url: e.target.value })} className={inputClass} placeholder="https://..." /></InputField>
            )}

            <div className="flex items-center gap-6">
              <InputField label="Sort Order"><input type="number" value={resourceForm.sort_order} onChange={e => setResourceForm({ ...resourceForm, sort_order: parseInt(e.target.value) || 0 })} className={`${inputClass} w-24`} /></InputField>
              <label className="flex items-center gap-2 cursor-pointer pt-4"><input type="checkbox" checked={resourceForm.is_primary} onChange={e => setResourceForm({ ...resourceForm, is_primary: e.target.checked })} className="rounded border-zinc-700 bg-zinc-800 text-amber-400" /><span className="text-sm text-zinc-300">Primary (shown in lesson viewer)</span></label>
            </div>
          </div>
          <ModalActions onCancel={() => setShowResourceForm(false)} onSave={handleSaveResource} saving={saving} disabled={!resourceForm.title} label={editingResourceId ? "Update" : "Create"} />
        </Modal>
      )}

      {/* Quiz Editor */}
      {showQuizEditor && (
        <Modal title="Quiz Editor" onClose={() => setShowQuizEditor(false)} wide>
          <div className="mb-4">
            <InputField label="Passing Score (%)"><input type="number" value={quizPassingScore} onChange={e => setQuizPassingScore(parseInt(e.target.value) || 70)} min={0} max={100} className={`${inputClass} w-24`} /></InputField>
          </div>
          <QuestionEditor questions={quizQuestions} setQuestions={setQuizQuestions} />
          <ModalActions onCancel={() => setShowQuizEditor(false)} onSave={handleSaveQuiz} saving={saving} label="Save Quiz" />
        </Modal>
      )}

      {/* Test Form */}
      {showTestForm && (
        <Modal title={editingTestId ? "Edit Test" : "Add Test"} onClose={() => setShowTestForm(false)} wide>
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Title"><input type="text" value={testForm.title} onChange={e => setTestForm({ ...testForm, title: e.target.value })} className={inputClass} /></InputField>
              <InputField label="Type">
                <select value={testForm.type} onChange={e => setTestForm({ ...testForm, type: e.target.value })} className={inputClass}>
                  <option value="test">Test</option><option value="exam">Exam</option><option value="assessment">Assessment</option><option value="practice">Practice</option>
                </select>
              </InputField>
            </div>
            <InputField label="Description"><textarea value={testForm.description} onChange={e => setTestForm({ ...testForm, description: e.target.value })} rows={2} className={`${inputClass} resize-none`} /></InputField>
            <div className="grid grid-cols-4 gap-4">
              <InputField label="Passing Score %"><input type="number" value={testForm.passing_score} onChange={e => setTestForm({ ...testForm, passing_score: parseInt(e.target.value) || 70 })} className={inputClass} /></InputField>
              <InputField label="Time Limit (min)"><input type="number" value={testForm.time_limit_min ?? ""} onChange={e => setTestForm({ ...testForm, time_limit_min: e.target.value ? parseInt(e.target.value) : null })} className={inputClass} placeholder="No limit" /></InputField>
              <InputField label="Max Attempts"><input type="number" value={testForm.max_attempts ?? ""} onChange={e => setTestForm({ ...testForm, max_attempts: e.target.value ? parseInt(e.target.value) : null })} className={inputClass} placeholder="Unlimited" /></InputField>
              <InputField label="Module (optional)">
                <select value={testForm.module_id} onChange={e => setTestForm({ ...testForm, module_id: e.target.value })} className={inputClass}>
                  <option value="">Course-level</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </InputField>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              {([["shuffle_questions", "Shuffle Questions"], ["shuffle_options", "Shuffle Options"], ["show_answers_after", "Show Answers After"], ["published", "Published"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={testForm[key] as boolean} onChange={e => setTestForm({ ...testForm, [key]: e.target.checked })} className="rounded border-zinc-700 bg-zinc-800 text-amber-400" />
                  <span className="text-sm text-zinc-300">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <h3 className="text-sm font-semibold text-zinc-200 mb-3">Questions</h3>
          <QuestionEditor questions={testQuestions} setQuestions={setTestQuestions} />
          <ModalActions onCancel={() => setShowTestForm(false)} onSave={handleSaveTest} saving={saving} disabled={!testForm.title} label={editingTestId ? "Update Test" : "Create Test"} />
        </Modal>
      )}
    </div>
  );
}

/* ── Shared Components ─────────────────────────────────────────── */

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className={`bg-zinc-900 border border-zinc-800 rounded-xl ${wide ? "w-full max-w-3xl" : "w-full max-w-lg"} p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave, saving, disabled, label }: { onCancel: () => void; onSave: () => void; saving: boolean; disabled?: boolean; label: string }) {
  return (
    <div className="flex items-center justify-end gap-3 mt-6">
      <button onClick={onCancel} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
      <button onClick={onSave} disabled={saving || disabled} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors disabled:opacity-50">{saving ? "Saving..." : label}</button>
    </div>
  );
}

function QuestionEditor({ questions, setQuestions }: { questions: QuizQuestion[]; setQuestions: (q: QuizQuestion[]) => void }) {
  return (
    <>
      <div className="space-y-4">
        {questions.map((q, qIdx) => (
          <div key={qIdx} className="border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-zinc-400">Question {qIdx + 1}</p>
              {questions.length > 1 && <button onClick={() => setQuestions(questions.filter((_, i) => i !== qIdx))} className="text-xs text-red-400 hover:text-red-300">Remove</button>}
            </div>
            <input type="text" value={q.question} onChange={e => setQuestions(questions.map((qq, i) => i === qIdx ? { ...qq, question: e.target.value } : qq))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 mb-3" placeholder="Enter the question..." />
            <div className="space-y-2">
              {q.options.map((opt, oIdx) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <button onClick={() => setQuestions(questions.map((qq, i) => i === qIdx ? { ...qq, correctIndex: oIdx } : qq))}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${q.correctIndex === oIdx ? "border-green-400 bg-green-400/20" : "border-zinc-600 hover:border-zinc-400"}`}>
                    {q.correctIndex === oIdx && <div className="w-2 h-2 rounded-full bg-green-400" />}
                  </button>
                  <input type="text" value={opt} onChange={e => setQuestions(questions.map((qq, i) => i === qIdx ? { ...qq, options: qq.options.map((o, j) => j === oIdx ? e.target.value : o) } : qq))}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50" placeholder={`Option ${oIdx + 1}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setQuestions([...questions, { question: "", options: ["", "", "", ""], correctIndex: 0 }])} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-amber-400 transition-colors mt-4">
        <Plus className="w-4 h-4" />Add Question
      </button>
    </>
  );
}
