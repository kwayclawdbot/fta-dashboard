import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClubTier } from "@/lib/tier";
import { deriveRegister } from "@/lib/register";
import { memberMode } from "@/lib/mode";
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
  chatToolsForProfile,
  resolveKaiProfile,
  KAI_CHAT_DAILY_CAP,
  KAI_MAX_TOOL_ROUNDS,
  KAI_MODEL,
  KAI_SUMMARY_MODEL,
  KAI_MEMORY_MAX_CHARS,
} from "@/lib/kai/persona";
import { beltForXp } from "@/lib/belts";
import { getResearchPayload } from "@/lib/research/aggregate";
import type { Letter } from "@/lib/research/grades";
import { serviceClient } from "@/lib/server/membership";
import { logClubEvent } from "@/lib/club/track";
import type { Register } from "@/lib/register";
import { parseAlertRequest, sanitizeRuleSpec, AlertParseError } from "@/lib/alerts/parse";
import { MAX_ACTIVE_RULES } from "@/lib/alerts/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const RANGE_DAYS: Record<string, number> = { "1m": 30, "3m": 90, "6m": 180, "1y": 365 };
const HISTORY_LIMIT = 16;

interface AnthMsg {
  role: "user" | "assistant";
  content: string | unknown[];
}
interface Block {
  kind: "chart" | "news" | "grade";
  [k: string]: unknown;
}

function sse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/** Context the club-only tools need (member-scoped Supabase + their family). */
interface ToolCtx {
  supabase: Awaited<ReturnType<typeof createClient>>;
  familyId: string | null;
  /** Caller identity — derived from the authenticated session, NEVER the model. */
  userId: string;
  /** Whether this caller may set alerts (paying adult; same gate as Kai Watch). */
  canAlerts: boolean;
}

/** Compact one screener_metrics row into the fields the briefing cares about. */
function summarizeMetrics(m: Record<string, unknown>) {
  const num = (v: unknown) => (typeof v === "number" ? v : v == null ? null : Number(v));
  const round = (v: number | null, d = 1) => (v == null || Number.isNaN(v) ? null : Number(v.toFixed(d)));
  const distHigh = round(num(m.dist_52w_high));
  const distLow = round(num(m.dist_52w_low));
  const events: string[] = [];
  if (distHigh != null && distHigh >= -1.5) events.push("at/near 52-week high");
  if (distLow != null && distLow >= 0 && distLow <= 3) events.push("at/near 52-week low");
  const vr = round(num(m.vol_ratio), 2);
  if (vr != null && vr >= 1.8) events.push(`volume surge (${vr}x avg)`);
  const gap = round(num(m.gap_pct));
  if (gap != null && Math.abs(gap) >= 2) events.push(`gap ${gap > 0 ? "up" : "down"} ${gap}%`);
  return {
    ticker: m.ticker,
    name: m.name ?? null,
    price: round(num(m.price), 2),
    chg_1d_pct: round(num(m.chg_1d)),
    chg_5d_pct: round(num(m.chg_5d)),
    vol_ratio: vr,
    gap_pct: gap,
    rsi14: round(num(m.rsi14)),
    ema20: m.ema20_state ?? null,
    ema50: m.ema50_state ?? null,
    dist_52w_high_pct: distHigh,
    dist_52w_low_pct: distLow,
    events: events.length ? events : null,
  };
}

/**
 * get_daily_changes — the club "what changed today" briefing (Lane C2). Pulls
 * today's screener deltas + fresh Club Newsroom articles for one ticker or the
 * member's watchlist. Uses the member-scoped client (screener/news are
 * authenticated-read; family_watchlist is own-family under RLS).
 */
