"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Video,
  Calendar,
  ExternalLink,
  Upload,
  Link2,
  Film,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  RECORDINGS_BUCKET,
  detectUrlKind,
  recordingObjectPath,
  resolveRecordingKind,
} from "@/lib/recordings";

interface SessionRow {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_min: number | null;
  zoom_join_url: string | null;
  recording_url: string | null;
  recording_path: string | null;
  recording_kind: string | null;
  status: string;
  track: string | null;
  min_tier: string | null;
  class_type: string | null;
  worksheet_url: string | null;
  assignment: string | null;
}

// Must match the live_sessions_status_check constraint.
const STATUS_OPTIONS = ["scheduled", "live", "completed", "cancelled"];

// Must match the live_sessions_track_check constraint (026).
const TRACK_OPTIONS = [
  { value: "all", label: "Whole Family" },
  { value: "kids", label: "Kids Corner" },
  { value: "teens", label: "Teens" },
  { value: "adults", label: "Parents & Adults" },
];

// Must match the live_sessions_class_type_check constraint (031).
const CLASS_TYPE_OPTIONS = [
  { value: "", label: "— none —" },
  { value: "free_class", label: "Free Class (public funnel)" },
  { value: "weekly_class", label: "Weekly Family Stock Class" },
  { value: "guest_speaker", label: "Guest Speaker" },
  { value: "orientation", label: "Orientation" },
  { value: "parent_qa", label: "Parent Q&A" },
  { value: "kids_money_lab", label: "Kids Money Lab" },
  { value: "market_recap", label: "Market Recap" },
];

const ACCEPT_EXTENSIONS = [".mp4", ".m4a", ".webm"];

/**
 * Upload straight to Supabase Storage with XHR so we get real progress
 * events (supabase-js upload() can't report progress). Auth is the admin's
 * own session token — storage RLS (migration 026) enforces admin-only writes.
 */
