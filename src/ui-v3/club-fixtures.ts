/**
 * v3 design-review fixtures. Rich, realistic data for BOTH scale states so the
 * page can be reviewed fully alive before /api/club/* lands.
 *
 * VENDORED into the v3 tree. This began life as `src/lib/clubhome/fixtures.ts`,
 * which main deleted when it retired Changed My Mind and the demo data behind
 * it. v3's anonymous/preview path still needs a structural fixture source, so
 * the file moved here rather than being resurrected in src/lib — that keeps
 * main's retirement of the old ClubHome v2 demo intact and leaves v3 owning the
 * only remaining copy. It carries no CMM data (the deleted file never had any).
 * Types still come from `@/lib/clubhome/contract`, which main kept and which is
 * pure type declarations, so the import wall is satisfied.
 *
 * These are FIXTURES ONLY. They are reachable exclusively when the fixtures
 * guard passes (dev / vercel preview) — never for a real user in production
 * (see client.ts › fixturesAllowed). No fabricated stat is ever rendered from a
 * real endpoint; that path uses the live client + founding-era fallbacks.
 *
 * Avatars are intentionally URL-less → the app <Avatar> renders warm initials
 * (no external photos: honors the brand register's no-people-photography rule
 * and keeps the artifact CSP-clean).
 */

import type { ClubData, ClubScale, CollectiveAvatar } from "@/lib/clubhome/contract";

function avatars(names: string[]): CollectiveAvatar[] {
  return names.map((name, i) => ({ id: `fx-${i}`, name, url: null }));
}

const CROWD = avatars([
  "Marcus Bell", "Priya Nair", "Devon Cole", "Sana Okafor", "Theo Marsh",
  "Lena Vogt", "Ravi Sethi", "Nora Quinn", "Jonah Reed", "Amara Diaz",
  "Kit Sullivan", "Elle Barron", "Owen Frey", "Mira Tanaka", "Cyrus Hale",
]);

const SPARK_UP = [41, 43, 42, 45, 44, 48, 47, 52, 55, 61];
const SPARK_STEP = [30, 31, 33, 32, 36, 38, 44, 47, 46, 51];
const SPARK_SWING = [58, 55, 50, 47, 49, 44, 46, 41, 45, 42];

