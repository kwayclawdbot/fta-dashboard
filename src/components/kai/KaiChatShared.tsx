"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
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
import { wallFor } from "@/lib/entitlements";
import UnlockLine from "@/components/entitlements/UnlockLine";
import { PriceChart } from "@/components/kai/ReportCharts";
import Markdown from "@/components/kai/Markdown";
import { Card } from "@/components/research/board";
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

/**
 * Kai's accent, SEMANTIC. `.text-kai-blue` reads `--kai-blue`, which the theme
 * blocks re-skin per mode: the club-dark terminal writes Kai in the owner
 * board's bright violet (#7C6BFF — the "KAI" wordmark and "KAI ANALYSIS"
 * eyebrow on the reference phone), while family-light keeps the calmer Kai
 * blue (#2563FF). NEVER a literal kai-ramp step with a dark: variant here —
 * that was the old KAI_INK and it could not follow the club's violet.
 */
const KAI_INK = "text-kai-blue";

/** Ratified Club words for a spent Kai meter. Resolved once, at module load. */
const KAI_FULL_WALL = wallFor("kai_chat_full");

/**
 * The Kai answer card's tint, written on --kai-blue so it follows the mode
 * accent (violet wash on the club terminal — the board's "KAI ANALYSIS" card
 * with its faint violet hairline — Kai blue wash in family-light). Overrides
 * <Card tone="kai">'s literal-blue TINT, which cannot flip to the club violet.
 */
const KAI_CARD_TINT: React.CSSProperties = {
  background:
    "linear-gradient(140deg, color-mix(in srgb, var(--kai-blue) 12%, var(--color-card)) 0%, var(--color-card) 70%)",
  borderColor: "color-mix(in srgb, var(--kai-blue) 30%, var(--color-sand))",
};

/**
 * Kai's identity mark — the board's robot-mascot slot (top-right of the Kai
 * phone). We render the system's `.f0-kai-mark` disc in that position, with
 * its gradient re-based on --kai-blue so it is violet on the club terminal
 * and Kai-blue in family-light (the primitive's own gradient is a literal
 * blue ramp and cannot follow the club accent).
 *
 * COLOUR LAW: this is the only Kai-accent object on the surface that is not
 * text, and the Kai accent is used for nothing that is not Kai.
 */
function KaiMark({ size = 28 }: { size?: number }) {
  return (
    <span className="relative shrink-0" aria-hidden>
      <span
        className="f0-kai-mark"
        style={{
          width: size,
          height: size,
          background:
            "linear-gradient(150deg, color-mix(in srgb, var(--kai-blue) 82%, #FFFFFF 18%) 0%, var(--kai-blue) 100%)",
          boxShadow: "0 8px 18px -12px color-mix(in srgb, var(--kai-blue) 70%, transparent)",
        }}
      >
        <Sparkles style={{ width: size * 0.5, height: size * 0.5 }} />
      </span>
      <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2 items-center justify-center">
        <span
          className="absolute inline-flex h-2 w-2 rounded-full motion-safe:animate-ping"
          style={{ background: "color-mix(in srgb, var(--kai-blue) 60%, transparent)" }}
        />
        <span
          className="relative inline-flex h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--kai-blue)" }}
        />
      </span>
    </span>
  );
}

/**
 * A suggestion chip — the board's pill row ("Research · Explain · Compare ·
 * Chart · Analyze" under the greeting; "Key Takeaways · Revenue · EPS ·
 * Valuation" under an answer). A raised card pill on the page ground: dark
 * cool pill on the club terminal, white pill on family paper. Wired to the
 * existing suggested-question mechanism — it PREFILLS the composer (and
 * focuses it); the member still sends.
 */
function SuggestionChip({
  label,
  onPick,
}: {
  label: string;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className="f0-focus f0-press shrink-0 whitespace-nowrap rounded-full border border-sand bg-card px-4 py-2 text-[12.5px] font-semibold text-soft shadow-soft transition-colors hover:border-[color:var(--kai-blue)] hover:text-ink"
    >
      {label}
    </button>
  );
}

/** The greeting chips, per guardrail profile. Labels are the board's verbs for
 *  adults (kids keep their friendly full questions); every prompt runs through
 *  the same prefill-the-composer mechanism the old chips used. */
