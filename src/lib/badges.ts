import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Professional-title badge engine (owner-locked plan 2026-07-20).
 *
 * These are CREDENTIALS (career identities), not playful scout names. Six seed
 * titles live in the `badges` table (migration 033, distinguished by a non-null
 * `criteria_key`); awards land in `badge_awards` via the SECURITY DEFINER
 * `award_badge(slug)` RPC — the only write path.
 *
 * Evaluation is DATA-DRIVEN, not event-hooked: `evaluateBadges` recomputes each
 * criterion from the contract tables and self-awards anything earned-but-missing.
 * It is cheap + idempotent, so it runs on badge-case mount and after the
 * community page loads.
 *
 * ⚠️ RESILIENCE: several criteria read tables shipped by another agent's
 * migration 032 (`family_watchlist`, `fic_missions`, `mission_completions`),
 * which may not exist yet when this runs. EVERY query is guarded — a missing
 * table/column (or any error) skips that criterion silently and NEVER throws.
 *
 * Chart-lesson pick (Technician): the `lessons` table has no `slug` column, so
 * the "beginner chart lesson" is matched by title containing "candle" — the
 * FIC foundation tracks each ship one candlestick-anatomy lesson ("Candlestick
 * Anatomy & Timeframes" / "Candlesticks & Timeframes" / "Candles: Green Teams
 * vs Red Teams"). Completing any of them earns Technician for that member.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;
type Row = Record<string, unknown>;

export const PRO_BADGE_SLUGS = [
  "scout",
  "analyst",
  "risk_manager",
  "investor",
  "technician",
  "ceo",
] as const;
export type ProBadgeSlug = (typeof PRO_BADGE_SLUGS)[number];

export interface BadgeRow {
  slug: string;
  title: string;
  subtitle: string | null;
  sort: number;
  awarded: boolean;
  awarded_at: string | null;
}

// ── Contract-table column heuristics (migration 032 schema not yet visible) ──
// We fetch family_watchlist rows and attribute by whichever "champion/adder"
// column exists, so the engine tolerates schema-name variation. If none match,
// the watchlist criteria simply never fire (safe skip) rather than crash.
const ADDER_FIELDS = [
  "added_by",
  "champion_id",
  "champion",
  "champion_user_id",
  "added_by_id",
  "created_by",
  "user_id",
  "member_id",
  "owner_id",
];
const STATUS_FIELDS = ["status"];
const RESEARCH_FLAG_FIELDS = ["research_complete", "researched", "studied", "card_complete"];
const BIZ_FIELDS = [
  "how_they_make_money",
  "makes_money",
  "money_machine",
  "business",
  "what_they_do",
];
const STRENGTH_FIELDS = ["strength", "one_strength", "bull", "strength_note"];
const RISK_FIELDS = ["risk", "one_risk", "risk_note", "bear", "what_could_go_wrong"];
const TREND_FIELDS = ["trend", "trend_tag", "trend_note"];
const COMPLETE_STATUSES = new Set(["favorite", "favorited", "avoid", "avoided"]);

function firstVal(row: Row, fields: string[]): unknown {
  for (const f of fields) {
    if (f in row && row[f] != null && row[f] !== "") return row[f];
  }
  return undefined;
}
function nonEmpty(v: unknown): boolean {
  return typeof v === "string" ? v.trim().length > 0 : v != null && v !== false;
}
function adderId(row: Row): string | undefined {
  const v = firstVal(row, ADDER_FIELDS);
  return typeof v === "string" ? v : undefined;
}
function hasRisk(row: Row): boolean {
  return nonEmpty(firstVal(row, RISK_FIELDS));
}
function isResearchComplete(row: Row): boolean {
  const status = firstVal(row, STATUS_FIELDS);
  if (typeof status === "string" && COMPLETE_STATUSES.has(status.toLowerCase())) return true;
  if (nonEmpty(firstVal(row, RESEARCH_FLAG_FIELDS))) return true;
  // Full research card = business + strength + risk + trend all filled.
  return (
    nonEmpty(firstVal(row, BIZ_FIELDS)) &&
    nonEmpty(firstVal(row, STRENGTH_FIELDS)) &&
    hasRisk(row) &&
    nonEmpty(firstVal(row, TREND_FIELDS))
  );
}

/** Run a supabase query, returning rows or null on ANY error (guarded skip).
 * Accepts a PromiseLike since supabase query builders are thenables, not
 * real Promises. */
async function safeRows(
  build: () => PromiseLike<{ data: unknown; error: unknown }>
): Promise<Row[] | null> {
  try {
    const { data, error } = await build();
    if (error) return null;
    return (data as Row[]) ?? [];
  } catch {
    return null;
  }
}

// ── Per-criterion checks (each returns true = earned, guarded to false) ──────

async function checkWatchlist(
  supabase: DB,
  userId: string
): Promise<{ scout: boolean; analyst: boolean; risk_manager: boolean }> {
  const rows = await safeRows(() => supabase.from("family_watchlist").select("*").limit(500));
  if (!rows) return { scout: false, analyst: false, risk_manager: false };
  const mine = rows.filter((r) => adderId(r) === userId);
  return {
    scout: mine.length >= 5,
    analyst: mine.filter(isResearchComplete).length >= 3,
    risk_manager: mine.filter(hasRisk).length >= 5,
  };
}

async function checkInvestor(supabase: DB, userId: string): Promise<boolean> {
  const rsvps = await safeRows(() =>
    supabase.from("session_rsvps").select("session_id").eq("user_id", userId)
  );
  if (!rsvps || rsvps.length === 0) return false;
  const ids = [...new Set(rsvps.map((r) => r.session_id).filter(Boolean))] as string[];
  if (ids.length === 0) return false;
  // Past sessions only. (class_type isn't on live_sessions yet; when migration
  // 032 adds a weekly-class type we can tighten this filter.)
  const past = await safeRows(() =>
    supabase
      .from("live_sessions")
      .select("id, scheduled_at")
      .in("id", ids)
      .lt("scheduled_at", new Date().toISOString())
  );
  if (!past) return false;
  return past.length >= 4;
}

async function checkTechnician(supabase: DB, userId: string): Promise<boolean> {
  const done = await safeRows(() =>
    supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .eq("status", "completed")
  );
  if (!done || done.length === 0) return false;
  const ids = [...new Set(done.map((r) => r.lesson_id).filter(Boolean))] as string[];
  if (ids.length === 0) return false;
  // Beginner chart lesson = the candlestick-anatomy lesson (title has "candle").
  const chart = await safeRows(() =>
    supabase.from("lessons").select("id").in("id", ids).ilike("title", "%candle%")
  );
  return !!chart && chart.length > 0;
}

async function checkCeo(supabase: DB, userId: string): Promise<boolean> {
  // Resolve the fic_missions slug → mission_completions.mission_id path. The
  // completions table (migration 032) keys ONLY on mission_id — there is no
  // `mission_slug` column, so a slug-based fallback query 400s on PostgREST.
  const mission = await safeRows(() =>
    supabase.from("fic_missions").select("id").eq("slug", "family-ceo").limit(1)
  );
  if (!mission || mission.length === 0) return false;
  const missionId = mission[0].id as string;
  const done = await safeRows(() =>
    supabase
      .from("mission_completions")
      .select("id")
      .eq("user_id", userId)
      .eq("mission_id", missionId)
      .limit(1)
  );
  return !!done && done.length > 0;
}

/** Compute the set of earned professional-title slugs (all checks guarded). */
async function computeEarned(supabase: DB, userId: string): Promise<Set<ProBadgeSlug>> {
  const earned = new Set<ProBadgeSlug>();
  try {
    const [wl, investor, technician, ceo] = await Promise.all([
      checkWatchlist(supabase, userId),
      checkInvestor(supabase, userId),
      checkTechnician(supabase, userId),
      checkCeo(supabase, userId),
    ]);
    if (wl.scout) earned.add("scout");
    if (wl.analyst) earned.add("analyst");
    if (wl.risk_manager) earned.add("risk_manager");
    if (investor) earned.add("investor");
    if (technician) earned.add("technician");
    if (ceo) earned.add("ceo");
  } catch {
    /* never throw from evaluation */
  }
  return earned;
}

/** Slugs already awarded to this user (guarded). */
async function awardedSlugs(supabase: DB, userId: string): Promise<Set<string>> {
  const rows = await safeRows(() =>
    supabase.from("badge_awards").select("badge:badges(slug)").eq("user_id", userId)
  );
  const set = new Set<string>();
  for (const r of rows ?? []) {
    const b = r.badge as { slug?: string } | { slug?: string }[] | null;
    const slug = Array.isArray(b) ? b[0]?.slug : b?.slug;
    if (slug) set.add(slug);
  }
  return set;
}

/**
 * Evaluate + self-award any earned-but-missing professional badges.
 * Returns the slugs newly awarded this run (empty when nothing changed).
 * Cheap + idempotent — safe to call on mount / after page load. Never throws.
 */
export async function evaluateBadges(supabase: DB, userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const earned = await computeEarned(supabase, userId);
    if (earned.size === 0) return [];
    const already = await awardedSlugs(supabase, userId);
    const toAward = [...earned].filter((s) => !already.has(s));
    const newly: string[] = [];
    for (const slug of toAward) {
      try {
        const { data } = await supabase.rpc("award_badge", { p_slug: slug });
        if (data) newly.push(slug);
      } catch {
        /* skip */
      }
    }
    return newly;
  } catch {
    return [];
  }
}