async function uploadWithProgress(
  token: string,
  path: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();
  const url = `${base}/storage/v1/object/${RECORDINGS_BUCKET}/${path}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", anon);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.message) msg += `: ${body.message}`;
          else if (body?.error) msg += `: ${body.error}`;
        } catch {
          /* keep generic message */
        }
        if (xhr.status === 413)
          msg +=
            " — file exceeds the project's upload size limit. Use a YouTube unlisted link instead, or raise the limit in Supabase project settings (Storage).";
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

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
  const [formStatus, setFormStatus] = useState("scheduled");
  const [formTrack, setFormTrack] = useState("all");
  const [formTier, setFormTier] = useState("challenge");
  const [formClassType, setFormClassType] = useState("");
  const [formWorksheetUrl, setFormWorksheetUrl] = useState("");
  const [formAssignment, setFormAssignment] = useState("");

  // Recording modal state
  const [recordingFor, setRecordingFor] = useState<SessionRow | null>(null);
  const [recUrl, setRecUrl] = useState("");
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const [recSaving, setRecSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setFormStatus("scheduled");
    setFormTrack("all");
    setFormTier("challenge");
    setFormClassType("");
    setFormWorksheetUrl("");
    setFormAssignment("");
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
    setFormTrack(session.track || "all");
    setFormTier(session.min_tier || "challenge");
    setFormClassType(session.class_type || "");
    setFormWorksheetUrl(session.worksheet_url || "");
    setFormAssignment(session.assignment || "");
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    const editing = editingId
      ? sessions.find((s) => s.id === editingId)
      : undefined;
    // Keep recording_kind honest: pasted URL wins, otherwise an existing
    // uploaded file keeps kind 'upload', otherwise no recording -> null.
    const recordingKind = formRecordingUrl
      ? detectUrlKind(formRecordingUrl)
      : editing?.recording_path
        ? "upload"
        : null;
    const payload = {
      title: formTitle,
      description: formDescription || null,
      scheduled_at: formScheduledAt
        ? new Date(formScheduledAt).toISOString()
        : null,
      duration_min: formDuration,
      zoom_join_url: formZoomUrl || null,
      recording_url: formRecordingUrl || null,
      recording_kind: recordingKind,
      status: formStatus,
      track: formTrack,
      min_tier: formTier,
      class_type: formClassType || null,
      worksheet_url: formWorksheetUrl || null,
      assignment: formAssignment || null,
    };

    const { error } = editingId
      ? await supabase.from("live_sessions").update(payload).eq("id", editingId)
      : await supabase.from("live_sessions").insert(payload);
    if (error) {
      alert(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    resetForm();
    setLoading(true);
    loadSessions();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this live session?")) return;
    const session = sessions.find((s) => s.id === id);
    // Remove the uploaded recording file too, so the bucket doesn't
    // accumulate orphans.
    if (session?.recording_path) {
      await supabase.storage
        .from(RECORDINGS_BUCKET)
        .remove([session.recording_path]);
    }
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

  // ── Recording modal ──

  function openRecordingModal(session: SessionRow) {
    setRecordingFor(session);
    setRecUrl(session.recording_url || "");
    setUploadPct(null);
    setRecError(null);
    setRecSaving(false);
  }

  function closeRecordingModal() {
    if (uploadPct !== null && uploadPct < 100 && recSaving) return; // mid-upload
    setRecordingFor(null);
    setUploadPct(null);
    setRecError(null);
    setRecSaving(false);
  }

  async function handleFileUpload(file: File) {
    if (!recordingFor) return;
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPT_EXTENSIONS.includes(ext)) {
      setRecError(`Unsupported file type. Use ${ACCEPT_EXTENSIONS.join(", ")}.`);
      return;
    }
    setRecError(null);
    setRecSaving(true);
    setUploadPct(0);
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) throw new Error("Not signed in");

      const path = recordingObjectPath(recordingFor.id, file.name);
      await uploadWithProgress(token, path, file, setUploadPct);

      const { error } = await supabase
        .from("live_sessions")
        .update({
          recording_path: path,
          recording_kind: "upload",
          status: "completed",
        })
        .eq("id", recordingFor.id);
      if (error) throw new Error(error.message);

      setUploadPct(100);
      setRecordingFor(null);
      setLoading(true);
      loadSessions();
    } catch (e) {
      setRecError(e instanceof Error ? e.message : "Upload failed");
      setUploadPct(null);
    } finally {
      setRecSaving(false);
    }
  }

  async function handleUrlSave() {
    if (!recordingFor || !recUrl.trim()) return;
    setRecError(null);
    setRecSaving(true);
    const url = recUrl.trim();
    const { error } = await supabase
      .from("live_sessions")
      .update({
        recording_url: url,
        recording_kind: detectUrlKind(url),
        status: "completed",
      })
      .eq("id", recordingFor.id);
    setRecSaving(false);
    if (error) {
      setRecError(error.message);
      return;
    }
    setRecordingFor(null);
    setLoading(true);
    loadSessions();
  }

  async function handleRemoveRecording() {
    if (!recordingFor) return;
    if (!confirm("Remove this session's recording?")) return;
    setRecSaving(true);
    if (recordingFor.recording_path) {
      await supabase.storage
        .from(RECORDINGS_BUCKET)
        .remove([recordingFor.recording_path]);
    }
    await supabase
      .from("live_sessions")
      .update({
        recording_path: null,
        recording_url: null,
        recording_kind: null,
      })
      .eq("id", recordingFor.id);
    setRecSaving(false);
    setRecordingFor(null);
    setLoading(true);
    loadSessions();
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
      case "scheduled":
        return "text-blue-400 bg-blue-400/10";
      case "completed":
        return "text-green-400 bg-green-400/10";
      case "cancelled":
        return "text-zinc-500 bg-zinc-800";
      default:
        return "text-zinc-400 bg-zinc-800";
    }
  };

  const recordingBadge = (session: SessionRow) => {
    const kind = resolveRecordingKind(session);
    if (!kind) return null;
    const label =
      kind === "upload" ? "Video" : kind === "youtube" ? "YouTube" : "Link";
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
        <Film className="w-3 h-3" />
        {label}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Live Sessions</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage live coaching sessions and recordings. To publish a past
            class, create a session with status &quot;completed&quot; and add
            its recording.
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
                    Scheduled / class date
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
                  Recording URL (YouTube unlisted or other link)
                </label>
                <input
                  type="text"
                  value={formRecordingUrl}
                  onChange={(e) => setFormRecordingUrl(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  placeholder="https://youtu.be/..."
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  To upload a video file instead, save the session, then use
                  the recording button in the table.
                </p>
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
                    {TRACK_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
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
                    <option value="academy">Academy (FTA)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Class type (FIC grouping)
                </label>
                <select
                  value={formClassType}
                  onChange={(e) => setFormClassType(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                >
                  {CLASS_TYPE_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Worksheet URL (optional)
                </label>
                <input
                  type="text"
                  value={formWorksheetUrl}
                  onChange={(e) => setFormWorksheetUrl(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                  placeholder="https://... (PDF, Google Doc, etc.)"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Assignment (optional)
                </label>
                <textarea
                  value={formAssignment}
                  onChange={(e) => setFormAssignment(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 resize-none"
                  placeholder="What families do after this class"
                />
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

      {/* Recording Modal */}
      {recordingFor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-zinc-100">
                Class Recording
              </h2>
              <button
                onClick={closeRecordingModal}
                className="text-zinc-400 hover:text-zinc-200"
                disabled={recSaving && uploadPct !== null}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-5 truncate">
              {recordingFor.title}
            </p>

            {resolveRecordingKind(recordingFor) && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-emerald-400/10 text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Recording attached (
                {resolveRecordingKind(recordingFor) === "upload"
                  ? recordingFor.recording_path
                  : recordingFor.recording_url}
                )
              </div>
            )}

            {/* Upload */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                <Upload className="w-3.5 h-3.5 inline mr-1" />
                Upload video file
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_EXTENSIONS.join(",")}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                  e.target.value = "";
                }}
              />
              {uploadPct !== null ? (
                <div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${uploadPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-400 mt-1.5">
                    Uploading... {uploadPct}%
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={recSaving}
                  className="w-full px-4 py-3 rounded-lg border border-dashed border-zinc-700 text-zinc-400 text-sm hover:border-amber-400/50 hover:text-zinc-200 transition-colors disabled:opacity-50"
                >
                  Choose file ({ACCEPT_EXTENSIONS.join(" / ")})
                </button>
              )}
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Stored privately; members stream it in-app. Large Zoom
                exports over the project upload limit? Use a YouTube unlisted
                link below.
              </p>
            </div>

            {/* URL */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                <Link2 className="w-3.5 h-3.5 inline mr-1" />
                Or paste a recording link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={recUrl}
                  onChange={(e) => setRecUrl(e.target.value)}
                  placeholder="https://youtu.be/..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50"
                />
                <button
                  onClick={handleUrlSave}
                  disabled={recSaving || !recUrl.trim()}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Save
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                YouTube links play in-app (privacy-enhanced embed); other
                links open in a new tab.
              </p>
            </div>

            {recError && (
              <p className="text-xs text-red-400 mb-4 break-words">
                {recError}
              </p>
            )}

            {resolveRecordingKind(recordingFor) && (
              <button
                onClick={handleRemoveRecording}
                disabled={recSaving}
                className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
              >
                Remove recording
              </button>
            )}
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
                  Recording
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
                    {session.duration_min ? (
                      <span className="text-zinc-600">
                        {" "}
                        · {session.duration_min}m
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {TRACK_OPTIONS.find((t) => t.value === session.track)
                      ?.label ||
                      session.track ||
                      "—"}
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
                  <td className="px-4 py-3 text-center">
                    {recordingBadge(session) || (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
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
                      <button
                        onClick={() => openRecordingModal(session)}
                        className="p-1.5 rounded text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                        title="Upload or link recording"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
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
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        title="Delete"
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
