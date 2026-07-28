import type { ChallengeDay } from "@/lib/challenge/types";

/* ══════════════════════════════════════════════════════════════════════════
   THE FIVE DAY MISSIONS — the static half of the contract.

   EVERYTHING THE SERVER OWNS IS ABSENT FROM THIS FILE. Titles, headlines, body
   copy, XP amounts, estimates, tags, unlock/session moments and the day's state
   all come from `challenge_state().days[]` (migration 199's `challenge_days`).
   What lives here is only what a database row cannot carry: the drawn medallion,
   the script line above the headline, the shape of each day's exercise, and the
   brand→ticker dictionary Day 1 needs.

   The canvas draws "Sept 1–5 · MON…FRI". The cohort actually runs Wed Sep 2 →
   Sun Sep 6, so NO weekday and NO date is written down anywhere in this lane —
   every one is formatted from `unlock_at` / `session_at` in the cohort's tz.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── per-day drawn identity ───────────────────────────────────────────────── */

export interface DayFace {
  /** The medallion glyph — the big drawn object at the top of the brief. */
  glyph: string;
  /** The small badge clipped to the medallion's corner. */
  badge: string;
  /** The handwritten line above the headline. */
  script: string;
  /** The medallion's tint. Kai blue ONLY on the day Kai is actually the tool. */
  tone: "accent" | "kai" | "sentiment";
  /** The step-2 label on the rail, e.g. "Do — pick from your life". */
  doLabel: string;
  /** The step-3 label on the rail. */
  shareLabel: string;
  /** The brief's CTA. */
  briefCta: string;
  /**
   * How many TRAILING words of `brief_headline` carry the drawn orange mark.
   * The headline itself is server copy, so the emphasis has to be expressed as a
   * rule over it rather than as a second hardcoded string that could drift out
   * of sync the first time the owner edits the row.
   */
  markWords: number;
}

export const DAY_FACE: Record<number, DayFace> = {
  1: {
    glyph: "📋",
    badge: "✦",
    script: "tonight's mission",
    tone: "accent",
    doLabel: "Do — pick from your life",
    shareLabel: "Share — the artifact",
    briefCta: "Start step 1",
    markWords: 2,
  },
  2: {
    glyph: "🐋",
    badge: "🔍",
    script: "tonight's mission",
    tone: "kai",
    doLabel: "Do — the guided dig",
    shareLabel: "Share — your first take",
    briefCta: "Start the four questions",
    markWords: 2,
  },
  3: {
    glyph: "👥",
    badge: "📈",
    script: "tonight's mission",
    tone: "sentiment",
    doLabel: "Do — vote your conviction",
    shareLabel: "Share — where the room landed",
    briefCta: "See the room's watchlist",
    markWords: 3,
  },
  4: {
    glyph: "🔭",
    badge: "⚗",
    script: "tonight's mission",
    tone: "accent",
    doLabel: "Do — screen, then trade it",
    shareLabel: "Share — the trade card",
    briefCta: "Build my first screen",
    markWords: 3,
  },
  5: {
    glyph: "🧩",
    badge: "🏁",
    script: "the final mission",
    tone: "accent",
    doLabel: "Do — pick your loop",
    shareLabel: "Share — finisher unlocked",
    briefCta: "Build my routine",
    markWords: 2,
  },
};

export function faceFor(day: ChallengeDay): DayFace {
  return DAY_FACE[day.day_no] ?? DAY_FACE[1];
}

/**
 * Split a server-authored headline into its plain head and its marked tail.
 * The canvas paints the closing clause of every mission headline orange; doing
 * it by a word count over the real string means the mark survives an edit to
 * `challenge_days.brief_headline` instead of silently marking the wrong words.
 */
export function splitHeadline(
  text: string,
  markWords: number
): { head: string; mark: string | undefined } {
  const words = text.trim().split(/\s+/);
  if (markWords <= 0 || words.length <= markWords) return { head: text, mark: undefined };
  return {
    head: words.slice(0, words.length - markWords).join(" "),
    mark: words.slice(words.length - markWords).join(" "),
  };
}

