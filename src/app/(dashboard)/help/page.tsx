"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  Send,
  Bot,
  User as UserIcon,
  ChevronDown,
  ChevronRight,
  Loader2,
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
import { SectionRule, TabRail, TextAction } from "@/components/f0/parts";

/**
 * /help — the support surface: a Kai help bot and a real ticket queue.
 *
 * REBUILD NOTE (canvas): the page previously wrote against the RAW midnight-*
 * ramp (bg-midnight-900, text-midnight-100 …), which is INVERTED in light mode —
 * it happened to work but described a dark app that no longer exists. Everything
 * is now on semantic tokens (ink / soft / sand / card / paper) so both themes
 * follow the surface vars, and every prose column is capped at a real reading
 * measure (~65ch). Kai's identity colour is Kai blue by law; the send affordances
 * are the brand action ramp with night-950 type (never white on gold).
 *
 * CANVAS V2 PASS: one annotated word in the masthead; the shared focus ring and
 * press feedback on every control (a support form with no visible focus state is
 * a real accessibility failure, not a polish item); fills moved to `bg-accent`
 * so the page is mode-correct; and both empty branches are designed FOUNDING
 * STATES rather than one grey sentence — "no tickets yet" is the state almost
 * every member is in, so it is the state worth designing.
 *
 * KAI'S MARK: the bot avatar uses the shared `.f0-kai-mark` (M1) rather than a
 * local bg-kai-blue-soft/text-kai-blue pair. Kai blue is an IDENTITY colour
 * reserved for Kai/AI by law, and one class is how it stays that way.
 *
 * THE SUPPORT ADDRESS: `support@cheatcode.com` is the ONLY support email in the
 * product. It is stated once, at the foot, as the last resort behind the bot and
 * the ticket queue — both of which are real, so the address is a fallback and
 * never the primary path. No other address may be introduced anywhere.
 */

/** The one support address in the product. */
const SUPPORT_EMAIL = "support@cheatcode.com";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const MAX_CHAT_MESSAGES = 20;

const GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Hi! I'm Kai, your Cheat Code Club help assistant. Ask me how anything in the app works — courses, live classes, your family, billing, and more. (I can't give trading advice — for that, stick with the lessons!)",
};

/* COLOUR LAW: green/red are price-only, so ticket state is carried by the
   neutral sand ramp plus the brand action tint for the one state that wants
   the member's attention. The word itself is the signal. */
const STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-gold-400/15 text-gold-700",
  pending: "bg-sand text-ink",
  resolved: "bg-sand/70 text-soft",
  closed: "bg-sand/40 text-soft",
};

