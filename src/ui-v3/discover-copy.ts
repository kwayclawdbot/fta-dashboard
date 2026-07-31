import { MIN_POSITIONED_OPINIONS } from "@/ui-v3/club-floors";

/**
 * The empty copy for each Discover region that can legitimately have nothing to
 * show.
 *
 * This used to live in `discover-data.ts`, which is `import "server-only"`. That
 * was fine while every Discover component was server-rendered; the moment the
 * screener's results moved into the client bundle (the chips are interactive
 * now) that one string dragged the whole adapter — and therefore the Supabase
 * server client — behind it, and the build said so.
 *
 * So the copy lives here instead: no imports but the shared floor, no data
 * access, safe on both sides of the boundary. There is still exactly one place
 * these sentences are written.
 */
export const DISCOVER_EMPTY = {
  divisive: `Not enough positioned opinions yet — a split takes ${MIN_POSITIONED_OPINIONS}+ members on one name.`,
  beltWatch: "No black belts yet — the first member to get there leads this row.",
  rising: "No names are climbing yet. This fills as the Club reads and takes sides.",
  quietToLoud: "Nothing has woken up yet — this row needs two weeks of attention history.",
  screenerRows: "Nothing clears this screen right now. Loosen a filter and the matches come back.",
  board: "No name is on the board yet — it fills the first time the Club reads one.",
  bullish: "No bullish consensus yet.",
  bearish: "No bearish positions on the board yet.",
  trendingChips: "The attention ledger is still filling.",
} as const;