async function runDailyChanges(
  input: Record<string, unknown>,
  ctx: ToolCtx
): Promise<{ result: string }> {
  const METRIC_COLS =
    "ticker, name, price, chg_1d, chg_5d, vol_ratio, gap_pct, dist_52w_high, dist_52w_low, rsi14, ema20_state, ema50_state, updated_at";
  const scope = String(input.scope || "").toLowerCase() === "watchlist" ? "watchlist" : "ticker";
  const twoDaysAgo = new Date(Date.now() - 2 * 864e5).toISOString();

  if (scope === "ticker") {
    const sym = normalizeSymbol(String(input.symbol || ""));
    if (!sym) return { result: "Provide a ticker symbol for a single-ticker briefing." };
    const { data: m } = await ctx.supabase
      .from("screener_metrics")
      .select(METRIC_COLS)
      .eq("ticker", sym)
      .maybeSingle();
    const { data: news } = await ctx.supabase
      .from("news_articles")
      .select("title, dek, kind, generated_at")
      .eq("published", true)
      .contains("tickers", [sym])
      .gte("generated_at", twoDaysAgo)
      .order("generated_at", { ascending: false })
      .limit(5);
    if (!m) {
      return {
        result: JSON.stringify({
          ticker: sym,
          note: "Not in the in-house screener universe — no daily-change snapshot. Use get_quote/get_bars for its price action.",
          fresh_news: news || [],
        }),
      };
    }
    return {
      result: JSON.stringify({
        asof: (m as Record<string, unknown>).updated_at,
        snapshot: summarizeMetrics(m as Record<string, unknown>),
        fresh_news: news || [],
        note: "Deltas are today's session vs. prior close; end-of-day / delayed ~15 min.",
      }),
    };
  }

  // scope === "watchlist"
  if (!ctx.familyId) {
    return { result: "No watchlist yet — this member isn't in a family/watchlist context." };
  }
  const { data: wl } = await ctx.supabase
    .from("family_watchlist")
    .select("ticker, company_name")
    .eq("family_id", ctx.familyId);
  const tickers = Array.from(
    new Set((wl || []).map((r) => String(r.ticker || "").toUpperCase()).filter(Boolean))
  );
  if (!tickers.length) {
    return { result: "The member's watchlist is empty. Suggest they add names on /watchlist." };
  }
  const { data: metrics } = await ctx.supabase
    .from("screener_metrics")
    .select(METRIC_COLS)
    .in("ticker", tickers);
  const { data: news } = await ctx.supabase
    .from("news_articles")
    .select("title, tickers, generated_at")
    .eq("published", true)
    .overlaps("tickers", tickers)
    .gte("generated_at", twoDaysAgo)
    .order("generated_at", { ascending: false })
    .limit(8);
  const rows = (metrics || []).map((m) => summarizeMetrics(m as Record<string, unknown>));
  // Sort by absolute day move so the biggest movers lead the briefing.
  rows.sort((a, b) => Math.abs((b.chg_1d_pct ?? 0) as number) - Math.abs((a.chg_1d_pct ?? 0) as number));
  const covered = new Set(rows.map((r) => r.ticker));
  const noData = tickers.filter((t) => !covered.has(t));
  return {
    result: JSON.stringify({
      watchlist_count: tickers.length,
      movers: rows,
      not_in_screener: noData.length ? noData : null,
      fresh_news: news || [],
      note: "Deltas are today's session vs. prior close, sorted by biggest move; end-of-day / delayed ~15 min.",
    }),
  };
}

/**
 * propose_alert_rule — parse a member's plain English into a concrete PROPOSAL
 * (LANE R4, chat). Uses the SAME parser as /api/kai-watch/parse (src/lib/alerts/
 * parse). PROPOSES ONLY — never writes. The model is instructed to read the
 * proposal back and get an explicit yes before create_alert_rule.
 */
async function runProposeAlert(
  input: Record<string, unknown>,
  ctx: ToolCtx
): Promise<{ result: string }> {
  if (!ctx.canAlerts) {
    return {
      result: JSON.stringify({
        supported: false,
        rules: [],
        note: "Setting alerts is a paying-member feature; this member isn't eligible. Don't offer to set one.",
      }),
    };
  }
  const request = String(input.request || "").trim();
  if (request.length < 2) {
    return { result: JSON.stringify({ supported: false, rules: [], note: "Ask the member what they'd like you to watch." }) };
  }
  try {
    const parsed = await parseAlertRequest({ text: request });
    return {
      result: JSON.stringify({
        supported: parsed.supported,
        rules: parsed.rules, // [{ kind, ticker, params, label }]
        note: parsed.note,
        confirmation_required:
          "This is a PROPOSAL only — nothing is saved. Read the rule(s) back to the member in plain English and get an explicit yes before calling create_alert_rule with these exact rules.",
      }),
    };
  } catch (e) {
    const code = e instanceof AlertParseError ? e.code : "parse_failed";
    return {
      result: JSON.stringify({
        supported: false,
        rules: [],
        note:
          code === "unavailable"
            ? "The alert parser is offline right now — tell the member you can't set alerts this moment."
            : "Couldn't read that into a watchable rule. Ask the member to rephrase (a ticker + a condition like a price, a % move, or volume).",
      }),
    };
  }
}

