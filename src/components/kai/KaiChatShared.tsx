"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  MessageSquareText,
  Menu,
  Loader2,
  Newspaper,
  ExternalLink,
  Brain,
  RotateCw,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { deriveRegister, type Register } from "@/lib/register";
import type { KaiChatSeed } from "@/lib/kai/chat-seed";
import { KAI_CHAT_DAILY_CAP, type KaiProfile } from "@/lib/kai/persona";
import { PriceChart } from "@/components/kai/ReportCharts";
import Markdown from "@/components/kai/Markdown";
import {
  useNewMemberHints,
  HintReopen,
} from "@/components/hints/useNewMemberHints";
import type { MarketBar } from "@/lib/market/client";

interface ChartBlock {
  kind: "chart";
  symbol: string;
  range: string;
  bars: MarketBar[];
}
interface NewsBlock {
  kind: "news";
  symbol: string;
  items: { title: string; url: string; publisher: string | null; published: string | null }[];
}
type Block = ChartBlock | NewsBlock;

interface Msg {
  id?: string;
  role: "user" | "assistant";
  content: string;
  blocks: Block[];
  streaming?: boolean;
  /** Set when this assistant turn ended in an error (degraded state) — drives
   *  the honest inline copy + a "Try again" affordance. */
  error?: boolean;
}
interface Thread {
  id: string;
  title: string;
  updated_at: string;
}

