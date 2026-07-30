import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getRequestClient, getRequestProfile, getRequestUser } from "@/lib/supabase/rsc";
import { resolveHomeRoute } from "@/lib/club/home-route";
import { beltProgress, BELT_ORDER, BELTS, type BeltKey } from "@/lib/belts";
import { LEVELS } from "@/lib/xp";
import { fetchStreak, type StreakResult } from "@/lib/streak";
import type { BeltTone } from "@/ui-v3/components/you/belt-tone";

/**
 * ui-v3 You — the ONLY data access boards "07 You Profile" and "22 Belts"
 * perform. Same contract as src/ui-v3/home-data.ts: components under
 * src/ui-v3/components/you are pure presentation and take this view model as
 * props, so one component tree serves both a signed-in member (live reads) and
 * an anonymous visitor (fixtures).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THESE ARTBOARDS ASK FOR THAT THE APP CANNOT ANSWER
 *
 * Board 07 and board 22 are drawn on top of a GRADED-CALL ENGINE — a system
 * that scores each member's directional calls and derives an accuracy rate from
 * them. That engine does not exist, and it is not merely unbuilt: migration
 * `196_member_participation.sql` lists accuracy / hit-rate / opinion-score /
 * "Influence 1.8x" / "People Influenced" as fields that MUST NOT be computed
 * without a compliance ruling, and the old /progress and /u/[username] surfaces
 * carry the same prohibition in their headers.
 *
 * So every artboard slot that needs it is handled one of two ways, never a
 * third: either the slot is OMITTED (the view model returns null), or it is
 * filled by a DIFFERENT, REAL metric and RELABELLED to say what that metric
 * actually is. Nothing on these screens is a placeholder number.
 *
 *   artboard slot              →  what actually renders
 *   ─────────────────────────────────────────────────────────────────────────
 *   ring "87 OPINION SCORE"    →  belt progress %, labelled "BELT PROGRESS"
 *   "Top 2% of 25,842 members" →  OMITTED live (no percentile is computed)
 *   "INFLUENCE 1.8x"           →  conviction: bull share of open positions
 *   "STRONGEST AREAS / Top 4%" →  where your reps come from: XP share by kind
 *   tile "Accuracy 71%"        →  OMITTED (compliance-blocked metric)
 *   tile "People Influenced"   →  "Respect", the real respect-reaction count
 *   tile "Changed Minds"       →  "Mind Changes", the member's OWN stance flips
 *   call result "✓ +6.4%"      →  OMITTED (no call is graded anywhere)
 *   belt gates "40 calls·58%+" →  the real XP threshold that opens the belt
 *   belt share "62% OF CLUB"   →  OMITTED live (see BELT SHARE below)
 *   footer "Red-stripe Black"  →  the real next belt degree and XP remaining
 *
 * BELT SHARE. A per-belt club distribution IS computable — the old
 * components/belts/BeltLadder.tsx reduces one over `xp_leaderboard_individuals`
 * — but that RPC returns the TOP 100 MEMBERS ONLY, so the result is the belt mix
 * of the leaderboard, not of the Club. Printing it beside the words "OF CLUB"
 * would be false, so live returns null. An uncapped `belt_distribution()` RPC
 * would light this column up unchanged.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── view model ───────────────────────────────────────────────────────────────

export interface ProfileHeaderVM {
  initials: string;
  avatarUrl: string | null;
  displayName: string;
  /** Full rank, degree included — "Blue Belt II". */
  beltLabel: string;
  beltTone: BeltTone;
  /** The ★ beside the belt line. Apex belt only. */
  isApex: boolean;
  /** Artboard: "Top 2% of 25,842 members". No percentile exists → null live. */
  standing: string | null;
  ring: { pct: number; value: string; label: string[] } | null;
}

export interface FigureCardVM {
  eyebrow: string;
  value: string;
  note: string | null;
}

export interface StrengthBarVM {
  name: string;
  /** The right-hand figure, already formatted. */
  value: string;
  /** 0-100, the bar width. */
  pct: number;
}

export interface StatTileVM {
  value: string;
  label: string;
}

export interface StreakPanelVM {
  days: number;
  /** Oldest → newest, ending today. Straight from StreakResult.window7. */
  window7: boolean[];
}

export interface RecentCallVM {
  id: string;
  ticker: string;
  text: string;
  /** The artboard's ✓/✗ badge. Nothing grades a call, so this is always null. */
  result: { win: boolean; move: string } | null;
}

export interface YouViewModel {
  source: "live" | "fixtures";
  header: ProfileHeaderVM;
  figure: FigureCardVM | null;
  strengths: { eyebrow: string; bars: StrengthBarVM[] } | null;
  tiles: StatTileVM[];
  streak: StreakPanelVM | null;
  calls: RecentCallVM[];
}

