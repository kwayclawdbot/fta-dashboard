"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  CalendarRange,
  Star,
  Eye,
  EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FicWeek } from "@/lib/fic";

interface SessionOpt {
  id: string;
  title: string;
  scheduled_at: string | null;
}

const EMPTY: Partial<FicWeek> = {
  week_start: "",
  class_title: "",
  class_session_id: null,
  company_name: "",
  company_ticker: "",
  cotw_what_they_do: "",
  cotw_how_they_make_money: "",
  cotw_why_customers_love: "",
  cotw_why_investors_watch: "",
  cotw_what_could_go_wrong: "",
  cotw_discussion_question: "",
  cotw_watchlist_assignment: "",
  family_assignment: "",
  parent_prompt: "",
  kid_challenge: "",
  parent_what_child_learned: "",
  parent_dinner_questions: "",
  parent_explain_simply: "",
  parent_what_not_to_do: "",
  parent_risk_talk: "",
  parent_patience: "",
  published: false,
  is_current: false,
};

function Field({
  label,
  hint,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-soft mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50 resize-none"
      />
      {hint && <p className="text-[11px] text-soft mt-1">{hint}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent pt-2">
      {children}
    </h3>
  );
}

export default function AdminFicWeeksPage() {
  const supabase = createClient();
  const [weeks, setWeeks] = useState<FicWeek[]>([]);
  const [sessions, setSessions] = useState<SessionOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<FicWeek>>(EMPTY);

  const set = (patch: Partial<FicWeek>) => setForm((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    const [{ data: w }, { data: s }] = await Promise.all([
      supabase.from("fic_weeks").select("*").order("week_start", { ascending: false }),
      supabase
        .from("live_sessions")
        .select("id, title, scheduled_at")
        .order("scheduled_at", { ascending: false }),
    ]);
    setWeeks((w as FicWeek[]) || []);
    setSessions((s as SessionOpt[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY });
    setShowForm(true);
  }

  function openEdit(w: FicWeek) {
    setEditingId(w.id);
    setForm({ ...w });
    setShowForm(true);
  }

  function close() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY });
  }

  async function save() {
    if (!form.week_start || !form.class_title) {
      alert("Week start date and class title are required.");
      return;
    }
    setSaving(true);
    const payload = {
      week_start: form.week_start,
      class_title: form.class_title,
      class_session_id: form.class_session_id || null,
      company_name: form.company_name || null,
      company_ticker: form.company_ticker
        ? form.company_ticker.toUpperCase()
        : null,
      cotw_what_they_do: form.cotw_what_they_do || null,
      cotw_how_they_make_money: form.cotw_how_they_make_money || null,
      cotw_why_customers_love: form.cotw_why_customers_love || null,
      cotw_why_investors_watch: form.cotw_why_investors_watch || null,
      cotw_what_could_go_wrong: form.cotw_what_could_go_wrong || null,
      cotw_discussion_question: form.cotw_discussion_question || null,
      cotw_watchlist_assignment: form.cotw_watchlist_assignment || null,
      family_assignment: form.family_assignment || null,
      parent_prompt: form.parent_prompt || null,
      kid_challenge: form.kid_challenge || null,
      parent_what_child_learned: form.parent_what_child_learned || null,
      parent_dinner_questions: form.parent_dinner_questions || null,
      parent_explain_simply: form.parent_explain_simply || null,
      parent_what_not_to_do: form.parent_what_not_to_do || null,
      parent_risk_talk: form.parent_risk_talk || null,
      parent_patience: form.parent_patience || null,
      published: !!form.published,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingId
      ? await supabase.from("fic_weeks").update(payload).eq("id", editingId)
      : await supabase.from("fic_weeks").insert(payload);
    setSaving(false);
    if (error) {
      alert(`Save failed: ${error.message}`);
      return;
    }
    close();
    setLoading(true);
    load();
  }

  async function togglePublished(w: FicWeek) {
    await supabase
      .from("fic_weeks")
      .update({ published: !w.published, updated_at: new Date().toISOString() })
      .eq("id", w.id);
    load();
  }

  async function setCurrent(w: FicWeek) {
    // Exactly one current week.
    await supabase.from("fic_weeks").update({ is_current: false }).neq("id", w.id);
    await supabase
      .from("fic_weeks")
      .update({ is_current: true, published: true, updated_at: new Date().toISOString() })
      .eq("id", w.id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this week? This cannot be undone.")) return;
    await supabase.from("fic_weeks").delete().eq("id", id);
    setLoading(true);
    load();
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink">This Week in FIC</h1>
          <p className="text-soft text-sm mt-1 max-w-2xl">
            Author each Family Investing Club week: the class, the Company of the
            Week breakdown, the family assignment, the parent prompt, and the kid
            challenge. Publish a week and set it as the current week to make it
            live on every family&apos;s home page.{" "}
            <span className="text-soft">
              The class video here is the single weekly Company-of-the-Week
              class — distinct from on-demand lesson videos (see Courses) and
              live-class replays (see Live Sessions).
            </span>
          </p>
        </div>
        <button
          onClick={openAdd}
          className="f0-press f0-focus flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-strong text-[color:var(--accent-on)] text-sm font-semibold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Week
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-scrim z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="club-b-card w-full max-w-2xl p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-[17px] font-extrabold text-ink">
                {editingId ? "Edit Week" : "New Week"}
              </h2>
              <button onClick={close} className="text-soft hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <SectionTitle>Class</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-soft mb-1">
                    Week start (Monday)
                  </label>
                  <input
                    type="date"
                    value={form.week_start || ""}
                    onChange={(e) => set({ week_start: e.target.value })}
                    className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-soft mb-1">
                    Class title
                  </label>
                  <input
                    type="text"
                    value={form.class_title || ""}
                    onChange={(e) => set({ class_title: e.target.value })}
                    placeholder="How Apple Makes Money"
                    className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-soft mb-1">
                  Link a live class (optional)
                </label>
                <select
                  value={form.class_session_id || ""}
                  onChange={(e) => set({ class_session_id: e.target.value || null })}
                  className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50"
                >
                  <option value="">— none —</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                      {s.scheduled_at
                        ? ` · ${new Date(s.scheduled_at).toLocaleDateString()}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <SectionTitle>Company of the Week</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-soft mb-1">
                    Company name
                  </label>
                  <input
                    type="text"
                    value={form.company_name || ""}
                    onChange={(e) => set({ company_name: e.target.value })}
                    placeholder="Apple"
                    className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-soft mb-1">Ticker</label>
                  <input
                    type="text"
                    value={form.company_ticker || ""}
                    onChange={(e) => set({ company_ticker: e.target.value })}
                    placeholder="AAPL"
                    className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink uppercase focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>
              <Field
                label="What they do"
                value={form.cotw_what_they_do || ""}
                onChange={(v) => set({ cotw_what_they_do: v })}
              />
              <Field
                label="How they make money"
                value={form.cotw_how_they_make_money || ""}
                onChange={(v) => set({ cotw_how_they_make_money: v })}
              />
              <Field
                label="Why customers love them"
                value={form.cotw_why_customers_love || ""}
                onChange={(v) => set({ cotw_why_customers_love: v })}
              />
              <Field
                label="Why investors watch"
                value={form.cotw_why_investors_watch || ""}
                onChange={(v) => set({ cotw_why_investors_watch: v })}
              />
              <Field
                label="What could go wrong"
                value={form.cotw_what_could_go_wrong || ""}
                onChange={(v) => set({ cotw_what_could_go_wrong: v })}
              />
              <Field
                label="Family discussion question"
                rows={2}
                value={form.cotw_discussion_question || ""}
                onChange={(v) => set({ cotw_discussion_question: v })}
              />
              <Field
                label="Watchlist assignment"
                rows={2}
                value={form.cotw_watchlist_assignment || ""}
                onChange={(v) => set({ cotw_watchlist_assignment: v })}
              />

              <SectionTitle>This week&apos;s assignments</SectionTitle>
              <Field
                label="Family assignment"
                value={form.family_assignment || ""}
                onChange={(v) => set({ family_assignment: v })}
              />
              <Field
                label="Parent prompt (Parents only)"
                value={form.parent_prompt || ""}
                onChange={(v) => set({ parent_prompt: v })}
              />
              <Field
                label="Kid challenge (Kids & Teens)"
                value={form.kid_challenge || ""}
                onChange={(v) => set({ kid_challenge: v })}
              />

              <SectionTitle>Parent Corner</SectionTitle>
              <Field
                label="What your child learned"
                value={form.parent_what_child_learned || ""}
                onChange={(v) => set({ parent_what_child_learned: v })}
              />
              <Field
                label="Dinner-table questions"
                hint="One per line."
                value={form.parent_dinner_questions || ""}
                onChange={(v) => set({ parent_dinner_questions: v })}
              />
              <Field
                label="Explain it simply"
                value={form.parent_explain_simply || ""}
                onChange={(v) => set({ parent_explain_simply: v })}
              />
              <Field
                label="What not to do"
                value={form.parent_what_not_to_do || ""}
                onChange={(v) => set({ parent_what_not_to_do: v })}
              />
              <Field
                label="The risk talk"
                value={form.parent_risk_talk || ""}
                onChange={(v) => set({ parent_risk_talk: v })}
              />
              <Field
                label="On patience"
                value={form.parent_patience || ""}
                onChange={(v) => set({ parent_patience: v })}
              />

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.published}
                  onChange={(e) => set({ published: e.target.checked })}
                  className="w-4 h-4 accent-[color:var(--accent-solid)]"
                />
                <span className="text-sm text-ink">
                  Published (visible to families)
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={close}
                className="px-4 py-2 text-sm text-soft hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="f0-press f0-focus px-4 py-2 rounded-lg bg-accent hover:bg-accent-strong text-[color:var(--accent-on)] text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : weeks.length === 0 ? (
        <div className="text-center py-20">
          <CalendarRange className="w-10 h-10 text-soft/70 mx-auto mb-3" />
          <h3 className="font-display text-[17px] font-extrabold text-ink mb-1">No weeks yet</h3>
          <p className="text-sm text-soft mb-4">
            Author the first Family Investing Club week.
          </p>
          <button
            onClick={openAdd}
            className="f0-press f0-focus inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-strong text-[color:var(--accent-on)] text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Week
          </button>
        </div>
      ) : (
        <div className="club-b-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sand bg-paper">
                <th className="text-left px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  Week
                </th>
                <th className="text-left px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  Class / Company
                </th>
                <th className="text-center px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  State
                </th>
                <th className="text-right px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-sand hover:bg-paper transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-ink whitespace-nowrap">
                    {w.week_start}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-ink font-medium">
                      {w.class_title}
                    </p>
                    <p className="text-xs text-soft mt-0.5">
                      {w.company_name
                        ? `${w.company_name}${w.company_ticker ? ` (${w.company_ticker})` : ""}`
                        : "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={`f0-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                          w.published
                            ? "text-soft"
                            : "text-soft"
                        }`}
                      >
                        {w.published ? "Live" : "Draft"}
                      </span>
                      {w.is_current && (
                        <span className="inline-flex items-center gap-1 f0-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent bg-accent/10">
                          <Star className="w-3 h-3" />
                          Current
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!w.is_current && (
                        <button
                          onClick={() => setCurrent(w)}
                          className="p-1.5 rounded text-soft hover:text-accent hover:bg-paper transition-colors"
                          title="Set as current week"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => togglePublished(w)}
                        className="p-1.5 rounded text-soft hover:text-ink hover:bg-paper transition-colors"
                        title={w.published ? "Unpublish" : "Publish"}
                      >
                        {w.published ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => openEdit(w)}
                        className="p-1.5 rounded text-soft hover:text-accent hover:bg-paper transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(w.id)}
                        className="p-1.5 rounded text-soft hover:text-accent hover:bg-paper transition-colors"
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