function starterChips(profile: KaiProfile): { label: string; prompt: string }[] {
  if (profile === "kid") {
    return [
      { label: "What does Apple make?", prompt: "What does Apple make?" },
      { label: "Tell me about Disney", prompt: "Tell me about Disney" },
      { label: "How does Nintendo earn money?", prompt: "How does Nintendo earn money?" },
    ];
  }
  if (profile === "club") {
    return [
      { label: "Research", prompt: "What changed in the market today?" },
      { label: "Explain", prompt: "Explain NVDA's business in plain words" },
      {
        label: "Compare",
        prompt:
          "Compare NVDA vs AMD over the last 2 years. Show revenue, EPS and price performance.",
      },
      { label: "Chart", prompt: "Show me Nvidia's 1-year chart" },
      { label: "Analyze", prompt: "Read the setup on NVDA" },
    ];
  }
  return [
    { label: "Research", prompt: "Research Microsoft — the business, the numbers, and the risks" },
    { label: "Explain", prompt: "Explain Apple's business" },
    {
      label: "Compare",
      prompt:
        "Compare NVDA vs AMD over the last 2 years. Show revenue, EPS and price performance.",
    },
    { label: "Chart", prompt: "Show me Nvidia's 1-year chart" },
    { label: "Analyze", prompt: "What are Costco's risks?" },
  ];
}

/** Follow-up chips shown under a COMPLETED Kai answer — the board's
 *  "Key Takeaways · Revenue · EPS · Valuation" row. Same prefill mechanism. */
function followUpChips(profile: KaiProfile): { label: string; prompt: string }[] {
  if (profile === "kid") {
    return [
      { label: "Tell me more", prompt: "Tell me more!" },
      { label: "How do they make money?", prompt: "How do they make money?" },
      { label: "Is it risky?", prompt: "Is it risky?" },
    ];
  }
  return [
    { label: "Key Takeaways", prompt: "Give me the key takeaways from that." },
    { label: "Revenue", prompt: "Go deeper on the revenue picture." },
    { label: "EPS", prompt: "Go deeper on EPS." },
    { label: "Valuation", prompt: "How does the valuation look?" },
  ];
}

/**
 * An evidence block Kai attaches to a turn. Charts and headlines are EVIDENCE,
 * not cards — they hang off the entry on a rule, at the same reading measure as
 * the prose, so the conversation stays one column of attributed material. The
 * chart caption is the board's bold in-card chart title ("NVDA vs AMD
 * Performance (2Y)").
 */