export interface BeltRungVM {
  key: string;
  name: string;
  tone: BeltTone;
  /** How the rung is earned. The real XP threshold, not a call/accuracy gate. */
  gate: string | null;
  /** Artboard's "62% OF CLUB". Null live — see the header note. */
  share: string | null;
  isHere: boolean;
}

export interface NextBeltVM {
  title: string;
  detail: string | null;
  /** 0-100. */
  pct: number;
}

export interface BeltsViewModel {
  source: "live" | "fixtures";
  rungs: BeltRungVM[];
  next: NextBeltVM | null;
}

// ── shared helpers ───────────────────────────────────────────────────────────

/**
 * The five belts map 1:1 onto the artboard's tones. The artboard also draws a
 * GREEN belt; the owner-set ladder (src/lib/belts.ts) has no green rung, so the
 * tone exists in the palette and is simply never selected here.
 */
const BELT_TONE: Record<BeltKey, BeltTone> = {
  white: "white",
  yellow: "yellow",
  blue: "blue",
  purple: "purple",
  black: "black",
};

const APEX_BELT: BeltKey = "black";

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The lowest XP threshold that opens a belt — the first level mapped to it. */
function beltEntryXp(key: BeltKey): number {
  for (const level of LEVELS) {
    // beltProgress/beltForXp own the level→belt mapping; probing it at each
    // threshold keeps this in step with any future re-mapping.
    const rank = beltProgress(level.min).current;
    if (rank.belt.key === key) return level.min;
  }
  return 0;
}

/** How many level degrees sit inside a belt (1 → no numeral is ever shown). */
function beltDegrees(key: BeltKey): number {
  return LEVELS.filter((l) => beltProgress(l.min).current.belt.key === key).length;
}

function buildRungs(xp: number | null): BeltRungVM[] {
  const here = xp === null ? null : beltProgress(xp);
  return BELT_ORDER.map((key) => {
    const isHere = here?.current.belt.key === key;
    const entry = beltEntryXp(key);
    const degrees = beltDegrees(key);
    const gate = isHere && here && xp !== null
      ? `${here.current.label} · ${xp.toLocaleString()} XP`
      : `${degrees > 1 ? `${degrees} degrees · ` : ""}from ${entry.toLocaleString()} XP`;
    return {
      key,
      name: `${BELTS[key].name} Belt`,
      tone: BELT_TONE[key],
      gate,
      // No honest club-wide distribution exists (see the header note).
      share: null,
      isHere: !!isHere,
    };
  });
}

function buildNext(xp: number | null): NextBeltVM | null {
  if (xp === null) return null;
  const { next, pct, toNext } = beltProgress(xp);
  if (!next) {
    return {
      title: "Black Belt — top of the ladder",
      detail: "Every degree earned",
      pct: 100,
    };
  }
  return {
    title: `Next: ${next.label}`,
    detail: `${toNext.toLocaleString()} XP to go`,
    pct: Math.max(0, Math.min(100, Math.round(pct))),
  };
}

function buildHeader(opts: {
  displayName: string;
  avatarUrl: string | null;
  xp: number | null;
  standing: string | null;
}): ProfileHeaderVM {
  const rank = opts.xp === null ? null : beltProgress(opts.xp);
  const pct = rank ? Math.max(0, Math.min(100, Math.round(rank.pct))) : null;
  return {
    initials: initialsFrom(opts.displayName),
    avatarUrl: opts.avatarUrl,
    displayName: opts.displayName,
    beltLabel: rank?.current.label ?? "",
    beltTone: rank ? BELT_TONE[rank.current.belt.key] : "white",
    isApex: rank?.current.belt.key === APEX_BELT,
    standing: opts.standing,
    ring:
      pct === null
        ? null
        : { pct, value: String(pct), label: ["BELT", "PROGRESS"] },
  };
}

// ── live reads ───────────────────────────────────────────────────────────────

/** `member_participation(uuid)` — migration 196. The one per-member stats RPC. */
interface Participation {
  stances: number;
  bull_stances: number;
  flips: number;
  respect: number;
  research: number;
  posts: number;
  weeks_active: number;
}

/** `member_flips(uuid, int)` — migration 196. */
interface FlipRow {
  id: string;
  ticker: string | null;
  from_stance: string | null;
  to_stance: string | null;
  reason: string | null;
}

const STANCE_WORD: Record<string, string> = {
  bull: "Bullish",
  bear: "Bearish",
  neutral: "Neutral",
};