/**
 * create_alert_rule — SAVE confirmed rule(s). Called only after the member says
 * yes. Caller identity comes from ctx.userId (the authenticated session), NEVER
 * the model; each rule is re-sanitized server-side (label recomputed), inserted
 * under own-row RLS with the 20-active DB cap enforced by trigger.
 */
async function runCreateAlert(
  input: Record<string, unknown>,
  ctx: ToolCtx
): Promise<{ result: string }> {
  if (!ctx.canAlerts) {
    return { result: "This member can't set alerts (paying-member feature). Do not save anything." };
  }
  const rawRules = Array.isArray(input.rules) ? input.rules : [];
  const specs = rawRules
    .map((r) => sanitizeRuleSpec(r))
    .filter((s): s is NonNullable<ReturnType<typeof sanitizeRuleSpec>> => s !== null)
    .slice(0, 3);
  if (specs.length === 0) {
    return {
      result:
        "None of those were valid, watchable rules. Re-run propose_alert_rule on the member's request and confirm the proposal before saving.",
    };
  }
  const created: string[] = [];
  for (const s of specs) {
    const { data, error } = await ctx.supabase
      .from("alert_rules")
      .insert({
        user_id: ctx.userId, // session identity — never trusted from the model
        kind: s.kind,
        ticker: s.ticker,
        params: s.params,
        label: s.label,
        surface: "manual",
        active: true,
      })
      .select("id, label")
      .single();
    if (error) {
      if (/cap reached/i.test(error.message)) {
        return {
          result: JSON.stringify({
            created,
            error: `The member is at the ${MAX_ACTIVE_RULES}-active-alert cap. ${
              created.length ? `Saved ${created.length} before hitting it. ` : ""
            }Tell them to pause an existing alert first, then try again.`,
          }),
        };
      }
      return {
        result: JSON.stringify({
          created,
          error: "Couldn't save one of the alerts. Tell the member it didn't go through and to try again.",
        }),
      };
    }
    if (data?.label) created.push(String(data.label));
  }
  return {
    result: JSON.stringify({
      created,
      note: "Saved to the member's account. Confirm in one line what's now live. These are notifications, not advice.",
    }),
  };
}

/**
 * list_my_alerts — the member's active personalized rules + the Kai Daily setups
 * they follow. Read-only, own rows (own-row RLS on both alert_rules and
 * setup_subscriptions scopes the reads to ctx.userId).
 */