function BlockView({ block }: { block: Block }) {
  if (block.kind === "chart") {
    return (
      <div className="mt-2 rounded-xl border border-sand bg-paper/40 p-3 text-kai-600">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-soft">
          <Link href={`/research/${encodeURIComponent(block.symbol)}`} className="hover:text-kai-700">
            {block.symbol} · {block.range}
          </Link>
          <span>delayed</span>
        </div>
        <PriceChart bars={block.bars} height={180} />
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft">
        <Newspaper className="h-3.5 w-3.5" />{" "}
        <Link href={`/research/${encodeURIComponent(block.symbol)}`} className="hover:text-kai-700">
          {block.symbol}
        </Link>{" "}
        headlines
      </div>
      {block.items.map((n, i) => (
        <a
          key={i}
          href={n.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 rounded-lg border border-sand bg-midnight-900 px-3 py-2 text-sm transition-colors hover:border-kai-400"
        >
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-kai-600" />
          <span className="min-w-0">
            <span className="line-clamp-2 font-medium text-ink">{n.title}</span>
            {n.publisher && <span className="text-[11px] text-soft">{n.publisher}</span>}
          </span>
        </a>
      ))}
    </div>
  );
}

/**
 * KaiChatShared — the single Ask-Kai chat surface, rendered in TWO places:
 *
 *   • variant="page"  — the /kai route (unchanged behavior). Seeded server-first
 *                       via `initialData`; owns the full-height page layout with
 *                       an inline thread sidebar on sm+.
 *   • variant="panel" — the Kai FAB slide-over. No server seed (runs the client
 *                       bootstrap once, then persists while mounted). Compact:
 *                       the thread list is menu-only, a branded header adds the
 *                       Kai identity, an "Open full view →" jump and a close.
 *
 * Same thread/history/usage APIs and the same streaming pipeline in both — no
 * server changes. Both share the degraded-state handling (honest error copy +
 * Try again) and the usage-count fix (increment only on a successful `done`).
 */
export default function KaiChatShared({
  initialData = null,
  variant = "page",
  autoThreadId = null,
  onClose,
  contextChip = null,
  initialInput = null,
  contextNonce = 0,
}: {
  initialData?: KaiChatSeed | null;
  variant?: "page" | "panel";
  /** Page-only: open this thread on first paint (from /kai?thread=…). */
  autoThreadId?: string | null;
  /** Panel-only: close the slide-over. */
  onClose?: () => void;
  /** Panel-only: a page-context label shown as a Kai-blue chip in the header
   *  (e.g. "NVDA", "Lesson: Reading a candle"). Tells Kai — and the member —
   *  what Kai already knows about the current surface. */
  contextChip?: string | null;
  /** Panel-only: prefill the composer with this query when the sheet opens. */
  initialInput?: string | null;
  /** Panel-only: bump to re-apply contextChip/initialInput on a fresh open. */
  contextNonce?: number;
}) {
  const isPanel = variant === "panel";
  const router = useRouter();
  const supabase = createClient();
  // Server-first: when seeded, the shell (header + empty state + thread sidebar)
  // paints on first paint instead of behind a spinner. The initial client load
  // is skipped; a null seed falls back to the original client load (the panel
  // is never seeded, so it always takes the client-bootstrap path).
  const seeded = initialData != null;
  const [ready, setReady] = useState(seeded);
  const [register, setRegister] = useState<Register>(initialData?.register ?? "adult");
  // Server-resolved guardrail profile (drives the cosmetic suggestion chips —
  // the actual guardrails are enforced server-side in the chat route).
  const [profile, setProfile] = useState<KaiProfile>(
    initialData?.profile ?? (initialData?.register === "kid" ? "kid" : "family-adult")
  );
  const [canToggleDeepMode] = useState(initialData?.canToggleDeepMode ?? false);
  const [deepMode, setDeepMode] = useState(initialData?.deepMode ?? false);
  const [deepModeSaving, setDeepModeSaving] = useState(false);
  const [tier, setTier] = useState<FamilyTier>(initialData?.tier ?? "fic");
  const [userId, setUserId] = useState(initialData?.userId ?? "");

  const [threads, setThreads] = useState<Thread[]>(initialData?.threads ?? []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Contextual open (Kai sheet): when the FAB / an "Ask Kai" entry / a search row
  // opens Kai with page context, prefill the composer and focus it. Keyed on
  // contextNonce so each fresh open re-applies even though the panel stays mounted.
  useEffect(() => {
    if (!isPanel || contextNonce === 0) return;
    if (initialInput) setInput(initialInput);
    const t = setTimeout(() => composerRef.current?.focus(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextNonce]);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Last user message text — kept so a failed turn can be retried without
  // adding a duplicate user bubble (degraded-state "Try again").
  const [lastUserText, setLastUserText] = useState("");

  const [usedToday, setUsedToday] = useState(initialData?.usedToday ?? 0);
  const [capNote, setCapNote] = useState("");

  // "What Kai remembers about you" transparency panel (Lane 8B).
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memorySummary, setMemorySummary] = useState<string | null>(
    initialData?.memorySummary ?? null
  );
  const [memoryUpdatedAt, setMemoryUpdatedAt] = useState<string | null>(
    initialData?.memoryUpdatedAt ?? null
  );
  const [memoryClearing, setMemoryClearing] = useState(false);

  const loadMemory = useCallback(
    async (uid: string) => {
      const { data } = await supabase
        .from("kai_user_memory")
        .select("summary, updated_at")
        .eq("user_id", uid)
        .maybeSingle();
      setMemorySummary((data?.summary as string) || "");
      setMemoryUpdatedAt((data?.updated_at as string) || null);
    },
    [supabase]
  );

  async function clearMemory() {
    if (!userId) return;
    setMemoryClearing(true);
    await supabase.from("kai_user_memory").delete().eq("user_id", userId);
    setMemorySummary("");
    setMemoryUpdatedAt(null);
    setMemoryClearing(false);
  }

  // "Deeper analysis mode" opt-in for Family-Mode adults (Lane C2). Persists
  // server-side; the chat route re-resolves the profile from it on the next
  // message, so we optimistically flip the local chips too.
  async function toggleDeepMode(next: boolean) {
    setDeepModeSaving(true);
    try {
      const res = await fetch("/api/kai/deep-mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) {
        setDeepMode(next);
        setProfile(next ? "club" : "family-adult");
      }
    } catch {
      /* best-effort; leave state unchanged on failure */
    } finally {
      setDeepModeSaving(false);
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const cap = KAI_CHAT_DAILY_CAP[tier] ?? 0;
  const isKid = register === "kid";
  // The empty-state "what Kai can do" how-to blurb expires for seasoned adults
  // (kids always keep their friendly intro; the "educational, not advice"
  // subtitle in the header is compliance and never wrapped — Lane 7A).
  const introHint = useNewMemberHints("kai-intro-howto");

  const loadThreads = useCallback(async () => {
    const { data } = await supabase
      .from("kai_chat_threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });
    setThreads((data as Thread[]) || []);
  }, [supabase]);

  const loadUsage = useCallback(async (uid: string) => {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("kai_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("role", "user")
      .gte("created_at", dayStart.toISOString());
    setUsedToday(count ?? 0);
  }, [supabase]);

  const openThread = useCallback(
    async (id: string) => {
      setActiveId(id);
      setSidebarOpen(false);
      const { data } = await supabase
        .from("kai_chat_messages")
        .select("id, role, content, blocks")
        .eq("thread_id", id)
        .order("created_at", { ascending: true });
      setMessages(
        (data || []).map((m) => ({
          id: m.id as string,
          role: m.role as "user" | "assistant",
          content: m.content as string,
          blocks: (m.blocks as Block[]) || [],
        }))
      );
    },
    [supabase]
  );

  useEffect(() => {
    // Server-first: threads + usage + memory + register/tier are already seeded,
    // so the shell painted immediately. Skip the client bootstrap entirely.
    if (seeded) return;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setReady(true);
        return;
      }
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, age_group, track, family_id")
        .eq("id", user.id)
        .maybeSingle();
      const reg = deriveRegister(profile);
      setRegister(reg);
      // Fallback path can't compute solo/mode client-side — approximate the
      // profile conservatively (kid stays kid; everyone else education-first).
      // The real guardrail is enforced server-side regardless of this value.
      setProfile(reg === "kid" ? "kid" : "family-adult");
      setTier(await getClubTier(supabase, profile?.family_id));
      await Promise.all([loadThreads(), loadUsage(user.id), loadMemory(user.id)]);
      setReady(true);
    })();
  }, [seeded, supabase, loadThreads, loadUsage, loadMemory]);

  // Page-only: deep-link a thread from /kai?thread=… (used by the panel's
  // "Open full view →" so the full page lands on the same conversation). Runs
  // once, after the seed is ready.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (isPanel || !ready || autoOpened.current) return;
    if (autoThreadId) {
      autoOpened.current = true;
      openThread(autoThreadId);
    }
  }, [isPanel, ready, autoThreadId, openThread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function newThread() {
    setActiveId(null);
    setMessages([]);
    setSidebarOpen(false);
    setCapNote("");
  }

  async function deleteThread(id: string) {
    await supabase.from("kai_chat_threads").delete().eq("id", id);
    setThreads((t) => t.filter((x) => x.id !== id));
    if (activeId === id) newThread();
  }

  // The streaming pipeline for one turn. Assumes a trailing streaming assistant
  // bubble already exists (send() and retry() both set that up). Usage is
  // incremented ONLY on a successful `done` event — a failed turn (server 4xx/5xx,
  // an `error` SSE event, or a dropped connection) never ticks the counter (the
  // old code incremented unconditionally at the end of the stream loop).
  async function runGeneration(text: string) {
    const patchLast = (fn: (m: Msg) => Msg) =>
      setMessages((prev) => {
        const copy = [...prev];
        const idx = copy.length - 1;
        copy[idx] = fn(copy[idx]);
        return copy;
      });

    let succeeded = false;
    try {
      const res = await fetch("/api/kai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: activeId, message: text }),
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        patchLast((m) => ({
          ...m,
          streaming: false,
          error: true,
          content: j?.error || "Kai is unavailable right now.",
        }));
        if (j?.capped) setCapNote(j.error);
        setSending(false);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let newThreadId: string | null = activeId;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const p of parts) {
          const line = p.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let e: { type: string; [k: string]: unknown };
          try {
            e = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (e.type === "meta") {
            newThreadId = e.threadId as string;
            if (!activeId) setActiveId(newThreadId);
          } else if (e.type === "token") {
            patchLast((m) => ({ ...m, content: m.content + (e.text as string) }));
          } else if (e.type === "block") {
            patchLast((m) => ({ ...m, blocks: [...m.blocks, e.block as Block] }));
          } else if (e.type === "done") {
            succeeded = true;
            patchLast((m) => ({
              ...m,
              streaming: false,
              error: false,
              content: (e.content as string) || m.content,
              blocks: (e.blocks as Block[]) || m.blocks,
            }));
          } else if (e.type === "error") {
            patchLast((m) => ({
              ...m,
              streaming: false,
              error: true,
              content: e.error as string,
            }));
          }
        }
      }
      // Only a genuinely completed turn counts against the daily cap.
      if (succeeded) setUsedToday((u) => u + 1);
      loadThreads();
    } catch {
      patchLast((m) => ({
        ...m,
        streaming: false,
        error: true,
        content: "Connection lost. Please try again.",
      }));
    } finally {
      setSending(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    if (cap > 0 && usedToday >= cap) {
      setCapNote(capLine());
      return;
    }
    setInput("");
    setSending(true);
    setLastUserText(text);
    setMessages((m) => [
      ...m,
      { role: "user", content: text, blocks: [] },
      { role: "assistant", content: "", blocks: [], streaming: true },
    ]);
    await runGeneration(text);
  }

  // Degraded-state recovery: re-run the last user turn in place (replace the
  // errored assistant bubble with a fresh streaming one — no duplicate user
  // bubble). The counter still only moves on a real success inside runGeneration.
  async function retry() {
    if (sending || !lastUserText) return;
    setCapNote("");
    setSending(true);
    setMessages((prev) => {
      const copy = [...prev];
      const idx = copy.length - 1;
      const fresh: Msg = { role: "assistant", content: "", blocks: [], streaming: true };
      if (idx >= 0 && copy[idx].role === "assistant") copy[idx] = fresh;
      else copy.push(fresh);
      return copy;
    });
    await runGeneration(lastUserText);
  }

  function openFullView() {
    onClose?.();
    router.push(activeId ? `/kai?thread=${encodeURIComponent(activeId)}` : "/kai");
  }

  function capLine() {
    return isKid
      ? "That's all your Kai questions for today — come back tomorrow!"
      : `You've used all ${cap} of today's Ask Kai messages. Come back tomorrow${
          register === "adult" && tier === "fic" ? "." : "."
        }`;
  }

  if (!ready) {
    return (
      <div className={`flex items-center justify-center ${isPanel ? "h-full" : "h-[70vh]"}`}>
        <Loader2 className="h-6 w-6 animate-spin text-kai-600" />
      </div>
    );
  }

  const capReached = cap > 0 && usedToday >= cap;
  const leftToday = cap > 0 ? Math.max(cap - usedToday, 0) : null;

  return (
    // Page: fit the viewport EXACTLY (100dvh minus the sticky TopBar + main
    // padding + the shell's reserved bottom). Panel: fill the slide-over, which
    // owns its own height — `relative` so the thread overlay is contained.
    <div
      className={
        isPanel
          ? "relative flex h-full w-full min-h-0"
          : "mx-auto flex max-w-5xl gap-0 px-0 sm:gap-4 sm:px-4 h-[calc(100dvh-9.5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-6.5rem)]"
      }
    >
      {/* Sidebar — inline on sm+ for the page; overlay-only in the panel. */}
      <aside
        className={`${sidebarOpen ? "block" : "hidden"} ${
          isPanel
            ? "absolute inset-0 z-40 bg-black/40"
            : "fixed inset-0 z-40 bg-black/40 sm:static sm:block sm:w-64 sm:bg-transparent"
        }`}
        onClick={() => setSidebarOpen(false)}
      >
        <div
          className="h-full w-64 overflow-y-auto border-r border-sand bg-midnight-900 p-3 sm:rounded-2xl sm:border"
          onClick={(ev) => ev.stopPropagation()}
        >
          <button
            onClick={newThread}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-kai-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-kai-600"
          >
            <Plus className="h-4 w-4" /> New chat
          </button>
          <div className="space-y-1">
            {threads.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm ${
                  activeId === t.id ? "bg-kai-400/12 text-ink" : "text-soft hover:bg-paper"
                }`}
              >
                <button
                  onClick={() => openThread(t.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-kai-600" />
                  <span className="truncate">{t.title}</span>
                </button>
                <button
                  onClick={() => deleteThread(t.id)}
                  className="opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                  aria-label="Delete chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {threads.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-soft">No chats yet.</p>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header — the page keeps its exact header; the panel gets a branded
            identity header with the full-view jump + close. */}
        {isPanel ? (
          <div className="flex items-center gap-2 border-b border-sand px-3 py-2.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-soft transition-colors hover:bg-paper"
              aria-label="Chats"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-kai-500 text-white shadow-[0_2px_8px_rgba(37,99,255,0.35)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-sm font-bold leading-tight text-ink">Ask Kai</h2>
              <p className="truncate text-[10.5px] text-soft">
                {isKid ? "Your friendly company guide" : "Research analyst · not advice"}
              </p>
            </div>
            {leftToday !== null && (
              <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[10.5px] font-semibold text-soft">
                {leftToday} left
              </span>
            )}
            <button
              onClick={openFullView}
              className="hidden shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-kai-700 transition-colors hover:bg-paper sm:inline-flex"
              title="Open the full Kai page"
            >
              Open full view <ExternalLink className="h-3 w-3" />
            </button>
            <button
              onClick={() => setMemoryOpen(true)}
              className="shrink-0 rounded-full p-1.5 text-soft transition-colors hover:bg-paper hover:text-kai-700"
              aria-label="What Kai remembers about you"
              title="What Kai remembers about you"
            >
              <Brain className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => onClose?.()}
              className="shrink-0 rounded-full p-1.5 text-soft transition-colors hover:bg-paper hover:text-ink"
              aria-label="Close Kai"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}
        {/* Context chip — the current surface Kai already knows about (ticker /
            lesson / thesis / alert). Kai-blue, panel only. */}
        {isPanel && contextChip && (
          <div className="flex items-center gap-1.5 border-b border-sand bg-kai-blue-soft px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-kai-blue" />
            <span className="text-[11px] font-semibold text-kai-blue">Context</span>
            <span className="truncate text-[11px] font-medium text-ink">{contextChip}</span>
          </div>
        )}
        {!isPanel && (
          <div className="flex items-center gap-2 border-b border-sand px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-soft hover:bg-paper sm:hidden"
              aria-label="Chats"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-kai-400/20">
              <Sparkles className="h-4 w-4 text-kai-700" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base font-bold text-ink">Ask Kai</h1>
              <p className="truncate text-[11px] text-soft">
                Your CheatCode research analyst · educational, not advice
              </p>
            </div>
            {cap > 0 && (
              <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-soft">
                {Math.max(cap - usedToday, 0)} left today
              </span>
            )}
            <button
              onClick={() => setMemoryOpen(true)}
              className="shrink-0 rounded-full p-1.5 text-soft transition-colors hover:bg-paper hover:text-kai-700"
              aria-label="What Kai remembers about you"
              title="What Kai remembers about you"
            >
              <Brain className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="mx-auto mt-10 max-w-md text-center">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-kai-400/20">
                <Sparkles className="h-7 w-7 text-kai-700" />
              </span>
              <h2 className="font-display text-lg font-bold text-ink">
                {isKid ? "Hi! I'm Kai 👋" : "Ask Kai anything about a company"}
              </h2>
              {isKid ? (
                <p className="mt-1.5 text-sm text-soft">
                  Ask me about a company you know — I&apos;ll explain what it does
                  in a simple way!
                </p>
              ) : introHint.show ? (
                <p className="mt-1.5 text-sm text-soft">
                  I can explain a business, walk through its numbers and price
                  history, and pull recent headlines. I research and teach — I
                  can&apos;t tell you what to buy or sell.
                </p>
              ) : (
                <div className="mt-1.5 flex justify-center">
                  <HintReopen
                    onClick={introHint.reopen}
                    label="What can Kai do?"
                  />
                </div>
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {(profile === "kid"
                  ? ["What does Apple make?", "Tell me about Disney", "How does Nintendo earn money?"]
                  : profile === "club"
                    ? ["What changed today?", "Read the setup on NVDA", "What's setting up today?"]
                    : ["Explain Apple's business", "Show me Nvidia's 1-year chart", "What are Costco's risks?"]
                ).map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="rounded-full border border-sand px-3 py-1.5 text-xs text-soft hover:border-kai-400 hover:text-ink"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-4">
              {messages.map((m, i) => (
                <div
                  key={m.id || i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] ${
                      m.role === "user"
                        ? "bg-kai-500 text-white"
                        : m.error
                          ? "border border-red-500/40 bg-red-500/5 text-midnight-200"
                          : "border border-sand bg-midnight-900 text-midnight-200"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <>
                        <div className="kai-md text-midnight-200">
                          <Markdown text={m.content} />
                        </div>
                        {m.streaming && !m.content && (
                          <span className="inline-flex items-center gap-1 text-soft">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Kai is thinking…
                          </span>
                        )}
                        {m.blocks.map((b, bi) => (
                          <BlockView key={bi} block={b} />
                        ))}
                        {m.error && !m.streaming && (
                          <button
                            onClick={retry}
                            disabled={sending}
                            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-sand bg-paper px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-kai-400 hover:text-kai-700 disabled:opacity-50"
                          >
                            {sending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCw className="h-3.5 w-3.5" />
                            )}
                            Try again
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-sand px-4 py-3">
          {capReached ? (
            <div className="rounded-xl border border-sand bg-paper px-4 py-3 text-center text-sm text-soft">
              {capLine()}
            </div>
          ) : (
            <>
              {capNote && <p className="mb-2 text-center text-xs text-kai-700">{capNote}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={isKid ? "Ask Kai about a company…" : "Ask Kai about a company or ticker…"}
                  className="max-h-32 flex-1 resize-none rounded-xl border border-sand bg-midnight-900 px-3.5 py-2.5 text-[15px] text-ink placeholder:text-midnight-500 focus:border-kai-400 focus:outline-none"
                />
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-kai-500 text-white transition-colors hover:bg-kai-600 disabled:opacity-50"
                  aria-label="Send"
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
              {isPanel && (
                <button
                  onClick={openFullView}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-soft transition-colors hover:text-kai-700 sm:hidden"
                >
                  Open full view <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* "What Kai remembers about you" — transparency + clear (Lane 8B) */}
      {memoryOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setMemoryOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-sand bg-midnight-900 p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-kai-400/20">
                <Brain className="h-4 w-4 text-kai-700" />
              </span>
              <h2 className="flex-1 font-display text-base font-bold text-ink">
                What Kai remembers about you
              </h2>
              <button
                onClick={() => setMemoryOpen(false)}
                className="rounded-lg p-1 text-soft hover:bg-paper"
                aria-label="Close"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <p className="mb-3 text-xs text-soft">
              {isKid
                ? "Kai keeps a few notes about what you're learning, so it can help you better next time."
                : "To pick up where you left off, Kai keeps a short private note about the topics you discuss. Only you can see it — and you can clear it anytime."}
            </p>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-sand bg-paper/40 p-3 text-sm text-midnight-200">
              {memorySummary ? (
                memorySummary
              ) : (
                <span className="text-soft">
                  Kai doesn&apos;t have any notes about you yet. They&apos;ll build up as you chat.
                </span>
              )}
            </div>

            {memoryUpdatedAt && (
              <p className="mt-2 text-[11px] text-soft">
                Last updated {new Date(memoryUpdatedAt).toLocaleDateString()}
              </p>
            )}

            {canToggleDeepMode && (
              <div className="mt-4 rounded-xl border border-sand bg-paper/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Deeper analysis mode</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-soft">
                      Sharper, numbers-first market reads — key levels, setup structure,
                      and &ldquo;what changed today&rdquo; briefings. Still education, never advice.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={deepMode}
                    disabled={deepModeSaving}
                    onClick={() => toggleDeepMode(!deepMode)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      deepMode ? "bg-kai-500" : "bg-sand"
                    }`}
                    aria-label="Toggle deeper analysis mode"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        deepMode ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {memorySummary && (
              <button
                onClick={clearMemory}
                disabled={memoryClearing}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-sand px-3 py-2.5 text-sm font-semibold text-soft transition-colors hover:border-red-500/40 hover:text-red-600 disabled:opacity-50"
              >
                {memoryClearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Clear what Kai remembers
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