// ── AT-SCALE — the network at full strength (mirrors the owner mock) ──────────
const SCALE: ClubData = {
  pulse: {
    updatedAt: "8:32 AM",
    signals: [
      { kind: "researched", ticker: "NVDA", company: "Nvidia", headline: "#1 most researched", detail: "38% more research vs yesterday", direction: "up", spark: SPARK_UP },
      { kind: "watchers", ticker: "PLTR", company: "Palantir", headline: "216 new watchers", detail: "added to watchlists today", direction: "up", spark: SPARK_STEP },
      { kind: "sentiment", ticker: "TSLA", company: "Tesla", headline: "Sentiment shifting", detail: "Bull 42% → 58% this week", direction: "up", spark: SPARK_SWING },
      { kind: "pattern", ticker: "AMD", company: "Advanced Micro Devices", headline: "Kai spotted a pattern", detail: "Similar to the May '23 setup", direction: "up", spark: SPARK_UP },
    ],
  },
  collective: {
    connectedMinds: 12482,
    actionsToday: 4312,
    floorMet: true,
    breakdown: { watches: 1842, reactions: 2716, comments: 1203, saves: 892, kaiQuestions: 411 },
    avatars: CROWD,
  },
  invite: {
    code: "ALEX-K7Q2",
    url: "https://cheatcode.com/r/ALEX-K7Q2",
    activatedCount: 7,
    xpEarned: 700,
    floorMet: true,
    leaderboard: [
      { name: "Priya Nair", count: 24 },
      { name: "Marcus Bell", count: 19 },
      { name: "You", count: 7, you: true },
      { name: "Devon Cole", count: 6 },
      { name: "Sana Okafor", count: 5 },
    ],
  },
  brief: {
    updatedAt: "8:32 AM",
    source: "live",
    available: true,
    items: [
      { ticker: "NVDA", kind: "research", text: "Research volume spiked 38% on Blackwell demand signals." },
      { ticker: "TSLA", kind: "sentiment", text: "Sentiment shifted bullish as FSD v12.4 rollout gains traction." },
      { ticker: "PLTR", kind: "watchers", text: "New watchers up 216 after the AIPCon investor update." },
      { ticker: "AMD", kind: "pattern", text: "Flagged in a Kai pattern similar to the May '23 breakout." },
    ],
  },
  trending: {
    updatedAt: "8:32 AM",
    rows: [
      { rank: 1, ticker: "NVDA", company: "Nvidia", score: 98, change: 12 },
      { rank: 2, ticker: "PLTR", company: "Palantir", score: 92, change: 8 },
      { rank: 3, ticker: "TSLA", company: "Tesla", score: 88, change: 6 },
      { rank: 4, ticker: "AMD", company: "Advanced Micro Devices", score: 86, change: 5 },
      { rank: 5, ticker: "SMCI", company: "Super Micro", score: 74, change: 10 },
      { rank: 6, ticker: "AMZN", company: "Amazon", score: 72, change: -2 },
      { rank: 7, ticker: "SOFI", company: "SoFi", score: 68, change: 3 },
    ],
  },
  thinking: {
    lead: {
      id: "t1", ticker: "NVDA", company: "Nvidia",
      title: "Blackwell inflection: why Nvidia's next leg is just beginning",
      author: { name: "InsightSeeker", badge: "Top researcher", verified: true },
      saves: 89, comments: 45, votes: 241, href: "/research/NVDA", editorPick: true,
    },
    secondary: [
      { id: "t2", ticker: "PLTR", company: "Palantir", title: "Palantir's moat is getting wider", author: { name: "QuantsOnly", verified: true }, saves: 61, comments: 32, votes: 187, href: "/research/PLTR" },
      { id: "t3", ticker: "AMD", company: "Advanced Micro Devices", title: "AMD's hidden catalyst: the MI300 adoption curve", author: { name: "RedChipRookie" }, saves: 47, comments: 28, votes: 154, href: "/research/AMD" },
      { id: "t4", ticker: "SOFI", company: "SoFi", title: "SoFi is quietly turning the profitability corner", author: { name: "LongTermLiz", badge: "Coach" }, saves: 38, comments: 19, votes: 128, href: "/research/SOFI" },
    ],
  },
  debate: {
    id: "d1",
    question: "Is Tesla still a growth stock?",
    counts: { yes: 2412, no: 1480 },
    userVote: null,
    floorMet: true,
    participants: CROWD.slice(0, 6),
  },
  foryou: {
    items: [
      { ticker: "NVDA", company: "Nvidia", price: 126.78, changePct: 1.93, delta: "12 new pieces of research this week", kind: "research" },
      { ticker: "TSLA", company: "Tesla", price: 177.96, changePct: -0.57, delta: "Sentiment trending up on your watched name", kind: "sentiment" },
      { ticker: "PLTR", company: "Palantir", price: 24.31, changePct: 3.31, delta: "216 new watchers today", kind: "watchers" },
      { ticker: "AMD", company: "Advanced Micro Devices", price: 164.32, changePct: 1.16, delta: "Kai pattern detected on your watchlist", kind: "pattern" },
    ],
  },
  people: {
    members: [
      { id: "p1", name: "TechTactician", avatar: null, tags: ["Semis", "Deep dives"], reason: "12 research pieces this month, most-saved in the Club", href: "/u/techtactician", followers: 24100 },
      { id: "p2", name: "ValueHawk", avatar: null, tags: ["Value", "Balance sheets"], reason: "Called the SoFi turn three weeks early", href: "/u/valuehawk", followers: 18700 },
      { id: "p3", name: "DataDive", avatar: null, tags: ["Data-driven", "Screens"], reason: "Shares the screens behind every idea", href: "/u/datadive", followers: 15300 },
      { id: "p4", name: "LongTermLiz", avatar: null, tags: ["Long horizon", "Coach"], reason: "Patient theses the room keeps coming back to", href: "/u/longtermliz", followers: 12900 },
      { id: "p5", name: "ChartNerd", avatar: null, tags: ["Technicals", "Levels"], reason: "Clean level maps on every trending ticker", href: "/u/chartnerd", followers: 11800 },
    ],
  },
};

