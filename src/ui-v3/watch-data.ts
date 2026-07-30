import "server-only";

import {
  getRequestClient,
  getRequestProfile,
  getRequestTierState,
  getRequestUser,
} from "@/lib/supabase/rsc";
import { effectiveClubTier } from "@/lib/tier";
import { getCachedStanceShifts } from "@/lib/club/club-cache";
import { WATCH_STATE_META, SETUP_STATE_META, readSetupLevels } from "@/lib/alerts/watch-ui";
import { SETUP_LIFECYCLE_THRESHOLDS } from "@/lib/alerts/setup-lifecycle";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";
import type { WatchState } from "@/lib/alerts/watch-state";
import { getBars } from "@/lib/market/polygon";

/**
 * ui-v3 Watch — the ONLY data access the three Watch screens perform.
 *
 * Same contract as `home-data.ts`: components under
 * `src/ui-v3/components/watch` are pure presentation and receive a view model;
 * an anonymous visitor gets the identical component tree rendered from
 * fixtures, which is what makes the artboard side-by-side possible without
 * credentials.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT "N OF M CONDITIONS" ACTUALLY IS
 *
 * The artboards show a setup with a met/total condition dial. The data layer has
 * NO multi-condition grouping — there is no `setup_conditions` table, and each
 * `alert_rules` row is exactly one condition. So the group is assembled here out
 * of things that are genuinely evaluated, and nothing else:
 *
 *  1. The setup's OWN lifecycle conditions, which is precisely what
 *     `deriveSetupState()` (src/lib/alerts/setup-lifecycle.ts) compares each
 *     cron cycle: price vs the trigger level, volume vs 1.5x average, price vs
 *     the stop. Each is a comparison of two real numbers — the setup's stored
 *     level against the ticker's stored `screener_metrics` reading.
 *  2. The member's OWN active `alert_rules` on that ticker, each carrying its
 *     real evaluated state from the `watch_current_state` view. "Met" means the
 *     watch state is literally `triggered`.
 *
 * A condition with no reading available is reported as NOT met with a null
 * reading — never as met, and never dropped to flatter the fraction.
 *
 * WHAT IS DELIBERATELY NOT RENDERED
 *
 *  - "Est. Trigger: Today" (artboard 06). The engine evaluates conditions; it
 *    does not forecast a trigger time. That slot carries the real freshness of
 *    the evaluation instead.
 *  - "72% follow-through · 41 triggers" (artboard 19). No per-setup-pattern
 *    backtest exists. The slot carries the setup's own observational move since
 *    it was flagged, which is a fact, or is omitted.
 *  - "Share to Club" / "Dismiss" / "Share". No mutation endpoint exists for any
 *    of them, so no button is drawn for them.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ── view model: 06 Watch ─────────────────────────────────────────────────── */

export interface WatchDestinationVM {
  /** The artboard's own leading emoji. */
  glyph: string;
  title: string;
  /** The one number that says why you'd go here. Null when there is no source. */
  caption: string | null;
  /** A live count worth an accent pill; null renders the chevron instead. */
  badge: number | null;
  /** Null until that screen has a v3 artboard — the row stays inert. */
  href: string | null;
}

export interface SetupConditionVM {
  label: string;
  met: boolean;
  /** The measured value behind the verdict ("176.20", "1.4x"), when known. */
  reading: string | null;
}

export interface SetupProgressVM {
  title: string;
  met: number;
  conditions: SetupConditionVM[];
  /** Real evaluation freshness ("12m ago"); null when never evaluated. */
  evaluatedLabel: string | null;
  href: string | null;
}

export interface SetupTeaserVM {
  ticker: string;
  title: string;
  met: number;
  total: number;
  /** The setup's own expiry ("3 days"); null when it has none. */
  horizonLabel: string | null;
  href: string | null;
}

export interface WatchOverviewVM {
  source: "live" | "fixtures";
  destinations: WatchDestinationVM[];
  closest: SetupProgressVM | null;
  next: SetupTeaserVM | null;
}

/* ── view models: the four destinations behind "06 Watch" ─────────────────────
 *
 * NO ARTBOARD EXISTS for any of these four screens. They are composed strictly
 * from the grammar's existing primitives (GRAMMAR §9) — SectionEyebrow, the flat
 * list row, TickerTile, EmptyNote, SetupTeaserRow — and every field below is a
 * real column, view or RPC. Where a source genuinely does not exist (the
 * earnings feed) the model says so instead of carrying a shape it cannot fill.
 * ────────────────────────────────────────────────────────────────────────── */

/** One symbol on the member's own board (`family_watchlist`). */
export interface WatchlistRowVM {
  /** `family_watchlist.id` — the row the remove affordance deletes. */
  id: string;
  ticker: string;
  name: string | null;
  /** Last stored close from `screener_metrics`; null when the symbol has none. */
  priceLabel: string | null;
  changePct: number | null;
  /**
   * Distinct members watching, all-time (`ticker_intel_snapshots.watchers`).
   * Null when there is no snapshot row OR when the effective Club tier is free —
   * club intel is a Club entitlement, and this screen honours the same wall the
   * /api/club reads do rather than routing around it.
   */
  watchers: number | null;
  /**
   * False = the row is PRESERVED but no longer monitored, which is what the
   * free-tier active cap does (migration 144). It is a real state of the row,
   * so the screen shows it rather than implying everything is being watched.
   */
  monitored: boolean;
  href: string;
}

export interface WatchlistVM {
  source: "live" | "fixtures";
  /**
   * The family the rows belong to. The add/remove affordance writes under RLS
   * as the member, so it needs the id it is allowed to write; null means the
   * screen renders read-only (no family, or the fixtures path).
   */
  familyId: string | null;
  /** Who is adding. Stored as the row's champion, the way the old board does. */
  viewerId: string | null;
  rows: WatchlistRowVM[];
}

/** One armed `alert_rules` row and its evaluated `watch_current_state`. */
export interface KaiWatchRuleVM {
  id: string;
  ticker: string | null;
  /** The rule's own stored human summary, computed at create time. */
  label: string;
  /** The rule's condition family ("PRICE", "VOLUME", "52W"…). */
  kindLabel: string;
  /** WATCH_STATE_META label — null when the crons have never recorded a state. */
  stateLabel: string | null;
  /** near_trigger / triggered: the "look now" states. */
  stateLive: boolean;
  /** Real `last_checked_at` freshness; null when never evaluated. */
  checkedLabel: string | null;
  href: string | null;
}

export interface KaiWatchVM {
  source: "live" | "fixtures";
  rules: KaiWatchRuleVM[];
  /** Live `alert_setups`, reusing the overview's teaser shape. */
  setups: SetupTeaserVM[];
}

export interface EarningsRowVM {
  ticker: string;
  name: string | null;
  /** "Before open" / "After close" — never guessed. */
  session: string | null;
  href: string;
}

export interface EarningsDayVM {
  day: string;
  rows: EarningsRowVM[];
}

