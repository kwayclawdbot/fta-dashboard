/**
 * Kai Watch — natural-language → structured alert-rule parsing (LANE R4), SHARED.
 *
 * The NL→rule translation used to live inline in /api/kai-watch/parse. It now
 * lives here so BOTH callers use ONE implementation:
 *   • POST /api/kai-watch/parse  — the Kai Watch panel/modal (parse-then-confirm UI)
 *   • the `propose_alert_rule` chat tool — Kai turning a mid-conversation "watch
 *     NVDA over 200 with volume" into a concrete proposal it reads back before saving
 *
 * This module NEVER writes. It calls claude-haiku-4-5 with a capability catalog +
 * JSON-schema structured output, then validates/normalizes the model's conditions
 * into insert-ready rule specs (label computed deterministically via ruleLabel —
 * the model's free text is never trusted for the wording or the params).
 *
 * `sanitizeRuleSpec` re-validates a single loose rule object on the WRITE path
 * (create_alert_rule), so even a proposal the model mangles or fabricates is
 * re-normalized server-side before it can reach the DB.
 *
 * Compliance floor (owner decision 7): every produced label is NOTIFICATION
 * framing ("I'll tell you when…"), never advice. Unsupported asks return
 * supported=false + an honest "here's the closest thing I CAN watch" note.
 */

import { ruleLabel, type AlertKind, type AlertParams } from "@/lib/alerts/types";

/** An insert-ready, fully-validated rule spec (label computed here). */
export interface ParsedRuleSpec {
  kind: AlertKind;
  ticker: string | null;
  params: AlertParams;
  label: string;
}

export interface AlertParseResult {
  supported: boolean;
  rules: ParsedRuleSpec[];
  note: string;
}

/** Typed failure so callers can map to the right surface (HTTP status / tool text). */
export class AlertParseError extends Error {
  constructor(public code: "unavailable" | "parse_failed") {
    super(code);
    this.name = "AlertParseError";
  }
}

// Model-facing catalog of everything Kai can actually watch. Kept terse — the
// schema constrains the shape; this teaches the mapping from phrasing → kind.
const CAPABILITY_BRIEF = `You translate a member's plain-English request into structured stock-alert conditions for the Cheat Code Club. You can ONLY watch these kinds of signals — never invent others:

- price_cross: the stock's price crosses a level. params: {op:"above"|"below", price:number}
- pct_move: the stock moves a % in a day or week. params: {pct:number, window:"1d"|"5d"}
- vol_surge: trading volume spikes vs its average. params: {ratio:number}  (e.g. 3 = 3x average)
- rsi_cross: RSI crosses a level (overbought/oversold). params: {op:"above"|"below", level:number}  (oversold≈30, overbought≈70)
- ema_cross: price closes above/below its moving average. params: {ema:20|50, side:"above"|"below"}
- w52_break: new 52-week high or low. params: {edge:"high"|"low"}
- sentiment_velocity: the CLUB's community sentiment turns more bullish/bearish on the stock. params: {sentiment:"bullish"|"bearish"}  Use this for "when the vibe/community/people turn bullish or bearish". This watches the CLUB's stance, NOT the whole market's mood.
- news_event: fresh material news breaks on the stock (optionally paired with a notable move). params: {move?:number}  Use this as the honest proxy for "thesis-changing news", "big news", "something important happens". It is a heads-up that news broke + the stock moved — it can NOT judge whether a thesis actually changed.

A request can map to MULTIPLE conditions (e.g. "drops below 150 AND volume spikes" = two conditions). Extract the ticker symbol (uppercase). If the user names a company, use its ticker. If NO specific stock is given but a ticker was provided as context, use that.

If the request asks for something you genuinely CANNOT watch (e.g. "when analysts change their rating", "when the CEO resigns", "when it becomes a good buy", "predict the price"), set supported=false, leave conditions empty, and in "note" honestly say what you cannot do AND offer the closest thing you CAN watch from the list above (usually news_event or a price/volume move). NEVER promise advice ("you should buy/sell") — only notifications ("I'll tell you when…").`;

interface ParsedCondition {
  kind: string;
  ticker?: string | null;
  op?: string;
  price?: number;
  pct?: number;
  window?: string;
  ratio?: number;
  level?: number;
  ema?: number;
  side?: string;
  edge?: string;
  sentiment?: string;
  move?: number;
}

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    supported: {
      type: "boolean",
      description: "true if at least one condition can be watched with the available kinds",
    },
    conditions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: {
            type: "string",
            enum: [
              "price_cross",
              "pct_move",
              "vol_surge",
              "rsi_cross",
              "ema_cross",
              "w52_break",
              "sentiment_velocity",
              "news_event",
            ],
          },
          ticker: { type: "string" },
          op: { type: "string", enum: ["above", "below"] },
          price: { type: "number" },
          pct: { type: "number" },
          window: { type: "string", enum: ["1d", "5d"] },
          ratio: { type: "number" },
          level: { type: "number" },
          ema: { type: "integer", enum: [20, 50] },
          side: { type: "string", enum: ["above", "below"] },
          edge: { type: "string", enum: ["high", "low"] },
          sentiment: { type: "string", enum: ["bullish", "bearish"] },
          move: { type: "number" },
        },
        required: ["kind"],
      },
    },
    note: {
      type: "string",
      description:
        "Short honest note. For unsupported asks: what you cannot do + the closest thing you CAN watch. For partial parses: any caveat. Empty string if the parse is clean.",
    },
  },
  required: ["supported", "conditions", "note"],
} as const;

