"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GraduationCap,
  Eye,
  Check,
  RotateCcw,
  Loader2,
  CircleDashed,
  CircleCheck,
  CircleDot,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Learning World P5 — DRAFT REVIEW CONSOLE (admin only).
 *
 * Lists every FIC Foundations lesson with its draft status, links each draft
 * into the REAL <LessonEngine> via ?draft=1 for preview, and exposes a per-lesson
 * PUBLISH action (publish_lesson_draft) that copies steps_draft -> steps. THE
 * OWNER reviews and publishes here; the conversion lane publishes nothing itself.
 * Backed by the admin-gated list_learn_drafts() / publish_lesson_draft() /
 * unpublish_lesson_draft() RPCs (migration 176).
 */

interface DraftRow {
  course_slug: string;
  course_title: string;
  module_id: string;
  module_title: string;
  module_track: string | null;
  module_sort: number;
  lesson_id: string;
  lesson_title: string;
  lesson_sort: number;
  has_draft: boolean;
  is_published: boolean;
  in_sync: boolean;
}

type Status = "none" | "draft" | "differs" | "live";

function statusOf(r: DraftRow): Status {
  if (!r.has_draft && !r.is_published) return "none";
  if (r.is_published && (!r.has_draft || r.in_sync)) return "live";
  if (r.is_published && r.has_draft && !r.in_sync) return "differs";
  return "draft";
}

const STATUS_META: Record<
  Status,
  { label: string; className: string; Icon: typeof CircleDot }
> = {
  none: {
    label: "No draft",
    className: "text-zinc-500 border-zinc-700 bg-zinc-800/40",
    Icon: CircleDashed,
  },
  draft: {
    label: "Draft ready",
    className: "text-amber-300 border-amber-400/40 bg-amber-400/10",
    Icon: CircleDot,
  },
  differs: {
    label: "Published · draft differs",
    className: "text-sky-300 border-sky-400/40 bg-sky-400/10",
    Icon: CircleDot,
  },
  live: {
    label: "Published (live)",
    className: "text-green-400 border-green-500/40 bg-green-500/10",
    Icon: CircleCheck,
  },
};

function trackLabel(track: string | null): string {
  if (track === "adults") return "Adult";
  if (track === "teens") return "Teen";
  if (track === "kids") return "Kid";
  return "Family";
}

export default function AdminLearnDraftsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_learn_drafts");
    if (error) setError(error.message);
    setRows((data as DraftRow[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function publish(lessonId: string) {
    setBusyId(lessonId);
    setError(null);
    const { error } = await supabase.rpc("publish_lesson_draft", {
      p_lesson_id: lessonId,
    });
    if (error) setError(error.message);
    await load();
    setBusyId(null);
  }

  async function unpublish(lessonId: string) {
    setBusyId(lessonId);
    setError(null);
    const { error } = await supabase.rpc("unpublish_lesson_draft", {
      p_lesson_id: lessonId,
    });
    if (error) setError(error.message);
    await load();
    setBusyId(null);
  }

  // Group rows by course, preserving order.
  const courses: { slug: string; title: string; rows: DraftRow[] }[] = [];
  for (const r of rows) {
    let c = courses.find((x) => x.slug === r.course_slug);
    if (!c) {
      c = { slug: r.course_slug, title: r.course_title, rows: [] };
      courses.push(c);
    }
    c.rows.push(r);
  }

  const draftCount = rows.filter((r) => r.has_draft).length;
  const liveCount = rows.filter((r) => statusOf(r) === "live").length;
  const pendingCount = rows.filter(
    (r) => statusOf(r) === "draft" || statusOf(r) === "differs"
  ).length;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex items-center gap-3 mb-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/10 text-amber-400">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-zinc-100">
            Learning World — Draft Review
          </h1>
          <p className="text-sm text-zinc-400">
            Preview each converted lesson in the real engine, then publish it to
            members. Nothing here is live until you press Publish.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 my-4 text-xs">
        <span className="rounded-full border border-zinc-700 bg-zinc-800/40 px-3 py-1 text-zinc-300">
          {draftCount} drafts authored
        </span>
        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-amber-300">
          {pendingCount} awaiting publish
        </span>
        <span className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-green-400">
          {liveCount} live
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400 py-12">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading lessons…
        </div>
      ) : (
        <div className="space-y-8">
          {courses.map((course) => (
            <section key={course.slug}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400/80 mb-3">
                {course.title}
              </h2>
              <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
                {course.rows.map((r) => {
                  const status = statusOf(r);
                  const meta = STATUS_META[status];
                  const busy = busyId === r.lesson_id;
                  const previewHref = `/courses/${r.course_slug}/${r.module_id}/${r.lesson_id}?draft=1`;
                  return (
                    <div
                      key={r.lesson_id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 bg-zinc-900/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                            {trackLabel(r.module_track)}
                          </span>
                          <span className="text-sm font-medium text-zinc-100 truncate">
                            {r.lesson_title}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                          {r.module_title}
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${meta.className}`}
                      >
                        <meta.Icon className="h-3 w-3" />
                        {meta.label}
                      </span>

                      <div className="flex items-center gap-2">
                        {r.has_draft && (
                          <a
                            href={previewHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </a>
                        )}
                        {r.has_draft && status !== "live" && (
                          <button
                            onClick={() => publish(r.lesson_id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300 transition-colors disabled:opacity-50"
                          >
                            {busy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            {status === "differs" ? "Republish" : "Publish"}
                          </button>
                        )}
                        {r.is_published && (
                          <button
                            onClick={() => unpublish(r.lesson_id)}
                            disabled={busy}
                            title="Revert to the legacy lesson view"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Unpublish
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
