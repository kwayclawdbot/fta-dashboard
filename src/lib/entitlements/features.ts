/**
 * ENTITLEMENTS — the feature catalog + the binding free/paid matrix.
 *
 * Owner-ratified philosophy (MONETIZATION-GATES.md): "The crowd is free. The
 * edge is paid." Free users participate in and strengthen the network (they ARE
 * the data engine); paid members (Cheat Code Club $99) buy the intelligence
 * extracted from it — interpretation, personalization, monitoring, action.
 *
 * This file is the SINGLE SOURCE OF TRUTH for what each tier unlocks. Both the
 * server-side `can(state, feature)` gate (can.ts) AND the pricing page consume
 * FEATURE_MATRIX / FEATURE_ACCESS from here, so the wall and the pricing table
 * can never drift apart.
 *
 * Tier mapping (the DB enrollment programs are unchanged — this is a naming
 * overlay, see src/lib/tier.ts):
 *   • Cheat Code Free     → FamilyTier 'free'
 *   • Cheat Code Club $99 → FamilyTier 'fic' (the umbrella membership)
 *   • FTA                 → FamilyTier 'fta' (separate advanced upgrade)
 *
 * Kid walls COMPOSE with entitlements — they do NOT merge. `can()` answers only
 * the tier/entitlement axis; every route keeps its own age (kid/teen) checks and
 * applies BOTH. A kid on a Club family still gets sentiment stripped; a free
 * adult still hits the Club Intelligence wall.
 */

/** The minimum entitlement LEVEL a surface requires. */
export type FeatureLevel = "free" | "club" | "fta";

/**
 * Every gated feature `can()` is ever asked about. Free-tier community
 * participation (feed read, react/comment/post, polls/debates/sentiment votes)
 * is deliberately ABSENT — it is never gated, so it never needs a Feature key.
 */
export type Feature =
  // ── Club Intelligence (the Kai Intelligence Layer — the paid moat) ──────────
  | "club_intel" // Club Score drivers/history + "why is this trending" (=/api/club/intel)
  | "trending_full" // full rankings + history (free = top 5)
  | "sentiment_detailed" // detailed trends + 24h/7d change (free = basic split)
  | "kai_watch" // Kai Watch / custom AI alerts (rule creation)
  | "kai_brief" // Kai Brief / "what changed since I left"
  | "foryou_deep" // deep personalized Home (free = basic)
  // ── Research ────────────────────────────────────────────────────────────────
  | "research_unlimited" // unlimited premium reads (free = 3/week metered)
  | "publish_thesis" // structured Research Object (free = basic ticker post)
  // ── Tools ───────────────────────────────────────────────────────────────────
  | "watchlist_unlimited" // unlimited + Intelligent Watchlist (free = 5 active)
  | "kai_chat_full" // higher Kai daily limits (free = 3/day metered)
  | "kai_research_full" // Kai deep stock research (free = basic)
  | "screener_full" // full screener + AI search (free = basic filters)
  | "news_personalized" // personalized to watchlist/holdings (free = general)
  | "simulator_advanced" // advanced stats / unlimited portfolios / family portfolios
  // ── Learning / live / picks ────────────────────────────────────────────────
  | "learning_full" // full library + live classes + recordings
  | "live_sessions_full" // live + archive (free = preview/replay clips)
  | "weekly_picks_full" // full weekly Club research/picks (free = preview/delayed)
  // ── Family ──────────────────────────────────────────────────────────────────
  | "family_activation" // family watchlist / report cards / family challenges
  // ── FTA ─────────────────────────────────────────────────────────────────────
  | "fta_section"; // the FTA hub (separate upgrade)

/**
 * Feature → minimum level. `club` means Cheat Code Club (fic) OR FTA (fta is a
 * superset). `fta` means the FTA upgrade only. Everything not listed here is
 * free and never routed through can().
 */
