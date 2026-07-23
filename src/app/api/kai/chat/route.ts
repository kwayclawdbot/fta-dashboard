import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFamilyTier } from "@/lib/tier";
import { deriveRegister } from "@/lib/register";
import {
  getQuote,
  getBars,
  getCompany,
  getNews,
  searchTickers,
  normalizeSymbol,
} from "@/lib/market/polygon";
import {
  buildChatSystemPrompt,
  buildPersonalizationBlock,
  buildMemorySummaryPrompt,
  CHAT_TOOLS,
  KAI_CHAT_DAILY_CAP,
  KAI_MAX_TOOL_ROUNDS,
  KAI_MODEL,
  KAI_SUMMARY_MODEL,
  KAI_MEMORY_MAX_CHARS,
} from "@/lib/kai/persona";
import { beltForXp } from "@/lib/belts";
import { serviceClient } from "@/lib/server/membership";
import type { Register } from "@/lib/register";

export const runtime = "nodejs";
export const maxDuration = 60;

const RANGE_DAYS: Record<string, number> = { "1m": 30, "3m": 90, "6m": 180, "1y": 365 };
const HISTORY_LIMIT = 16;

interface AnthMsg {
  role: "user" | "assistant";
  content: string | unknown[];
}
interface Block {
  kind: "chart" | "news";
  [k: string]: unknown;
}

function sse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/** Execute one Kai tool → { toolResult (string for the model), block? (client render) }. */
async function runTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ result: string; block?: Block }> {
  try {
    if (name === "get_quote") {
      const sym = normalizeSymbol(String(input.symbol || ""));
      if (!sym) return { result: "Invalid ticker symbol." };
      const q = await getQuote(sym);
      if (!q) return { result: `No quote found for ${sym}.` };
      return {
        result: JSON.stringify({
          symbol: sym,
          price: q.price,
          changePercent: q.changePercent,
          delayed: true,
        }),
      };
    }
    if (name === "get_bars") {
      const sym = normalizeSymbol(String(input.symbol || ""));
      const range = String(input.range || "1y");
      const days = RANGE_DAYS[range] ?? 365;
      if (!sym) return { result: "Invalid ticker symbol." };
      const bars = await getBars(sym, days);
      if (!bars || bars.length < 2) return { result: `No price history for ${sym}.` };
      const closes = bars.map((b) => b.c);
      const first = closes[0];
      const last = closes[closes.length - 1];
      const pct = first ? ((last - first) / first) * 100 : 0;
      return {
        result: JSON.stringify({
          symbol: sym,
          range,
          points: bars.length,
          first: first.toFixed(2),
          last: last.toFixed(2),
          high: Math.max(...closes).toFixed(2),
          low: Math.min(...closes).toFixed(2),
          changePct: pct.toFixed(1),
          note: "A chart of this history is shown to the user.",
        }),
        block: { kind: "chart", symbol: sym, range, bars: bars.map((b) => ({ t: b.t, c: b.c })) },
      };
    }
    if (name === "company_info") {
      const sym = normalizeSymbol(String(input.symbol || ""));
      if (!sym) return { result: "Invalid ticker symbol." };
      const c = await getCompany(sym);
      if (!c) return { result: `No profile found for ${sym}.` };
      return {
        result: JSON.stringify({
          symbol: c.symbol,
          name: c.name,
          sector: c.sector,
          marketCap: c.marketCapText,
          description: (c.description || "").slice(0, 900),
        }),
      };
    }
    if (name === "ticker_search") {
      const hits = await searchTickers(String(input.query || ""));
      return { result: JSON.stringify(hits.slice(0, 8)) };
    }
    if (name === "news_headlines") {
      const sym = normalizeSymbol(String(input.symbol || ""));
      if (!sym) return { result: "Invalid ticker symbol." };
      const items = await getNews(sym, 6);
      if (!items.length) return { result: `No recent news for ${sym}.` };
      return {
        result: JSON.stringify(
          items.map((n) => ({ title: n.title, publisher: n.publisher, published: n.published }))
        ),
        block: {
          kind: "news",
          symbol: sym,
          items: items.map((n) => ({
            title: n.title,
            url: n.url,
            publisher: n.publisher,
            published: n.published,
          })),
        },
      };
    }
    return { result: `Unknown tool: ${name}` };
  } catch {
    return { result: `Tool ${name} failed.` };
  }
}

/**
 * Cross-thread memory refresh (Lane 8B). Runs a cheap Haiku pass over the
 * member's recent chat activity + their prior summary, and writes an updated
 * bounded summary via the service role (kai_user_memory has no member write
 * policy). Kid accounts get a learning-context-only summarization prompt.
 * Best-effort: any failure is swallowed so it never affects the chat reply.
 */
