import "server-only";

import { getRequestClient, getRequestProfile, getRequestUser } from "@/lib/supabase/rsc";
import { resolveHomeRoute } from "@/lib/club/home-route";
import { buildClubHomeSeedSplit } from "@/lib/club/home-payload";
import { clubFixtures } from "@/ui-v3/club-fixtures";
import { beltProgress } from "@/lib/belts";
import { LEVELS } from "@/lib/xp";
import { TRENDING_DISCLAIMER } from "@/lib/club/score";
import { MIN_POSITIONED_OPINIONS } from "@/ui-v3/club-floors";

/**
 * ui-v3 Home — the ONLY data access the screen performs.
 *
 * Everything under src/ui-v3/components is pure presentation: it receives this
 * view model as props and renders it. That split is what lets the same
 * components serve a signed-in member (live Supabase reads) and an anonymous
 * visitor (fixtures) without a single conditional inside the markup — and it is
 * what makes the Playwright side-by-side possible with zero credentials.
 *
 * HONESTY RULES applied throughout:
 *  - A field that has no real source is `null`, and the component omits that
 *    element. We never invent a server-side metric to fill a hole in the design.
 *  - Fixture-only content is reachable ONLY through `source: "fixtures"`, which
 *    in turn is only chosen when there is no authenticated user.
 */

// ── view model ───────────────────────────────────────────────────────────────

export interface TrendingTileVM {
  rank: number;
  ticker: string;
  /**
   * The artboard's "78%" line. ONE unit for the whole strip — see `mapTrending`.
   * Never a mix of a percentage on one card and a raw score on the next.
   */
  metric: number | null;
  /** False when `metric` is the unbounded raw attention `score`, which must NOT wear a % sign. */
  isPct: boolean;
  /** The artboard's "▲ 6" line — trending core `change` (club_change_14d). */
  delta: number | null;
}

export interface TrendingStripVM {
  tiles: TrendingTileVM[];
  /**
   * Names the unit the whole strip is printing when that unit is NOT a
   * percentage — rendered as a small mono caption beside the section subtitle so
   * a bare "9" is never left to be read as a percent. Null when the tiles carry
   * a real percentage, which the "%" sign already names.
   */
  unitLabel: string | null;
  /**
   * `TRENDING_DISCLAIMER`, verbatim. The trending contract documents it as a
   * line the UI MUST render (attention ≠ recommendation), so it travels with the
   * rows rather than being retyped in the component.
   */
  disclaimer: string;
}

export interface IndexChipVM {
  symbol: string;
  changePct: number;
}

export interface SignalRowVM {
  ticker: string;
  /** The artboard's descriptive line — foryou core `delta`, the human "what changed" string. */
  text: string;
  /**
   * Trailing affordance. Mirrors the three the artboard draws:
   *  "add"    → the green ＋   (nothing is tracking this yet)
   *  "count"  → the orange pill (a live count worth surfacing)
   *  "go"     → the → chevron  (default: just navigate)
   */
  affordance: "add" | "count" | "go";
  count: number | null;
}

export interface YouStripVM {
  beltLabel: string;
  xp: number;
  target: number;
  /** 0-100. Drives BOTH the progress bar and the ring. */
  pct: number;
}

export interface HomeViewModel {
  source: "live" | "fixtures";
  greetingName: string;
  initials: string;
  /**
   * The bell badge: alert events fired since `alert_prefs.hub_seen_at`. Null on
   * a first visit, on a failed read, and on nothing-new — see
   * `readUnseenAlertCount`. The bell itself always links to /v3/watch/alerts.
   */
  notificationCount: number | null;
  trending: TrendingStripVM;
  /**
   * The artboard's one-liner under "TODAY IN 30 SECONDS" — the brief core's lead
   * item, once the degenerate activity-count lines are filtered out (see
   * `mapBriefLine`). Null → the panel says the brief has not landed yet.
   */
  briefLine: string | null;
  /**
   * Index chips. Not in any seed, so:
   *   fixtures → these values, rendered directly.
   *   live     → null, and <IndexChips> fetches /api/market/quote client-side.
   */
  indices: IndexChipVM[] | null;
  signals: SignalRowVM[];
  you: YouStripVM | null;
}

