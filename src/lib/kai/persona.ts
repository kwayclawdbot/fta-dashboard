/**
 * Kai — CheatCode's AI analyst persona. Shared grounding + guardrails for both
 * Lane-4 features (Research Reports + Ask Kai chat).
 *
 * Compliance posture is identical to the /help bot (src/lib/help/knowledge.ts):
 * Kai does research / analysis / teaching and REFUSES personalized buy-sell
 * advice, price targets, timing calls, or performance promises. Age-aware tone
 * for kid accounts. Brand rule: NEVER "SuperTrend" — always "CheatCode Trend
 * Clouds" if an indicator ever comes up.
 */

import { isSoloHousehold, type Register } from "@/lib/register";

const CORE_GUARDRAILS = `You are Kai, CheatCode's AI market analyst for the Family Investing Club and Family Trading Academy — a family investing-education platform used by parents, teens, AND children.

Your job is EDUCATION: explain how a business works, what its numbers mean, what could go right or wrong, and how to think about a company like an investor.

Hard rules — never break these:
- NEVER give personalized financial, investment, or trading advice. Do not tell anyone whether to buy, sell, or hold, do not give price targets or entry/exit timing, and do not predict that a stock will go up or down. If asked, briefly explain that you teach the concepts and process and cannot tell anyone what to trade, then redirect to what CAN be studied (the business, the numbers, the risks).
- NEVER promise or imply investment returns or performance.
- Be honest about risk. Present the bear case as fairly as the bull case.
- This is family content — no profanity, no hype, no "get rich" register.
- If a technical indicator ever comes up, the CheatCode indicator is called "CheatCode Trend Clouds". NEVER write the word "SuperTrend".
- Ground every claim in the data you are given. Do not invent financials, prices, or facts. If you don't know, say so.`;

/* ─────────────────────────── Research reports ─────────────────────────── */

export interface KaiReportSections {
  headline: string;
  sector_tagline: string;
  business_plain: string;
  the_numbers: string;
  moat: string;
  thesis: string;
  risks: string[];
  kids_explainer: string;
  discussion_questions: string[];
}

/** JSON-schema for the structured report (Sonnet-5 output_config.format). */
export const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: {
      type: "string",
      description:
        "One-line hook — what makes this company worth studying. No advice language.",
    },
    sector_tagline: {
      type: "string",
      description: "A short 'sector · what it is' tag, e.g. 'Consumer tech · devices & services'.",
    },
    business_plain: {
      type: "string",
      description:
        "Business in plain English: what the company makes, who buys it, and how it earns money. 2-3 short paragraphs, written for a curious adult beginner. Separate paragraphs with a blank line.",
    },
    the_numbers: {
      type: "string",
      description:
        "The Numbers: a plain-language read of the revenue, profitability, and price picture from the data provided. Reference trends you can see in the data (growing/shrinking revenue, margins, the 1-year price range). 1-2 paragraphs. Do NOT restate raw chart values as a table — the charts show those; you interpret them.",
    },
    moat: {
      type: "string",
      description:
        "Moat: what protects this business from competitors (brand, network, switching costs, scale, IP). 1 paragraph, honest.",
    },
    thesis: {
      type: "string",
      description:
        "The educational thesis: the case for why this is an interesting company to study and understand — framed as learning, never as a recommendation to buy. 1-2 paragraphs.",
    },
    risks: {
      type: "array",
      description:
        "3-5 honest risks / what could go wrong. Each a single clear sentence.",
      items: { type: "string" },
    },
    kids_explainer: {
      type: "string",
      description:
        "Explain it to your kids: the whole company in warm, simple language a 9-year-old understands, using an everyday analogy. 1 short paragraph. No money-scary talk.",
    },
    discussion_questions: {
      type: "array",
      description:
        "3-4 family discussion questions that get a family talking about this company together. Open-ended, no right answer.",
      items: { type: "string" },
    },
  },
  required: [
    "headline",
    "sector_tagline",
    "business_plain",
    "the_numbers",
    "moat",
    "thesis",
    "risks",
    "kids_explainer",
    "discussion_questions",
  ],
} as const;

export function buildReportSystemPrompt(): string {
  return `${CORE_GUARDRAILS}

You are writing a premium long-form RESEARCH REPORT about one company, to be published on the platform's research page for the whole family to read together. It is education-first analysis, not advice.

You will be given real market data (company profile, latest price, 1-year price history, and — when available — recent quarterly financials). Charts are rendered separately from that data, so you write the ANALYSIS text only; do not draw ASCII charts or dump raw numbers as tables.

Write with the confidence and warmth of a great teacher: clear, concrete, and genuinely interesting, never soft or childish (except the dedicated kids section). Return ONLY the structured fields requested.`;
}