function StatusChip({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-[0.1em] ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

/* The viewer's clock as an EXTERNAL STORE, bucketed to the hour. Ticket
   timestamps are relative to the VIEWER's wall clock, which the server cannot
   know, and a component may not read an impure function during render —
   `timeAgo` called Date.now() and was invoked straight from JSX. The snapshot
   must be stable between calls or React spins, hence the hour bucket. That does
   cost the sub-hour steps ("just now", "12m ago"): a support thread is measured
   in hours and days, and a stale "just now" that never advances is worse than an
   honest "today". Server snapshot is null → the absolute date, always true. */
const HOUR_MS = 3_600_000;
const CLOCK_SUBSCRIBE = () => () => {};
const CLOCK_CLIENT = () => Math.floor(Date.now() / HOUR_MS);
const CLOCK_SERVER = () => null;

/** Pure once the clock is handed in. */
function timeAgo(iso: string, nowHour: number | null): string {
  const abs = new Date(iso).toLocaleDateString();
  if (nowHour == null) return abs;
  const h = Math.floor((nowHour * HOUR_MS - new Date(iso).getTime()) / HOUR_MS);
  if (h < 1) return "today";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return abs;
}

const fieldCls =
  "f0-focus f0-frame w-full rounded-lg bg-transparent px-3 py-2 text-sm text-ink placeholder:text-soft transition-colors focus:outline-none";
const labelCls =
  "mb-1.5 block text-eyebrow font-display font-bold uppercase text-soft";
const sendBtnCls =
  "f0-focus f0-press shrink-0 flex items-center justify-center rounded-lg bg-accent text-night-950 disabled:opacity-40";

export default function HelpPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<"bot" | "team">("bot");
  const nowHour = useSyncExternalStore(CLOCK_SUBSCRIBE, CLOCK_CLIENT, CLOCK_SERVER);

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
    <div className="mx-auto max-w-3xl px-4 py-6 pb-16">
      {/* Masthead */}
      <header>
        <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
          Support
        </p>
        <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase leading-[1.05] text-ink">
          Help &amp; <span className="f0-underline-mark">Support</span>
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-soft">
          Ask the help bot a quick question, or reach a real person on the team.
        </p>
      </header>

      <div className="mt-8">
        <TabRail
          ariaLabel="Help channels"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "bot", label: "Ask Kai" },
            { id: "team", label: "The team" },
          ]}
        />
      </div>

      {/* ── AI chat tab ─────────────────────────────────────────────────── */}
      {tab === "bot" && (
        <div className="mt-6">
          <div className="h-[440px] space-y-5 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  m.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    m.role === "user"
                      ? "bg-sand text-soft"
                      : "f0-kai-mark"
                  }`}
                >
                  {m.role === "user" ? (
                    <UserIcon className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </span>
                <div
                  className={`max-w-[52ch] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-ink ${
                    m.role === "user"
                      ? "rounded-tr-sm bg-sand"
                      : "rounded-tl-sm f0-frame bg-card"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-3">
                <span className="f0-kai-mark mt-0.5 h-7 w-7 shrink-0">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="rounded-2xl rounded-tl-sm f0-frame bg-card px-4 py-2.5 text-soft">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={sendChat}
            className="f0-rule-top mt-2 flex items-end gap-2 pt-3"
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
              className={`${fieldCls} max-h-32 flex-1 resize-none`}
            />
            <button
              type="submit"
              disabled={sending || !input.trim() || chatCapped}
              className={`${sendBtnCls} h-10 w-10`}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          {/* Escalate */}
          <div className="mt-3">
            <TextAction onClick={escalateToTeam}>
              Talk to a human instead
              <ChevronRight className="h-3.5 w-3.5" />
            </TextAction>
          </div>
        </div>
      )}

      {/* ── Speak to the team tab ───────────────────────────────────────── */}
      {tab === "team" && (
        <div className="mt-8">
          {/* Form */}
          <form onSubmit={submitTicket}>
            <SectionRule>New support request</SectionRule>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="sm:w-56">
                <label className={labelCls}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  className={fieldCls}
                >
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className={labelCls}>Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Short summary"
                  maxLength={200}
                  className={fieldCls}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls}>How can we help?</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Tell us what's going on…"
                className={`${fieldCls} resize-y`}
              />
            </div>
            {/* COLOUR LAW: no danger red — the error signals by weight in the
                action ramp. */}
            {formError && (
              <p className="mt-2 text-xs font-semibold text-gold-700">
                {formError}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="f0-focus f0-press mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-night-950 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {submitting ? "Sending…" : "Send to the team"}
            </button>
          </form>

          {/* Existing tickets */}
          <div className="mt-11">
            <SectionRule>Your requests</SectionRule>
            {loadingTickets ? (
              /* LOADING ≠ EMPTY (§0.4) — a centred spinner reads the same as
                 "you have no requests", which is the far more common state. */
              <div className="f0-ledger mt-1 border-t border-sand/70" aria-busy="true">
                {[0, 1].map((i) => (
                  <div key={i} className="f0-ledger-row">
                    <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-sand/60" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-1/2 animate-pulse rounded bg-sand/60" />
                      <div className="h-3 w-1/3 animate-pulse rounded bg-sand/40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : tickets.length === 0 ? (
              /* FOUNDING STATE (§0.5) — the state almost every member is in. */
              <div className="mt-4 border-l-2 border-sand py-1 pl-4">
                <p className="font-display text-display-3 font-extrabold text-ink">
                  No requests yet
                </p>
                <p className="mt-1.5 max-w-[62ch] text-[15px] leading-relaxed text-soft">
                  Send one above and we&apos;ll get back to you. Every reply lands
                  right here in this thread, so nothing gets lost in an inbox.
                </p>
              </div>
            ) : (
              <div className="f0-ledger mt-1">
                {tickets.map((t) => {
                  const open = expanded === t.id;
                  return (
                    <div key={t.id}>
                      <button
                        onClick={() => setExpanded(open ? null : t.id)}
                        aria-expanded={open}
                        className="f0-ledger-row f0-focus f0-press w-full text-left"
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-soft" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-soft" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-display text-[15px] font-bold text-ink">
                              {t.subject}
                            </span>
                            <StatusChip status={t.status} />
                          </div>
                          <p className="mt-0.5 text-[12px] text-soft">
                            {CATEGORY_LABELS[t.category]} ·{" "}
                            {timeAgo(t.last_message_at, nowHour)}
                          </p>
                        </div>
                      </button>

                      {open && (
                        <div className="space-y-4 pb-5 pl-8">
                          {t.help_messages?.map((m) => (
                            <div
                              key={m.id}
                              className={`flex gap-2.5 ${
                                m.sender === "user" ? "flex-row-reverse" : ""
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-display font-bold ${
                                  m.sender === "user"
                                    ? "bg-sand text-soft"
                                    : "bg-gold-400/20 text-gold-700"
                                }`}
                              >
                                {m.sender === "user" ? "You" : "FTA"}
                              </span>
                              <div
                                className={`max-w-[52ch] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed text-ink ${
                                  m.sender === "user"
                                    ? "rounded-tr-sm bg-sand"
                                    : "rounded-tl-sm f0-frame bg-card"
                                }`}
                              >
                                {m.body}
                              </div>
                            </div>
                          ))}

                          {t.status !== "closed" && (
                            <div className="flex items-end gap-2 pt-1">
                              <textarea
                                value={open ? replyBody : ""}
                                onChange={(e) => setReplyBody(e.target.value)}
                                rows={1}
                                placeholder="Write a reply…"
                                className={`${fieldCls} max-h-28 flex-1 resize-none`}
                              />
                              <button
                                onClick={() => submitReply(t.id)}
                                disabled={replyBusy || !replyBody.trim()}
                                className={`${sendBtnCls} h-9 w-9`}
                                aria-label="Send reply"
                              >
                                <Send className="h-4 w-4" />
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

          {/* The last resort. Stated once, after the two real channels — the bot
              and the ticket queue both work, so the address is a fallback. */}
          <p className="f0-rule-top mt-11 max-w-[62ch] pt-5 text-[13px] leading-relaxed text-soft">
            Prefer email? Write to{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="f0-focus font-semibold text-gold-700 transition-colors hover:text-gold-600"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            — it reaches the same team, but a request opened here keeps the whole
            thread in one place.
          </p>
        </div>
      )}
    </div>
  );
}