const REASON_WORD: Record<string, string> = {
  valuation: "on valuation",
  thesis_broken: "thesis broke",
  new_evidence: "new evidence",
  risk_increased: "risk increased",
  better_opportunity: "better opportunity elsewhere",
};

/** Human labels for the XP kinds that back the "reps" bars. */
const XP_KIND_LABEL: Record<string, string> = {
  lesson: "Lessons",
  quiz: "Quizzes",
  flashcards: "Flashcards",
  game: "Games",
  community: "Community",
  rsvp: "Events",
  bonus: "Bonuses",
};

async function readParticipation(
  supabase: SupabaseClient,
  userId: string
): Promise<Participation | null> {
  const { data, error } = await supabase.rpc("member_participation", { p_user_id: userId });
  if (error || !data || typeof data !== "object") return null;
  return data as Participation;
}

async function readFlips(supabase: SupabaseClient, userId: string): Promise<FlipRow[]> {
  const { data, error } = await supabase.rpc("member_flips", {
    p_user_id: userId,
    p_limit: CALL_LIMIT,
  });
  if (error || !Array.isArray(data)) return [];
  return data as FlipRow[];
}

/**
 * Where the member's XP actually came from, as a share of their own total.
 * This is the honest occupant of the artboard's "STRONGEST AREAS" slot: no
 * per-sector competence ranking exists anywhere in the app, and a "Top 4%"
 * figure would be a comparison against other members that is not computed.
 */
async function readReps(
  supabase: SupabaseClient,
  userId: string
): Promise<StrengthBarVM[]> {
  const { data, error } = await supabase
    .from("xp_events")
    .select("kind, amount")
    .eq("user_id", userId)
    .gt("amount", 0)
    .limit(2000);
  if (error || !Array.isArray(data)) return [];

  const byKind = new Map<string, number>();
  let total = 0;
  for (const row of data as { kind?: string | null; amount?: number | null }[]) {
    const kind = typeof row.kind === "string" ? row.kind : null;
    const amount = Number(row.amount) || 0;
    if (!kind || amount <= 0) continue;
    byKind.set(kind, (byKind.get(kind) ?? 0) + amount);
    total += amount;
  }
  if (total === 0) return [];

  return [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, STRENGTH_LIMIT)
    .map(([kind, amount]) => {
      const pct = Math.round((amount / total) * 100);
      return { name: XP_KIND_LABEL[kind] ?? kind, value: `${pct}%`, pct };
    });
}

/** Circles the member opened. `club_circles.created_by` is the real column. */
async function readCirclesHosted(
  supabase: SupabaseClient,
  userId: string
): Promise<number | null> {
  const { count, error } = await supabase
    .from("club_circles")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId);
  // The Circles schema is optional in some environments; a failed read is an
  // absence, never a zero.
  if (error || typeof count !== "number") return null;
  return count;
}

// ── limits the artboards set ─────────────────────────────────────────────────

/** Board 07 draws two call rows. */
const CALL_LIMIT = 2;
/** Board 07 draws three ranked bars. */
const STRENGTH_LIMIT = 3;

// ── mappers ──────────────────────────────────────────────────────────────────

function mapTiles(part: Participation | null, circlesHosted: number | null): StatTileVM[] {
  const tiles: StatTileVM[] = [];
  if (!part) return tiles;
  tiles.push({ value: String(part.stances), label: "Opinions" });
  tiles.push({ value: String(part.respect), label: "Respect" });
  tiles.push({ value: String(part.flips), label: "Mind Changes" });
  if (circlesHosted !== null) {
    tiles.push({ value: String(circlesHosted), label: "Circles Hosted" });
  }
  tiles.push({ value: String(part.posts), label: "Posts" });
  return tiles;
}

/**
 * The artboard's "INFLUENCE 1.8x" slot. No influence multiplier is computed
 * anywhere, so the card carries CONVICTION — the bull share of the member's own
 * open positions — and says so in the eyebrow.
 */
function mapFigure(part: Participation | null): FigureCardVM | null {
  if (!part || part.stances <= 0) return null;
  const pct = Math.round((part.bull_stances / part.stances) * 100);
  return {
    eyebrow: "Conviction",
    value: `${pct}%`,
    note: `${part.bull_stances} of your ${part.stances} open positions are bullish`,
  };
}

