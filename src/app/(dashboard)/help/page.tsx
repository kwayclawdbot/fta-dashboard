"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  LifeBuoy,
  Send,
  Bot,
  User as UserIcon,
  MessageSquarePlus,
  ChevronDown,
  ChevronRight,
  Loader2,
  Headset,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  TICKET_CATEGORIES,
  CATEGORY_LABELS,
  createTicket,
  fetchMyTickets,
  replyToTicket,
  type HelpTicket,
  type TicketCategory,
  type TicketStatus,
} from "@/lib/help/tickets";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const MAX_CHAT_MESSAGES = 20;

const GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Hi! I'm Kai, your Family Investing Club help assistant. Ask me how anything in the app works — courses, live classes, your family, billing, and more. (I can't give trading advice — for that, stick with the lessons!)",
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-gold-400/15 text-gold-700",
  pending: "bg-blue-400/15 text-blue-400",
  resolved: "bg-emerald-400/15 text-emerald-400",
  closed: "bg-midnight-700/40 text-midnight-400",
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

export default function HelpPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<"bot" | "team">("bot");

  // ── AI chat ────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Ticket form ────────────────────────────────────────────────────────
  const [category, setCategory] = useState<TicketCategory>("other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Tickets list ───────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<HelpTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, [supabase]);

  const loadTickets = useCallback(async () => {
    try {
      setTickets(await fetchMyTickets(supabase));
    } catch {
      /* non-fatal */
    } finally {
      setLoadingTickets(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const chatCapped = userTurns >= MAX_CHAT_MESSAGES;

  async function sendChat(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending || chatCapped) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/help/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.reply ||
            "I'm having trouble right now — please use the Speak to the team tab.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something went wrong reaching me. Please use the Speak to the team tab and a real person will help.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function escalateToTeam() {
    // Prefill the team form with the recent chat transcript.
    const transcript = messages
      .filter((m) => m !== GREETING)
      .map((m) => `${m.role === "user" ? "Me" : "Kai"}: ${m.content}`)
      .join("\n");
    const preface =
      "I was chatting with the help bot and would like a person to help.\n\n";
    setMessage(
      transcript
        ? `${preface}--- Chat with Kai ---\n${transcript}`
        : preface
    );
    setSubject((s) => s || "Help from the team");
    setTab("team");
  }

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!userId) {
      setFormError("Please wait a moment and try again.");
      return;
    }
    if (subject.trim().length < 3) {
      setFormError("Add a short subject.");
      return;
    }
    if (message.trim().length < 3) {
      setFormError("Tell us a little about what you need.");
      return;
    }
    setSubmitting(true);
    try {
      const id = await createTicket(supabase, userId, {
        category,
        subject,
        message,
      });
      setSubject("");
      setMessage("");
      setCategory("other");
      await loadTickets();
      setExpanded(id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReply(ticketId: string) {
    const text = replyBody.trim();
    if (!text || replyBusy) return;
    setReplyBusy(true);
    try {
      await replyToTicket(supabase, ticketId, text);
      setReplyBody("");
      await loadTickets();
    } catch {
      /* keep text so they can retry */
    } finally {
      setReplyBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <span className="w-9 h-9 rounded-lg bg-gold-400/15 text-gold-700 flex items-center justify-center">
          <LifeBuoy className="w-5 h-5" />
        </span>
        <h1 className="font-display text-2xl font-bold text-midnight-100">
          Help &amp; Support
        </h1>
      </div>
      <p className="text-sm text-midnight-400 mb-5 ml-12">
        Ask the help bot a quick question, or reach a real person on the team.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-midnight-900 border border-midnight-800 mb-5 w-full max-w-md">
        <button
          onClick={() => setTab("bot")}
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-md transition-colors ${
            tab === "bot"
              ? "bg-gold-400/15 text-gold-700"
              : "text-midnight-400 hover:text-midnight-200"
          }`}
        >
          <Bot className="w-4 h-4" /> Ask Kai&apos;s help bot
        </button>
        <button
          onClick={() => setTab("team")}
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-md transition-colors ${
            tab === "team"
              ? "bg-gold-400/15 text-gold-700"
              : "text-midnight-400 hover:text-midnight-200"
          }`}
        >
          <Headset className="w-4 h-4" /> Speak to the team
        </button>
      </div>

      {/* ── AI chat tab ─────────────────────────────────────────────────── */}
      {tab === "bot" && (
        <div className="rounded-xl border border-midnight-800 bg-midnight-900/50 overflow-hidden">
          <div className="h-[420px] overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  m.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <span
                  className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    m.role === "user"
                      ? "bg-midnight-800 text-midnight-300"
                      : "bg-gold-400/20 text-gold-700"
                  }`}
                >
                  {m.role === "user" ? (
                    <UserIcon className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </span>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-gold-500 text-white rounded-tr-sm"
                      : "bg-midnight-800 text-midnight-100 rounded-tl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-3">
                <span className="mt-0.5 w-7 h-7 rounded-full bg-gold-400/20 text-gold-700 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </span>
                <div className="bg-midnight-800 text-midnight-400 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Escalate */}
          <div className="px-4 py-2 border-t border-midnight-800 bg-midnight-950/40">
            <button
              onClick={escalateToTeam}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-midnight-300 hover:text-gold-700 transition-colors"
            >
              <Headset className="w-3.5 h-3.5" /> Talk to a human instead
            </button>
          </div>

          {/* Composer */}
          <form
            onSubmit={sendChat}
            className="flex items-end gap-2 p-3 border-t border-midnight-800"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChat();
                }
              }}
              rows={1}
              disabled={chatCapped}
              placeholder={
                chatCapped
                  ? "Chat limit reached — use Speak to the team for more help."
                  : "Ask a question…"
              }
              className="flex-1 resize-none bg-midnight-950 border border-midnight-800 rounded-lg px-3 py-2 text-sm text-midnight-100 placeholder-midnight-600 focus:outline-none focus:border-gold-500/50 max-h-32"
            />
            <button
              type="submit"
              disabled={sending || !input.trim() || chatCapped}
              className="shrink-0 w-10 h-10 rounded-lg bg-gold-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-gold-600 transition-colors"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* ── Speak to the team tab ───────────────────────────────────────── */}
      {tab === "team" && (
        <div className="space-y-6">
          {/* Form */}
          <form
            onSubmit={submitTicket}
            className="rounded-xl border border-midnight-800 bg-midnight-900/50 p-5 space-y-3"
          >
            <div className="flex items-center gap-2 text-midnight-200">
              <MessageSquarePlus className="w-4 h-4 text-gold-700" />
              <span className="text-sm font-semibold">New support request</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-midnight-400 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as TicketCategory)
                  }
                  className="w-full bg-midnight-950 border border-midnight-800 rounded-lg px-3 py-2 text-sm text-midnight-100 focus:outline-none focus:border-gold-500/50"
                >
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-midnight-400 mb-1">
                  Subject
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Short summary"
                  maxLength={200}
                  className="w-full bg-midnight-950 border border-midnight-800 rounded-lg px-3 py-2 text-sm text-midnight-100 placeholder-midnight-600 focus:outline-none focus:border-gold-500/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-midnight-400 mb-1">
                How can we help?
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Tell us what's going on…"
                className="w-full resize-y bg-midnight-950 border border-midnight-800 rounded-lg px-3 py-2 text-sm text-midnight-100 placeholder-midnight-600 focus:outline-none focus:border-gold-500/50"
              />
            </div>
            {formError && (
              <p className="text-xs text-red-400">{formError}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gold-500 text-white font-semibold hover:bg-gold-600 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? "Sending…" : "Send to the team"}
            </button>
          </form>

          {/* Existing tickets */}
          <div>
            <h2 className="text-sm font-semibold text-midnight-200 mb-3">
              Your requests
            </h2>
            {loadingTickets ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-gold-700" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-midnight-500 py-6 text-center rounded-xl border border-midnight-800 bg-midnight-900/30">
                No requests yet. Send one above and we&apos;ll get back to you.
              </p>
            ) : (
              <div className="space-y-2">
                {tickets.map((t) => {
                  const open = expanded === t.id;
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border border-midnight-800 bg-midnight-900/50 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpanded(open ? null : t.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-midnight-800/30 transition-colors"
                      >
                        {open ? (
                          <ChevronDown className="w-4 h-4 text-midnight-500 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-midnight-500 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-midnight-100 truncate">
                              {t.subject}
                            </span>
                            <StatusChip status={t.status} />
                          </div>
                          <p className="text-[11px] text-midnight-500 mt-0.5">
                            {CATEGORY_LABELS[t.category]} ·{" "}
                            {timeAgo(t.last_message_at)}
                          </p>
                        </div>
                      </button>

                      {open && (
                        <div className="border-t border-midnight-800 px-4 py-3 space-y-3">
                          <div className="space-y-3">
                            {t.help_messages?.map((m) => (
                              <div
                                key={m.id}
                                className={`flex gap-2.5 ${
                                  m.sender === "user" ? "flex-row-reverse" : ""
                                }`}
                              >
                                <span
                                  className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                    m.sender === "user"
                                      ? "bg-midnight-800 text-midnight-300"
                                      : "bg-gold-400/20 text-gold-700"
                                  }`}
                                >
                                  {m.sender === "user" ? "You" : "FTA"}
                                </span>
                                <div
                                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                                    m.sender === "user"
                                      ? "bg-gold-500 text-white rounded-tr-sm"
                                      : "bg-midnight-800 text-midnight-100 rounded-tl-sm"
                                  }`}
                                >
                                  {m.body}
                                </div>
                              </div>
                            ))}
                          </div>

                          {t.status !== "closed" && (
                            <div className="flex items-end gap-2 pt-1">
                              <textarea
                                value={open ? replyBody : ""}
                                onChange={(e) => setReplyBody(e.target.value)}
                                rows={1}
                                placeholder="Write a reply…"
                                className="flex-1 resize-none bg-midnight-950 border border-midnight-800 rounded-lg px-3 py-2 text-sm text-midnight-100 placeholder-midnight-600 focus:outline-none focus:border-gold-500/50 max-h-28"
                              />
                              <button
                                onClick={() => submitReply(t.id)}
                                disabled={replyBusy || !replyBody.trim()}
                                className="shrink-0 w-9 h-9 rounded-lg bg-gold-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-gold-600 transition-colors"
                                aria-label="Send reply"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