async function refreshKaiMemory(opts: {
  key: string;
  userId: string;
  register: Register;
  priorSummary: string;
  transcript: { role: string; content: unknown }[];
  msgsSummarized: number;
}): Promise<void> {
  const transcriptText = opts.transcript
    .map((r) => {
      const c = typeof r.content === "string" ? r.content : JSON.stringify(r.content);
      return `${r.role === "assistant" ? "Kai" : "Member"}: ${c}`;
    })
    .join("\n")
    .slice(0, 8000);

  const userMsg = `PREVIOUS SUMMARY (may be empty):\n${opts.priorSummary || "(none yet)"}\n\nRECENT TRANSCRIPT:\n${transcriptText}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: KAI_SUMMARY_MODEL,
      max_tokens: 500,
      system: buildMemorySummaryPrompt(opts.register),
      messages: [{ role: "user", content: userMsg }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return;
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const summary = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("")
    .trim()
    .slice(0, KAI_MEMORY_MAX_CHARS);
  if (!summary) return;

  const admin = serviceClient();
  await admin.from("kai_user_memory").upsert(
    {
      user_id: opts.userId,
      summary,
      msgs_summarized: opts.msgsSummarized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    return Response.json({ error: "Kai is offline right now." }, { status: 503 });

  // Profile → register (age-aware) + tier (cap).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track, family_id")
    .eq("id", user.id)
    .maybeSingle();
  const register = deriveRegister(profile);
  const tier = await getFamilyTier(supabase, profile?.family_id);

  const cap = KAI_CHAT_DAILY_CAP[tier] ?? 0;
  if (cap <= 0)
    return Response.json(
      { error: "Ask Kai is for members. Join the club to chat with Kai.", capped: true, register },
      { status: 403 }
    );

  // Daily rate cap — count today's own user-role messages (UTC calendar day).
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count: usedToday } = await supabase
    .from("kai_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", dayStart.toISOString());
  if ((usedToday ?? 0) >= cap) {
    return Response.json(
      {
        error:
          register === "kid"
            ? "That's all your Kai questions for today — come back tomorrow for more!"
            : `You've used all ${cap} of your Ask Kai messages for today. Come back tomorrow${register === "adult" && tier === "fic" ? " — or upgrade to FTA for more" : ""}.`,
        capped: true,
        register,
        used: usedToday,
        cap,
      },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const text = String(body?.message || "").trim().slice(0, 2000);
  let threadId = body?.threadId ? String(body.threadId) : null;
  const startedNewThread = !threadId; // memory-refresh trigger (Lane 8B)
  if (!text) return Response.json({ error: "Empty message." }, { status: 400 });

  // Personalization (Lane 8B) — sourced server-side, never client-supplied. The
  // definer RPC returns only THIS caller's data (works for kids past the
  // parent-only family_profiles RLS); the memory summary is the caller's own row.
  const { data: persData } = await supabase.rpc("kai_personalization");
  const { data: memRow } = await supabase
    .from("kai_user_memory")
    .select("summary, msgs_summarized")
    .eq("user_id", user.id)
    .maybeSingle();
  const pers = (persData || {}) as {
    display_name?: string | null;
    xp?: number;
    family?: {
      experience?: string | null;
      goals?: string[] | null;
      market_interest?: string | null;
      household?: { adults?: number; kids?: number; kid_age_ranges?: string[] } | null;
    } | null;
  };
  const fam = pers.family || {};
  const personalizationBlock = buildPersonalizationBlock({
    displayName: pers.display_name,
    beltLabel: typeof pers.xp === "number" ? beltForXp(pers.xp).label : null,
    experience: fam.experience ?? null,
    goals: fam.goals ?? null,
    marketInterest: fam.market_interest ?? null,
    household: fam.household ?? null,
    memory: memRow?.summary ?? null,
  });

  // Ensure a thread (own-row).
  if (!threadId) {
    const title = text.slice(0, 60);
    const { data: t, error } = await supabase
      .from("kai_chat_threads")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();
    if (error || !t)
      return Response.json({ error: "Could not start a chat." }, { status: 500 });
    threadId = t.id;
  }

  // Persist the user's message.
  await supabase.from("kai_chat_messages").insert({
    thread_id: threadId,
    user_id: user.id,
    role: "user",
    content: text,
  });

  // Build history for the model (own-row read; trim to the last N turns).
  const { data: hist } = await supabase
    .from("kai_chat_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  const rows = (hist || []).slice(-HISTORY_LIMIT);
  const messages: AnthMsg[] = rows.map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content,
  }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    messages.push({ role: "user", content: text });
  }

  const system = buildChatSystemPrompt(register, personalizationBlock);
  const tid = threadId;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (o: unknown) => controller.enqueue(sse(o));
      emit({ type: "meta", threadId: tid });

      let finalText = "";
      const collectedBlocks: Block[] = [];

      try {
        for (let round = 0; round < KAI_MAX_TOOL_ROUNDS; round++) {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": key,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: KAI_MODEL,
              max_tokens: 1600,
              thinking: { type: "disabled" },
              system,
              tools: CHAT_TOOLS,
              stream: true,
              messages,
            }),
            signal: AbortSignal.timeout(55_000),
          });

          if (!res.ok || !res.body) {
            const errText = await res.text().catch(() => "");
            console.error("[KaiChat] anthropic error:", res.status, errText);
            emit({ type: "error", error: "Kai had trouble answering. Try again." });
            break;
          }

          // Parse Anthropic SSE for this round.
          const blocks: Record<number, { type: string; text?: string; id?: string; name?: string; json?: string }> = {};
          let stopReason = "";
          let roundText = "";
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const events = buf.split("\n\n");
            buf = events.pop() || "";
            for (const ev of events) {
              const line = ev.split("\n").find((l) => l.startsWith("data:"));
              if (!line) continue;
              const json = line.slice(5).trim();
              if (!json) continue;
              let e: {
                type: string;
                index?: number;
                content_block?: { type: string; id?: string; name?: string };
                delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string };
              };
              try {
                e = JSON.parse(json);
              } catch {
                continue;
              }
              if (e.type === "content_block_start" && e.index != null) {
                blocks[e.index] = {
                  type: e.content_block?.type || "text",
                  id: e.content_block?.id,
                  name: e.content_block?.name,
                  text: "",
                  json: "",
                };
              } else if (e.type === "content_block_delta" && e.index != null) {
                const b = blocks[e.index];
                if (!b) continue;
                if (e.delta?.type === "text_delta" && e.delta.text) {
                  b.text = (b.text || "") + e.delta.text;
                  roundText += e.delta.text;
                  emit({ type: "token", text: e.delta.text });
                } else if (e.delta?.type === "input_json_delta" && e.delta.partial_json != null) {
                  b.json = (b.json || "") + e.delta.partial_json;
                }
              } else if (e.type === "message_delta" && e.delta?.stop_reason) {
                stopReason = e.delta.stop_reason;
              }
            }
          }

          finalText += roundText;

          if (stopReason !== "tool_use") break;

          // Assemble the assistant turn (text + tool_use) exactly as received.
          const ordered = Object.keys(blocks)
            .map(Number)
            .sort((a, b) => a - b)
            .map((i) => blocks[i]);
          const assistantContent: unknown[] = [];
          const toolUses: { id: string; name: string; input: Record<string, unknown> }[] = [];
          for (const b of ordered) {
            if (b.type === "text" && b.text) {
              assistantContent.push({ type: "text", text: b.text });
            } else if (b.type === "tool_use" && b.id && b.name) {
              let parsed: Record<string, unknown> = {};
              try {
                parsed = b.json ? JSON.parse(b.json) : {};
              } catch {
                parsed = {};
              }
              assistantContent.push({ type: "tool_use", id: b.id, name: b.name, input: parsed });
              toolUses.push({ id: b.id, name: b.name, input: parsed });
            }
          }
          messages.push({ role: "assistant", content: assistantContent });

          // Execute tools; emit render blocks; build tool_result turn.
          const toolResults: unknown[] = [];
          for (const tu of toolUses) {
            emit({ type: "tool", name: tu.name, input: tu.input });
            const { result, block } = await runTool(tu.name, tu.input);
            if (block) {
              collectedBlocks.push(block);
              emit({ type: "block", block });
            }
            toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
          }
          messages.push({ role: "user", content: toolResults });
        }

        // Persist the assistant reply.
        const safeText = finalText.trim() || "I couldn't find an answer to that.";
        await supabase.from("kai_chat_messages").insert({
          thread_id: tid,
          user_id: user.id,
          role: "assistant",
          content: safeText,
          blocks: collectedBlocks,
        });

        emit({ type: "done", threadId: tid, content: safeText, blocks: collectedBlocks });

        // Cross-thread memory refresh (Lane 8B). Cheap trigger: on a new-thread
        // start (the previous session just ended), or once ≥8 user messages have
        // accrued since the last summary. The user already has their answer, so
        // this runs after `done`; best-effort and never surfaced to the client.
        try {
          const { count: totalUserMsgs } = await supabase
            .from("kai_chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("role", "user");
          const total = totalUserMsgs ?? 0;
          const summarized = memRow?.msgs_summarized ?? 0;
          if (total > summarized && (startedNewThread || total - summarized >= 8)) {
            const { data: recent } = await supabase
              .from("kai_chat_messages")
              .select("role, content")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(24);
            const transcript = (recent || []).slice().reverse();
            await refreshKaiMemory({
              key,
              userId: user.id,
              register,
              priorSummary: memRow?.summary ?? "",
              transcript,
              msgsSummarized: total,
            });
          }
        } catch (e) {
          console.error("[KaiChat] memory refresh failed:", e);
        }
      } catch (err) {
        console.error("[KaiChat] stream error:", err);
        emit({ type: "error", error: "Kai had trouble answering. Try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
