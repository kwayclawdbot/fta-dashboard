"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Video,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SessionRow {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_min: number | null;
  zoom_join_url: string | null;
  recording_url: string | null;
  status: string;
  track: string | null;
  min_tier: string | null;
}

const STATUS_OPTIONS = ["upcoming", "live", "completed", "cancelled"];

export default function AdminLiveSessionsPage() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formScheduledAt, setFormScheduledAt] = useState("");
  const [formDuration, setFormDuration] = useState(45);
  const [formZoomUrl, setFormZoomUrl] = useState("");
  const [formRecordingUrl, setFormRecordingUrl] = useState("");
  const [formStatus, setFormStatus] = useState("upcoming");
  const [formTrack, setFormTrack] = useState("stocks-options");
  const [formTier, setFormTier] = useState("challenge");

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("live_sessions")
      .select("*")
      .order("scheduled_at", { ascending: false });
    setSessions(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  function resetForm() {
    setFormTitle("");
    setFormDescription("");
    setFormScheduledAt("");
    setFormDuration(45);
    setFormZoomUrl("");
    setFormRecordingUrl("");
    setFormStatus("upcoming");
    setFormTrack("stocks-options");
    setFormTier("challenge");
    setEditingId(null);
    setShowForm(false);
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(session: SessionRow) {
    setEditingId(session.id);
    setFormTitle(session.title);
    setFormDescription(session.description || "");
    setFormScheduledAt(
      session.scheduled_at
        ? new Date(session.scheduled_at).toISOString().slice(0, 16)
        : ""
    );
    setFormDuration(session.duration_min || 45);
    setFormZoomUrl(session.zoom_join_url || "");
    setFormRecordingUrl(session.recording_url || "");
    setFormStatus(session.status);
    setFormTrack(session.track || "stocks-options");
    setFormTier(session.min_tier || "challenge");
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      title: formTitle,
      description: formDescription || null,
      scheduled_at: formScheduledAt ? new Date(formScheduledAt).toISOString() : null,
      duration_min: formDuration,
      zoom_join_url: formZoomUrl || null,
      recording_url: formRecordingUrl || null,
      status: formStatus,
      track: formTrack,
      min_tier: formTier,
    };

    if (editingId) {
      await supabase.from("live_sessions").update(payload).eq("id", editingId);
    } else {
      await supabase.from("live_sessions").insert(payload);
    }

    setSaving(false);
    resetForm();
    setLoading(true);
    loadSessions();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this live session?")) return;
    await supabase.from("live_sessions").delete().eq("id", id);
    setLoading(true);
    loadSessions();
  }

  async function markCompleted(session: SessionRow) {
    await supabase
      .from("live_sessions")
      .update({ status: "completed" })
      .eq("id", session.id);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === session.id ? { ...s, status: "completed" } : s
      )
    );
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "live":
        return "text-red-400 bg-red-400/10";
      case "upcoming":
        return "text-blue-400 bg-blue-400/10";
      case "completed":
        return "text-green-400 bg-green-400/10";
      case "cancelled":
        return "text-zinc-500 bg-zinc-800";
      default:
        return "text-zinc-400 bg-zinc-800";
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Live Sessions</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage live coaching sessions and recordings
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-100">
                {editingId ? "Edit Session" : "New Session"}
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
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  placeholder="Weekly Market Breakdown"
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
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Scheduled At
                  </label>
                  <input
                    type="datetime-local"
                    value={formScheduledAt}
                    onChange={(e) => setFormScheduledAt(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={formDuration}
                    onChange={(e) =>
                      setFormDuration(parseInt(e.target.value) || 45)
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Zoom Join URL
                </label>
                <input
                  type="text"
                  value={formZoomUrl}
                  onChange={(e) => setFormZoomUrl(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  placeholder="https://zoom.us/j/..."
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Recording URL
                </label>
                <input
                  type="text"
                  value={formRecordingUrl}
                  onChange={(e) => setFormRecordingUrl(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Track
                  </label>
                  <select
                    value={formTrack}
                    onChange={(e) => setFormTrack(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  >
                    <option value="stocks-options">Stocks & Options</option>
                    <option value="forex">Forex</option>
                    <option value="futures">Futures</option>
                    <option value="crypto">Crypto</option>
                    <option value="all">All Tracks</option>
                  </select>
                </div>
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
              </div>
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
                disabled={saving || !formTitle}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20">
          <Video className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-1">
            No live sessions yet
          </h3>
          <p className="text-sm text-zinc-500 mb-4">
            Create your first session
          </p>
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Session
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
                  Scheduled
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Track
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm text-zinc-100 font-medium">
                      {session.title}
                    </p>
                    {session.description && (
                      <p className="text-xs text-zinc-500 truncate max-w-xs mt-0.5">
                        {session.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {formatDate(session.scheduled_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {session.track || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${statusColor(
                        session.status
                      )}`}
                    >
                      {session.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 text-center">
                    {session.duration_min ? `${session.duration_min}m` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {session.zoom_join_url && (
                        <a
                          href={session.zoom_join_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors"
                          title="Open Zoom"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {session.status !== "completed" && (
                        <button
                          onClick={() => markCompleted(session)}
                          className="p-1.5 rounded text-zinc-400 hover:text-green-400 hover:bg-zinc-800 transition-colors text-xs"
                          title="Mark completed"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openEditForm(session)}
                        className="p-1.5 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
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
