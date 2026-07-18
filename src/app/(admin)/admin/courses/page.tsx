"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
  BookOpen,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  min_tier: string | null;
  sort_order: number;
  published: boolean;
  created_at: string;
  module_count: number;
  lesson_count: number;
}

export default function AdminCoursesPage() {
  const supabase = createClient();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formThumbnail, setFormThumbnail] = useState("");
  const [formTier, setFormTier] = useState("challenge");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formPublished, setFormPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCourses = useCallback(async () => {
    const { data: rawCourses } = await supabase
      .from("courses")
      .select("*")
      .order("sort_order");

    if (!rawCourses) {
      setLoading(false);
      return;
    }

    const enriched: CourseRow[] = [];
    for (const c of rawCourses) {
      const { count: moduleCount } = await supabase
        .from("modules")
        .select("id", { count: "exact", head: true })
        .eq("course_id", c.id);

      const { data: mods } = await supabase
        .from("modules")
        .select("id")
        .eq("course_id", c.id);

      let lessonCount = 0;
      if (mods && mods.length > 0) {
        const modIds = mods.map((m: { id: string }) => m.id);
        const { count } = await supabase
          .from("lessons")
          .select("id", { count: "exact", head: true })
          .in("module_id", modIds);
        lessonCount = count ?? 0;
      }

      enriched.push({
        ...c,
        module_count: moduleCount ?? 0,
        lesson_count: lessonCount,
      });
    }

    setCourses(enriched);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  function resetForm() {
    setFormTitle("");
    setFormSlug("");
    setFormDescription("");
    setFormThumbnail("");
    setFormTier("challenge");
    setFormSortOrder(0);
    setFormPublished(false);
    setEditingId(null);
    setShowForm(false);
  }

  function openAddForm() {
    resetForm();
    setFormSortOrder(courses.length);
    setShowForm(true);
  }

  function openEditForm(course: CourseRow) {
    setEditingId(course.id);
    setFormTitle(course.title);
    setFormSlug(course.slug);
    setFormDescription(course.description || "");
    setFormThumbnail(course.thumbnail_url || "");
    setFormTier(course.min_tier || "challenge");
    setFormSortOrder(course.sort_order);
    setFormPublished(course.published);
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      title: formTitle,
      slug: formSlug,
      description: formDescription || null,
      thumbnail_url: formThumbnail || null,
      min_tier: formTier,
      sort_order: formSortOrder,
      published: formPublished,
    };

    if (editingId) {
      await supabase.from("courses").update(payload).eq("id", editingId);
    } else {
      await supabase.from("courses").insert(payload);
    }

    setSaving(false);
    resetForm();
    setLoading(true);
    loadCourses();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this course? This will also delete all its modules and lessons.")) return;

    // Get modules for this course
    const { data: mods } = await supabase
      .from("modules")
      .select("id")
      .eq("course_id", id);

    if (mods && mods.length > 0) {
      const modIds = mods.map((m: { id: string }) => m.id);
      // Delete lessons in those modules
      await supabase.from("lessons").delete().in("module_id", modIds);
      // Delete quizzes for those lessons would cascade if FK is set, otherwise manual
      // Delete modules
      await supabase.from("modules").delete().eq("course_id", id);
    }

    await supabase.from("courses").delete().eq("id", id);
    setLoading(true);
    loadCourses();
  }

  async function togglePublished(course: CourseRow) {
    await supabase
      .from("courses")
      .update({ published: !course.published })
      .eq("id", course.id);
    setCourses((prev) =>
      prev.map((c) =>
        c.id === course.id ? { ...c, published: !c.published } : c
      )
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Courses</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage courses, modules, and lessons
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Course
        </button>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-100">
                {editingId ? "Edit Course" : "Add Course"}
              </h2>
              <button
                onClick={resetForm}
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
                  value={formTitle}
                  onChange={(e) => {
                    setFormTitle(e.target.value);
                    if (!editingId) {
                      setFormSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, "")
                      );
                    }
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  placeholder="e.g. Stocks & Options Mastery"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  placeholder="stocks-options"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 resize-none"
                  placeholder="Course description..."
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Thumbnail URL
                </label>
                <input
                  type="text"
                  value={formThumbnail}
                  onChange={(e) => setFormThumbnail(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Min Tier
                  </label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  >
                    <option value="challenge">Challenge</option>
                    <option value="academy">Academy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) =>
                      setFormSortOrder(parseInt(e.target.value) || 0)
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formPublished}
                  onChange={(e) => setFormPublished(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-amber-400 focus:ring-amber-400/50"
                />
                <span className="text-sm text-zinc-300">Published</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formTitle || !formSlug}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Courses table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-1">
            No courses yet
          </h3>
          <p className="text-sm text-zinc-500 mb-4">
            Create your first course to get started
          </p>
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Course
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Slug
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Tier
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Modules
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Lessons
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Published
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr
                  key={course.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/courses/${course.id}`}
                      className="text-sm text-zinc-100 hover:text-amber-400 transition-colors font-medium"
                    >
                      {course.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {course.slug}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        course.min_tier === "challenge"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-amber-400/10 text-amber-400"
                      }`}
                    >
                      {course.min_tier || "challenge"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 text-center">
                    {course.module_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 text-center">
                    {course.lesson_count}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePublished(course)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                        course.published
                          ? "text-green-400 bg-green-400/10 hover:bg-green-400/20"
                          : "text-zinc-500 bg-zinc-800 hover:bg-zinc-700"
                      }`}
                    >
                      {course.published ? (
                        <>
                          <Eye className="w-3 h-3" /> Live
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" /> Draft
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="p-1.5 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                        title="Edit course content"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => openEditForm(course)}
                        className="p-1.5 rounded text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors"
                        title="Edit course details"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(course.id)}
                        className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        title="Delete course"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