function mapCalls(flips: FlipRow[]): RecentCallVM[] {
  return flips
    .filter((f) => typeof f.ticker === "string" && f.ticker.length > 0)
    .slice(0, CALL_LIMIT)
    .map((f) => {
      const to = STANCE_WORD[f.to_stance ?? ""] ?? "Changed";
      const from = STANCE_WORD[f.from_stance ?? ""];
      const why = REASON_WORD[f.reason ?? ""];
      const tail = why ?? (from ? `was ${from.toLowerCase()}` : "position opened");
      return {
        id: f.id,
        ticker: (f.ticker as string).toUpperCase(),
        text: `${to} · ${tail}`,
        // Nothing grades a call, so the ✓/✗ badge never renders.
        result: null,
      };
    });
}

function mapStreak(streak: StreakResult | null): StreakPanelVM | null {
  // fetchStreak returns null on a FAILED read; that is an absence, not a zero.
  if (!streak) return null;
  return { days: streak.days, window7: streak.window7 };
}

// ── fixtures branch ──────────────────────────────────────────────────────────

/**
 * The anonymous/preview view model — what an unauthenticated visit to /v3/you
 * renders, and what the artboard side-by-side is shot against.
 *
 * These values are the ARTBOARD'S OWN demo content for a fictional member, used
 * only so the design proof is complete. Two of them ("Marcus Hill", the standing
 * line) are claims that the live branch deliberately refuses to make; they are
 * reachable ONLY through `source: "fixtures"`, i.e. only when there is no
 * session at all.
 */
function fixtureYou(): YouViewModel {
  const xp = 2840;
  return {
    source: "fixtures",
    header: buildHeader({
      displayName: "Marcus Hill",
      avatarUrl: null,
      xp,
      // ARTBOARD COPY. No member percentile is computed anywhere in the app —
      // this line never renders for a real member.
      standing: "Top 2% of 25,842 members",
    }),
    figure: {
      eyebrow: "Conviction",
      value: "64%",
      note: "9 of your 14 open positions are bullish",
    },
    strengths: {
      eyebrow: "Where your reps come from",
      bars: [
        { name: "Lessons", value: "46%", pct: 46 },
        { name: "Community", value: "31%", pct: 31 },
        { name: "Games", value: "23%", pct: 23 },
      ],
    },
    tiles: [
      { value: "142", label: "Opinions" },
      { value: "382", label: "Respect" },
      { value: "47", label: "Mind Changes" },
      { value: "6", label: "Circles Hosted" },
      { value: "88", label: "Posts" },
    ],
    streak: { days: 16, window7: [true, true, true, true, false, false, false] },
    calls: [
      { id: "fx-1", ticker: "NVDA", text: "Bullish · new evidence", result: null },
      { id: "fx-2", ticker: "TSLA", text: "Bearish · thesis broke", result: null },
    ],
  };
}

function fixtureBelts(): BeltsViewModel {
  const xp = 2840;
  return { source: "fixtures", rungs: buildRungs(xp), next: buildNext(xp) };
}

// ── entry points ─────────────────────────────────────────────────────────────

/**
 * Build the You view model — board "07 You Profile".
 *
 * /v3 is not behind the middleware's auth wall, so an anonymous visit is a
 * first-class case: it renders the same components from fixtures.
 */
export async function getYouViewModel(): Promise<YouViewModel> {
  const user = await getRequestUser();
  if (!user) return fixtureYou();

  const supabase = await getRequestClient();
  const [route, profile] = await Promise.all([resolveHomeRoute(supabase), getRequestProfile()]);

  const displayName = profile?.display_name?.trim() || "";
  const firstName = ("firstName" in route && route.firstName) || displayName || "there";
  const xp = "xp" in route ? route.xp : null;

  const [part, flips, reps, circles, streak] = await Promise.all([
    readParticipation(supabase, user.id),
    readFlips(supabase, user.id),
    readReps(supabase, user.id),
    readCirclesHosted(supabase, user.id),
    fetchStreak(supabase, user.id, Date.now()),
  ]);

  return {
    source: "live",
    header: buildHeader({
      displayName: displayName || firstName,
      avatarUrl: profile?.avatar_url ?? null,
      xp,
      // No member percentile is computed. The line stays off rather than lying.
      standing: null,
    }),
    figure: mapFigure(part),
    strengths:
      reps.length > 0 ? { eyebrow: "Where your reps come from", bars: reps } : null,
    tiles: mapTiles(part, circles),
    streak: mapStreak(streak),
    calls: mapCalls(flips),
  };
}

/** Build the Belts view model — board "22 Belts". */
export async function getBeltsViewModel(): Promise<BeltsViewModel> {
  const user = await getRequestUser();
  if (!user) return fixtureBelts();

  const supabase = await getRequestClient();
  const route = await resolveHomeRoute(supabase);
  const xp = "xp" in route ? route.xp : null;

  return { source: "live", rungs: buildRungs(xp), next: buildNext(xp) };
}