async function runListMyAlerts(ctx: ToolCtx): Promise<{ result: string }> {
  if (!ctx.canAlerts) {
    return { result: "This member isn't on a plan that includes personal alerts." };
  }
  const { data: rules } = await ctx.supabase
    .from("alert_rules")
    .select("ticker, label, kind, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false });

  // Setups the member is following (own subscriptions → the setup lifecycle rows).
  const { data: subs } = await ctx.supabase
    .from("setup_subscriptions")
    .select("setup_id")
    .limit(50);
  const setupIds = (subs || []).map((s) => (s as { setup_id: string }).setup_id);
  let following: unknown[] = [];
  if (setupIds.length > 0) {
    const { data: setups } = await ctx.supabase
      .from("alert_setups")
      .select("ticker, direction, thesis, state, created_at")
      .in("id", setupIds)
      .order("created_at", { ascending: false });
    following = (setups || []).map((s) => {
      const r = s as Record<string, unknown>;
      return {
        ticker: r.ticker,
        direction: r.direction,
        state: r.state,
        thesis: typeof r.thesis === "string" ? r.thesis.slice(0, 160) : null,
      };
    });
  }

  return {
    result: JSON.stringify({
      active_alerts: (rules || []).map((r) => {
        const x = r as Record<string, unknown>;
        return { ticker: x.ticker, label: x.label, kind: x.kind };
      }),
      active_count: (rules || []).length,
      cap: MAX_ACTIVE_RULES,
      following_setups: following,
      note: "These are the member's own watches — notifications, not advice.",
    }),
  };
}

/* ───────────────────────── grade_ticker (research scorecard) ───────────────────────── */

/**
 * The grades engine's fixed letter bands (grades.ts scoreToLetter). A signed
 * display grade ("A-", "B+") is DERIVED from the engine's own 0–100 score —
 * the score's tercile within its letter band — so the chip stays a pure,
 * deterministic read of the real grade, never a second opinion. F carries no
 * sign (there is no F+).
 */
const LETTER_BANDS: Record<Letter, [number, number]> = {
  A: [80, 100],
  B: [65, 79],
  C: [45, 64],
  D: [25, 44],
  F: [0, 24],
};

function signedGrade(letter: Letter, score: number): string {
  if (letter === "F") return "F";
  const [lo, hi] = LETTER_BANDS[letter];
  const pos = (score - lo) / (hi - lo);
  if (pos >= 2 / 3) return `${letter}+`;
  if (pos < 1 / 3) return `${letter}-`;
  return letter;
}

/**
 * grade_ticker — the app's REAL research grade as a chat artifact. Reuses the
 * EXACT server path the /research/[ticker] scorecard reads (getResearchPayload
 * → cached fundamentals + live screener momentum + medians → computeGrades),
 * so the card in chat and the scorecard on the research page can never
 * disagree. Honest insufficiency is preserved: an ungradeable name returns a
 * plain-language result and NO render block — a grade is never invented.
 */
async function runGradeTicker(
  input: Record<string, unknown>
): Promise<{ result: string; block?: Block }> {
  const sym = normalizeSymbol(String(input.symbol || ""));
  if (!sym) return { result: "Invalid ticker symbol." };

  const payload = await getResearchPayload(sym);
  if (!payload) {
    return {
      result: `No research data is available for ${sym}, so no grade can be computed. Tell the member that honestly — do not invent a grade.`,
    };
  }

  const g = payload.grades;
  const name = payload.company.name;
  const subscores = g.dimensions.map((d) => ({
    dimension: d.dimension,
    letter: d.letter,
    score: d.score,
    sufficient: d.sufficient,
  }));

  // Not enough gradeable dimensions for an overall read → no card, honest note.
  if (g.overall.letter == null || g.overall.score == null) {
    return {
      result: JSON.stringify({
        ticker: sym,
        name,
        grade: null,
        graded_of_4: g.overall.graded,
        subscores,
        note: payload.partial
          ? `The financial data for ${sym} is still arriving — the grade engine can't compute an honest grade yet. Say the data is still loading and to try again shortly. Never invent a grade.`
          : `Not enough published financials to compute an overall grade for ${sym} (only ${g.overall.graded} of 4 dimensions were gradeable). Say so plainly — many small caps and ETFs don't file standardized financials. Never invent a grade.`,
      }),
    };
  }

  const grade = signedGrade(g.overall.letter, g.overall.score);

  // Price + day move for the card — the same delayed quote get_quote uses,
  // with the in-house screener day-change as the honest fallback. No quote and
  // no screener read → the card simply shows no price (real data only).
  let price: number | null = null;
  let changePct: number | null = null;
  try {
    const q = await getQuote(sym);
    if (q && q.price != null && q.price > 0) {
      price = q.price;
      changePct = q.changePercent ?? null;
    }
  } catch {
    /* fall through to screener day change */
  }
  if (changePct == null) changePct = payload.momentum.chg1d;

  // One-line reasons: the engine's own plain-English check sentences —
  // strengths first, then the leading weakness, so the card stays honest.
  const reasons = [...g.strengths.slice(0, 2), ...g.weaknesses.slice(0, 1)];

  const block: Block = {
    kind: "grade",
    ticker: sym,
    name,
    grade,
    letter: g.overall.letter,
    label: g.overall.label,
    score: g.overall.score,
    graded: g.overall.graded,
    subscores,
    price,
    changePct,
    reasons,
    asOf: payload.cachedAt,
  };

  return {
    result: JSON.stringify({
      ticker: sym,
      name,
      grade,
      verdict: g.overall.label,
      score: g.overall.score,
      graded_of_4: g.overall.graded,
      subscores,
      price,
      change_pct: changePct,
      strengths: g.strengths.slice(0, 3),
      weaknesses: g.weaknesses.slice(0, 3),
      note: "A graded ticker card is shown to the member automatically — refer to it naturally rather than restating every number. These are the platform's educational research grades; never frame the grade as a buy/sell recommendation.",
    }),
    block,
  };
}

/** Execute one Kai tool → { toolResult (string for the model), block? (client render) }. */
async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolCtx
): Promise<{ result: string; block?: Block }> {
  try {
    if (name === "get_daily_changes") return runDailyChanges(input, ctx);
    if (name === "grade_ticker") return runGradeTicker(input);
    if (name === "propose_alert_rule") return runProposeAlert(input, ctx);
    if (name === "create_alert_rule") return runCreateAlert(input, ctx);
    if (name === "list_my_alerts") return runListMyAlerts(ctx);
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

  // Trim the key defensively: a pasted Vercel env value can carry a trailing
  // newline, which makes the x-api-key header malformed and every Anthropic
  // call fail with 401 — surfacing as a blanket "temporarily unavailable".
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key)
    return Response.json({ error: "Kai is offline right now." }, { status: 503 });

  // Profile → register (age-aware) + tier (cap).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track, family_id, kai_deep_mode")
    .eq("id", user.id)
    .maybeSingle();
  const register = deriveRegister(profile);
  const deepMode = profile?.kai_deep_mode === true;
  const tier = await getClubTier(supabase, profile?.family_id);

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
            : `You've used all ${cap} of your Ask Kai messages for today. Come back tomorrow${
                register === "adult" && tier === "free"
                  ? " — or join the Club for much higher limits"
                  : register === "adult" && tier === "fic"
                    ? " — or upgrade to FTA for more"
                    : ""
              }.`,
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

  // ClubHome instrumentation: log a kai_question (best-effort, non-blocking). A
  // cashtag in the message ($AAPL) attributes the question to a ticker for the
  // Club Score pipeline; otherwise it still counts toward collective activity.
  {
    const cash = text.match(/\$([A-Za-z]{1,5})\b/);
    void logClubEvent(supabase, user.id, "kai_question", cash ? cash[1] : null);
  }

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
    /** Stored experience (families.door, migration 215) — null with no family. */
    door?: "club" | "family" | null;
    family?: {
      experience?: string | null;
      goals?: string[] | null;
      market_interest?: string | null;
      household?: { adults?: number; kids?: number; kid_age_ranges?: string[] } | null;
      hh_completed_at?: string | null;
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

  // Resolve the guardrail PROFILE server-side (Lane C2). Solo = a COMPLETED
  // family-of-one (Family Mode off). The member-mode verdict is owned by
  // src/lib/mode.ts (C1): memberMode() requires completed_at AND a solo
  // household, so a half-finished default-shaped draft is never mistaken for
  // solo — behavior-identical to the prior isSoloProfile derivation.
  const solo =
    memberMode({
      household: fam.household ?? null,
      completed_at: fam.hh_completed_at ?? null,
    }) === "individual";
  const profileTier = resolveKaiProfile(register, {
    door: pers.door ?? null,
    solo,
    deepMode,
  });
  // Conversational alert-setting gate: paying ADULTS only — the exact gate the
  // Kai Watch panel uses (register 'adult' + non-free tier). Teens (family-adult
  // register) and kids never get the alert tools. Derived server-side.
  const canAlerts = register === "adult" && tier !== "free";
  const tools = chatToolsForProfile(profileTier, { alerts: canAlerts });
  const toolCtx: ToolCtx = {
    supabase,
    familyId: profile?.family_id ?? null,
    userId: user.id,
    canAlerts,
  };

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

  // Persist the user's message. Capture its id so a failed turn (API/billing
  // error or empty generation) can remove it — otherwise the member is charged
  // a daily-cap message for a reply they never got (the cap counts user rows).
  const { data: userMsgRow } = await supabase
    .from("kai_chat_messages")
    .insert({
      thread_id: threadId,
      user_id: user.id,
      role: "user",
      content: text,
    })
    .select("id")
    .single();
  const userMsgId = userMsgRow?.id ?? null;

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

  // PROMPT CACHING (biggest per-message cost lever on claude-sonnet-5: cached
  // input reads bill ~0.1x). The Anthropic render order is tools -> system ->
  // messages, so the cacheable prefix is [tools + system]. We split `system`
  // into two blocks so the cache is layered and byte-stable:
  //
  //   block 1 = the register/profile base prompt with NO personalization. This
  //     is GLOBAL — identical for every member on the same (register, profile),
  //     with no timestamps/IDs/per-request data anywhere in it (guardrail floor
  //     + club/education register are static string constants). A cache_control
  //     breakpoint here freezes tools + base prompt, so it hits across turns AND
  //     across members. This is the dominant win.
  //   block 2 = the per-member personalization (name, belt, memory summary).
  //     Placed AFTER block 1 (global before user-specific) with its own
  //     breakpoint so it caches within a member's session; it only invalidates
  //     when the rolling memory summary is rewritten (after a turn, not during).
  //
  // Everything volatile (history, the current user turn, tool_result payloads,
  // market data) lives in `messages`, which is AFTER both breakpoints — so a new
  // turn never disturbs the cached prefix.
  const baseSystem = buildChatSystemPrompt(register, profileTier, "", { alerts: canAlerts });
  const system: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[] = [
    { type: "text", text: baseSystem, cache_control: { type: "ephemeral" } },
  ];
  if (personalizationBlock) {
    system.push({
      type: "text",
      text: personalizationBlock,
      cache_control: { type: "ephemeral" },
    });
  }
  const tid = threadId;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (o: unknown) => controller.enqueue(sse(o));
      emit({ type: "meta", threadId: tid });

      let finalText = "";
      const collectedBlocks: Block[] = [];
      let apiFailed = false; // model/API call failed (billing, auth, 5xx, …)

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
              tools,
              stream: true,
              messages,
            }),
            signal: AbortSignal.timeout(55_000),
          });

          if (!res.ok || !res.body) {
            const errText = await res.text().catch(() => "");
            console.error("[KaiChat] anthropic error:", res.status, errText);
            apiFailed = true;
            emit({
              type: "error",
              error:
                register === "kid"
                  ? "Kai is taking a quick break — try again in a little while!"
                  : "Kai is temporarily unavailable. Please try again in a bit.",
            });
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
            const { result, block } = await runTool(tu.name, tu.input, toolCtx);
            if (block) {
              collectedBlocks.push(block);
              emit({ type: "block", block });
            }
            toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
          }
          messages.push({ role: "user", content: toolResults });
        }

        const replyText = finalText.trim();

        // A turn that produced no usable answer — an API/billing failure, or an
        // empty generation — must NOT consume the member's daily quota or leave
        // a junk assistant message in the thread. Remove the user row inserted
        // before the model call (the cap counts user rows) and surface a clear
        // error instead of the old generic "I couldn't find an answer" fallback,
        // which the client's `done` handler used to paint over the real error.
        if (apiFailed || !replyText) {
          if (userMsgId) {
            await supabase.from("kai_chat_messages").delete().eq("id", userMsgId);
          }
          if (!apiFailed) {
            emit({
              type: "error",
              error:
                register === "kid"
                  ? "Kai didn't have an answer for that — try asking a different way!"
                  : "Kai couldn't generate a reply. Please try again.",
            });
          }
          return; // finally { controller.close() } still runs
        }

        // Persist the assistant reply.
        await supabase.from("kai_chat_messages").insert({
          thread_id: tid,
          user_id: user.id,
          role: "assistant",
          content: replyText,
          blocks: collectedBlocks,
        });

        emit({ type: "done", threadId: tid, content: replyText, blocks: collectedBlocks });

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
        try {
          if (userMsgId) {
            await supabase.from("kai_chat_messages").delete().eq("id", userMsgId);
          }
        } catch {
          /* best-effort quota refund */
        }
        emit({ type: "error", error: "Kai is temporarily unavailable. Please try again in a bit." });
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
