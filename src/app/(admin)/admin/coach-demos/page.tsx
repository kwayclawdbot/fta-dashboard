"use client";

import { useState, useEffect, useCallback } from "react";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Plus,
  Upload,
  Check,
  Clock,
  AlertCircle,
  Video,
  ChevronDown,
  X,
  Tag,
  User,
  BookOpen,
  Filter,
  Search,
  ExternalLink,
  Clapperboard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CoachDemo {
  id: string;
  course_slug: string | null;
  module_title: string;
  lesson_title: string;
  title: string;
  description: string | null;
  instructions: string;
  tags: string[];
  priority: string;
  estimated_duration: string | null;
  status: string;
  assigned_to: string | null;
  video_url: string | null;
  video_provider: string | null;
  video_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Course {
  id: string;
  title: string;
  slug: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "text-soft", bg: "bg-paper", icon: Clock },
  assigned: { label: "Assigned", color: "text-soft", bg: "bg-paper", icon: User },
  recording: { label: "Recording", color: "text-accent", bg: "bg-accent/10", icon: Video },
  uploaded: { label: "Uploaded", color: "text-soft", bg: "bg-paper", icon: Upload },
  review: { label: "In Review", color: "text-accent", bg: "bg-accent/10", icon: AlertCircle },
  approved: { label: "Approved", color: "text-soft", bg: "bg-paper", icon: Check },
  published: { label: "Published", color: "text-soft", bg: "bg-paper", icon: ExternalLink },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "text-soft" },
  normal: { label: "Normal", color: "text-ink" },
  high: { label: "High", color: "text-accent" },
  urgent: { label: "Urgent", color: "text-accent" },
};