const KINDS = new Set<AlertKind>([
  "price_cross",
  "pct_move",
  "vol_surge",
  "rsi_cross",
  "ema_cross",
  "w52_break",
  "sentiment_velocity",
  "news_event",
]);

const NEEDS_TICKER: Set<AlertKind> = new Set([
  "price_cross",
  "pct_move",
  "vol_surge",
  "rsi_cross",
  "ema_cross",
  "w52_break",
  "sentiment_velocity",
  "news_event",
]);

export function normalizeTicker(t: string | null | undefined): string | null {
  if (!t) return null;
  const c = t.toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 8);
  return c || null;
}

/** Build validated params for a kind, dropping anything nonsensical. */
function buildParams(c: ParsedCondition): AlertParams | null {
  switch (c.kind as AlertKind) {
    case "price_cross": {
      if (typeof c.price !== "number" || !Number.isFinite(c.price)) return null;
      return { op: c.op === "below" ? "below" : "above", price: c.price };
    }
    case "pct_move": {
      const pct = typeof c.pct === "number" && c.pct > 0 ? c.pct : 5;
      return { pct, window: c.window === "5d" ? "5d" : "1d" };
    }
    case "vol_surge": {
      const ratio = typeof c.ratio === "number" && c.ratio > 0 ? c.ratio : 3;
      return { ratio };
    }
    case "rsi_cross": {
      const level = typeof c.level === "number" ? c.level : c.op === "above" ? 70 : 30;
      return { op: c.op === "above" ? "above" : "below", level };
    }
    case "ema_cross":
      return { ema: c.ema === 50 ? 50 : 20, side: c.side === "below" ? "below" : "above" };
    case "w52_break":
      return { edge: c.edge === "low" ? "low" : "high" };
    case "sentiment_velocity":
      return { sentiment: c.sentiment === "bearish" ? "bearish" : "bullish", delta: 5, days: 7 };
    case "news_event":
      return typeof c.move === "number" && c.move > 0 ? { move: c.move } : {};
    default:
      return null;
  }
}

/**
 * Re-validate a SINGLE loose rule object into an insert-ready spec, recomputing
 * the label deterministically. Used on the WRITE path (create_alert_rule) so a
 * proposal echoed back by the model — or anything a model hallucinates — is
 * normalized server-side before it can touch the DB. Returns null if the object
 * is not a watchable rule (bad kind, missing required params, missing ticker).
 */
export function sanitizeRuleSpec(raw: unknown): ParsedRuleSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as ParsedCondition & { params?: Record<string, unknown> };
  const kind = r.kind as AlertKind;
  if (!KINDS.has(kind)) return null;
  // Params may arrive nested under `params` (the proposal shape) or flat.
  const p = (r.params && typeof r.params === "object" ? r.params : r) as ParsedCondition;
  const cond: ParsedCondition = { ...p, kind };
  const ticker = normalizeTicker(r.ticker ?? (p as ParsedCondition).ticker);
  if (NEEDS_TICKER.has(kind) && !ticker) return null;
  const params = buildParams(cond);
  if (!params) return null;
  return { kind, ticker, params, label: ruleLabel(kind, ticker, params) };
}

/**
 * Parse a plain-English watch request into 1–3 validated, insert-ready rule
 * specs. Never writes. Throws AlertParseError('unavailable') if no API key,
 * ('parse_failed') on any model / JSON failure.
 */
export async function parseAlertRequest(opts: {
  text: string;
  ticker?: string | null;
}): Promise<AlertParseResult> {
  const text = (opts.text || "").trim().slice(0, 500);
  const ctxTicker = normalizeTicker(opts.ticker);

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new AlertParseError("unavailable");

  let parsed: { supported: boolean; conditions: ParsedCondition[]; note: string };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 700,
        thinking: { type: "disabled" },
        system: CAPABILITY_BRIEF,
        output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
        messages: [
          {
            role: "user",
            content: ctxTicker ? `Ticker context: ${ctxTicker}. Request: ${text}` : text,
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[KaiWatch] anthropic error:", res.status, errText);
      throw new AlertParseError("parse_failed");
    }
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
    };
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (data.stop_reason === "refusal" || !textBlock?.text) {
      throw new AlertParseError("parse_failed");
    }
    parsed = JSON.parse(textBlock.text);
  } catch (e) {
    if (e instanceof AlertParseError) throw e;
    console.error("[KaiWatch] parse exception:", e);
    throw new AlertParseError("parse_failed");
  }

  // Validate + normalize the model's conditions into insert-ready rule specs. We
  // NEVER trust the model's free text for the label — we compute it ourselves via
  // ruleLabel so the wording (and the compliance framing) is deterministic.
  const rules: ParsedRuleSpec[] = [];
  for (const c of parsed.conditions || []) {
    const kind = c.kind as AlertKind;
    if (!KINDS.has(kind)) continue;
    const ticker = normalizeTicker(c.ticker) ?? ctxTicker;
    if (NEEDS_TICKER.has(kind) && !ticker) continue;
    const params = buildParams(c);
    if (!params) continue;
    rules.push({ kind, ticker, params, label: ruleLabel(kind, ticker, params) });
    if (rules.length >= 3) break; // cap a single ask at 3 linked rules
  }

  return {
    supported: rules.length > 0,
    rules,
    note: (parsed.note || "").slice(0, 400),
  };
}
