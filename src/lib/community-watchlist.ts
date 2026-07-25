/**
 * Community Watchlist — shared types + pure helpers (no Supabase here).
 *
 * The flagship communal research board (migration 097): admin-curated "our
 * research" picks + member picks that families explicitly promoted from their
 * private family_watchlist. Collaborative research + comments are keyed per
 * TICKER (the wiki model). Prices/snapshots/charts come from the delayed
 * Polygon layer via /api/market/*; daily closes accumulate in ticker_snapshots.
 */

export type CommunityKind = "admin" | "member";
export type CommunityStatus = "active" | "watching" | "closed" | "archived";
export type AgePosture = "kids" | "teens" | "adults" | string;

export interface CommunityEntry {
  id: string;
  ticker: string;
  company_name: string;
  kind: CommunityKind;
  status: CommunityStatus;
  headline: string | null;
  thesis: string | null;
  blurb: string | null;
  family_id: string | null;
  family_name: string | null;
  promoted_by: string | null;
  promoter_name: string | null;
  promoter_age_group: AgePosture | null;
  source_watchlist_id: string | null;
  snapshot_price: number | null;
  snapshot_at: string | null;
  created_at: string;
  latest_close: number | null;
  comment_count: number;
}

export interface TickerComment {
  id: string;
  ticker: string;
  user_id: string | null;
  body: string;
  created_at: string;
  author?: {
    display_name: string | null;
    avatar_url: string | null;
    age_group: string | null;
    username?: string | null;
  } | null;
}

/* ---------- performance ---------- */

/**
 * Percent change since the pick landed on the board. Prefers the live/delayed
 * price when available (fresher), falling back to the latest daily close.
 */
export function pctSinceAdded(
  snapshotPrice: number | null | undefined,
  currentPrice: number | null | undefined
): number | null {
  if (snapshotPrice == null || snapshotPrice <= 0) return null;
  if (currentPrice == null) return null;
  return ((currentPrice - snapshotPrice) / snapshotPrice) * 100;
}

export function formatPct(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

export function pctTone(v: number | null): "up" | "down" | "flat" {
  if (v == null || Math.abs(v) < 0.05) return "flat";
  return v > 0 ? "up" : "down";
}

/* ---------- performance XP (anti-gaming rules, see the plan doc) ----------
 * Awarded by the DAILY CRON only, off daily closes, ONLY for community-promoted
 * member picks (public accountability = the anti-spam gate). One award per
 * (entry, milestone) ever; min-hold ≥1 daily close; per-family daily cap. */
export const PERF_MILESTONES: { pct: number; xp: number }[] = [
  { pct: 5, xp: 15 },
  { pct: 10, xp: 25 },
  { pct: 25, xp: 50 },
];
/** Max performance-milestone awards counted per family per cron run. */
export const PERF_FAMILY_DAILY_CAP = 5;

/** Age posture → AgeBadge group (kids/teens/adults). */
export function agePosture(ageGroup: string | null | undefined): AgePosture {
  if (ageGroup === "kids" || ageGroup === "teens") return ageGroup;
  return "adults";
}

export const COMMUNITY_DISCLAIMER =
  "The Cheat Code Club studies real companies to learn how investing works. " +
  "Nothing here is investment advice or a recommendation to buy or sell any security. " +
  "Prices are delayed ~15 minutes. Always do your own research.";

/** Split a long thesis into paragraphs for rendering. */
export function toParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
