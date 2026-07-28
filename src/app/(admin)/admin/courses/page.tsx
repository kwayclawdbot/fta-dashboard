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
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink">Courses</h1>
          <p className="text-soft text-sm mt-1 max-w-2xl">
            Manage courses, modules, and lessons.{" "}
            <span className="text-soft">
              Lesson videos here are on-demand, self-paced course content — not
              live-class replays (see Live Sessions) or the weekly class video
              (see This Week in FIC).
            </span>
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="f0-press f0-focus flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-strong text-[color:var(--accent-on)] text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Course
        </button>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-scrim z-50 flex items-center justify-center p-4">
          <div className="club-b-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-[17px] font-extrabold text-ink">
                {editingId ? "Edit Course" : "Add Course"}
              </h2>
              <button
                onClick={resetForm}
                className="text-soft hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-soft mb-1">
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
                  className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50"
                  placeholder="e.g. Stocks & Options Mastery"
                />
              </div>

              <div>
                <label className="block text-xs text-soft mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50"
                  placeholder="stocks-options"
                />
              </div>

              <div>
                <label className="block text-xs text-soft mb-1">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50 resize-none"
                  placeholder="Course description..."
                />
              </div>

              <div>
                <label className="block text-xs text-soft mb-1">
                  Thumbnail URL
                </label>
                <input
                  type="text"
                  value={formThumbnail}
                  onChange={(e) => setFormThumbnail(e.target.value)}
                  className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50"
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-soft mb-1">
                    Min Tier
                  </label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value)}
                    className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50"
                  >
                    <option value="challenge">Challenge</option>
                    <option value="academy">Academy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-soft mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) =>
                      setFormSortOrder(parseInt(e.target.value) || 0)
                    }
                    className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formPublished}
                  onChange={(e) => setFormPublished(e.target.checked)}
                  className="rounded border-sand bg-paper text-accent focus:ring-accent/50"
                />
                <span className="text-sm text-ink">Published</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm text-soft hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formTitle || !formSlug}
                className="f0-press f0-focus px-4 py-2 rounded-lg bg-accent hover:bg-accent-strong text-[color:var(--accent-on)] text-sm font-semibold transition-colors disabled:opacity-50"
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
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-10 h-10 text-soft/70 mx-auto mb-3" />
          <h3 className="font-display text-[17px] font-extrabold text-ink mb-1">
            No courses yet
          </h3>
          <p className="text-sm text-soft mb-4">
            Create your first course to get started
          </p>
          <button
            onClick={openAddForm}
            className="f0-press f0-focus inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-strong text-[color:var(--accent-on)] text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Course
          </button>
        </div>
      ) : (
        <div className="club-b-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sand bg-paper">
                <th className="text-left px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  Title
                </th>
                <th className="text-left px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  Slug
                </th>
                <th className="text-left px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  Tier
                </th>
                <th className="text-center px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  Modules
                </th>
                <th className="text-center px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  Lessons
                </th>
                <th className="text-center px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  Published
                </th>
                <th className="text-right px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr
                  key={course.id}
                  className="border-b border-sand hover:bg-paper transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/courses/${course.id}`}
                      className="text-sm text-ink hover:text-accent-strong transition-colors font-medium"
                    >
                      {course.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-soft">
                    {course.slug}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`f0-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                        course.min_tier === "challenge"
                          ? "text-soft"
                          : "f0-chip-accent text-accent"
                      }`}
                    >
                      {course.min_tier || "challenge"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-soft text-center">
                    {course.module_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-soft text-center">
                    {course.lesson_count}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePublished(course)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                        course.published
                          ? "text-soft bg-card hover:bg-paper"
                          : "text-soft bg-card hover:bg-paper"
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
                        className="p-1.5 rounded text-soft hover:text-accent hover:bg-paper transition-colors"
                        title="Edit course content"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => openEditForm(course)}
                        className="p-1.5 rounded text-soft hover:text-ink hover:bg-paper transition-colors"
                        title="Edit course details"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(course.id)}
                        className="p-1.5 rounded text-soft hover:text-accent hover:bg-paper transition-colors"
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