export interface EarningsVM {
  source: "live" | "fixtures";
  /** How many of the member's symbols the calendar would be scoped to. */
  symbols: number | null;
  /**
   * ALWAYS EMPTY TODAY. There is no earnings-date source in this application:
   * no earnings table or column in any migration, no earnings call on the
   * Polygon client, and no ingest route in this repo. The shape is declared so
   * the screen is ready for a feed, and `getWatchEarnings()` refuses to
   * manufacture dates in the meantime.
   */
  days: EarningsDayVM[];
}

/** A ticker the club changed its mind about, from `get_stance_shifts`. */
export interface OpinionChangeVM {
  ticker: string;
  /** Members who moved their stance inside the window. */
  shifts: number;
  /** Net stance NOW: positive = more bulls than bears. Zero = evenly split. */
  net: number;
  href: string;
}

export interface OpinionChangesVM {
  source: "live" | "fixtures";
  /** The window the RPC was asked for, so the screen can name it honestly. */
  hours: number;
  rows: OpinionChangeVM[];
}

/* ── view model: 18 Kai Alerts ────────────────────────────────────────────── */

export type AlertKindVM = "buy" | "sell" | "headsup";

/** A run of the alert sentence; `tone` sets it in mono in the run's own color. */
export interface AlertSegment {
  text: string;
  tone?: "entry" | "invalid" | "figure";
}

export interface AlertActionVM {
  label: string;
  href: string;
}

export interface AlertCardVM {
  id: string;
  kind: AlertKindVM;
  kindLabel: string;
  ticker: string;
  time: string | null;
  body: AlertSegment[];
  chips: string[];
  primary: AlertActionVM | null;
  secondary: AlertActionVM | null;
}

export interface AlertDigestVM {
  id: string;
  kind: AlertKindVM;
  kindLabel: string;
  ticker: string;
  status: string;
  /** Observational move since the alert fired. Never graded win/loss. */
  sincePct: number | null;
  href: string | null;
}

export interface AlertGroupVM {
  day: string;
  /** Full cards for the freshest group. */
  cards: AlertCardVM[];
  /** Compressed rows for older groups. */
  rows: AlertDigestVM[];
}

export interface AlertsVM {
  source: "live" | "fixtures";
  /** "Generated from your watchlist · 6:02 AM" — the real generation time. */
  generatedLabel: string | null;
  /** Unseen since `alert_prefs.hub_seen_at`; null when never visited. */
  newCount: number | null;
  groups: AlertGroupVM[];
}

/* ── view model: 19 Alert Setup ───────────────────────────────────────────── */

/**
 * The artboard's inline SVG, resolved to geometry. The chart is drawn directly
 * as SVG (no charting library): a price polyline plus the setup's own level
 * bands, all in the artboard's 330x120 user space.
 */
export interface SetupChartVM {
  /** The close polyline, "M x y L x y …". */
  path: string;
  /** The last point, where the artboard puts its accent dot. */
  markerX: number;
  markerY: number;
  /** Entry zone as a filled band + its two dashed edges. */
  entryBand: { y: number; height: number } | null;
  entryEdges: number[];
  /** Invalidation zone below the stop. */
  invalidBand: { y: number; height: number } | null;
  invalidEdge: number | null;
  entryLabel: string | null;
  invalidLabel: string | null;
}

export interface NotifySettingVM {
  label: string;
  on: boolean;
}

export interface SetupDetailVM {
  source: "live" | "fixtures";
  id: string;
  ticker: string;
  title: string;
  /** "Kai Watch setup · created 4 days ago". */
  subtitle: string;
  /** "3/3 LIVE" style status: the real met/total plus the lifecycle label. */
  statusLabel: string;
  statusLive: boolean;
  quote: { price: number; changePct: number | null } | null;
  chart: SetupChartVM | null;
  conditions: SetupConditionVM[];
  met: number;
  notify: NotifySettingVM[];
  /** True when the member has a `setup_subscriptions` row for this setup. */
  followed: boolean;
  /** The observational move since Kai flagged it, or null. */
  sinceLine: string | null;
}

/* ── small shared helpers ─────────────────────────────────────────────────── */

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Every read below is optional: a missing table, an RLS-empty result and a
 * network failure all mean "no data", never a thrown screen. Supabase's builders
 * are PromiseLike rather than Promise, so this wraps them properly.
 */
