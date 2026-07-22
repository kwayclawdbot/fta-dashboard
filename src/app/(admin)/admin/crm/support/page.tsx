"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  LifeBuoy,
  RefreshCw,
  Send,
  Loader2,
  User as UserIcon,
  Bot,
  ExternalLink,
  Inbox,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchAdminTickets,
  fetchAdminTicketDetail,
  adminReply,
  adminSetStatus,
  type AdminTicketRow,
  type AdminTicketDetail,
} from "@/lib/help/admin";
import {
  CATEGORY_LABELS,
  type TicketStatus,
  type TicketCategory,
} from "@/lib/help/tickets";
import { AdminAvatar } from "@/components/admin/crm/ui";

const STATUSES: (TicketStatus | "all")[] = [
  "all",
  "open",
  "pending",
  "resolved",
  "closed",
];
const CATEGORIES: (TicketCategory | "all")[] = [
  "all",
  "billing",
  "account",
  "classes",
  "technical",
  "other",
];

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-amber-400/15 text-amber-300",
  pending: "bg-blue-400/15 text-blue-300",
  resolved: "bg-emerald-400/15 text-emerald-300",
  closed: "bg-zinc-700/40 text-zinc-400",
};

function StatusChip({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminSupportPage() {
  const supabase = useMemo(() => createClient(), []);
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | "all">(
    "all"
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminTicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchAdminTickets(supabase, {
        status: statusFilter,
        category: categoryFilter,
      });
      setTickets(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [supabase, statusFilter, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      try {
        setDetail(await fetchAdminTicketDetail(supabase, id));
      } catch {
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const openCount = useMemo(
    () => tickets.filter((t) => t.awaiting_team).length,
    [tickets]
  );

  async function sendReply() {
    if (!selectedId || !reply.trim() || busy) return;
    setBusy(true);
    try {
      await adminReply(supabase, selectedId, reply.trim());
      setReply("");
      await loadDetail(selectedId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: TicketStatus) {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      await adminSetStatus(supabase, selectedId, status);
      await loadDetail(selectedId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setBusy(false);
    }
  }

  const t = detail?.ticket;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Support</h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              {openCount > 0
                ? `${openCount} ticket${openCount === 1 ? "" : "s"} awaiting a reply`
                : "Member support requests"}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as TicketStatus | "all")
          }
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value as TicketCategory | "all")
          }
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-4">
        {/* Queue */}
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-16 text-center text-zinc-600 text-sm flex flex-col items-center gap-2">
              <Inbox className="w-6 h-6" />
              No tickets match.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/70 max-h-[70vh] overflow-y-auto">
              {tickets.map((row) => {
                const active = row.id === selectedId;
                return (
                  <button
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full text-left px-4 py-3 flex gap-3 transition-colors ${
                      active ? "bg-amber-400/5" : "hover:bg-zinc-800/30"
                    }`}
                  >
                    <div className="relative">
                      <AdminAvatar
                        name={row.display_name}
                        avatarUrl={row.avatar_url}
                        size="md"
                      />
                      {row.awaiting_team && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#0a0a0f]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm truncate ${
                            row.awaiting_team
                              ? "font-semibold text-zinc-100"
                              : "font-medium text-zinc-300"
                          }`}
                        >
                          {row.subject}
                        </span>
                        <StatusChip status={row.status} />
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {row.display_name || row.email || "Member"} ·{" "}
                        {CATEGORY_LABELS[row.category]}
                      </p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        {row.message_count} msg · {timeAgo(row.last_message_at)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 min-h-[400px] flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-sm gap-2">
              <LifeBuoy className="w-6 h-6" />
              Select a ticket to view the thread.
            </div>
          ) : detailLoading || !t ? (
            <div className="flex-1 flex justify-center items-center">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            </div>
          ) : (
            <>
              {/* Ticket header */}
              <div className="px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-zinc-100">
                    {t.subject}
                  </h2>
                  <StatusChip status={t.status} />
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500 flex-wrap">
                  <AdminAvatar
                    name={t.display_name}
                    avatarUrl={t.avatar_url}
                    size="sm"
                  />
                  <span className="text-zinc-300">
                    {t.display_name || "Member"}
                  </span>
                  {t.email && <span>· {t.email}</span>}
                  {t.family_name && <span>· {t.family_name}</span>}
                  <span>· {CATEGORY_LABELS[t.category]}</span>
                  <Link
                    href={`/admin/crm/members/${t.user_id}`}
                    className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300"
                  >
                    <ExternalLink className="w-3 h-3" /> CRM profile
                  </Link>
                </div>
                {/* Status controls */}
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  {(["open", "pending", "resolved", "closed"] as TicketStatus[]).map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() => changeStatus(s)}
                        disabled={busy || t.status === s}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors capitalize ${
                          t.status === s
                            ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                            : "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                        } disabled:opacity-60`}
                      >
                        {s}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Thread */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 max-h-[46vh]">
                {detail?.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${
                      m.sender === "team" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        m.sender === "team"
                          ? "bg-amber-400/20 text-amber-300"
                          : m.sender === "ai"
                            ? "bg-zinc-700 text-zinc-300"
                            : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {m.sender === "user" ? (
                        <UserIcon className="w-4 h-4" />
                      ) : m.sender === "ai" ? (
                        <Bot className="w-4 h-4" />
                      ) : (
                        <LifeBuoy className="w-4 h-4" />
                      )}
                    </span>
                    <div className="max-w-[80%]">
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                          m.sender === "team"
                            ? "bg-amber-400 text-zinc-950 rounded-tr-sm"
                            : "bg-zinc-800 text-zinc-100 rounded-tl-sm"
                        }`}
                      >
                        {m.body}
                      </div>
                      <p
                        className={`text-[10px] text-zinc-600 mt-1 ${
                          m.sender === "team" ? "text-right" : ""
                        }`}
                      >
                        {m.sender === "team"
                          ? "Team"
                          : m.sender === "ai"
                            ? "Kai bot"
                            : t.display_name || "Member"}{" "}
                        · {timeAgo(m.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              <div className="border-t border-zinc-800 p-3 flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  rows={2}
                  placeholder="Reply as the team… (⌘/Ctrl + Enter to send)"
                  className="flex-1 resize-none bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400/50 max-h-32"
                />
                <button
                  onClick={sendReply}
                  disabled={busy || !reply.trim()}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 h-10 rounded-lg bg-amber-400 text-zinc-950 font-semibold text-sm disabled:opacity-40 hover:bg-amber-300 transition-colors"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
