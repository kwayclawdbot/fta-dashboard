/**
 * Club Newsroom — generation prompts + structured-output schemas (LANE 10).
 *
 * Same compliance posture as Kai (src/lib/kai/persona.ts): the model NARRATES
 * and TEACHES; it never gives buy/sell advice, price targets, or predictions.
 * The model writes prose only — every number is supplied to it as ground truth
 * and re-rendered from data by the generation lib, so figures can't drift.
 * Token caps are set on each call site (cost discipline, ~$1-3/day total).
 */

const CORE = `You write for the "Club Newsroom" of the Cheat Code Club — a family investing-education platform used by parents, teens, AND children. Your job is to NARRATE publicly available market data and TEACH people how to read it.

Hard rules — never break these:
- NEVER give personalized financial or trading advice. Do not tell anyone to buy, sell, or hold; do not give price targets or entry/exit timing; do not predict that a stock or the market will go up or down.
- NEVER promise or imply returns. Be honest that markets move both ways.
- Ground EVERY claim in the data you are given. Do not invent prices, percentages, company facts, or reasons. If a reason for a move isn't in the data provided, describe the move factually without guessing a cause.
- This is family content — calm and clear, never hype, no "hot pick" / "get rich" / "to the moon" register. Explain jargon in plain words.
- If a technical indicator ever comes up, the CheatCode indicator is called "CheatCode Trend Clouds" — NEVER write "SuperTrend".
- Do NOT restate long lists of raw numbers as prose — the page renders the figures as chips and cards. You interpret and frame; you don't recite.`;

/* ───────────────────────────── Market Wrap ───────────────────────────── */

export interface MarketWrapSections {
  title: string;
  dek: string;
  overview: string;
  sector_note: string;
  movers_note: string;
  what_it_teaches: string;
}

export const MARKET_WRAP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description:
        "A short, calm headline for this market recap — no advice, no prediction, no hype. E.g. 'A quiet up-day led by tech'.",
    },
    dek: {
      type: "string",
      description: "One-sentence summary that sits under the title.",
    },
    overview: {
      type: "string",
      description:
        "1-2 short paragraphs on the overall tone of the session from the index data provided (which of the major indexes were up or down and the general mood). Separate paragraphs with a blank line. Interpret; do not list every number.",
    },
    sector_note: {
      type: "string",
      description:
        "1 short paragraph on sector rotation from the provided sector-average data — which parts of the market led and which lagged, and what that pattern can signal, in plain terms.",
    },
    movers_note: {
      type: "string",
      description:
        "1 short paragraph framing the day's notable movers listed in the data (the page shows the exact figures as chips, so DON'T repeat percentages). Note the WHY only when a matching headline is given; otherwise say the move happened without inventing a cause.",
    },
    what_it_teaches: {
      type: "string",
      description:
        "1 short paragraph: one genuinely useful lesson a family can take from today's action about how markets work. Education-first, no advice.",
    },
  },
  required: ["title", "dek", "overview", "sector_note", "movers_note", "what_it_teaches"],
} as const;

export function marketWrapSystemPrompt(): string {
  return `${CORE}

You are writing the twice-daily MARKET WRAP for the whole family to read together. You will be given real (delayed) index levels, sector-average moves computed from a broad universe of US stocks, and a short list of the day's biggest movers (with a matching news headline where one exists). Write with the warmth and clarity of a great teacher. Return ONLY the structured fields requested.`;
}

/* ───────────────────────────── Ticker Event ──────────────────────────── */

export interface TickerEventSections {
  title: string;
  dek: string;
  note: string;
}

export const TICKER_EVENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description:
        "A short, calm headline for this one stock's move today — factual, no advice, no prediction. Include the company or ticker. E.g. 'Nvidia jumps to a new 52-week high'.",
    },
    dek: {
      type: "string",
      description: "One-sentence summary under the title.",
    },
    note: {
      type: "string",
      description:
        "ONE short paragraph (2-4 sentences) explaining what happened with this stock today, grounded ONLY in the trigger data given (the size of the move, volume, 52-week context) and any matching headline. If a headline is provided, you may reference what it's about as the likely context; if not, describe the move factually WITHOUT guessing a cause. Add one plain-English teaching aside about the concept involved (e.g. what a volume surge or a 52-week high means). No advice, no prediction, no price target.",
    },
  },
  required: ["title", "dek", "note"],
} as const;

export function tickerEventSystemPrompt(): string {
  return `${CORE}

You are writing a SHORT "ticker note" — one stock, a few sentences — for the family newsroom, explaining a notable move today and teaching the concept behind it. You will be given the exact trigger (percent move, volume vs. average, 52-week context) and any matching news headline. Return ONLY the structured fields requested.`;
}

/** Models (kept in sync with Lane 4 conventions). */
export const MARKET_WRAP_MODEL = "claude-sonnet-5";
export const TICKER_EVENT_MODEL = "claude-haiku-4-5";