/* ── DAY 1 — the brand dictionary ─────────────────────────────────────────
   "Tap what you used this week" only works if the translation from a thing you
   own to a thing you can hold is TRUE. Every mapping below is a company that
   actually owns the brand. Where the brand's maker is private (OpenAI), the
   note says so out loud rather than quietly pointing at a proxy — that note IS
   the lesson the canvas draws next to the ChatGPT row. */

export interface BrandSeed {
  key: string;
  emoji: string;
  label: string;
  ticker: string;
  /** Shown on the row: "from iPhone". */
  from: string;
  /** Only where the mapping is not one-to-one. Rendered as a stated note. */
  note?: string;
}

export const BRANDS: BrandSeed[] = [
  { key: "iphone", emoji: "📱", label: "iPhone", ticker: "AAPL", from: "iPhone" },
  { key: "netflix", emoji: "🎬", label: "Netflix", ticker: "NFLX", from: "Netflix" },
  { key: "amazon", emoji: "📦", label: "Amazon", ticker: "AMZN", from: "Amazon" },
  { key: "nike", emoji: "👟", label: "Nike", ticker: "NKE", from: "Nike" },
  { key: "starbucks", emoji: "☕", label: "Starbucks", ticker: "SBUX", from: "Starbucks" },
  {
    key: "xbox",
    emoji: "🎮",
    label: "Xbox",
    ticker: "MSFT",
    from: "Xbox",
    note: "Xbox is Microsoft's — so it lands on the same ticker as Windows and Office.",
  },
  { key: "tesla", emoji: "🚗", label: "Tesla", ticker: "TSLA", from: "Tesla" },
  {
    key: "chatgpt",
    emoji: "🤖",
    label: "ChatGPT",
    ticker: "MSFT",
    from: "ChatGPT",
    note: "OpenAI, which makes ChatGPT, is not publicly traded. Microsoft is its largest investor and runs the compute behind it — that sideways step is how investors reach a private company.",
  },
  { key: "visa", emoji: "💳", label: "Visa", ticker: "V", from: "Visa" },
  { key: "disney", emoji: "🏰", label: "Disney+", ticker: "DIS", from: "Disney+" },
  { key: "target", emoji: "🎯", label: "Target", ticker: "TGT", from: "Target" },
  { key: "costco", emoji: "🛒", label: "Costco", ticker: "COST", from: "Costco" },
  {
    key: "youtube",
    emoji: "▶️",
    label: "YouTube",
    ticker: "GOOGL",
    from: "YouTube",
    note: "YouTube is Alphabet's — the same company as Google Search.",
  },
  {
    key: "instagram",
    emoji: "📸",
    label: "Instagram",
    ticker: "META",
    from: "Instagram",
    note: "Instagram and WhatsApp are both Meta's.",
  },
  { key: "spotify", emoji: "🎧", label: "Spotify", ticker: "SPOT", from: "Spotify" },
  { key: "uber", emoji: "🚕", label: "Uber", ticker: "UBER", from: "Uber" },
  { key: "doordash", emoji: "🥡", label: "DoorDash", ticker: "DASH", from: "DoorDash" },
  { key: "airbnb", emoji: "🏠", label: "Airbnb", ticker: "ABNB", from: "Airbnb" },
  { key: "chipotle", emoji: "🌯", label: "Chipotle", ticker: "CMG", from: "Chipotle" },
  { key: "roblox", emoji: "🧱", label: "Roblox", ticker: "RBLX", from: "Roblox" },
  { key: "mcdonalds", emoji: "🍟", label: "McDonald's", ticker: "MCD", from: "McDonald's" },
  { key: "coke", emoji: "🥤", label: "Coca-Cola", ticker: "KO", from: "Coca-Cola" },
];

/** Every ticker Day 1 can possibly produce — the page seeds prices for these. */
export const BRAND_TICKERS: string[] = Array.from(new Set(BRANDS.map((b) => b.ticker)));

