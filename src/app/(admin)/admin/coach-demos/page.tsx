"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  pending: { label: "Pending", color: "text-zinc-400", bg: "bg-zinc-400/10", icon: Clock },
  assigned: { label: "Assigned", color: "text-blue-400", bg: "bg-blue-400/10", icon: User },
  recording: { label: "Recording", color: "text-amber-400", bg: "bg-amber-400/10", icon: Video },
  uploaded: { label: "Uploaded", color: "text-purple-400", bg: "bg-purple-400/10", icon: Upload },
  review: { label: "In Review", color: "text-orange-400", bg: "bg-orange-400/10", icon: AlertCircle },
  approved: { label: "Approved", color: "text-emerald-400", bg: "bg-emerald-400/10", icon: Check },
  published: { label: "Published", color: "text-green-400", bg: "bg-green-400/10", icon: ExternalLink },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "text-zinc-500" },
  normal: { label: "Normal", color: "text-zinc-300" },
  high: { label: "High", color: "text-amber-400" },
  urgent: { label: "Urgent", color: "text-red-400" },
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
        <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Clapperboard className="w-6 h-6 text-amber-400" />
            Coach Demo Content
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Track, assign, and manage live coach demo recordings
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-zinc-950 rounded-lg text-sm font-semibold hover:bg-amber-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Demo
        </button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterStatus("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === "all" ? "bg-zinc-700 text-zinc-100" : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"}`}
        >
          All ({demos.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${filterStatus === key ? `${cfg.bg} ${cfg.color}` : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"}`}
          >
            {cfg.label} ({statusCounts[key] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, lesson, module, or tag..."
          className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40"
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
            <motion.div
              key={demo.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-zinc-800 rounded-lg bg-zinc-900/40 overflow-hidden"
            >
              {/* Card header */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${statusCfg.bg} ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                      <span className={`text-[11px] font-medium ${priorityCfg.color}`}>
                        {priorityCfg.label}
                      </span>
                      {demo.estimated_duration && (
                        <span className="text-[11px] text-zinc-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {demo.estimated_duration}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-zinc-100">{demo.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                      {course && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {course.title}</span>}
                      <span>→ {demo.module_title} → {demo.lesson_title}</span>
                    </div>
                    {demo.description && (
                      <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{demo.description}</p>
                    )}
                    {/* Tags */}
                    {demo.tags && demo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {demo.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[11px] rounded-full flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" /> {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {demo.status === "pending" && (
                      <button onClick={() => updateStatus(demo.id, "assigned")} className="px-2.5 py-1.5 bg-blue-400/10 text-blue-400 rounded text-xs font-medium hover:bg-blue-400/20 transition-colors">Assign</button>
                    )}
                    {(demo.status === "assigned" || demo.status === "recording") && (
                      <button onClick={() => setUploadingId(demo.id)} className="px-2.5 py-1.5 bg-purple-400/10 text-purple-400 rounded text-xs font-medium hover:bg-purple-400/20 transition-colors flex items-center gap-1">
                        <Upload className="w-3 h-3" /> Upload
                      </button>
                    )}
                    {demo.status === "uploaded" && (
                      <button onClick={() => updateStatus(demo.id, "approved")} className="px-2.5 py-1.5 bg-emerald-400/10 text-emerald-400 rounded text-xs font-medium hover:bg-emerald-400/20 transition-colors flex items-center gap-1">
                        <Check className="w-3 h-3" /> Approve
                      </button>
                    )}
                    {demo.status === "approved" && (
                      <button onClick={() => updateStatus(demo.id, "published")} className="px-2.5 py-1.5 bg-green-400/10 text-green-400 rounded text-xs font-medium hover:bg-green-400/20 transition-colors">Publish</button>
                    )}
                    {demo.video_url && (
                      <a href={demo.video_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => setEditingId(editingId === demo.id ? null : demo.id)} className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
                      <ChevronDown className={`w-4 h-4 transition-transform ${editingId === demo.id ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload URL input */}
              <AnimatePresence>
                {uploadingId === demo.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-zinc-800">
                    <div className="p-4 bg-zinc-800/30">
                      <label className="text-xs text-zinc-400 font-medium mb-1 block">Video URL (Bunny.net or YouTube)</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://iframe.mediadelivery.net/embed/... or YouTube URL"
                          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleVideoUrl(demo.id, (e.target as HTMLInputElement).value);
                            }
                          }}
                        />
                        <button
                          onClick={() => setUploadingId(null)}
                          className="px-3 py-2 text-zinc-500 hover:text-zinc-300 text-sm"
                        >Cancel</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Expanded instructions */}
              <AnimatePresence>
                {editingId === demo.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-zinc-800">
                    <div className="p-4 bg-zinc-800/20">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Recording Instructions</h4>
                      <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{demo.instructions}</div>
                      {demo.assigned_to && (
                        <div className="mt-3 text-xs text-zinc-500">Assigned to: <span className="text-zinc-300">{demo.assigned_to}</span></div>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => deleteDemo(demo.id)} className="px-2.5 py-1 text-red-400 bg-red-400/10 rounded text-xs hover:bg-red-400/20 transition-colors">Delete</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-500 text-sm">
            {search ? "No demos matching your search" : "No coach demos yet. Click Add Demo to create one."}
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-100">New Coach Demo</h3>
                <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-zinc-300"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-4 space-y-4">
                {/* Course */}
                <div>
                  <label className="text-xs text-zinc-400 font-medium mb-1 block">Course</label>
                  <select value={form.course_slug} onChange={(e) => setForm({ ...form, course_slug: e.target.value })} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-amber-400/40">
                    <option value="">Select course...</option>
                    {courses.map((c) => <option key={c.id} value={c.slug}>{c.title}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 font-medium mb-1 block">Module</label>
                    <input value={form.module_title} onChange={(e) => setForm({ ...form, module_title: e.target.value })} placeholder="e.g. Module 2: FVGs" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 font-medium mb-1 block">Lesson</label>
                    <input value={form.lesson_title} onChange={(e) => setForm({ ...form, lesson_title: e.target.value })} placeholder="e.g. Live Demo: FVGs" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium mb-1 block">Demo Title</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Finding FVGs on TradingView" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40" />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium mb-1 block">Description (optional)</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40" />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium mb-1 block">Recording Instructions *</label>
                  <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder={"What the coach should record:\n\n1. Open TradingView on ES 1-min chart\n2. Show how to identify FVGs visually\n3. Walk through a live example\n4. Show where to place entry and stop loss\n\nKeep it 3-5 minutes. Screen share + face cam."} rows={6} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40 resize-none" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 font-medium mb-1 block">Priority</label>
                    <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-amber-400/40">
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 font-medium mb-1 block">Duration</label>
                    <input value={form.estimated_duration} onChange={(e) => setForm({ ...form, estimated_duration: e.target.value })} placeholder="3-5 min" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 font-medium mb-1 block">Assign to</label>
                    <input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Coach name" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium mb-1 block">Tags (comma-separated)</label>
                  <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tradingview, charting, FVG, beginner" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40" />
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t border-zinc-800">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-zinc-400 text-sm hover:text-zinc-200 transition-colors">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={!form.title || !form.module_title || !form.lesson_title || !form.instructions}
                  className="px-4 py-2 bg-amber-400 text-zinc-950 rounded-lg text-sm font-semibold hover:bg-amber-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Create Demo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