// ── FOUNDING ERA — below floor. Cold start = motivation, not a sad empty page.
// Numbers that would embarrass stay non-numeric; the invite engine takes center.
const FOUNDING: ClubData = {
  pulse: {
    updatedAt: "8:32 AM",
    signals: [
      { kind: "researched", ticker: "NVDA", company: "Nvidia", headline: "The Club is watching", detail: "Nvidia leads early research", direction: "up", spark: SPARK_UP },
      { kind: "watchers", ticker: "PLTR", company: "Palantir", headline: "Getting attention", detail: "New on founding watchlists", direction: "up", spark: SPARK_STEP },
      { kind: "sentiment", ticker: "AMD", company: "Advanced Micro Devices", headline: "First reads in", detail: "Early members leaning bullish", direction: "up", spark: SPARK_SWING },
    ],
  },
  collective: {
    connectedMinds: 23,
    actionsToday: 41,
    floorMet: false,
    breakdown: { watches: 18, reactions: 9, comments: 6, saves: 5, kaiQuestions: 3 },
    avatars: CROWD.slice(0, 5),
  },
  invite: {
    code: "ALEX-K7Q2",
    url: "https://cheatcode.com/r/ALEX-K7Q2",
    activatedCount: 2,
    xpEarned: 200,
    floorMet: false,
    leaderboard: [
      { name: "You", count: 2, you: true },
      { name: "Priya Nair", count: 1 },
    ],
  },
  brief: {
    updatedAt: "8:32 AM",
    source: "derived",
    available: true,
    items: [
      { ticker: "NVDA", kind: "research", text: "Nvidia is the most-read name among founding members." },
      { ticker: "PLTR", kind: "watchers", text: "Palantir was just added to a founding watchlist." },
      { kind: "news", text: "Three new members joined the Club since your last check-in." },
    ],
  },
  trending: {
    updatedAt: "8:32 AM",
    rows: [
      { rank: 1, ticker: "NVDA", company: "Nvidia", score: 34, change: 6 },
      { rank: 2, ticker: "AMD", company: "Advanced Micro Devices", score: 29, change: 4 },
      { rank: 3, ticker: "PLTR", company: "Palantir", score: 21, change: 3 },
    ],
  },
  thinking: {
    lead: {
      id: "t1", ticker: "NVDA", company: "Nvidia",
      title: "Why I started my founding research with Nvidia",
      author: { name: "InsightSeeker", badge: "Founding member", verified: true },
      saves: 4, comments: 2, votes: 9, href: "/research/NVDA", editorPick: true,
    },
    secondary: [
      { id: "t2", ticker: "AMD", company: "Advanced Micro Devices", title: "A first look at AMD's data-center story", author: { name: "RedChipRookie", badge: "Founding member" }, saves: 2, comments: 1, votes: 5, href: "/research/AMD" },
    ],
  },
  debate: {
    id: "d1",
    question: "Is Tesla still a growth stock?",
    counts: { yes: 5, no: 3 },
    userVote: null,
    floorMet: false,
    participants: CROWD.slice(0, 3),
  },
  foryou: {
    items: [
      { ticker: "NVDA", company: "Nvidia", price: 126.78, changePct: 1.93, delta: "First research pieces are landing on your watched name", kind: "research" },
      { ticker: "AMD", company: "Advanced Micro Devices", price: 164.32, changePct: 1.16, delta: "New on the founding board", kind: "watchers" },
    ],
  },
  people: {
    members: [
      { id: "p1", name: "TechTactician", avatar: null, tags: ["Semis", "Deep dives"], reason: "One of the first to publish research here", href: "/u/techtactician" },
      { id: "p2", name: "ValueHawk", avatar: null, tags: ["Value", "Balance sheets"], reason: "Founding member sharing full theses", href: "/u/valuehawk" },
      { id: "p3", name: "DataDive", avatar: null, tags: ["Data-driven", "Screens"], reason: "Posts the screens behind every idea", href: "/u/datadive" },
    ],
  },
};

export function clubFixtures(scale: ClubScale): ClubData {
  return scale === "founding" ? FOUNDING : SCALE;
}
