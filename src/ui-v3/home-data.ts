import "server-only";

import { getRequestClient, getRequestProfile, getRequestUser } from "@/lib/supabase/rsc";
import { resolveHomeRoute } from "@/lib/club/home-route";
import { buildClubHomeSeedSplit } from "@/lib/club/home-payload";
import { clubFixtures } from "@/lib/clubhome/fixtures";
import { beltProgress } from "@/lib/belts";
import { LEVELS } from "@/lib/xp";

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
   * The artboard's "78%" line. Real source is the trending core's `heat`
   * (0-100 club-score dial) or, failing that, `sentiment.bullPct`. Both are
   * genuine percentages, so `isPct` is true and the tile appends "%".
   */
  metric: number | null;
  /** False when `metric` is the unbounded raw attention `score`, which must NOT wear a % sign. */
  isPct: boolean;
  /** The artboard's "▲ 6" line — trending core `change` (club_change_14d). */
  delta: number | null;
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
  /** No notifications core exists yet — live always yields null and the badge is omitted. */
  notificationCount: number | null;
  trending: TrendingTileVM[];
  /** The artboard's one-liner under "TODAY IN 30 SECONDS" — brief core `items[0].text`. */
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
  sentiment?: { bullPct?: number | null } | null;
}
interface RawForYouItem {
  ticker?: string | null;
  delta?: string | null;
  watchState?: string | null;
}
interface RawBriefItem {
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

function mapTrending(section: unknown): TrendingTileVM[] {
  return rows<RawTrendingRow>(section, "rows")
    .filter((r) => typeof r?.ticker === "string" && r.ticker.length > 0)
    .slice(0, TRENDING_LIMIT)
    .map((r, i) => {
      // Prefer a real percentage. `heat` is the 0-100 club-score dial; bullPct
      // is the bull share. Only if BOTH are absent do we fall back to the raw
      // attention `score`, which is unbounded and therefore never gets a "%".
      const pct = r.heat ?? r.sentiment?.bullPct ?? null;
      const isPct = pct !== null;
      return {
        rank: r.rank ?? i + 1,
        ticker: (r.ticker as string).toUpperCase(),
        metric: isPct ? Math.round(pct) : (r.score ?? null),
        isPct,
        delta: r.change ?? null,
      };
    });
}

function mapSignals(section: unknown): SignalRowVM[] {
  const seen = new Set<string>();
  return rows<RawForYouItem>(section, "items")
    .filter((it) => {
      if (typeof it?.ticker !== "string" || typeof it?.delta !== "string") return false;
      if (seen.has(it.delta)) return false;
      seen.add(it.delta);
      return true;
    })
    .slice(0, SIGNAL_LIMIT)
    .map((it) => ({
      ticker: (it.ticker as string).toUpperCase(),
      text: it.delta as string,
      // watchState is the only real per-row state the foryou core exposes.
      affordance: it.watchState === "triggered" || it.watchState === "near_trigger" ? "add" : "go",
      count: null,
    }));
}

function mapBriefLine(brief: unknown): string | null {
  const first = rows<RawBriefItem>(brief, "items")[0];
  return typeof first?.text === "string" && first.text.length > 0 ? first.text : null;
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
  const [route, profile] = await Promise.all([resolveHomeRoute(supabase), getRequestProfile()]);

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
    // No notifications core exists. The badge stays off rather than showing a lie.
    notificationCount: null,
    trending: mapTrending(seed?.trending),
    briefLine: mapBriefLine(briefBody),
    // Not in the seed — <IndexChips> fetches these client-side.
    indices: null,
    signals: mapSignals(seed?.foryou),
    you: mapYou(xp),
  };
}