/** Full credential state for one user (the 6 pro titles + awarded flags). */
export async function getBadgeState(supabase: DB, userId: string): Promise<BadgeRow[]> {
  const defs = await safeRows(() =>
    supabase
      .from("badges")
      .select("slug, title, subtitle, sort")
      .not("criteria_key", "is", null)
      .order("sort", { ascending: true })
  );
  const awards = await safeRows(() =>
    supabase
      .from("badge_awards")
      .select("awarded_at, badge:badges(slug)")
      .eq("user_id", userId)
  );
  const awardedAt = new Map<string, string>();
  for (const a of awards ?? []) {
    const b = a.badge as { slug?: string } | { slug?: string }[] | null;
    const slug = Array.isArray(b) ? b[0]?.slug : b?.slug;
    if (slug) awardedAt.set(slug, (a.awarded_at as string) ?? null);
  }
  return (defs ?? []).map((d) => {
    const slug = d.slug as string;
    return {
      slug,
      title: (d.title as string) ?? slug,
      subtitle: (d.subtitle as string) ?? null,
      sort: (d.sort as number) ?? 0,
      awarded: awardedAt.has(slug),
      awarded_at: awardedAt.get(slug) ?? null,
    };
  });
}

export interface BadgeSummary {
  count: number;
  topTitle: string | null;
}