export default function CoachDemosPage() {
  const supabase = createClient();
  const [demos, setDemos] = useState<CoachDemo[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    course_slug: "",
    module_title: "",
    lesson_title: "",
    title: "",
    description: "",
    instructions: "",
    tags: "",
    priority: "normal",
    estimated_duration: "",
    assigned_to: "",
  });

  const loadData = useCallback(async () => {
    const [demosRes, coursesRes] = await Promise.all([
      supabase.from("coach_demos").select("*").order("created_at", { ascending: false }),
      supabase.from("courses").select("id, title, slug").eq("published", true).order("sort_order"),
    ]);
    setDemos(demosRes.data || []);
    setCourses(coursesRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCreate() {
    const { error } = await supabase.from("coach_demos").insert({
      course_slug: form.course_slug || null,
      module_title: form.module_title,
      lesson_title: form.lesson_title,
      title: form.title,
      description: form.description || null,
      instructions: form.instructions,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
      priority: form.priority,
      estimated_duration: form.estimated_duration || null,
      assigned_to: form.assigned_to || null,
      status: form.assigned_to ? "assigned" : "pending",
    });
    if (!error) {
      setShowCreate(false);
      setForm({ course_slug: "", module_title: "", lesson_title: "", title: "", description: "", instructions: "", tags: "", priority: "normal", estimated_duration: "", assigned_to: "" });
      loadData();
    }
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("coach_demos").update({ status }).eq("id", id);
    loadData();
  }

  async function handleVideoUrl(id: string, url: string) {
    const provider = url.includes("youtube") ? "youtube" : url.includes("bunny") || url.includes("mediadelivery") ? "bunny" : null;
    await supabase.from("coach_demos").update({
      video_url: url,
      video_provider: provider,
      status: "uploaded",
    }).eq("id", id);
    setUploadingId(null);
    loadData();
  }

  async function deleteDemo(id: string) {
    await supabase.from("coach_demos").delete().eq("id", id);
    loadData();
  }

  const filtered = demos.filter((d) => {
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.title.toLowerCase().includes(q) || d.lesson_title.toLowerCase().includes(q) || d.module_title.toLowerCase().includes(q) || (d.tags || []).some((t) => t.toLowerCase().includes(q));
    }
    return true;
  });

  const statusCounts = demos.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink flex items-center gap-2">
            <Clapperboard className="w-6 h-6 text-accent" />
            Coach Demo Content
          </h1>
          <p className="text-soft text-sm mt-1">
            Track, assign, and manage live coach demo recordings
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="f0-press f0-focus flex items-center gap-2 px-4 py-2 bg-accent text-[color:var(--accent-on)] rounded-lg text-sm font-semibold hover:bg-accent-strong transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Demo
        </button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterStatus("all")}
          aria-pressed={filterStatus === "all"}
          className={`f0-chip f0-press f0-focus px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${filterStatus === "all" ? "f0-chip-on" : "text-soft hover:text-ink"}`}
        >
          All ({demos.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            aria-pressed={filterStatus === key}
            className={`f0-chip f0-press f0-focus flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${filterStatus === key ? "f0-chip-on" : "text-soft hover:text-ink"}`}
          >
            {cfg.label} ({statusCounts[key] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-soft" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, lesson, module, or tag..."
          className="w-full pl-10 pr-4 py-2.5 bg-paper border border-sand rounded-lg text-sm text-ink placeholder:text-soft/70 focus:outline-none focus:border-accent/40"
        />
      </div>

      {/* Demo cards */}
      <div className="space-y-3">
        {filtered.map((demo) => {
          const statusCfg = STATUS_CONFIG[demo.status] || STATUS_CONFIG.pending;
          const StatusIcon = statusCfg.icon;
          const priorityCfg = PRIORITY_CONFIG[demo.priority] || PRIORITY_CONFIG.normal;
          const course = courses.find((c) => c.slug === demo.course_slug);

          return (
            <m.div
              key={demo.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="club-b-card overflow-hidden"
            >
              {/* Card header */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`f0-chip inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                      <span className={`text-[11px] font-medium ${priorityCfg.color}`}>
                        {priorityCfg.label}
                      </span>
                      {demo.estimated_duration && (
                        <span className="text-[11px] text-soft/70 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {demo.estimated_duration}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-[15px] font-extrabold text-ink">{demo.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-soft">
                      {course && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {course.title}</span>}
                      <span>→ {demo.module_title} → {demo.lesson_title}</span>
                    </div>
                    {demo.description && (
                      <p className="text-xs text-soft mt-2 line-clamp-2">{demo.description}</p>
                    )}
                    {/* Tags */}
                    {demo.tags && demo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {demo.tags.map((tag) => (
                          <span key={tag} className="f0-chip flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-soft">
                            <Tag className="w-2.5 h-2.5" /> {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {demo.status === "pending" && (
                      <button onClick={() => updateStatus(demo.id, "assigned")} className="f0-press f0-focus px-2.5 py-1.5 rounded-lg bg-accent text-[color:var(--accent-on)] text-xs font-semibold hover:bg-accent-strong transition-colors">Assign</button>
                    )}
                    {(demo.status === "assigned" || demo.status === "recording") && (
                      <button onClick={() => setUploadingId(demo.id)} className="f0-press f0-focus px-2.5 py-1.5 rounded-lg bg-accent text-[color:var(--accent-on)] text-xs font-semibold hover:bg-accent-strong transition-colors flex items-center gap-1">
                        <Upload className="w-3 h-3" /> Upload
                      </button>
                    )}
                    {demo.status === "uploaded" && (
                      <button onClick={() => updateStatus(demo.id, "approved")} className="f0-press f0-focus px-2.5 py-1.5 rounded-lg bg-accent text-[color:var(--accent-on)] text-xs font-semibold hover:bg-accent-strong transition-colors flex items-center gap-1">
                        <Check className="w-3 h-3" /> Approve
                      </button>
                    )}
                    {demo.status === "approved" && (
                      <button onClick={() => updateStatus(demo.id, "published")} className="f0-press f0-focus px-2.5 py-1.5 rounded-lg bg-accent text-[color:var(--accent-on)] text-xs font-semibold hover:bg-accent-strong transition-colors">Publish</button>
                    )}
                    {demo.video_url && (
                      <a href={demo.video_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-soft hover:text-ink transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => setEditingId(editingId === demo.id ? null : demo.id)} className="p-1.5 text-soft hover:text-ink transition-colors">
                      <ChevronDown className={`w-4 h-4 transition-transform ${editingId === demo.id ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload URL input */}
              <AnimatePresence>
                {uploadingId === demo.id && (
                  <m.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-sand">
                    <div className="p-4 bg-paper">
                      <label className="text-xs text-soft font-medium mb-1 block">Video URL (Bunny.net or YouTube)</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://iframe.mediadelivery.net/embed/... or YouTube URL"
                          className="flex-1 px-3 py-2 bg-paper border border-sand rounded text-sm text-ink placeholder:text-soft/70 focus:outline-none focus:border-accent/40"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleVideoUrl(demo.id, (e.target as HTMLInputElement).value);
                            }
                          }}
                        />
                        <button
                          onClick={() => setUploadingId(null)}
                          className="px-3 py-2 text-soft hover:text-ink text-sm"
                        >Cancel</button>
                      </div>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>

              {/* Expanded instructions */}
              <AnimatePresence>
                {editingId === demo.id && (
                  <m.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-sand">
                    <div className="p-4 bg-paper">
                      <h4 className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent mb-2">Recording Instructions</h4>
                      <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{demo.instructions}</div>
                      {demo.assigned_to && (
                        <div className="mt-3 text-xs text-soft">Assigned to: <span className="text-ink">{demo.assigned_to}</span></div>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => deleteDemo(demo.id)} className="f0-press f0-focus px-2.5 py-1 rounded-lg border border-sand text-xs text-soft hover:border-accent/50 hover:text-accent transition-colors">Delete</button>
                      </div>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </m.div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-soft text-sm">
            {search ? "No demos matching your search" : "No coach demos yet. Click Add Demo to create one."}
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
            onClick={() => setShowCreate(false)}
          >
            <m.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="club-b-card max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-sand">
                <h3 className="font-display text-[17px] font-extrabold text-ink">New Coach Demo</h3>
                <button onClick={() => setShowCreate(false)} className="text-soft hover:text-ink"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-4 space-y-4">
                {/* Course */}
                <div>
                  <label className="text-xs text-soft font-medium mb-1 block">Course</label>
                  <select value={form.course_slug} onChange={(e) => setForm({ ...form, course_slug: e.target.value })} className="w-full px-3 py-2 bg-paper border border-sand rounded text-sm text-ink focus:outline-none focus:border-accent/40">
                    <option value="">Select course...</option>
                    {courses.map((c) => <option key={c.id} value={c.slug}>{c.title}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-soft font-medium mb-1 block">Module</label>
                    <input value={form.module_title} onChange={(e) => setForm({ ...form, module_title: e.target.value })} placeholder="e.g. Module 2: FVGs" className="w-full px-3 py-2 bg-paper border border-sand rounded text-sm text-ink placeholder:text-soft/70 focus:outline-none focus:border-accent/40" />
                  </div>
                  <div>
                    <label className="text-xs text-soft font-medium mb-1 block">Lesson</label>
                    <input value={form.lesson_title} onChange={(e) => setForm({ ...form, lesson_title: e.target.value })} placeholder="e.g. Live Demo: FVGs" className="w-full px-3 py-2 bg-paper border border-sand rounded text-sm text-ink placeholder:text-soft/70 focus:outline-none focus:border-accent/40" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-soft font-medium mb-1 block">Demo Title</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Finding FVGs on TradingView" className="w-full px-3 py-2 bg-paper border border-sand rounded text-sm text-ink placeholder:text-soft/70 focus:outline-none focus:border-accent/40" />
                </div>

                <div>
                  <label className="text-xs text-soft font-medium mb-1 block">Description (optional)</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" className="w-full px-3 py-2 bg-paper border border-sand rounded text-sm text-ink placeholder:text-soft/70 focus:outline-none focus:border-accent/40" />
                </div>

                <div>
                  <label className="text-xs text-soft font-medium mb-1 block">Recording Instructions *</label>
                  <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder={"What the coach should record:\n\n1. Open TradingView on ES 1-min chart\n2. Show how to identify FVGs visually\n3. Walk through a live example\n4. Show where to place entry and stop loss\n\nKeep it 3-5 minutes. Screen share + face cam."} rows={6} className="w-full px-3 py-2 bg-paper border border-sand rounded text-sm text-ink placeholder:text-soft/70 focus:outline-none focus:border-accent/40 resize-none" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-soft font-medium mb-1 block">Priority</label>
                    <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 bg-paper border border-sand rounded text-sm text-ink focus:outline-none focus:border-accent/40">
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-soft font-medium mb-1 block">Duration</label>
                    <input value={form.estimated_duration} onChange={(e) => setForm({ ...form, estimated_duration: e.target.value })} placeholder="3-5 min" className="w-full px-3 py-2 bg-paper border border-sand rounded text-sm text-ink placeholder:text-soft/70 focus:outline-none focus:border-accent/40" />
                  </div>
                  <div>
                    <label className="text-xs text-soft font-medium mb-1 block">Assign to</label>
                    <input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Coach name" className="w-full px-3 py-2 bg-paper border border-sand rounded text-sm text-ink placeholder:text-soft/70 focus:outline-none focus:border-accent/40" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-soft font-medium mb-1 block">Tags (comma-separated)</label>
                  <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tradingview, charting, FVG, beginner" className="w-full px-3 py-2 bg-paper border border-sand rounded text-sm text-ink placeholder:text-soft/70 focus:outline-none focus:border-accent/40" />
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t border-sand">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-soft text-sm hover:text-ink transition-colors">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={!form.title || !form.module_title || !form.lesson_title || !form.instructions}
                  className="f0-press f0-focus px-4 py-2 bg-accent text-[color:var(--accent-on)] rounded-lg text-sm font-semibold hover:bg-accent-strong transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Create Demo
                </button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
