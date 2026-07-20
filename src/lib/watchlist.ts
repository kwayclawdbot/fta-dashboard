/**
 * Family Watchlist — shared types + the STATUS LADDER teaching mechanic.
 *
 * Everything enters `watch`. `study` opens the research card. A verdict
 * (`favorite`/`avoid`) is LOCKED until the research card is complete — enforced
 * here in the UI AND by the `watchlist_verdict_needs_research` CHECK constraint
 * in migration 032 (belt-and-suspenders: no verdict without homework).
 */

export type WatchStatus = "watch" | "study" | "favorite" | "avoid";

export interface WatchlistItem {
  id: string;
  family_id: string;
  company_name: string;
  ticker: string;
  status: WatchStatus;
  champion_id: string | null;
  trend: string | null;
  what_they_sell: string | null;
  how_they_make_money: string | null;
  strength: string | null;
  risk: string | null;
  bull_case: string | null;
  bear_case: string | null;
  why_we_picked: string | null;
  in_big_book: boolean;
  created_at: string;
  updated_at: string;
}

export interface WatchlistNote {
  id: string;
  watchlist_id: string;
  author_id: string | null;
  note: string;
  created_at: string;
}

// The four fields that make a research card "done" and unlock a verdict.
export const RESEARCH_FIELDS: (keyof WatchlistItem)[] = [
  "how_they_make_money",
  "strength",
  "risk",
  "trend",
];

/** True once the research card has all four required fields filled in. */
export function researchComplete(item: Partial<WatchlistItem>): boolean {
  return RESEARCH_FIELDS.every((f) => {
    const v = item[f];
    return typeof v === "string" && v.trim().length > 0;
  });
}

/** How many of the four required research fields are filled (0–4). */
export function researchFilledCount(item: Partial<WatchlistItem>): number {
  return RESEARCH_FIELDS.reduce((n, f) => {
    const v = item[f];
    return n + (typeof v === "string" && v.trim().length > 0 ? 1 : 0);
  }, 0);
}

// Board columns, in ladder order.
export const STATUS_ORDER: WatchStatus[] = [
  "watch",
  "study",
  "favorite",
  "avoid",
];

export const STATUS_META: Record<
  WatchStatus,
  { label: string; blurb: string; chip: string; dot: string }
> = {
  watch: {
    label: "Watching",
    blurb: "On our radar — no homework yet.",
    chip: "bg-chip-sky text-night-500",
    dot: "bg-sky-400",
  },
  study: {
    label: "Studying",
    blurb: "Doing the research.",
    chip: "bg-chip-amber text-gold-700",
    dot: "bg-gold-400",
  },
  favorite: {
    label: "Favorite",
    blurb: "We did the homework — we like it.",
    chip: "bg-chip-green text-green-600",
    dot: "bg-green-500",
  },
  avoid: {
    label: "Avoid",
    blurb: "We did the homework — not for us.",
    chip: "bg-red-500/10 text-red-600",
    dot: "bg-red-500",
  },
};

// Trend reads — friendly, kid-safe language (no "bearish/bullish" jargon).
export const TREND_OPTIONS = [
  { value: "Uptrend", label: "Going up ↗" },
  { value: "Sideways", label: "Flat / sideways →" },
  { value: "Downtrend", label: "Going down ↘" },
  { value: "New / Volatile", label: "New & bouncy ↕" },
] as const;

// XP for watchlist actions (awarded via lib/xp.ts, kind 'bonus', once per ref).
export const WATCHLIST_XP = {
  ADD: 10,
  RESEARCH: 15,
} as const;