/**
 * Batched earned-badge summary for many users (family members list).
 * Returns { count, topTitle } per userId — topTitle = highest-sort earned
 * credential (CEO ranks above Scout). One query, no N+1.
 */
export async function getBadgeSummaries(
  supabase: DB,
  userIds: ReadonlyArray<string>
): Promise<Record<string, BadgeSummary>> {
  const out: Record<string, BadgeSummary> = {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const rows = await safeRows(() =>
    supabase
      .from("badge_awards")
      .select("user_id, badge:badges(title, sort, criteria_key)")
      .in("user_id", ids)
  );
  for (const r of rows ?? []) {
    const uid = r.user_id as string;
    const b0 = r.badge as
      | { title?: string; sort?: number; criteria_key?: string | null }
      | { title?: string; sort?: number; criteria_key?: string | null }[]
      | null;
    const b = Array.isArray(b0) ? b0[0] : b0;
    // Only count professional titles (criteria_key set), not legacy achievements.
    if (!b || b.criteria_key == null) continue;
    const cur = out[uid] || { count: 0, topTitle: null, _sort: -1 } as BadgeSummary & { _sort: number };
    const entry = cur as BadgeSummary & { _sort: number };
    entry.count += 1;
    if ((b.sort ?? 0) > entry._sort) {
      entry._sort = b.sort ?? 0;
      entry.topTitle = b.title ?? null;
    }
    out[uid] = entry;
  }
  // Strip the private _sort accumulator.
  for (const k of Object.keys(out)) {
    out[k] = { count: out[k].count, topTitle: out[k].topTitle };
  }
  return out;
}
