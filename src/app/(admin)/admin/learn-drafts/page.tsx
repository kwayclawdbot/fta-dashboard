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
    className: "text-soft border-sand bg-paper",
    Icon: CircleDashed,
  },
  draft: {
    label: "Draft ready",
    className: "text-accent border-accent/40 bg-accent/10",
    Icon: CircleDot,
  },
  differs: {
    label: "Published · draft differs",
    className: "text-soft border-sand bg-paper",
    Icon: CircleDot,
  },
  live: {
    label: "Published (live)",
    className: "text-soft border-sand bg-paper",
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
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-[20px] font-extrabold text-ink">
            Learning World — Draft Review
          </h1>
          <p className="text-sm text-soft">
            Preview each converted lesson in the real engine, then publish it to
            members. Nothing here is live until you press Publish.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 my-4 text-xs">
        <span className="rounded-full border border-sand bg-paper px-3 py-1 text-ink">
          {draftCount} drafts authored
        </span>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-accent">
          {pendingCount} awaiting publish
        </span>
        <span className="rounded-full border border-sand bg-paper px-3 py-1 text-soft">
          {liveCount} live
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-soft py-12">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading lessons…
        </div>
      ) : (
        <div className="space-y-8">
          {courses.map((course) => (
            <section key={course.slug}>
              <h2 className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent mb-3">
                {course.title}
              </h2>
              <div className="club-b-card overflow-hidden divide-y divide-sand">
                {course.rows.map((r) => {
                  const status = statusOf(r);
                  const meta = STATUS_META[status];
                  const busy = busyId === r.lesson_id;
                  const previewHref = `/courses/${r.course_slug}/${r.module_id}/${r.lesson_id}?draft=1`;
                  return (
                    <div
                      key={r.lesson_id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="f0-chip px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-soft">
                            {trackLabel(r.module_track)}
                          </span>
                          <span className="text-sm font-medium text-ink truncate">
                            {r.lesson_title}
                          </span>
                        </div>
                        <div className="text-[11px] text-soft mt-0.5 truncate">
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
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sand px-3 py-1.5 text-xs text-ink hover:bg-paper transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </a>
                        )}
                        {r.has_draft && status !== "live" && (
                          <button
                            onClick={() => publish(r.lesson_id)}
                            disabled={busy}
                            className="f0-press f0-focus inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-on)] hover:bg-accent-strong transition-colors disabled:opacity-50"
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
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sand px-3 py-1.5 text-xs text-soft hover:text-ink hover:bg-paper transition-colors disabled:opacity-50"
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