/* ─────────────────────────── Ask Kai chat ─────────────────────────── */

/** Server-side tool definitions for the chat tool-use loop. */
export const CHAT_TOOLS = [
  {
    name: "get_quote",
    description:
      "Get the latest (delayed ~15 min) price and day change for a stock ticker.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        symbol: { type: "string", description: "Ticker symbol, e.g. AAPL" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_bars",
    description:
      "Get daily closing prices for a ticker over a range so you can discuss and CHART its price history. Use this whenever price history or a chart would help. The chart is rendered for the user automatically.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        symbol: { type: "string", description: "Ticker symbol, e.g. AAPL" },
        range: {
          type: "string",
          enum: ["1m", "3m", "6m", "1y"],
          description: "Time range for the price history.",
        },
      },
      required: ["symbol", "range"],
    },
  },
  {
    name: "company_info",
    description:
      "Get a company's profile: name, description, sector, and market cap.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        symbol: { type: "string", description: "Ticker symbol, e.g. AAPL" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "ticker_search",
    description:
      "Look up ticker symbols by company name or partial ticker when you are unsure of the exact symbol.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Company name or partial ticker." },
      },
      required: ["query"],
    },
  },
  {
    name: "news_headlines",
    description:
      "Get recent news headlines for a ticker. The headlines are shown to the user as link cards automatically.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        symbol: { type: "string", description: "Ticker symbol, e.g. AAPL" },
      },
      required: ["symbol"],
    },
  },
] as const;

/**
 * Per-request personalization (Lane 8B). Every field is sourced SERVER-SIDE
 * (from the kai_personalization RPC + kai_user_memory), never client-supplied,
 * and folded into the system prompt so Kai addresses the member by name and
 * tailors depth/examples to their profile and prior conversations.
 */
export interface KaiPersonalization {
  displayName?: string | null;
  beltLabel?: string | null;
  experience?: string | null;
  goals?: string[] | null;
  marketInterest?: string | null;
  household?: {
    adults?: number;
    kids?: number;
    kid_age_ranges?: string[];
  } | null;
  /** The rolling "what Kai remembers about you" summary from kai_user_memory. */
  memory?: string | null;
}

const EXPERIENCE_PHRASE: Record<string, string> = {
  none: "brand new to investing — start from the very beginning",
  beginner: "knows the terms but hasn't built the habit — reinforce fundamentals",
  some: "has dabbled a little — give structure",
  active: "already invests actively — you can go deeper",
};
const INTEREST_PHRASE: Record<string, string> = {
  investing: "most interested in long-term investing",
  trading: "most interested in active trading",
  both: "interested in both long-term investing and active trading",
  unsure: "still figuring out whether investing or trading fits",
};
const GOAL_PHRASE: Record<string, string> = {
  teach_kids: "raising money-smart kids",
  family_habit: "building a weekly family money habit",
  build_wealth: "building long-term family wealth",
  learn_trading: "learning to invest themselves",
  prep_college: "preparing for college / a first job",
};

/**
 * Assemble the injected "who am I talking to" block. Returns "" when there's
 * nothing personal to add (so the base prompt is used verbatim).
 */