async function soft<T>(work: () => PromiseLike<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

/** "12m ago" / "3h ago" / "4 days" — the bare value, no faked recency. */
function relAge(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const mins = Math.max(0, Math.round((now - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** "3 days" — time REMAINING, for a setup's expiry. Null once elapsed. */
function relHorizon(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= now) return null;
  const hrs = Math.round((t - now) / 3_600_000);
  if (hrs < 24) return `${Math.max(1, hrs)}h`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function clockLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

/** Today / Yesterday / "Jul 12" — the artboard's day rules. */
function dayLabel(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const days = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) /
      86_400_000
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function kindFromDirection(direction: string | null | undefined): AlertKindVM {
  if (direction === "long") return "buy";
  if (direction === "short") return "sell";
  return "headsup";
}

const CARD_KIND_LABEL: Record<AlertKindVM, string> = {
  buy: "BUY SIGNAL",
  sell: "SELL SIGNAL",
  headsup: "HEADS UP",
};

const ROW_KIND_LABEL: Record<AlertKindVM, string> = {
  buy: "BUY",
  sell: "SELL",
  headsup: "WATCH",
};

/**
 * Two number voices, exactly as the artboards use them.
 *
 * `level` names a level inside a sentence or a chart tag — the artboard writes
 * those as the round numbers a trader says out loud ("Price above 176",
 * "ENTRY 173–176"), so a whole number keeps no decimals.
 *
 * `money` is a MEASUREMENT — the reading that settles whether a condition holds
 * ("176.20 ✓") — and always carries its cents.
 */
const level = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2))));
const money = (v: number) => v.toFixed(2);

/* ── condition assembly ───────────────────────────────────────────────────── */

interface SetupRow {
  id: string;
  ticker: string;
  direction: string | null;
  thesis: string | null;
  entry: number | null;
  levels: Record<string, unknown> | null;
  snapshot_price: number | null;
  state: string | null;
  state_entered_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface MetricRow {
  ticker: string;
  price: number | null;
  vol_ratio: number | null;
}

interface RuleRow {
  id: string;
  kind: string;
  ticker: string | null;
  label: string;
  last_checked_at: string | null;
}

interface RuleStateRow {
  rule_id: string;
  state: string;
  detail: Record<string, unknown> | null;
}

/**
 * The setup's own lifecycle conditions, evaluated exactly the way
 * `deriveSetupState()` evaluates them.
 *
 * Long setups clear their entry/resistance to the upside and hold above their
 * stop; shorts are the mirror. A level the setup does not define produces no
 * condition at all — an absent level is not a failed one.
 */
function setupConditions(setup: SetupRow, metric: MetricRow | null): SetupConditionVM[] {
  const isShort = setup.direction === "short";
  const levels = readSetupLevels(setup.levels as Record<string, unknown> | null);
  const trigger = num(setup.entry) ?? (isShort ? levels.support : levels.resistance);
  const stop = levels.stop;
  const price = num(metric?.price);
  const volRatio = num(metric?.vol_ratio);
  const out: SetupConditionVM[] = [];

  if (trigger !== null) {
    out.push({
      label: isShort ? `Breaks below ${level(trigger)}` : `Price above ${level(trigger)}`,
      met: price !== null && (isShort ? price <= trigger : price >= trigger),
      reading: price !== null ? money(price) : null,
    });
  }

  if (volRatio !== null || trigger !== null) {
    const threshold = SETUP_LIFECYCLE_THRESHOLDS.confirmVolRatio;
    out.push({
      label: `Volume expansion > ${threshold}x avg`,
      met: volRatio !== null && volRatio >= threshold,
      reading: volRatio !== null ? `${volRatio.toFixed(1)}x` : null,
    });
  }

  if (stop !== null) {
    out.push({
      label: isShort ? `Holding below ${level(stop)}` : `Holding above ${level(stop)}`,
      met: price !== null && (isShort ? price < stop : price > stop),
      reading: price !== null ? money(price) : null,
    });
  }

  return out;
}

/**
 * The member's own watches on the ticker, each a real condition with a real
 * evaluated state. `triggered` is the only state that counts as met — the
 * intermediate `building` / `near_trigger` states are explicitly not-yet.
 */
function ruleConditions(
  rules: RuleRow[],
  states: Map<string, RuleStateRow>
): SetupConditionVM[] {
  return rules.map((rule) => {
    const st = states.get(rule.id);
    const state = (st?.state ?? null) as WatchState | null;
    const metric = typeof st?.detail?.metric === "string" ? (st.detail.metric as string) : null;
    return {
      label: rule.label || rule.kind.replace(/_/g, " "),
      met: state === "triggered",
      reading: metric ?? (state ? WATCH_STATE_META[state]?.label ?? null : null),
    };
  });
}

/* ── the chart, translated from the artboard's SVG ────────────────────────── */

const CHART_W = 330;
/** The artboard keeps its line and bands inside this vertical inset of the 120px box. */
const CHART_TOP = 12;
const CHART_BOTTOM = 108;

/**
 * Map a real close series and the setup's real levels into the artboard's
 * 330x120 user space. Returns null when there is no series to draw — the card
 * is omitted rather than showing an invented shape.
 */
function buildChart(
  closes: number[],
  entryLow: number | null,
  entryHigh: number | null,
  stop: number | null
): SetupChartVM | null {
  if (closes.length < 2) return null;

  const values = [...closes, entryLow, entryHigh, stop].filter(
    (v): v is number => v !== null && Number.isFinite(v)
  );
  const low = Math.min(...values);
  const high = Math.max(...values);
  /*
   * Pad the price domain by 15% of its own span at both ends.
   *
   * Without it, whichever value is the extreme lands flush on the plot edge —
   * and since the stop is usually the lowest number in the set, the
   * invalidation zone collapses to a hairline. The artboard's own scale carries
   * the same headroom: its stop sits at y=88 in a 120-tall box, not on the
   * floor. This changes only the framing, never a value.
   */
  const pad = (high - low || 1) * 0.15;
  const min = low - pad;
  const span = high + pad - min;
  const y = (v: number) =>
    CHART_BOTTOM - ((v - min) / span) * (CHART_BOTTOM - CHART_TOP);
  const x = (i: number) => (i / (closes.length - 1)) * CHART_W;

  const path = closes
    .map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(c).toFixed(1)}`)
    .join(" ");

  let entryBand: { y: number; height: number } | null = null;
  const entryEdges: number[] = [];
  if (entryLow !== null && entryHigh !== null) {
    const top = y(Math.max(entryLow, entryHigh));
    const bottom = y(Math.min(entryLow, entryHigh));
    entryBand = { y: top, height: Math.max(2, bottom - top) };
    entryEdges.push(top, bottom);
  } else if (entryHigh !== null) {
    entryEdges.push(y(entryHigh));
  }

  let invalidBand: { y: number; height: number } | null = null;
  let invalidEdge: number | null = null;
  if (stop !== null) {
    invalidEdge = y(stop);
    invalidBand = { y: invalidEdge, height: Math.max(2, CHART_BOTTOM - invalidEdge) };
  }

  const entryLabel =
    entryLow !== null && entryHigh !== null
      ? `ENTRY ${level(Math.min(entryLow, entryHigh))}–${level(Math.max(entryLow, entryHigh))}`
      : entryHigh !== null
        ? `ENTRY ${level(entryHigh)}`
        : null;

  return {
    path,
    markerX: CHART_W,
    markerY: Number(y(closes[closes.length - 1]).toFixed(1)),
    entryBand,
    entryEdges,
    invalidBand,
    invalidEdge,
    entryLabel,
    invalidLabel: stop !== null ? `INVALID < ${level(stop)}` : null,
  };
}

/* ── fixtures ─────────────────────────────────────────────────────────────── */

/*
 * The anonymous / preview view models.
 *
 * `clubFixtures()` has no watch or alerts key (its nine keys are pulse,
 * collective, invite, brief, trending, thinking, debate, foryou, people), so
 * unlike Home these fixtures cannot be derived from the shared set. They are the
 * artboards' OWN content, present so the design proof is complete, and they are
 * reachable only when there is no authenticated user.
 *
 * Note what they do NOT contain: no "Est. Trigger", no follow-through
 * percentage, no earnings count. A fixture that shows a capability the live path
 * cannot is a lie with extra steps.
 */

const FIXTURE_SETUP_ID = "fixture-nvda-bullish-break";

/**
 * Where the four destination rows go. Declared once because the fixtures path
 * and the live path must send a visitor to the SAME screen — a row that is a
 * link for an anonymous visitor and inert for a member would be the exact
 * "collapses once you log in" failure these screens exist to fix.
 */
const WATCH_DEST_HREF = {
  watchlist: "/v3/watch/list",
  kaiWatch: "/v3/watch/setups",
  earnings: "/v3/watch/earnings",
  changes: "/v3/watch/changes",
} as const;

/** A ticker's own screen. Owned by another lane; the link resolves at merge. */
const tickerHref = (ticker: string) => `/v3/ticker/${ticker.toUpperCase()}`;

function fixtureOverview(): WatchOverviewVM {
  return {
    source: "fixtures",
    destinations: [
      {
        glyph: "📈",
        title: "My Watchlist",
        caption: "28 symbols",
        badge: null,
        href: WATCH_DEST_HREF.watchlist,
      },
      {
        glyph: "🐋",
        title: "Kai Watch",
        caption: "6 active watches",
        badge: 2,
        href: WATCH_DEST_HREF.kaiWatch,
      },
      {
        glyph: "🗓",
        title: "Earnings Calendar",
        caption: null,
        badge: null,
        href: WATCH_DEST_HREF.earnings,
      },
      {
        glyph: "🔁",
        title: "Opinion Changes",
        caption: "4 tickers shifted today",
        badge: null,
        href: WATCH_DEST_HREF.changes,
      },
    ],
    closest: {
      title: "NVDA Bullish Break",
      met: 2,
      conditions: [
        { label: "Price above 176", met: true, reading: "176.20" },
        { label: "Volume expansion > 1.5x avg", met: true, reading: "1.4x" },
        { label: "Holding above 166", met: false, reading: "173.42" },
      ],
      evaluatedLabel: "12m ago",
      href: `/v3/watch/alerts/${FIXTURE_SETUP_ID}`,
    },
    next: {
      ticker: "TSLA",
      title: "TSLA earnings setup",
      met: 1,
      total: 3,
      horizonLabel: "3 days",
      href: null,
    },
  };
}

function fixtureAlerts(): AlertsVM {
  return {
    source: "fixtures",
    generatedLabel: "Generated from your watchlist · 6:02 AM",
    newCount: 3,
    groups: [
      {
        day: "Today",
        cards: [
          {
            id: "fx-1",
            kind: "buy",
            kindLabel: CARD_KIND_LABEL.buy,
            ticker: "NVDA",
            time: "6:02 AM",
            body: [
              { text: "Bullish break setup completed 3 of 3 conditions. Entry zone " },
              { text: "173–176", tone: "entry" },
              { text: ", invalidation below " },
              { text: "166", tone: "invalid" },
              { text: "." },
            ],
            chips: ["RSI reset ✓", "Volume 3.1x ✓", "Club shift +14 ✓"],
            primary: { label: "View setup", href: `/v3/watch/alerts/${FIXTURE_SETUP_ID}` },
            secondary: null,
          },
          {
            id: "fx-2",
            kind: "sell",
            kindLabel: CARD_KIND_LABEL.sell,
            ticker: "RIVN",
            time: "6:02 AM",
            body: [
              {
                text: "Distribution pattern confirmed — declining volume on every bounce. Kai flags exit into strength above ",
              },
              { text: "14.80", tone: "invalid" },
              { text: "." },
            ],
            chips: ["Lower highs ✗", "Club 61% bearish", "Put flow rising"],
            primary: null,
            secondary: null,
          },
          {
            id: "fx-3",
            kind: "headsup",
            kindLabel: CARD_KIND_LABEL.headsup,
            ticker: "TSLA",
            time: "6:02 AM",
            body: [
              { text: "Earnings in 3 days. Implied move " },
              { text: "±8.4%", tone: "figure" },
              { text: " — the Club flipped 24 opinions this week. Consider sizing down." },
            ],
            chips: [],
            primary: null,
            secondary: null,
          },
        ],
        rows: [],
      },
      {
        day: "Yesterday",
        cards: [],
        rows: [
          {
            id: "fx-4",
            kind: "buy",
            kindLabel: ROW_KIND_LABEL.buy,
            ticker: "SMCI",
            status: "Triggered",
            sincePct: 6.1,
            href: null,
          },
        ],
      },
    ],
  };
}

function fixtureSetup(): SetupDetailVM {
  // A plausible 13-close series so the polyline has the artboard's shape. These
  // are fixture prices, reachable only with no session — never a live fallback.
  const closes = [
    166.4, 167.9, 167.2, 169.8, 168.9, 171.4, 170.6, 173.1, 172.2, 174.6, 173.9, 175.8, 176.2,
  ];
  const chart = buildChart(closes, 173, 176, 166);
  return {
    source: "fixtures",
    id: FIXTURE_SETUP_ID,
    ticker: "NVDA",
    title: "NVDA Bullish Break",
    subtitle: "Kai Watch setup · created 4 days ago",
    statusLabel: "3/3 LIVE",
    statusLive: true,
    quote: { price: 173.42, changePct: 4.7 },
    chart,
    conditions: [
      { label: "Price above 176 resistance", met: true, reading: "176.20" },
      { label: "Volume expansion > 1.5x avg", met: true, reading: "1.4x" },
      { label: "Holding above 166", met: true, reading: "173.42" },
    ],
    met: 3,
    notify: [
      { label: "Push when this setup confirms", on: true },
      { label: "Invalidation warning (close < 166)", on: true },
      { label: "Hold for the daily digest instead", on: false },
    ],
    followed: true,
    sinceLine: "Since Kai flagged it: +4.4%",
  };
}

/* ── 06 Watch ─────────────────────────────────────────────────────────────── */

/**
 * Build the Watch overview view model.
 *
 * /v3 sits outside the middleware's protected paths, so an anonymous visit is a
 * first-class case rather than an error: it renders the same screen from
 * fixtures.
 */
export async function getWatchOverview(): Promise<WatchOverviewVM> {
  const user = await getRequestUser();
  if (!user) return fixtureOverview();

  const [supabase, profile] = await Promise.all([getRequestClient(), getRequestProfile()]);

  const [watchlistCount, rules, shifts, setups] = await Promise.all([
    // Real symbol count, family-scoped like the rest of the watchlist.
    profile?.family_id
      ? soft(
          async () =>
            (
              await supabase
                .from("family_watchlist")
                .select("id", { count: "exact", head: true })
                .eq("family_id", profile.family_id as string)
            ).count ?? null,
          null as number | null
        )
      : Promise.resolve<number | null>(null),
    readActiveRules(supabase, null),
    soft(() => getCachedStanceShifts(24), [] as { ticker: string }[]),
    soft(
      async () =>
        ((
          await supabase
            .from("alert_setups")
            .select(
              "id, ticker, direction, thesis, entry, levels, snapshot_price, state, state_entered_at, expires_at, created_at"
            )
            .in("state", ["waiting", "confirmed"])
            .order("created_at", { ascending: false })
            .limit(20)
        ).data ?? []) as unknown as SetupRow[],
      [] as SetupRow[]
    ),
  ]);

  // Current watch state per rule, for the Kai Watch badge and the conditions.
  const states = await readRuleStates(
    supabase,
    rules.map((r) => r.id)
  );
  const liveWatches = [...states.values()].filter(
    (s) => s.state === "near_trigger" || s.state === "triggered"
  ).length;

  const destinations: WatchDestinationVM[] = [
    {
      glyph: "📈",
      title: "My Watchlist",
      caption: watchlistCount === null ? null : `${watchlistCount} symbols`,
      badge: null,
      href: WATCH_DEST_HREF.watchlist,
    },
    {
      glyph: "🐋",
      title: "Kai Watch",
      caption: rules.length > 0 ? `${rules.length} active watches` : null,
      badge: liveWatches > 0 ? liveWatches : null,
      href: WATCH_DEST_HREF.kaiWatch,
    },
    {
      // The artboard's caption here is "This week: 17 companies". No earnings
      // source exists in this application — no table, no column, no Polygon
      // call, no ingest route (see EarningsVM) — so the row keeps its
      // destination and drops the count. A fabricated "this week" would be the
      // one lie on the screen, and it would be the lie a member acts on.
      glyph: "🗓",
      title: "Earnings Calendar",
      caption: null,
      badge: null,
      href: WATCH_DEST_HREF.earnings,
    },
    {
      glyph: "🔁",
      title: "Opinion Changes",
      caption:
        shifts.length > 0
          ? `${shifts.length} ticker${shifts.length === 1 ? "" : "s"} shifted today`
          : null,
      badge: null,
      href: WATCH_DEST_HREF.changes,
    },
  ];

  // Score the live setups by how much of their condition set holds, and render
  // the top two: the leader as the panel, the runner-up as the teaser row.
  const metrics = await readMetrics(
    supabase,
    setups.map((s) => s.ticker)
  );
  const scored = setups
    .map((setup) => {
      const conditions = [
        ...setupConditions(setup, metrics.get(setup.ticker.toUpperCase()) ?? null),
        ...ruleConditions(
          rules.filter((r) => (r.ticker ?? "").toUpperCase() === setup.ticker.toUpperCase()),
          states
        ),
      ];
      const met = conditions.filter((c) => c.met).length;
      return { setup, conditions, met, ratio: conditions.length ? met / conditions.length : 0 };
    })
    .filter((s) => s.conditions.length > 0)
    .sort((a, b) => b.ratio - a.ratio || b.met - a.met);

  const lead = scored[0] ?? null;
  const runnerUp = scored[1] ?? null;

  // Freshness comes from the real last_checked_at of the rules behind the lead,
  // falling back to when the setup last changed state.
  const leadFresh = lead
    ? (rules
        .filter((r) => (r.ticker ?? "").toUpperCase() === lead.setup.ticker.toUpperCase())
        .map((r) => r.last_checked_at)
        .filter((v): v is string => Boolean(v))
        .sort()
        .pop() ?? lead.setup.state_entered_at)
    : null;

  return {
    source: "live",
    destinations,
    closest: lead
      ? {
          title: setupTitle(lead.setup),
          met: lead.met,
          conditions: lead.conditions,
          evaluatedLabel: relAge(leadFresh),
          href: `/v3/watch/alerts/${lead.setup.id}`,
        }
      : null,
    next: runnerUp
      ? {
          ticker: runnerUp.setup.ticker.toUpperCase(),
          title: setupTitle(runnerUp.setup),
          met: runnerUp.met,
          total: runnerUp.conditions.length,
          horizonLabel: relHorizon(runnerUp.setup.expires_at),
          href: `/v3/watch/alerts/${runnerUp.setup.id}`,
        }
      : null,
  };
}

/** The setup's own thesis is its name; absent that, the plainest true label. */
function setupTitle(setup: SetupRow): string {
  const thesis = (setup.thesis ?? "").trim();
  if (thesis) return thesis.length > 48 ? `${thesis.slice(0, 45).trimEnd()}…` : thesis;
  return `${setup.ticker.toUpperCase()} setup`;
}

type DB = Awaited<ReturnType<typeof getRequestClient>>;

/** Latest stored reading per ticker — the price and volume the engine compares. */
async function readMetrics(supabase: DB, tickers: string[]): Promise<Map<string, MetricRow>> {
  const out = new Map<string, MetricRow>();
  const unique = [...new Set(tickers.map((t) => t.toUpperCase()))].filter(Boolean);
  if (unique.length === 0) return out;
  const rows = await soft(
    async () =>
      ((
        await supabase.from("screener_metrics").select("ticker, price, vol_ratio").in("ticker", unique)
      ).data ?? []) as unknown as MetricRow[],
    [] as MetricRow[]
  );
  for (const row of rows) out.set(row.ticker.toUpperCase(), row);
  return out;
}

/** The member's active watches, optionally narrowed to one ticker. */
async function readActiveRules(supabase: DB, ticker: string | null): Promise<RuleRow[]> {
  return soft(async () => {
    let q = supabase
      .from("alert_rules")
      .select("id, kind, ticker, label, last_checked_at")
      .eq("active", true);
    if (ticker) q = q.eq("ticker", ticker);
    return ((await q).data ?? []) as unknown as RuleRow[];
  }, [] as RuleRow[]);
}

/** Each rule's current evaluated watch state, keyed by rule id. */
async function readRuleStates(
  supabase: DB,
  ruleIds: string[]
): Promise<Map<string, RuleStateRow>> {
  const out = new Map<string, RuleStateRow>();
  if (ruleIds.length === 0) return out;
  const rows = await soft(
    async () =>
      ((
        await supabase
          .from("watch_current_state")
          .select("rule_id, state, detail")
          .in("rule_id", ruleIds)
      ).data ?? []) as unknown as RuleStateRow[],
    [] as RuleStateRow[]
  );
  for (const row of rows) out.set(row.rule_id, row);
  return out;
}

/* ── 18 Kai Alerts ────────────────────────────────────────────────────────── */

interface EventRow {
  id: string;
  ticker: string;
  kind: string;
  payload: Record<string, unknown> | null;
  fired_at: string;
}

/**
 * Build the alert stream.
 *
 * Source is the member's own `alert_events` rows (own-row RLS), which is where
 * every fired rule, broadcast, Kai watch update and setup update lands. The
 * artboard's grouping — full cards for the freshest day, compressed rows for
 * older days — is applied to whatever really fired.
 */
export async function getWatchAlerts(): Promise<AlertsVM> {
  const user = await getRequestUser();
  if (!user) return fixtureAlerts();

  const supabase = await getRequestClient();

  const [events, prefs] = await Promise.all([
    soft(
      async () =>
        ((
          await supabase
            .from("alert_events")
            .select("id, ticker, kind, payload, fired_at")
            .order("fired_at", { ascending: false })
            .limit(40)
        ).data ?? []) as unknown as EventRow[],
      [] as EventRow[]
    ),
    soft(
      async () =>
        ((
          await supabase.from("alert_prefs").select("hub_seen_at").eq("user_id", user.id).maybeSingle()
        ).data ?? null) as { hub_seen_at: string | null } | null,
      null as { hub_seen_at: string | null } | null
    ),
  ]);

  const seenAt = prefs?.hub_seen_at ?? null;
  // A first visit is not a pile of unread mail — null, not the whole stream.
  const newCount = seenAt ? events.filter((e) => e.fired_at > seenAt).length : null;

  // Current price per ticker, for the observational move on older alerts.
  const metrics = await readMetrics(
    supabase,
    events.map((e) => e.ticker)
  );

  const byDay = new Map<string, EventRow[]>();
  for (const event of events) {
    const day = dayLabel(event.fired_at);
    const list = byDay.get(day);
    if (list) list.push(event);
    else byDay.set(day, [event]);
  }

  const groups: AlertGroupVM[] = [];
  let first = true;
  for (const [day, rows] of byDay) {
    if (first) {
      groups.push({ day, cards: rows.slice(0, 6).map(toCard), rows: [] });
      first = false;
    } else {
      groups.push({
        day,
        cards: [],
        rows: rows.slice(0, 6).map((event) => toDigestRow(event, metrics)),
      });
    }
    if (groups.length >= 3) break;
  }

  return {
    source: "live",
    // The stream's own newest timestamp is the only honest "generated at".
    generatedLabel: events[0]
      ? `Generated from your watchlist · ${clockLabel(events[0].fired_at) ?? ""}`.trim()
      : null,
    newCount,
    groups,
  };
}

function toCard(event: EventRow): AlertCardVM {
  const payload = event.payload ?? {};
  const kind = kindFromDirection(payload.direction as string | undefined);
  const message = typeof payload.message === "string" ? payload.message : "";
  const setupId = typeof payload.setup_id === "string" ? payload.setup_id : null;
  const condition = typeof payload.condition === "string" ? payload.condition.trim() : "";
  const snapshot = num(payload.snapshot_price);

  const body: AlertSegment[] = [];
  if (message) body.push({ text: message });
  // The alert's own reference price, set in mono the way the artboard sets its
  // levels inside the sentence.
  if (snapshot !== null) {
    body.push({ text: message ? " Price at issue " : "Price at issue " });
    body.push({ text: money(snapshot), tone: kind === "sell" ? "invalid" : "entry" });
    body.push({ text: "." });
  }
  if (body.length === 0) body.push({ text: `${event.ticker.toUpperCase()} update.` });

  const chips: string[] = [];
  if (condition) chips.push(condition);
  if (payload.delayed === true) chips.push("delayed data");

  return {
    id: event.id,
    kind,
    kindLabel: CARD_KIND_LABEL[kind],
    ticker: event.ticker.toUpperCase(),
    time: clockLabel(event.fired_at),
    body,
    chips,
    // "View setup" is the one action with a real destination. "Share to Club"
    // and "Dismiss" have no endpoint, so no button is drawn for them.
    primary: setupId ? { label: "View setup", href: `/v3/watch/alerts/${setupId}` } : null,
    secondary: null,
  };
}

function toDigestRow(event: EventRow, metrics: Map<string, MetricRow>): AlertDigestVM {
  const payload = event.payload ?? {};
  const kind = kindFromDirection(payload.direction as string | undefined);
  const state = typeof payload.state === "string" ? (payload.state as WatchState) : null;
  const base = num(payload.snapshot_price);
  const now = num(metrics.get(event.ticker.toUpperCase())?.price);
  const setupId = typeof payload.setup_id === "string" ? payload.setup_id : null;

  return {
    id: event.id,
    kind,
    kindLabel: ROW_KIND_LABEL[kind],
    ticker: event.ticker.toUpperCase(),
    status: (state && WATCH_STATE_META[state]?.label) || "Fired",
    sincePct: base !== null && base > 0 && now !== null ? ((now - base) / base) * 100 : null,
    href: setupId ? `/v3/watch/alerts/${setupId}` : null,
  };
}

/* ── 19 Alert Setup ───────────────────────────────────────────────────────── */

/**
 * Build one setup's detail view model.
 *
 * Returns null when the id matches no readable setup, which the route turns
 * into a 404. The fixture id is honoured only when there is no session, so a
 * signed-in member can never be shown fixture prices.
 */
export async function getWatchSetup(id: string): Promise<SetupDetailVM | null> {
  const user = await getRequestUser();
  if (!user) return id === FIXTURE_SETUP_ID ? fixtureSetup() : null;

  const supabase = await getRequestClient();
  const setup = await soft(
    async () =>
      ((
        await supabase
          .from("alert_setups")
          .select(
            "id, ticker, direction, thesis, entry, levels, snapshot_price, state, state_entered_at, expires_at, created_at"
          )
          .eq("id", id)
          .maybeSingle()
      ).data ?? null) as unknown as SetupRow | null,
    null as SetupRow | null
  );
  if (!setup) return null;

  const ticker = setup.ticker.toUpperCase();

  const [metrics, rules, subscription, bars] = await Promise.all([
    readMetrics(supabase, [ticker]),
    readActiveRules(supabase, ticker),
    soft(
      async () =>
        Boolean(
          (await supabase.from("setup_subscriptions").select("id").eq("setup_id", setup.id).maybeSingle())
            .data
        ),
      false
    ),
    // Daily closes for the chart. Absent market data means no chart, not a
    // drawn-from-nothing line.
    soft(() => getBars(ticker, 60), null),
  ]);

  const states = await readRuleStates(
    supabase,
    rules.map((r) => r.id)
  );

  const metric = metrics.get(ticker) ?? null;
  const conditions = [...setupConditions(setup, metric), ...ruleConditions(rules, states)];
  const met = conditions.filter((c) => c.met).length;

  const levels = readSetupLevels(setup.levels as Record<string, unknown> | null);
  const entryHigh = num(setup.entry) ?? levels.resistance;
  const entryLow = levels.support;
  const chart = bars
    ? buildChart(
        bars.map((b) => b.c),
        entryLow,
        entryHigh,
        levels.stop
      )
    : null;

  const price = num(metric?.price);
  const base = num(setup.snapshot_price);
  const state = (setup.state ?? "waiting") as SetupState;
  const stateMeta = SETUP_STATE_META[state];

  return {
    source: "live",
    id: setup.id,
    ticker,
    title: setupTitle(setup),
    subtitle: `Kai Watch setup · created ${relAge(setup.created_at) ?? "recently"}`,
    statusLabel: `${met}/${conditions.length} ${(stateMeta?.label ?? state).toUpperCase()}`,
    statusLive: Boolean(stateMeta?.live),
    quote:
      price !== null
        ? {
            price,
            // Change since the setup was issued — the only reference price the
            // setup itself carries. Null when it has none.
            changePct: base !== null && base > 0 ? ((price - base) / base) * 100 : null,
          }
        : null,
    chart,
    conditions,
    met,
    // Real notification state. `digest` on the member's rules for this ticker is
    // the genuine "hold it for the daily digest" switch; following the setup is
    // the genuine push opt-in.
    notify: [
      { label: "Push when this setup confirms", on: subscription },
      ...rules.map((rule) => ({
        label: rule.label || rule.kind.replace(/_/g, " "),
        on: true,
      })),
    ],
    followed: subscription,
    sinceLine:
      base !== null && base > 0 && price !== null
        ? `Since Kai flagged it: ${((price - base) / base) * 100 >= 0 ? "+" : ""}${(
            ((price - base) / base) *
            100
          ).toFixed(1)}%`
        : null,
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
 * THE FOUR DESTINATIONS BEHIND "06 Watch"
 *
 * Unmocked screens (GRAMMAR §9). The rule governing every adapter below is the
 * one the mocked screens already follow: a field with no real source returns
 * null and the component omits the element. Nothing here derives a number the
 * database cannot show its working for.
 * ═════════════════════════════════════════════════════════════════════════════ */

interface WatchlistItemRow {
  id: string;
  ticker: string;
  company_name: string | null;
  wl_active: boolean | null;
  created_at: string;
}

interface QuoteRow {
  ticker: string;
  name: string | null;
  price: number | null;
  chg_1d: number | null;
}

/** Latest stored close + day change for a set of symbols. */
async function readQuotes(supabase: DB, tickers: string[]): Promise<Map<string, QuoteRow>> {
  const out = new Map<string, QuoteRow>();
  const unique = [...new Set(tickers.map((t) => t.toUpperCase()))].filter(Boolean);
  if (unique.length === 0) return out;
  const rows = await soft(
    async () =>
      ((
        await supabase
          .from("screener_metrics")
          .select("ticker, name, price, chg_1d")
          .in("ticker", unique)
      ).data ?? []) as unknown as QuoteRow[],
    [] as QuoteRow[]
  );
  for (const row of rows) out.set(row.ticker.toUpperCase(), row);
  return out;
}

/**
 * Distinct members watching each ticker, all-time.
 *
 * `ticker_intel_snapshots.watchers` (migration 141) is the ONE stored watcher
 * tally in the application — there is no per-request count to compute — and
 * club intel is a Club entitlement, so a free/lapsed family gets nulls rather
 * than the number. That is the wall /api/club/intel already enforces; this
 * screen honours it instead of reading around it.
 */
async function readWatchers(
  supabase: DB,
  tickers: string[],
  familyId: string | null
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(tickers.map((t) => t.toUpperCase()))].filter(Boolean);
  if (unique.length === 0) return out;

  const { tier, clubLapsed } = await getRequestTierState(familyId);
  if (effectiveClubTier(tier, clubLapsed) === "free") return out;

  const rows = await soft(
    async () =>
      ((
        await supabase
          .from("ticker_intel_snapshots")
          .select("ticker, watchers")
          .in("ticker", unique)
      ).data ?? []) as unknown as { ticker: string; watchers: number | null }[],
    [] as { ticker: string; watchers: number | null }[]
  );
  for (const row of rows) {
    const n = num(row.watchers);
    if (n !== null && n > 0) out.set(row.ticker.toUpperCase(), n);
  }
  return out;
}

/* ── /v3/watch/list — the WATCHLIST tab ───────────────────────────────────── */

function fixtureWatchlist(): WatchlistVM {
  // Reachable only with no session, exactly like fixtureOverview() — never a
  // fallback for a member whose read came back empty.
  return {
    source: "fixtures",
    familyId: null,
    viewerId: null,
    rows: [
      {
        id: "fx-wl-1",
        ticker: "NVDA",
        name: "NVIDIA Corporation",
        priceLabel: "173.42",
        changePct: 4.7,
        watchers: 214,
        monitored: true,
        href: tickerHref("NVDA"),
      },
      {
        id: "fx-wl-2",
        ticker: "TSLA",
        name: "Tesla, Inc.",
        priceLabel: "241.05",
        changePct: -1.2,
        watchers: 186,
        monitored: true,
        href: tickerHref("TSLA"),
      },
      {
        id: "fx-wl-3",
        ticker: "AAPL",
        name: "Apple Inc.",
        priceLabel: "227.63",
        changePct: 0.4,
        watchers: 173,
        monitored: true,
        href: tickerHref("AAPL"),
      },
    ],
  };
}

/**
 * The member's own board.
 *
 * `family_watchlist` is FAMILY-scoped, which is what "my watchlist" means in
 * this product — the same rows the Watch hub already counts, the /watchlist
 * board renders and the alert crons monitor. Newest first, because the add
 * affordance on this screen puts a symbol at the top and it has to be visible.
 */
export async function getWatchlist(): Promise<WatchlistVM> {
  const user = await getRequestUser();
  if (!user) return fixtureWatchlist();

  const [supabase, profile] = await Promise.all([getRequestClient(), getRequestProfile()]);
  const familyId = (profile?.family_id as string | null) ?? null;
  if (!familyId) return { source: "live", familyId: null, viewerId: user.id, rows: [] };

  const items = await soft(
    async () =>
      ((
        await supabase
          .from("family_watchlist")
          .select("id, ticker, company_name, wl_active, created_at")
          .eq("family_id", familyId)
          .order("created_at", { ascending: false })
          .limit(120)
      ).data ?? []) as unknown as WatchlistItemRow[],
    [] as WatchlistItemRow[]
  );

  const tickers = items.map((i) => (i.ticker ?? "").toUpperCase()).filter(Boolean);
  const [quotes, watchers] = await Promise.all([
    readQuotes(supabase, tickers),
    readWatchers(supabase, tickers, familyId),
  ]);

  return {
    source: "live",
    familyId,
    viewerId: user.id,
    rows: items
      .filter((item) => Boolean(item.ticker))
      .map((item) => {
        const ticker = item.ticker.toUpperCase();
        const quote = quotes.get(ticker) ?? null;
        const price = num(quote?.price);
        return {
          id: item.id,
          ticker,
          // The stored company name is what the member picked when they added
          // it; the screener's name is the reference. Prefer the stored one.
          name: (item.company_name ?? "").trim() || quote?.name || null,
          priceLabel: price === null ? null : money(price),
          changePct: num(quote?.chg_1d),
          watchers: watchers.get(ticker) ?? null,
          monitored: item.wl_active !== false,
          href: tickerHref(ticker),
        };
      }),
  };
}

/* ── /v3/watch/setups — the KAI WATCH tab ─────────────────────────────────── */

/** The condition family an `alert_rules` row belongs to. */
const RULE_KIND_LABEL: Record<string, string> = {
  price_cross: "PRICE",
  pct_move: "MOVE",
  vol_surge: "VOLUME",
  rsi_cross: "RSI",
  ema_cross: "EMA",
  w52_break: "52W",
  preset_match: "SCREEN",
};

function fixtureKaiWatch(): KaiWatchVM {
  return {
    source: "fixtures",
    rules: [
      {
        id: "fx-rule-1",
        ticker: "NVDA",
        label: "NVDA crosses above 176",
        kindLabel: RULE_KIND_LABEL.price_cross,
        stateLabel: WATCH_STATE_META.near_trigger.label,
        stateLive: true,
        checkedLabel: "12m ago",
        href: tickerHref("NVDA"),
      },
      {
        id: "fx-rule-2",
        ticker: "SMCI",
        label: "SMCI volume surge above 1.5x average",
        kindLabel: RULE_KIND_LABEL.vol_surge,
        stateLabel: WATCH_STATE_META.building.label,
        stateLive: false,
        checkedLabel: "12m ago",
        href: tickerHref("SMCI"),
      },
      {
        id: "fx-rule-3",
        ticker: "TSLA",
        label: "TSLA holding above 230",
        kindLabel: RULE_KIND_LABEL.price_cross,
        stateLabel: WATCH_STATE_META.watching.label,
        stateLive: false,
        checkedLabel: "12m ago",
        href: tickerHref("TSLA"),
      },
    ],
    setups: [
      {
        ticker: "TSLA",
        title: "TSLA earnings setup",
        met: 1,
        total: 3,
        horizonLabel: "3 days",
        href: null,
      },
    ],
  };
}

/**
 * Everything Kai is currently watching FOR this member, plus the live setups
 * Kai has published to the club.
 *
 * Two genuinely different objects, so two sections rather than one merged list:
 * an `alert_rules` row is the member's OWN armed condition (RLS: `user_id =
 * auth.uid()`), while an `alert_setups` row is a club-wide published setup every
 * member can read. Collapsing them would claim the member armed things they
 * never armed.
 *
 * The pipeline is dry in this environment — no cron has written `watch_states` —
 * so `stateLabel` comes back null on most rows and the screen says "not checked
 * yet" rather than defaulting every watch to a flattering "Building".
 */
export async function getKaiWatch(): Promise<KaiWatchVM> {
  const user = await getRequestUser();
  if (!user) return fixtureKaiWatch();

  const supabase = await getRequestClient();

  const [rules, setups] = await Promise.all([
    readActiveRules(supabase, null),
    soft(
      async () =>
        ((
          await supabase
            .from("alert_setups")
            .select(
              "id, ticker, direction, thesis, entry, levels, snapshot_price, state, state_entered_at, expires_at, created_at"
            )
            .in("state", ["waiting", "confirmed"])
            .order("created_at", { ascending: false })
            .limit(20)
        ).data ?? []) as unknown as SetupRow[],
      [] as SetupRow[]
    ),
  ]);

  const [states, metrics] = await Promise.all([
    readRuleStates(
      supabase,
      rules.map((r) => r.id)
    ),
    readMetrics(
      supabase,
      setups.map((s) => s.ticker)
    ),
  ]);

  return {
    source: "live",
    rules: rules.map((rule) => {
      const state = states.get(rule.id) ?? null;
      const meta = state ? (WATCH_STATE_META[state.state as WatchState] ?? null) : null;
      const ticker = (rule.ticker ?? "").toUpperCase() || null;
      return {
        id: rule.id,
        ticker,
        // A rule always stores a human summary at create time; one that somehow
        // has none falls back to its condition family, never to blank.
        label: (rule.label ?? "").trim() || rule.kind.replace(/_/g, " "),
        kindLabel: RULE_KIND_LABEL[rule.kind] ?? rule.kind.replace(/_/g, " ").toUpperCase(),
        stateLabel: meta?.label ?? null,
        stateLive: meta?.live ?? false,
        checkedLabel: relAge(rule.last_checked_at),
        // preset_match spans the whole universe and carries no ticker, so it
        // has nowhere to link.
        href: ticker ? tickerHref(ticker) : null,
      };
    }),
    setups: setups.map((setup) => {
      const conditions = setupConditions(setup, metrics.get(setup.ticker.toUpperCase()) ?? null);
      return {
        ticker: setup.ticker.toUpperCase(),
        title: setupTitle(setup),
        met: conditions.filter((c) => c.met).length,
        total: conditions.length,
        horizonLabel: relHorizon(setup.expires_at),
        href: `/v3/watch/alerts/${setup.id}`,
      };
    }),
  };
}

/* ── /v3/watch/earnings — the Earnings Calendar ───────────────────────────── */

/**
 * THE EARNINGS SOURCE DOES NOT EXIST. This was investigated before the screen
 * was built and the verdict is recorded here so the next lane does not repeat
 * the search:
 *
 *   • No migration declares an earnings table, view or column. `screener_metrics`
 *     carries price / volume / technical columns only — there is no report date
 *     anywhere in the schema.
 *   • `src/lib/market/polygon.ts` exposes bars, snapshots, ticker details and
 *     news. It has no earnings, financials or calendar call.
 *   • The `cron-earnings-ingest` Railway service has no route or worker in this
 *     repository — nothing here reads or writes what it would produce.
 *   • The news/ticker-event cron classifies headlines; it carries no scheduled
 *     report date.
 *
 * So this adapter returns the symbols the calendar WOULD be scoped to, and no
 * days. It will not derive a date from a last-reported quarter and it will not
 * borrow "earnings in 3 days" from an alert's prose: a wrong earnings date is
 * the most expensive number on this screen, because it is the one a member
 * sizes a position against.
 */
export async function getWatchEarnings(): Promise<EarningsVM> {
  const user = await getRequestUser();
  if (!user) return { source: "fixtures", symbols: 28, days: [] };

  const [supabase, profile] = await Promise.all([getRequestClient(), getRequestProfile()]);
  const familyId = (profile?.family_id as string | null) ?? null;

  const symbols = familyId
    ? await soft(
        async () =>
          (
            await supabase
              .from("family_watchlist")
              .select("id", { count: "exact", head: true })
              .eq("family_id", familyId)
          ).count ?? null,
        null as number | null
      )
    : null;

  return { source: "live", symbols, days: [] };
}

/* ── /v3/watch/changes — Opinion Changes ──────────────────────────────────── */

const STANCE_WINDOW_HOURS = 24;

function fixtureOpinionChanges(): OpinionChangesVM {
  return {
    source: "fixtures",
    hours: STANCE_WINDOW_HOURS,
    rows: [
      { ticker: "NVDA", shifts: 14, net: 9, href: tickerHref("NVDA") },
      { ticker: "TSLA", shifts: 11, net: -6, href: tickerHref("TSLA") },
      { ticker: "RIVN", shifts: 7, net: -7, href: tickerHref("RIVN") },
      { ticker: "PLTR", shifts: 4, net: 0, href: tickerHref("PLTR") },
    ],
  };
}

/**
 * Tickers the club changed its mind about in the last 24 hours.
 *
 * `get_stance_shifts` (migration 195) is aggregate-only by construction: it
 * counts `ticker_sentiment` rows UPDATED after they were created, and sums the
 * current votes. So a row here says how many members moved and which way the
 * club leans NOW — and it can never say who moved. The direction shown is the
 * club's present stance, not a per-member flip, and the screen words it that
 * way.
 */
export async function getOpinionChanges(): Promise<OpinionChangesVM> {
  const user = await getRequestUser();
  if (!user) return fixtureOpinionChanges();

  const shifts = await soft(
    () => getCachedStanceShifts(STANCE_WINDOW_HOURS),
    [] as { ticker: string; shifts: number; net_now: number }[]
  );

  return {
    source: "live",
    hours: STANCE_WINDOW_HOURS,
    rows: shifts
      .filter((s) => Boolean(s.ticker))
      .map((s) => ({
        ticker: s.ticker.toUpperCase(),
        shifts: num(Number(s.shifts)) ?? 0,
        net: num(Number(s.net_now)) ?? 0,
        href: tickerHref(s.ticker),
      })),
  };
}