// ── narrow reads of the seed (sections cross the RSC boundary as `unknown`) ───

interface RawTrendingRow {
  rank?: number | null;
  ticker?: string | null;
  score?: number | null;
  change?: number | null;
  heat?: number | null;
  sentiment?: {
    bull?: number | null;
    neutral?: number | null;
    bear?: number | null;
    bullPct?: number | null;
  } | null;
}
interface RawForYouItem {
  ticker?: string | null;
  delta?: string | null;
  kind?: string | null;
  watchState?: string | null;
  /**
   * Net stance movement on this ticker over the week — bull adds minus bear
   * adds, off `ticker_intel_snapshots.provenance.sentiment.net`. The foryou core
   * already speaks it ("3 net new bull opinions"); this is the same number as a
   * number, which is what the artboard's count pill wants.
   */
  sentimentNet?: number | null;
}
interface RawBriefItem {
  kind?: string | null;
  text?: string | null;
}

function rows<T>(section: unknown, key: string): T[] {
  if (!section || typeof section !== "object") return [];
  const value = (section as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

// ── mappers ──────────────────────────────────────────────────────────────────

/** The artboard shows five tiles. */
const TRENDING_LIMIT = 5;
/** The artboard shows three signal rows. */
const SIGNAL_LIMIT = 3;

function positionedOf(row: RawTrendingRow): number {
  const s = row.sentiment;
  if (!s) return 0;
  return (s.bull ?? 0) + (s.neutral ?? 0) + (s.bear ?? 0);
}

/**
 * The ranked strip — and the one rule that governs it: EVERY CARD PRINTS THE
 * SAME UNIT.
 *
 * The unit is chosen once, for the whole strip, by walking three candidates in
 * order and taking the first that every row can answer:
 *
 *  1. `heat` — the 0-100 club-score dial. The trending core nulls it for any row
 *     below FLOORS.trendingScore, so on a founding club only the leaders have it.
 *  2. `sentiment.bullPct` — the bull share, and ONLY when every row clears
 *     MIN_POSITIONED_OPINIONS. One member clicking "bullish" is a 100% that
 *     means nothing, so the floor gates the percentage, not just the ranking.
 *  3. the raw attention `score` — unbounded, so it wears no "%" and the strip
 *     carries a mono caption naming it instead.
 *
 * Mixing them is the bug this replaces: the live strip printed "AAPL 100%" from
 * a one-sided bullPct beside "GOOG 9" from a raw score, as though 100 and 9 were
 * the same measurement.
 */
function mapTrending(section: unknown): TrendingStripVM {
  const raw = rows<RawTrendingRow>(section, "rows")
    .filter((r): r is RawTrendingRow & { ticker: string } =>
      typeof r?.ticker === "string" && r.ticker.length > 0,
    )
    .slice(0, TRENDING_LIMIT);

  const disclaimer = TRENDING_DISCLAIMER;
  if (raw.length === 0) return { tiles: [], unitLabel: null, disclaimer };

  const everyHeat = raw.every((r) => typeof r.heat === "number");
  const everyBullPct = raw.every(
    (r) =>
      typeof r.sentiment?.bullPct === "number" &&
      positionedOf(r) >= MIN_POSITIONED_OPINIONS,
  );

  const unit: "heat" | "bullPct" | "score" = everyHeat
    ? "heat"
    : everyBullPct
      ? "bullPct"
      : "score";

  const value = (r: RawTrendingRow): number | null => {
    if (unit === "heat") return Math.round(r.heat as number);
    if (unit === "bullPct") return Math.round(r.sentiment?.bullPct as number);
    return typeof r.score === "number" ? Math.round(r.score) : null;
  };

  return {
    tiles: raw.map((r, i) => ({
      rank: r.rank ?? i + 1,
      ticker: r.ticker.toUpperCase(),
      metric: value(r),
      isPct: unit !== "score",
      delta: r.change ?? null,
    })),
    unitLabel: unit === "score" ? "CLUB SCORE" : null,
    disclaimer,
  };
}

/**
 * The foryou core's own last-resort line (route.ts `reasonsFor` step 6): the
 * sentence it appends to EVERY ticker so a row always has something to say. It
 * is a statement that nothing happened, which is the definition of a row not
 * worth a slot on the artboard's three-row stack.
 */
const FORYOU_FILLER = "Steady in the Club — no shift this week";

/**
 * Fewer than this many real signals → the section shows its empty state rather
 * than a single lonely row pretending to be a stack. Read by <YourSignals>.
 */
export const SIGNAL_MIN = 2;

/**
 * THE SIGNAL KINDS THAT ARE REAL, and the one that is not.
 *
 * The artboard defines three trailing affordances and the grammar records that
 * live data resolved to `→` almost every time, because `watchState` was the only
 * per-row state being read. Two kinds were asked for; exactly one of them
 * exists:
 *
 *  ✔ "N new opinions this week" — REAL. `sentimentNet` rides on every foryou
 *    item (route.ts shapes it from `provenance.sentiment.net`) and the core
 *    already writes the sentence. Reading the number too is what finally lights
 *    the orange count pill from something rather than from nothing.
 *
 *  ✘ "Earnings in N days" — NO SOURCE. There is no upcoming-earnings date
 *    anywhere in this repo: no earnings or calendar table in supabase/migrations
 *    (checked every migration), no earnings-ingest cron (the thirteen crons under
 *    src/app/api/cron are screener, alerts, news, challenge and clock work), and
 *    no provider call that returns one. The closest thing is
 *    `/vX/reference/financials` in src/lib/market/polygon.ts, whose
 *    `period_of_report_date` is the END OF A QUARTER ALREADY REPORTED — a past
 *    date, and a fiscal period rather than an announcement. Deriving "earnings
 *    in 12 days" from it would be arithmetic on the wrong number. So the kind is
 *    NOT implemented and NOT faked; it needs an earnings-calendar source
 *    (Polygon Benzinga earnings, or a nightly ingest into a new table) before it
 *    can render a single row. FLAGGED, not skipped quietly.
 */
function mapSignals(section: unknown): SignalRowVM[] {
  const seen = new Set<string>();
  return rows<RawForYouItem>(section, "items")
    .filter((it) => {
      if (typeof it?.ticker !== "string" || typeof it?.delta !== "string") return false;
      // Drop the core's no-news line. A row that says "nothing changed" is not a
      // signal, and three of them stacked under "YOUR SIGNALS" reads as a screen
      // pretending to have content.
      if (it.delta.trim() === FORYOU_FILLER) return false;
      if (seen.has(it.delta)) return false;
      seen.add(it.delta);
      return true;
    })
    .slice(0, SIGNAL_LIMIT)
    .map((it) => {
      const net = typeof it.sentimentNet === "number" ? Math.abs(it.sentimentNet) : 0;
      // The count pill belongs to the row whose REASON is the stance move. A
      // row the core chose to speak about research reads may also carry a net,
      // but pinning a number to a sentence that is not about it is how a badge
      // stops meaning anything.
      const isOpinions = it.kind === "sentiment" && net > 0;
      const armed = it.watchState === "triggered" || it.watchState === "near_trigger";
      return {
        ticker: (it.ticker as string).toUpperCase(),
        text: it.delta as string,
        // A member's own Kai Watch reaching its level outranks the Club's
        // opinion count — it is the more personal thing we know about the row.
        affordance: armed ? ("add" as const) : isOpinions ? ("count" as const) : ("go" as const),
        count: !armed && isOpinions ? net : null,
      };
    });
}

/**
 * Below this, the brief's raw activity tally is noise dressed as news: "1
 * research look across the Club in the last day" is a true sentence that tells a
 * member nothing, and it was the whole brief on the live club.
 */
const BRIEF_MIN_ACTIVITY = 5;

/**
 * Is this brief item a bare activity count rather than something about the
 * market?
 *
 * Deliberately narrow: ONE kind (`research_velocity`, the brief route's item 1),
 * and only while its own count is under the floor. Every other kind the route
 * emits — watcher growth, sentiment shift, and the rest — names a ticker or a
 * move, and passes untouched. A club with real research volume also passes.
 */
function isDegenerateBriefItem(item: RawBriefItem): boolean {
  if (item.kind !== "research_velocity") return false;
  const count = Number(String(item.text ?? "").match(/^\s*([\d,]+)/)?.[1]?.replace(/,/g, ""));
  return Number.isFinite(count) && count < BRIEF_MIN_ACTIVITY;
}

/**
 * The brief's lead line — the first item that actually says something. When the
 * only thing the brief managed was a degenerate count, this is null and the
 * panel renders its index chips plus an honest waiting line.
 */
/** Every brief item worth saying out loud, in the order the brief put them. */
function briefItemsWorthSaying(brief: unknown): string[] {
  return rows<RawBriefItem>(brief, "items")
    .filter(
      (it) =>
        typeof it?.text === "string" && it.text.trim().length > 0 && !isDegenerateBriefItem(it),
    )
    .map((it) => (it.text as string).trim());
}

function mapBriefLine(brief: unknown): string | null {
  return briefItemsWorthSaying(brief)[0] ?? null;
}

/**
 * What the ▶ on "Today in 30 seconds" READS ALOUD.
 *
 * The panel prints the lead line; the button reads the whole brief, which is
 * what a thirty-second summary is and why the artboard put a play control on it
 * rather than beside a paragraph. Both come from the SAME filter, so the button
 * can never be offered on a brief the panel decided had nothing in it — null
 * here and null there happen together, by construction.
 *
 * Nothing is composed or rewritten for the ear: these are the brief's own
 * sentences, joined. The cap is a safety rail on a TTS request, not an editorial
 * choice — the brief route emits a handful of items and has never come near it.
 */
const SPEECH_ITEM_LIMIT = 8;
const SPEECH_CHAR_LIMIT = 1200;

export function briefSpokenText(brief: unknown): string | null {
  const items = briefItemsWorthSaying(brief).slice(0, SPEECH_ITEM_LIMIT);
  if (items.length === 0) return null;
  const text = items.join(" ");
  return text.length > SPEECH_CHAR_LIMIT ? text.slice(0, SPEECH_CHAR_LIMIT) : text;
}

/**
 * The artboard's belt line + progress bar + ring, from lifetime XP.
 *
 * NOTE: the artboard's ring is labelled "SCORE". No member-score metric exists
 * anywhere in the data layer, so rather than fabricate one the ring is driven by
 * belt progress and the component labels it "XP". Same shape, honest number.
 */
function mapYou(xp: number | null): YouStripVM | null {
  if (typeof xp !== "number") return null;
  const { current, next, pct } = beltProgress(xp);
  const ladderTop = LEVELS[LEVELS.length - 1]?.min ?? 1;
  return {
    beltLabel: current.label,
    xp,
    target: next ? next.level.min : ladderTop,
    pct: Math.max(0, Math.min(100, Math.round(pct))),
  };
}

/**
 * THE BELL BADGE — alert events fired since this member last opened the hub.
 *
 * Source is the watermark the alerts hub already stamps
 * (`alert_prefs.hub_seen_at`, migration 195) counted against the member's own
 * `alert_events` rows. Both tables are own-row RLS, so the count is scoped by
 * the database rather than by a filter here.
 *
 * THE CHEAPEST REAL SOURCE. The watch adapter derives the same figure, but only
 * as a by-product of fetching forty events with their payloads and joining
 * prices — far too much work for a number in a top bar. This is a `head` count:
 * two small reads, no rows returned.
 *
 * NULL, NOT ZERO, in three cases, and each is a different kind of absence:
 *  - never visited the hub (`hub_seen_at` is null) — a first visit is not a pile
 *    of unread mail, so the badge stays off until there is a "since" to count
 *    from. This is the same rule getWatchAlerts applies to its own count pill.
 *  - the read failed — a badge is not worth a broken screen.
 *  - nothing new — zero unseen alerts is an absent badge, not a "0".
 */
async function readUnseenAlertCount(
  supabase: Awaited<ReturnType<typeof getRequestClient>>,
  userId: string
): Promise<number | null> {
  try {
    const { data: prefs } = await supabase
      .from("alert_prefs")
      .select("hub_seen_at")
      .eq("user_id", userId)
      .maybeSingle();
    const seenAt = (prefs as { hub_seen_at: string | null } | null)?.hub_seen_at ?? null;
    if (!seenAt) return null;

    const { count, error } = await supabase
      .from("alert_events")
      .select("id", { count: "exact", head: true })
      .gt("fired_at", seenAt);
    if (error || typeof count !== "number") return null;
    return count > 0 ? count : null;
  } catch {
    return null;
  }
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── fixtures branch ──────────────────────────────────────────────────────────

/**
 * The anonymous/preview view model.
 *
 * Structural data comes from the shared club fixtures so this path exercises the
 * same mappers as live. Three values have no fixture source at all and are the
 * artboard's own content, used here purely so the design proof is complete:
 * the greeting name, the notification count, and the index chips.
 */
function fixtureModel(): HomeViewModel {
  const fx = clubFixtures("scale");
  return {
    source: "fixtures",
    greetingName: "Marcus",
    initials: "MH",
    notificationCount: 12,
    trending: mapTrending(fx.trending),
    briefLine: mapBriefLine(fx.brief),
    indices: [
      { symbol: "SPY", changePct: 1.02 },
      { symbol: "QQQ", changePct: 1.35 },
      { symbol: "IWM", changePct: -4.21 },
    ],
    signals: mapSignals(fx.foryou),
    // Mid-ladder XP: the real belt ladder tops out at 3,200 (src/lib/xp.ts), so
    // a value like the artboard's 12,840 would peg the bar and ring at 100%.
    you: mapYou(2840),
  };
}

// ── entry point ──────────────────────────────────────────────────────────────

/**
 * Build the Home view model.
 *
 * /v3 is not behind the middleware's auth wall, so an anonymous visit is a
 * first-class case, not an error: it renders the same screen from fixtures.
 */
export async function getHomeViewModel(): Promise<HomeViewModel> {
  const user = await getRequestUser();
  if (!user) return fixtureModel();

  const supabase = await getRequestClient();
  const [route, profile, unseen] = await Promise.all([
    resolveHomeRoute(supabase),
    getRequestProfile(),
    readUnseenAlertCount(supabase, user.id),
  ]);

  const displayName = profile?.display_name?.trim() ?? "";
  const firstName =
    ("firstName" in route && route.firstName) || displayName.split(/\s+/)[0] || "there";
  const xp = "xp" in route ? route.xp : null;

  const { rest, brief } = buildClubHomeSeedSplit(supabase);
  // TODO(perf): `brief` costs ~3s because of its optional LLM polish step. The
  // old dashboard streams it on its own Suspense boundary; this screen awaits it
  // inline for v1. Move it behind Suspense before /v3 carries real traffic.
  const [seed, briefBody] = await Promise.all([rest, brief]);

  return {
    source: "live",
    greetingName: firstName,
    initials: initialsFrom(displayName || firstName),
    notificationCount: unseen,
    trending: mapTrending(seed?.trending),
    briefLine: mapBriefLine(briefBody),
    // Not in the seed — <IndexChips> fetches these client-side.
    indices: null,
    signals: mapSignals(seed?.foryou),
    you: mapYou(xp),
  };
}