export const FEATURE_ACCESS: Record<Feature, FeatureLevel> = {
  club_intel: "club",
  trending_full: "club",
  sentiment_detailed: "club",
  kai_watch: "club",
  kai_brief: "club",
  foryou_deep: "club",
  research_unlimited: "club",
  publish_thesis: "club",
  watchlist_unlimited: "club",
  kai_chat_full: "club",
  kai_research_full: "club",
  screener_full: "club",
  news_personalized: "club",
  simulator_advanced: "club",
  learning_full: "club",
  live_sessions_full: "club",
  weekly_picks_full: "club",
  family_activation: "club",
  fta_section: "fta",
};

// ── Free-tier meters (the two hard caps on otherwise-free surfaces) ───────────

/** Free tier: premium research reads per rolling week. Club/FTA = unlimited. */
export const RESEARCH_FREE_WEEKLY_READS = 3;

/**
 * Free tier: how many watchlist tickers stay ACTIVELY MONITORED. Above this the
 * rows are PRESERVED (never deleted) but their monitoring/intelligence is
 * paused — the downgrade screen invites reactivation. See MONETIZATION-GATES.md
 * "DOWNGRADE = PRESERVE, NEVER DELETE".
 */
export const WATCHLIST_FREE_ACTIVE = 5;

// ── The pricing matrix (binding — verbatim cells from the doc) ────────────────
// Drives the pricing page. `free` copy = participation verbs; `club` copy =
// intelligence verbs. FTA inherits everything in Club (its column shows ✓ =
// "included" unless it adds something FTA-specific). NO follow-graph row — the
// follow graph does not exist yet (do NOT print until built).

export interface PricingRow {
  surface: string;
  free: string; // "—" = not included; "✓" = included
  club: string;
  /** FTA cell; omit to inherit the club cell ("Everything in Club"). */
  fta?: string;
}

export const PRICING_MATRIX: PricingRow[] = [
  { surface: "Community feed", free: "Full read", club: "Full" },
  { surface: "React, comment, post", free: "✓", club: "✓" },
  { surface: "Polls, debates & sentiment votes", free: "✓", club: "✓" },
  { surface: "Trending in the Club", free: "Top 5", club: "Full rankings + history" },
  {
    surface: "Club Score",
    free: "Current score only",
    club: "Drivers + history + score alerts",
  },
  {
    surface: "Community sentiment",
    free: "Basic current split",
    club: "Detailed trends + 24h/7d change",
  },
  {
    surface: "Research reads",
    free: "3 premium pieces / week",
    club: "Unlimited",
  },
  {
    surface: "Publish research",
    free: "Basic ticker post",
    club: "Structured thesis + tracking",
  },
  {
    surface: "Watchlist",
    free: "5 tickers",
    club: "Unlimited + Intelligent Watchlist",
  },
  { surface: "Ask Kai", free: "A few questions / day", club: "Much higher limits" },
  { surface: "Kai deep stock research", free: "Basic", club: "Full" },
  { surface: "Kai Watch / custom AI alerts", free: "—", club: "✓" },
  { surface: "For You / personalized Home", free: "Basic", club: "Deep personalization" },
  { surface: "Kai Brief — what changed since you left", free: "—", club: "✓" },
  {
    surface: "Screener / Stock Finder",
    free: "Basic filters",
    club: "Full screener + AI search",
  },
  { surface: "News", free: "General", club: "Personalized to your watchlist" },
  {
    surface: "Simulator",
    free: "Basic $10K portfolio",
    club: "Advanced stats + unlimited portfolios",
  },
  {
    surface: "Learning",
    free: "Starter lessons",
    club: "Full library + live classes",
  },
  {
    surface: "Live Club sessions",
    free: "Preview / replay clips",
    club: "Live + full archive",
  },
  { surface: "Weekly Club research & picks", free: "Preview", club: "Full" },
  {
    surface: "Family Mode",
    free: "Create your family (activation locked)",
    club: "Fully included — spouse, kids & family watchlist",
  },
  {
    surface: "FTA — the trade-ready academy",
    free: "—",
    club: "—",
    fta: "6-week live trading academy",
  },
];