function BlockView({ block }: { block: Block }) {
  if (block.kind === "chart") {
    return (
      <figure className="f0-rule-top mt-4 pt-3">
        <figcaption className="mb-2 flex items-baseline justify-between gap-3">
          <Link
            href={`/research/${encodeURIComponent(block.symbol)}`}
            className="font-display text-[14px] font-bold tracking-tight text-ink hover:opacity-80"
          >
            ${block.symbol} · {block.range}
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft/70">
            delayed
          </span>
        </figcaption>
        <PriceChart bars={block.bars} height={180} />
      </figure>
    );
  }
  return (
    <div className="mt-4">
      <p className="mb-1 flex items-center gap-1.5 font-mono text-eyebrow font-semibold uppercase text-soft">
        <Newspaper className="h-3 w-3" />
        <Link
          href={`/research/${encodeURIComponent(block.symbol)}`}
          className={`${KAI_INK} hover:opacity-80`}
        >
          ${block.symbol}
        </Link>
        headlines
      </p>
      <div className="f0-ledger f0-rule-top">
        {block.items.map((n, i) => (
          <a
            key={i}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="f0-ledger-row"
          >
            <ExternalLink className={`h-3.5 w-3.5 shrink-0 self-start ${KAI_INK}`} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 block text-[13.5px] font-medium leading-snug text-ink">
                {n.title}
              </span>
              {n.publisher && (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft/70">
                  {n.publisher}
                </span>
              )}
            </span>
          </a>
        ))}
      </div>
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
 *
 * ── SKIN (owner board "ChatGPT Image Aug 7 2026, 10_07_23 AM", Kai phone) ──
 * One structure, semantic tokens: the club-dark terminal shows the board
 * exactly — violet "KAI" wordmark header, "How can Kai help you today?"
 * greeting, the Research/Explain/Compare/Chart/Analyze pill row, user turns
 * as right-aligned raised bubbles, Kai turns as the "KAI ANALYSIS" violet-
 * washed card, follow-up chips under the answer, and the rounded "Ask Kai
 * anything…" pill composer. Family-light renders the same structure on paper
 * (Kai blue, white cards) so kid/family stay coherent without a branch.
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
  /** Panel-only: a page-context label shown as a Kai-accent chip in the header
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

  /** The suggestion-chip mechanism: prefill the composer and focus it. */
  function pickSuggestion(prompt: string) {
    setInput(prompt);
    composerRef.current?.focus();
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
      : `You've used all ${cap} of today's Ask Kai messages. Come back tomorrow.`;
  }

  if (!ready) {
    // LOADING ≠ EMPTY. This is the SHAPE of the surface pulsing — the greeting
    // headline, the suggestion-chip row and the pill composer — so it can never
    // be mistaken for the founding state of a member who has never asked Kai
    // anything (which is the designed empty state further down, with real copy).
    return (
      <div
        className={`flex flex-col ${isPanel ? "h-full" : "h-[70vh]"}`}
        aria-busy="true"
        aria-label="Opening Kai"
      >
        <div className="flex items-center gap-3 border-b border-sand px-4 py-3.5">
          <div className="space-y-1.5">
            <div className="h-4 w-14 animate-pulse rounded bg-sand" />
            <div className="h-2.5 w-56 animate-pulse rounded bg-sand/70" />
          </div>
          <div className="flex-1" />
          <div
            className="f0-kai-mark motion-safe:animate-pulse"
            style={{ width: 30, height: 30 }}
            aria-hidden
          />
        </div>
        <div className="flex-1 px-4 py-5">
          <div className="mx-auto max-w-2xl">
            <div className="h-8 w-72 max-w-full animate-pulse rounded bg-sand" />
            <div className="mt-5 flex gap-2 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-sand/70" />
              ))}
            </div>
          </div>
        </div>
        <div className="px-4 pb-4 pt-2">
          <div className="mx-auto flex max-w-[65ch] items-end gap-2.5">
            <div className="h-12 flex-1 animate-pulse rounded-full border border-sand bg-card" />
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-sand/70" />
          </div>
        </div>
      </div>
    );
  }

  const capReached = cap > 0 && usedToday >= cap;
  const leftToday = cap > 0 ? Math.max(cap - usedToday, 0) : null;
  const lastMsg = messages[messages.length - 1];
  // The board's follow-up chip row appears only under a COMPLETED Kai answer —
  // never while streaming, never on an errored turn, never once the cap is spent.
  const showFollowUps =
    lastMsg?.role === "assistant" && !lastMsg.streaming && !lastMsg.error && !capReached;

  return (
    // Page: fit the viewport EXACTLY (100dvh minus the sticky TopBar + main
    // padding + the shell's reserved bottom). Panel: fill the slide-over, which
    // owns its own height — `relative` so the thread overlay is contained.
    <div
      className={
        isPanel
          ? "relative flex h-full w-full min-h-0"
          : "mx-auto flex max-w-5xl gap-0 px-0 sm:gap-7 sm:px-4 h-[calc(100dvh-9.5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-6.5rem)]"
      }
    >
      {/* Conversations — a hairline rail, never a boxed sidebar. Inline on sm+
          for the page; an overlay in the panel (and on narrow page screens),
          where it needs an opaque ground. */}
      <aside
        className={`${sidebarOpen ? "block" : "hidden"} ${
          isPanel
            ? "absolute inset-0 z-40 bg-scrim"
            : "fixed inset-0 z-40 bg-scrim sm:static sm:block sm:w-60 sm:bg-transparent"
        }`}
        onClick={() => setSidebarOpen(false)}
      >
        <div
          className="h-full w-64 overflow-y-auto bg-paper px-4 py-4 sm:w-full sm:border-r sm:border-sand sm:bg-transparent sm:pl-0"
          onClick={(ev) => ev.stopPropagation()}
        >
          <div className="f0-section-rule pr-4">
            <span className="font-display text-eyebrow font-bold uppercase text-ink">
              Conversations
            </span>
          </div>
          <button
            onClick={newThread}
            className={`f0-focus f0-press mt-3 flex w-full items-center gap-1.5 rounded-lg pb-3 text-left text-[13px] font-semibold transition hover:opacity-80 ${KAI_INK}`}
          >
            <Plus className="h-4 w-4" /> New conversation
          </button>
          {threads.length === 0 ? (
            <p className="f0-rule-top pt-3 text-[12.5px] leading-snug text-soft/75">
              Nothing yet — every conversation you start with Kai is kept here.
            </p>
          ) : (
            <div className="f0-ledger f0-rule-top">
              {threads.map((t) => (
                <div key={t.id} className="group flex items-center gap-2 py-2.5">
                  <span
                    aria-hidden
                    className="h-3.5 w-[3px] shrink-0 rounded-full"
                    style={{
                      background: activeId === t.id ? "var(--kai-blue)" : "transparent",
                    }}
                  />
                  <button
                    onClick={() => openThread(t.id)}
                    className={`f0-focus min-w-0 flex-1 truncate rounded text-left text-[13px] transition ${
                      activeId === t.id
                        ? "font-semibold text-ink"
                        : "text-soft hover:text-ink"
                    }`}
                  >
                    {t.title}
                  </button>
                  <button
                    onClick={() => deleteThread(t.id)}
                    /* COLOUR LAW: there is no "danger red" tone — red is PRICE.
                       A destructive control is differentiated by position and
                       by the confirm it triggers, never by turning the colour
                       of a down move (see the f0 parts header). */
                    className="f0-focus shrink-0 rounded text-soft/50 opacity-0 transition hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header — the board's masthead: the "KAI" wordmark in the Kai accent
            (violet on the club terminal), the compliance line under it, and
            Kai's mark on the right where the board seats the robot mascot.
            The panel keeps its compact chrome (menu · full-view · memory ·
            close) around the same identity. */}
        {isPanel ? (
          <div className="flex items-center gap-2 border-b border-sand px-3 py-2.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="f0-focus f0-press rounded-lg p-1.5 text-soft transition-colors hover:text-ink"
              aria-label="Chats"
            >
              <Menu className="h-5 w-5" />
            </button>
            <KaiMark size={26} />
            <div className="min-w-0 flex-1">
              <h2
                className={`font-display text-[14px] font-extrabold uppercase leading-tight tracking-[0.26em] ${KAI_INK}`}
              >
                Kai
              </h2>
              <p className="truncate font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft">
                {isKid ? "Your company guide" : "Signals · interpretation · not advice"}
              </p>
            </div>
            {leftToday !== null && (
              /* Canvas's trailing count chip on the Kai strip (App Light L1413). */
              <span className="f0-chip shrink-0 bg-card px-2 py-0.5 font-mono text-[9.5px] tabular-nums text-soft">
                {leftToday} left
              </span>
            )}
            <button
              onClick={openFullView}
              className={`f0-focus f0-press hidden shrink-0 items-center gap-1 rounded-full px-1 py-1 text-[11px] font-semibold transition hover:opacity-80 sm:inline-flex ${KAI_INK}`}
              title="Open the full Kai page"
            >
              Open full view <ExternalLink className="h-3 w-3" />
            </button>
            <button
              onClick={() => setMemoryOpen(true)}
              className="f0-focus f0-press shrink-0 rounded-full p-1.5 text-soft transition-colors hover:text-ink"
              aria-label="What Kai remembers about you"
              title="What Kai remembers about you"
            >
              <Brain className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => onClose?.()}
              className="f0-focus f0-press shrink-0 rounded-full p-1.5 text-soft transition-colors hover:text-ink"
              aria-label="Close Kai"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}
        {/* Context chip — the current surface Kai already knows about (ticker /
            lesson / thesis / alert). Kai-accent, panel only. */}
        {isPanel && contextChip && (
          <div className="flex items-center gap-2 border-b border-sand bg-kai-blue-soft px-3 py-1.5">
            <Sparkles className={`h-3.5 w-3.5 shrink-0 ${KAI_INK}`} />
            <span
              className={`font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${KAI_INK}`}
            >
              Kai already sees
            </span>
            <span className="truncate text-[11.5px] font-medium text-ink">{contextChip}</span>
          </div>
        )}
        {!isPanel && (
          <header className="flex items-center gap-3 border-b border-sand px-4 py-3.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="f0-focus f0-press rounded-full p-1 text-soft transition-colors hover:text-ink sm:hidden"
              aria-label="Chats"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1
                className={`font-display text-[18px] font-extrabold uppercase leading-none tracking-[0.28em] ${KAI_INK}`}
              >
                Kai
              </h1>
              <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                Signals and interpretation · educational, not advice
              </p>
            </div>
            {cap > 0 && (
              /* The meter reads FORWARD, not backward: a free member should see
                 what they have spent of a known allowance, not a countdown to
                 zero. Both numbers are interpolated — never a hardcoded "3". */
              <span className="f0-chip shrink-0 bg-card px-2.5 py-1 font-mono text-[10px] tabular-nums text-soft">
                {Math.min(usedToday, cap)} of {cap} questions used today
              </span>
            )}
            <button
              onClick={() => setMemoryOpen(true)}
              className="f0-focus f0-press shrink-0 rounded-full p-1.5 text-soft transition-colors hover:text-ink"
              aria-label="What Kai remembers about you"
              title="What Kai remembers about you"
            >
              <Brain className="h-4.5 w-4.5" />
            </button>
            <KaiMark size={32} />
          </header>
        )}

        {/* The conversation. The board keeps the greeting + verb chips at the
            TOP of the scroll (they ride above the first turn and scroll away),
            the member's turns as right-aligned raised bubbles, and Kai's turns
            in the violet-washed "KAI ANALYSIS" card, with follow-up chips under
            a finished answer. */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
          {/* Greeting — the board's headline, always at the head of the scroll. */}
          <div className={isPanel ? "" : "mx-auto max-w-2xl"}>
            <h2 className="font-display text-[24px] font-bold leading-tight tracking-tight text-ink sm:text-[27px]">
              {isKid ? "Hi — I'm Kai!" : "How can Kai help you today?"}
            </h2>

            {messages.length === 0 &&
              (isKid ? (
                <p className="mt-2.5 max-w-md text-[13.5px] leading-relaxed text-soft">
                  Ask me about a company you already know and I&apos;ll explain what
                  it does and how it makes money, in plain words.
                </p>
              ) : introHint.show ? (
                <p className="mt-2.5 max-w-[62ch] text-[13.5px] leading-relaxed text-soft">
                  Ask for a business explained, a chart read, a number unpacked,
                  or the recent headlines on a ticker. Kai answers with what it
                  can actually see — and says so plainly when the honest answer
                  is that it can&apos;t know.
                </p>
              ) : (
                <div className="mt-2.5">
                  <HintReopen onClick={introHint.reopen} label="What can Kai do?" />
                </div>
              ))}

            {/* The board's suggestion pill row — Research · Explain · Compare ·
                Chart · Analyze (kids keep their friendly questions). Each chip
                prefills the composer via the suggested-question mechanism. */}
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
              {starterChips(profile).map((c) => (
                <SuggestionChip
                  key={c.label}
                  label={c.label}
                  onPick={() => pickSuggestion(c.prompt)}
                />
              ))}
            </div>
          </div>

          {messages.length > 0 && (
            <div className="mx-auto mt-6 max-w-[65ch] space-y-4">
              {messages.map((m, i) =>
                m.role === "assistant" ? (
                  <article key={m.id || i}>
                    <Card tone="kai" radius="md" className="px-4 py-3.5" style={KAI_CARD_TINT}>
                      <p
                        className={`font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.16em] ${KAI_INK}`}
                      >
                        {m.error ? "Kai · couldn't answer" : isKid ? "Kai" : "Kai Analysis"}
                      </p>
                      <div className="mt-2.5">
                        <div
                          className={`text-[14.5px] leading-relaxed ${
                            m.error ? "text-soft" : "text-ink"
                          }`}
                        >
                          <Markdown text={m.content} />
                        </div>
                        {m.streaming && !m.content && (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Kai is
                            reading
                          </span>
                        )}
                        {m.blocks.map((b, bi) => (
                          <BlockView key={bi} block={b} />
                        ))}
                        {m.error && !m.streaming && (
                          <button
                            onClick={retry}
                            disabled={sending}
                            className="f0-focus f0-press mt-3 inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold text-gold-700 transition hover:text-gold-600 disabled:opacity-50"
                          >
                            {sending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCw className="h-3.5 w-3.5" />
                            )}
                            Try again
                          </button>
                        )}
                      </div>
                    </Card>
                  </article>
                ) : (
                  /* The member's turn — the board's right-aligned raised bubble
                     (dark cool card on the terminal, white card on paper). */
                  <article key={m.id || i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md border border-sand bg-card px-4 py-3 shadow-soft">
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                        {m.content}
                      </p>
                    </div>
                  </article>
                )
              )}

              {/* Follow-up chips under a finished answer — the board's
                  "Key Takeaways · Revenue · EPS · Valuation" row. Prefill only;
                  the member still sends. */}
              {showFollowUps && (
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
                  {followUpChips(profile).map((c) => (
                    <SuggestionChip
                      key={c.label}
                      label={c.label}
                      onPick={() => pickSuggestion(c.prompt)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer — the board's rounded "Ask Kai anything…" pill with the
            round send control beside it. */}
        <div className="px-4 pb-4 pt-2">
          {capReached ? (
            /* Spent meter. The fact first, then — for a free adult only — the
               door, in the ratified Club words. A kid never sees commercial
               copy, so the kid branch ends at the sentence. */
            <div className="mx-auto max-w-[65ch]">
              <p className="py-1.5 text-center text-[13px] leading-relaxed text-soft">
                {capLine()}
              </p>
              {!isKid && tier === "free" && (
                <UnlockLine cta={KAI_FULL_WALL.cta} href="/pricing" rule={false}>
                  {KAI_FULL_WALL.body}
                </UnlockLine>
              )}
            </div>
          ) : (
            <>
              {capNote && (
                <p
                  className={`mb-2 text-center font-mono text-[11px] uppercase tracking-[0.14em] ${KAI_INK}`}
                >
                  {capNote}
                </p>
              )}
              <div className="mx-auto flex max-w-[65ch] items-end gap-2.5">
                <div className="flex min-w-0 flex-1 items-end rounded-[26px] border border-sand bg-card px-4 py-1.5 shadow-soft transition-colors focus-within:border-[color:var(--kai-blue)]">
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
                    placeholder="Ask Kai anything…"
                    className="max-h-32 w-full resize-none bg-transparent py-1.5 text-[15px] leading-relaxed text-ink placeholder:text-soft/60 focus:outline-none"
                  />
                </div>
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  className={`f0-focus f0-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sand bg-card shadow-soft transition hover:border-[color:var(--kai-blue)] disabled:opacity-45 ${KAI_INK}`}
                  aria-label="Send"
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
                </button>
              </div>
              <div className="mx-auto mt-2 flex max-w-[65ch] items-center gap-3">
                <p className="min-w-0 flex-1 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-soft/65">
                  Kai reads and explains. It never predicts a price and never
                  tells you what to buy or sell.
                </p>
                {isPanel && (
                  <button
                    onClick={openFullView}
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-soft transition-colors hover:text-ink sm:hidden"
                  >
                    Open full view <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* "What Kai remembers about you" — transparency + clear (Lane 8B) */}
      {memoryOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-scrim p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setMemoryOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-paper p-6 shadow-lift sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`font-mono text-eyebrow font-semibold uppercase ${KAI_INK}`}>
                  Kai · transparency
                </p>
                <h2 className="mt-1.5 font-display text-display-3 font-extrabold text-ink">
                  What Kai remembers
                </h2>
              </div>
              <button
                onClick={() => setMemoryOpen(false)}
                className="f0-focus f0-press rounded-full p-1 text-soft transition-colors hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-[13px] leading-relaxed text-soft">
              {isKid
                ? "Kai keeps a few notes about what you're learning, so it can help you better next time."
                : "To pick up where you left off, Kai keeps a short private note about the topics you discuss. Only you can see it — and you can clear it anytime."}
            </p>

            <div className="f0-rule-top mt-4 max-h-56 overflow-y-auto pt-3 text-[13.5px] leading-relaxed text-ink">
              {memorySummary ? (
                memorySummary
              ) : (
                <span className="text-soft">
                  Kai doesn&apos;t have any notes about you yet. They&apos;ll build up as you chat.
                </span>
              )}
            </div>

            {memoryUpdatedAt && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-soft/70">
                Last updated {new Date(memoryUpdatedAt).toLocaleDateString()}
              </p>
            )}

            {canToggleDeepMode && (
              <div className="f0-rule-top mt-5 flex items-start justify-between gap-4 pt-4">
                <div className="min-w-0">
                  <p className="font-display text-[14px] font-bold text-ink">
                    Deeper analysis mode
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-soft">
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
                  className="f0-focus relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50"
                  style={{ background: deepMode ? "var(--kai-blue)" : "var(--sand)" }}
                  aria-label="Toggle deeper analysis mode"
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      deepMode ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            )}

            {memorySummary && (
              <button
                onClick={clearMemory}
                disabled={memoryClearing}
                className="f0-focus f0-rule-top mt-5 flex w-full items-center justify-center gap-2 pt-4 text-[13px] font-semibold text-soft transition-colors hover:text-red-600 disabled:opacity-50 dark:hover:text-red-500"
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