export const DAY1_MIN_PICKS = 5;

/* ── DAY 2 — the four questions ───────────────────────────────────────────
   The canvas draws them as a numbered list on the brief and as a four-stop
   progress ledger on the exercise. They are the artifact: a research card is
   these four answers in the member's own words. */

export interface ResearchQuestion {
  key: "sells" | "money" | "rivals" | "worry";
  n: number;
  short: string;
  prompt: string;
  helper: string;
  placeholder: string;
}

export const RESEARCH_QUESTIONS: ResearchQuestion[] = [
  {
    key: "sells",
    n: 1,
    short: "Sells",
    prompt: "What does this company actually sell?",
    helper:
      "In the plainest words you have. If you cannot say it in one line, that is the finding.",
    placeholder: "The chips almost every AI product runs on.",
  },
  {
    key: "money",
    n: 2,
    short: "Money",
    prompt: "How does the money come in?",
    helper:
      "One sale, or the same customer every month? One product, or twenty? Concentration is not automatically bad — it is just something you should know.",
    placeholder: "Mostly one product line sold to a handful of very large buyers.",
  },
  {
    key: "rivals",
    n: 3,
    short: "Rivals",
    prompt: "Who is trying to beat them?",
    helper:
      "Name someone. Every company has a rival, and the ones with no obvious rival are the interesting cases.",
    placeholder: "Direct competitors, plus their own biggest customers building in-house.",
  },
  {
    key: "worry",
    n: 4,
    short: "Risks",
    prompt: "What would make you worry?",
    helper:
      "The thing that, if it happened, would change your mind. Writing it down now is what makes it useful later.",
    placeholder: "If their largest customers stopped buying and started building.",
  },
];

/* ── DAY 4 — the screen ───────────────────────────────────────────────────
   Three filters, one shortlist, one practice rep. The canvas labels its filters
   "Revenue +20%/yr · Profitable · Signal > 60%" — none of which exist in
   `screener_metrics`, and a filter chip that does not filter is a dead control.
   These five DO exist as columns, so the match count under them is a real
   count of real rows. */

export interface ScreenFilter {
  key: string;
  label: string;
  sub: string;
}

export const SCREEN_FILTERS: ScreenFilter[] = [
  { key: "up_1m", label: "Up over the last month", sub: "1-month change above zero" },
  { key: "above_50", label: "Above its 50-day average", sub: "Trading over the 50-day line" },
  { key: "near_high", label: "Near its 52-week high", sub: "Within 15% of the high" },
  { key: "volume_hot", label: "Volume running hot", sub: "Above its own 20-day average" },
  { key: "not_stretched", label: "Not overbought", sub: "RSI under 70" },
];

export const SCREEN_MIN_FILTERS = 3;
export const PRACTICE_SIZE_USD = 1_000;

/* ── DAY 5 — the weekly loop ──────────────────────────────────────────────
   Five skills, one per weekday, 55 minutes total. The skill list is fixed (it
   IS the week they just ran); the weekday assignment is the member's. */

export interface RoutineSkill {
  key: string;
  emoji: string;
  label: string;
  fromDay: number;
  minutes: number;
  defaultDay: number; // 1 = Monday … 5 = Friday
}

export const ROUTINE_SKILLS: RoutineSkill[] = [
  { key: "watchlist", emoji: "📋", label: "Watchlist review", fromDay: 1, minutes: 5, defaultDay: 1 },
  { key: "research", emoji: "🐋", label: "One research card", fromDay: 2, minutes: 15, defaultDay: 2 },
  { key: "community", emoji: "👥", label: "Community watchlist + vote", fromDay: 3, minutes: 10, defaultDay: 3 },
  { key: "screen", emoji: "🔭", label: "Run my screen", fromDay: 4, minutes: 10, defaultDay: 4 },
  { key: "practice", emoji: "🧪", label: "One practice rep + share a take", fromDay: 5, minutes: 15, defaultDay: 5 },
];