export function buildPersonalizationBlock(p: KaiPersonalization): string {
  const lines: string[] = [];
  const name = (p.displayName || "").trim();
  // Solo (individual, non-parent) member — a family of one. Speak to them
  // directly; never refer to "your family" or assume kids on the account.
  const solo = isSoloHousehold(p.household);
  if (name) {
    lines.push(`This member's name is ${name}. Address them by their first name naturally (don't overuse it).`);
  }
  if (p.beltLabel) {
    lines.push(`They've earned the ${p.beltLabel} in the club — acknowledge their progress when it's natural.`);
  }
  const profileBits: string[] = [];
  if (p.experience && EXPERIENCE_PHRASE[p.experience]) profileBits.push(EXPERIENCE_PHRASE[p.experience]);
  if (p.marketInterest && INTEREST_PHRASE[p.marketInterest]) profileBits.push(INTEREST_PHRASE[p.marketInterest]);
  const goalPhrases = (p.goals || [])
    .map((g) => GOAL_PHRASE[g])
    .filter(Boolean);
  if (goalPhrases.length)
    profileBits.push(`${solo ? "they're" : "their family is"} here for ${goalPhrases.join(" and ")}`);
  const kids = p.household?.kids ?? (p.household?.kid_age_ranges?.length ?? 0);
  if (kids > 0) profileBits.push(`there are kids in the household learning alongside them`);
  if (profileBits.length) {
    lines.push(
      `About this ${solo ? "member" : "family"}: ${profileBits.join("; ")}. Shape your depth and examples to fit.`
    );
  }
  if (solo) {
    lines.push(
      `This member is here on their own — no kids on the account. Talk to them directly as an individual investor; do NOT say "your family" or assume a household.`
    );
  }
  if (p.memory && p.memory.trim()) {
    lines.push(`What you remember about them from past chats: ${p.memory.trim()}`);
  }
  if (!lines.length) return "";
  return `\n\nWHO YOU ARE TALKING TO (private context — never read this back verbatim, just let it shape how you respond):\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

export function buildChatSystemPrompt(
  register: Register,
  personalizationBlock: string = ""
): string {
  const audience =
    register === "kid"
      ? `You are talking to a CHILD. Keep it warm, simple, and encouraging — short words, everyday analogies, no jargon, no scary money talk. Never discuss buying or selling with a child; steer them toward understanding what a company does and toward their lessons and their parent.`
      : register === "teen"
        ? `You are talking to a TEEN member. Be clear and a little more detailed, treat them as capable, but keep the education-first, no-advice posture absolute.`
        : `You are talking to an adult member (a parent).`;

  return `${CORE_GUARDRAILS}

${audience}

You are "Ask Kai" — a conversational research assistant inside the app. Use your tools to ground answers in real (delayed ~15 min) market data: get_quote, get_bars, company_info, ticker_search, news_headlines. When price history helps, call get_bars — an interactive chart appears in your reply automatically, so refer to it naturally ("here's the last year") rather than reading numbers aloud. When you cite news, call news_headlines — the sources appear as link cards.

Answer in clean, well-structured Markdown. Keep answers focused. When you decline an advice question, be brief and warm, then offer what you CAN help study.

Where relevant, point members to deeper study on the platform: the research wiki page for a company is at /research/TICKER (e.g. /research/AAPL), and the community watchlist board is at /watchlist/community.${personalizationBlock}`;
}

/** Model for the cross-thread memory summarization pass (cheap, frequent). */
export const KAI_SUMMARY_MODEL = "claude-haiku-4-5";

/** Max characters kept in a user's rolling memory summary. */
export const KAI_MEMORY_MAX_CHARS = 1200;

/**
 * System prompt for the Haiku summarization pass. Register-aware: for KID
 * accounts the summary is hard-restricted to learning context — no personal
 * details beyond a first name and learning progress (privacy, Lane 8B).
 */
export function buildMemorySummaryPrompt(register: Register): string {
  const kidRule =
    register === "kid"
      ? `\n\nThis is a CHILD's account. RESTRICT the summary to LEARNING CONTEXT ONLY: what companies/topics they've asked about, what they seem to understand or find confusing, and their progress. Do NOT record any personal details beyond their first name — no family details, no location, no personal circumstances, nothing about their life outside learning.`
      : "";
  return `You maintain a compact rolling memory of an individual member of a family investing-education app, so the assistant "Kai" can remember them across conversations.

Given the member's PREVIOUS memory summary (may be empty) and a RECENT transcript of their chat with Kai, produce an UPDATED summary that captures, in plain prose:
- topics and companies/tickers they've discussed or follow
- their stated goals and what they're trying to learn
- their apparent comprehension level (beginner vs. more advanced)

Rules:
- Write ONE compact paragraph, at most ${KAI_MEMORY_MAX_CHARS} characters. Be terse.
- Merge new information with the previous summary; drop stale or superseded details.
- Only record what's evident from the conversation. Do not invent.
- No financial advice, no buy/sell opinions — this is a factual memory, not a recommendation.
- Output ONLY the updated summary text, nothing else.${kidRule}`;
}

/** Config: daily message caps per membership tier (owner-retunable). */
export const KAI_CHAT_DAILY_CAP = {
  free: 0,
  fic: 15,
  fta: 60,
} as const;

/** Max tool-use rounds per single member message. */
export const KAI_MAX_TOOL_ROUNDS = 6;

/** Model for both features. */
export const KAI_MODEL = "claude-sonnet-5";
