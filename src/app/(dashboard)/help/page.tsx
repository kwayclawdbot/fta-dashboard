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
  Mail,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppMode } from "@/lib/useAppMode";
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
import { DisplayHead, TextAction } from "@/components/f0/parts";
import { BoardSection } from "@/components/clubhome/board";

/**
 * /help — the support surface: a Kai help bot and a real ticket queue.
 *
 * BOARD LANGUAGE (legacy purge): the page was built on the PREVIOUS version's
 * structure — a `TabRail`, `SectionRule` marks, `f0-ledger` ticket rows,
 * `f0-frame` fields and `f0-rule-top` separators. It is now the board's set: a
 * `DisplayHead` masthead, board-07 filter pills (orange fill when active, white
 * hairline card when not), `BoardSection` marks, white `club-b-card` objects
 * with the ticket threads as disclosure rows INSIDE a card, and one brand-tinted
 * contact object at the foot.
 *
 * KAI'S MARK: the bot avatar uses the shared `.f0-kai-mark`. Kai blue is an
 * IDENTITY colour reserved for Kai/AI by law, and one class is how it stays that
 * way.
 *
 * THE SUPPORT ADDRESS: `support@cheatcode.com` is the ONLY support email in the
 * product and the ONLY address on this page. It is stated once, at the foot, as
 * the last resort behind the bot and the ticket queue — both of which are real,
 * so the address is a fallback and never the primary path. No other address and
 * no other channel may be introduced here.
 *
 * COLOUR LAW: green/red are price-only, so ticket state is carried by the
 * neutral sand ramp plus the brand action tint for the one state that wants the
 * member's attention. The word itself is the signal.
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

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-gold-400/15 text-gold-700",
  pending: "bg-sand text-ink",
  resolved: "bg-sand/70 text-soft",
  closed: "bg-sand/40 text-soft",
};

function StatusChip({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] ${STATUS_STYLES[status]}`}
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
  "f0-focus w-full rounded-[10px] border border-sand bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-soft focus:outline-none";
const labelCls =
  "mb-1.5 block font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft";
const sendBtnCls =
  "f0-focus f0-press grid shrink-0 place-items-center rounded-[10px] bg-accent text-[color:var(--accent-on)] disabled:opacity-40";

const TABS: { id: "bot" | "team"; label: string }[] = [
  { id: "bot", label: "Ask Kai" },
  { id: "team", label: "The team" },
];

/** Section head wrapper (.planning/CLUB-TERMINAL-STYLE.md): the family branch
 *  renders BoardSection with the exact same props — byte-identical output.
 *  Club gets the law's WHITE BOLD CAPS section label. */
function HelpSection({
  club,
  id,
  label,
  mark,
  children,
}: {
  club: boolean;
  id: string;
  label: string;
  mark?: string;
  children: React.ReactNode;
}) {
  if (!club) {
    return (
      <BoardSection id={id} label={label} mark={mark}>
        {children}
      </BoardSection>
    );
  }
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink"
      >
        {label}
        {mark ? ` ${mark}` : ""}
      </h2>
      {children}
    </section>
  );
}