export const WEEKDAYS = [
  { n: 1, short: "MON", label: "Monday" },
  { n: 2, short: "TUE", label: "Tuesday" },
  { n: 3, short: "WED", label: "Wednesday" },
  { n: 4, short: "THU", label: "Thursday" },
  { n: 5, short: "FRI", label: "Friday" },
  { n: 6, short: "SAT", label: "Saturday" },
  { n: 7, short: "SUN", label: "Sunday" },
] as const;

/* ── the shape a Do step hands to a Share step ────────────────────────────
   The Do payload is written to `challenge_step_completions.payload` by
   `challenge_complete_step`, so a member who closes the tab and comes back gets
   their own work back — the share screen re-hydrates from the server rather
   than from a client memory that no longer exists. */

export interface Day1Payload {
  picks: {
    brand: string;
    ticker: string;
    company: string | null;
    price: number | null;
    chg: number | null;
  }[];
}

export interface Day2Payload {
  ticker: string;
  company: string | null;
  answers: Partial<Record<ResearchQuestion["key"], string>>;
}

export interface Day3Payload {
  votes: { ticker: string; company: string | null; stance: "bull" | "bear" | "neutral" }[];
}

export interface Day4Payload {
  filters: string[];
  matches: number;
  ticker: string;
  company: string | null;
  size: number;
  entry: number | null;
  reason: string;
}

export interface Day5Payload {
  loop: { key: string; label: string; emoji: string; weekday: number; minutes: number }[];
  total_minutes: number;
  reminder: boolean;
}

export type DoPayload =
  | Day1Payload
  | Day2Payload
  | Day3Payload
  | Day4Payload
  | Day5Payload
  | Record<string, never>;

/* ── seeded server data ───────────────────────────────────────────────────
   Everything below is READ from a real table on the server and passed into the
   client board. A null value renders an honest absence; it is never replaced
   with a plausible-looking stand-in. */

export interface Quote {
  ticker: string;
  name: string | null;
  price: number | null;
  chg: number | null;
  chg1m?: number | null;
  chg3m?: number | null;
  distHigh?: number | null;
  rsi?: number | null;
  sector?: string | null;
  mcap?: number | null;
  ema50?: string | null;
  volRatio?: number | null;
}

export interface CohortArtifact {
  userId: string;
  name: string;
  avatar: string | null;
  ticker: string | null;
  company: string | null;
  body: string | null;
  tickers: string[];
  stance: string | null;
}

export interface RoomEntry {
  ticker: string;
  company: string;
  blurb: string | null;
  quote: Quote | null;
  bull: number;
  bear: number;
  neutral: number;
  votes: number;
}

export interface DaySeed {
  /** Prices for whatever the day needs them for. Keyed by ticker. */
  quotes: Record<string, Quote>;
  /** The screener universe (Day 4 only). */
  universe: Quote[];
  /** The community board with real vote tallies (Day 3 only). */
  room: RoomEntry[];
  /** What other members made on this day. */
  cohort: CohortArtifact[];
  /** Real count of artifacts posted for this day, all-time. */
  postedCount: number | null;
  /** The member's own artifacts, days 1-4, for the Day-5 recap. */
  mine: Record<number, CohortArtifact>;
  /** The `do` payload the member already saved, if any. */
  doPayload: DoPayload | null;
  /** The member's own artifact for THIS day, if it exists. */
  myArtifact: CohortArtifact | null;
  /** Display name + avatar for the artifact preview card. */
  me: { name: string; avatar: string | null };
}

/* ── formatting ───────────────────────────────────────────────────────────── */

export function fmtDay(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
}

export function fmtWeekday(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", timeZone: tz });
}

/** USD, no cents above $1,000 — the canvas's own measure. */
export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 1000
    ? `$${Math.round(n).toLocaleString()}`
    : `$${n.toFixed(2)}`;
}

/** Signed percent. Callers pair it with text-price-up / text-price-down. */
export function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}%`;
}

/** The price-token class for a delta. Never used for anything that is not price. */
export function priceTone(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "text-soft";
  return n > 0 ? "text-price-up" : "text-price-down";
}