export default function HelpPage() {
  // CLUB TERMINAL SKIN (.planning/CLUB-TERMINAL-STYLE.md, 2026-08-09): the club
  // branch swaps the wordmark masthead for terminal caps and the tracked-mono
  // section marks for white bold caps. The cards already ride --card/--sand
  // (dark in club), and the bot, ticket writes, the single support address and
  // the family render are byte-identical.
  const isClub = useAppMode() === "club";
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

  /* WHY THIS IS GUARDED. The chat is not its own scroll container — it sits in
     the page flow — so `scrollIntoView` scrolls the WHOLE DOCUMENT. Running it
     unconditionally meant the greeting (present on first render) scrolled the
     page the moment /help mounted, dragging the "HELP & SUPPORT" masthead up
     under the sticky app bar, which then sliced it in half. The bar was never
     the bug; the page was scrolling itself out from under it.

     So: never on mount, and `block: "nearest"` afterwards so a reply brings the
     end of the thread just into view instead of pinning it to the top of the
     viewport and taking the header with it. */
  const chatMounted = useRef(false);
  useEffect(() => {
    if (!chatMounted.current) {
      chatMounted.current = true;
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
      {isClub ? (
        <header>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-soft">
            Support
          </p>
          <h1 className="mt-2 font-display text-[clamp(28px,8vw,34px)] font-black uppercase leading-[0.9] tracking-[-0.04em] text-ink">
            Help &amp; Support
          </h1>
          <p className="mt-2.5 max-w-[52ch] text-[13px] leading-relaxed text-soft">
            Ask the help bot a quick question, or reach a real person on the
            team.
          </p>
        </header>
      ) : (
        <DisplayHead
          eyebrow="Support"
          title="Help &"
          mark="Support"
          lede="Ask the help bot a quick question, or reach a real person on the team."
        />
      )}

      {/* Board-07 filter pills: orange fill when active, white hairline card
          when not. Same roles and keyboard behaviour as the rail it replaces. */}
      <div role="tablist" aria-label="Help channels" className="mt-8 flex gap-2">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              /* The inactive pill is the card composed from utilities rather
                 than `.club-b-card`: that class sets the 14px radius shorthand
                 unlayered, which would beat `rounded-full`. Same ground, same
                 hairline, correct geometry. */
              className={`f0-focus f0-press rounded-full px-4 py-2 font-display text-[12px] font-extrabold uppercase tracking-[0.08em] transition-colors ${
                on
                  ? "bg-accent text-[color:var(--accent-on)]"
                  : "border border-sand bg-card text-soft hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Ask Kai ──────────────────────────────────────────────────────── */}
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
                    m.role === "user" ? "bg-sand text-soft" : "f0-kai-mark"
                  }`}
                >
                  {m.role === "user" ? (
                    <UserIcon className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </span>
                <div
                  className={`max-w-[52ch] whitespace-pre-wrap px-4 py-2.5 text-[14px] leading-relaxed text-ink ${
                    m.role === "user"
                      ? "rounded-[14px] rounded-tr-[4px] bg-sand"
                      : "club-b-card"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-3" aria-busy="true">
                <span className="f0-kai-mark mt-0.5 h-7 w-7 shrink-0">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="club-b-card px-4 py-2.5 text-soft">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="sr-only">Kai is replying</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={sendChat}
            className="mt-2 flex items-end gap-2 border-t border-sand pt-3"
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
              aria-label="Ask Kai a question"
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

      {/* ── The team ─────────────────────────────────────────────────────── */}
      {tab === "team" && (
        <div className="mt-8">
          {/* New request — one white board card holding the whole form. */}
          <form onSubmit={submitTicket}>
            <HelpSection club={isClub} id="help-new" label="New support" mark="request">
              <div className="club-b-card mt-2.5 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="sm:w-56">
                    <label className={labelCls} htmlFor="help-category">
                      Category
                    </label>
                    <select
                      id="help-category"
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as TicketCategory)
                      }
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
                    <label className={labelCls} htmlFor="help-subject">
                      Subject
                    </label>
                    <input
                      id="help-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Short summary"
                      maxLength={200}
                      className={fieldCls}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className={labelCls} htmlFor="help-message">
                    How can we help?
                  </label>
                  <textarea
                    id="help-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Tell us what's going on…"
                    className={`${fieldCls} resize-y`}
                  />
                </div>
                {/* COLOUR LAW: no danger red — the error signals by weight in
                    the action ramp. */}
                {formError && (
                  <p className="mt-2 text-[12.5px] font-semibold text-gold-700">
                    {formError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="f0-focus f0-press mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)] disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {submitting ? "Sending…" : "Send to the team"}
                </button>
              </div>
            </HelpSection>
          </form>

          {/* Your requests — disclosure rows inside one card. */}
          <div className="mt-10">
            <HelpSection club={isClub} id="help-requests" label="Your" mark="requests">
              {loadingTickets ? (
                /* LOADING ≠ EMPTY — a centred spinner reads the same as
                   "you have no requests", which is the far more common state. */
                <div className="club-b-card mt-2.5 divide-y divide-sand" aria-busy="true">
                  {[0, 1].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-sand/60" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-4 w-1/2 animate-pulse rounded bg-sand/60" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-sand/40" />
                      </div>
                    </div>
                  ))}
                  <span className="sr-only">Loading your requests</span>
                </div>
              ) : tickets.length === 0 ? (
                /* FOUNDING STATE — the state almost every member is in. */
                <div className="club-b-card mt-2.5 px-4 py-4">
                  <p className="font-display text-[17px] font-extrabold text-ink">
                    No requests yet
                  </p>
                  <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-soft">
                    Send one above and we&apos;ll get back to you. Every reply
                    lands right here in this thread, so nothing gets lost in an
                    inbox.
                  </p>
                </div>
              ) : (
                <div className="club-b-card mt-2.5 divide-y divide-sand">
                  {tickets.map((t) => {
                    const open = expanded === t.id;
                    return (
                      <div key={t.id}>
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : t.id)}
                          aria-expanded={open}
                          className="f0-focus f0-press flex w-full items-center gap-3 px-4 py-3.5 text-left"
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
                            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-soft tabular-nums">
                              {CATEGORY_LABELS[t.category]} ·{" "}
                              {timeAgo(t.last_message_at, nowHour)}
                            </p>
                          </div>
                        </button>

                        {open && (
                          <div className="space-y-4 px-4 pb-5 pl-11">
                            {t.help_messages?.map((msg) => (
                              <div
                                key={msg.id}
                                className={`flex gap-2.5 ${
                                  msg.sender === "user" ? "flex-row-reverse" : ""
                                }`}
                              >
                                <span
                                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full font-display text-[9px] font-bold ${
                                    msg.sender === "user"
                                      ? "bg-sand text-soft"
                                      : "bg-gold-400/20 text-gold-700"
                                  }`}
                                >
                                  {msg.sender === "user" ? "You" : "FTA"}
                                </span>
                                <div
                                  className={`max-w-[52ch] whitespace-pre-wrap px-3.5 py-2 text-[14px] leading-relaxed text-ink ${
                                    msg.sender === "user"
                                      ? "rounded-[14px] rounded-tr-[4px] bg-sand"
                                      : "rounded-[14px] rounded-tl-[4px] border border-sand bg-paper"
                                  }`}
                                >
                                  {msg.body}
                                </div>
                              </div>
                            ))}

                            {t.status !== "closed" && (
                              <div className="flex items-end gap-2 pt-1">
                                <textarea
                                  value={open ? replyBody : ""}
                                  onChange={(e) => setReplyBody(e.target.value)}
                                  rows={1}
                                  aria-label="Write a reply"
                                  placeholder="Write a reply…"
                                  className={`${fieldCls} max-h-28 flex-1 resize-none`}
                                />
                                <button
                                  type="button"
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
            </HelpSection>
          </div>

          {/* The last resort, as the one brand-tinted object on the surface.
              Stated once, after the two real channels — the bot and the ticket
              queue both work, so the address is a fallback. It is the ONLY
              support address on this page. */}
          <div className="club-b-warm mt-10 flex items-center gap-3.5 px-[15px] py-[14px]">
            <span className="club-b-orb h-10 w-10 shrink-0" aria-hidden>
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                Prefer <span className="text-accent">email?</span>
              </p>
              <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-soft">
                Write to{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="f0-focus font-semibold text-gold-700 transition-colors hover:text-gold-600"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                — it reaches the same team, but a request opened here keeps the
                whole thread in one place.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
