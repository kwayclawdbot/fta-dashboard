/**
 * Ownership Cards — hold-side milestone engine (pure, deterministic).
 *
 * Drives the ONLY gamification the plan allows: holding age + value-appreciation
 * clubs. Nothing here triggers on a trade. Tiers accumulate and NEVER regress;
 * value clubs are high-water (once earned, kept forever even if price falls).
 *
 * Used by the nightly sync (src/app/api/ownership/cron) to decide when to write a
 * milestone event + snapshot and bump the card's design_state cache.
 */
import type { CardDesignState, HoldTier, ValueClub } from "./types";

/** Hold-age tiers by whole days owned (ordered issued → legacy). Per types.ts. */
export const HOLD_TIER_THRESHOLDS: { tier: HoldTier; minDays: number }[] = [
  { tier: "legacy", minDays: 1825 }, // ~5 years
  { tier: "days_1000", minDays: 1000 },
  { tier: "year_1", minDays: 365 },
  { tier: "days_100", minDays: 100 },
  { tier: "issued", minDays: 0 },
];

const TIER_ORDER: HoldTier[] = ["issued", "days_100", "year_1", "days_1000", "legacy"];

/** Value-appreciation clubs by % gain since issue (high-water). Per types.ts. */
export const VALUE_CLUB_THRESHOLDS: { club: ValueClub; minPct: number }[] = [
  { club: "gain_25", minPct: 25 },
  { club: "gain_50", minPct: 50 },
  { club: "gain_100", minPct: 100 },
];

/** Snapshot label + event kind for each tier (for card_snapshots.label). */
export const TIER_SNAPSHOT_LABEL: Record<HoldTier, string> = {
  issued: "issue",
  days_100: "days_100",
  year_1: "year_1",
  days_1000: "days_1000",
  legacy: "legacy",
};

export const CLUB_SNAPSHOT_LABEL: Record<ValueClub, string> = {
  gain_25: "milestone_25",
  gain_50: "milestone_50",
  gain_100: "milestone_100",
};

export function tierRank(tier: HoldTier): number {
  const i = TIER_ORDER.indexOf(tier);
  return i < 0 ? 0 : i;
}

/** Highest hold-age tier earned at `ownedDays`. */
export function holdTierForDays(ownedDays: number): HoldTier {
  for (const t of HOLD_TIER_THRESHOLDS) {
    if (ownedDays >= t.minDays) return t.tier;
  }
  return "issued";
}

/** All value clubs earned at a given gain %. */
export function clubsForGain(gainPct: number): ValueClub[] {
  return VALUE_CLUB_THRESHOLDS.filter((c) => gainPct >= c.minPct).map((c) => c.club);
}

export interface MilestoneResult {
  /** Design era after applying every newly-earned milestone. */
  nextDesign: CardDesignState;
  /** Set if the hold-age tier upgraded this run (null otherwise). */
  newTier: HoldTier | null;
  /** Value clubs newly crossed this run (empty if none). */
  newClubs: ValueClub[];
  /** True if anything changed and a milestone should be recorded. */
  changed: boolean;
}

/**
 * Given the card's current design era and its live hold-age + gain, compute the
 * next era and which milestones (if any) were newly crossed. Never regresses:
 * a tier only goes up, clubs are unioned with what was already earned.
 */
export function evaluateMilestones(
  current: CardDesignState,
  ownedDays: number,
  gainPct: number | null
): MilestoneResult {
  const liveTier = holdTierForDays(ownedDays);
  const tierUpgraded = tierRank(liveTier) > tierRank(current.holdTier);
  const nextTier: HoldTier = tierUpgraded ? liveTier : current.holdTier;

  const already = new Set(current.valueClubs);
  const earned = gainPct == null ? [] : clubsForGain(gainPct);
  const newClubs = earned.filter((c) => !already.has(c));
  // High-water union, preserving the canonical order.
  const mergedClubs = VALUE_CLUB_THRESHOLDS.map((c) => c.club).filter(
    (c) => already.has(c) || newClubs.includes(c)
  );

  const nextDesign: CardDesignState = {
    ...current,
    holdTier: nextTier,
    valueClubs: mergedClubs,
  };

  return {
    nextDesign,
    newTier: tierUpgraded ? liveTier : null,
    newClubs,
    changed: tierUpgraded || newClubs.length > 0,
  };
}

/** Completed anniversary year (>=1) at `ownedDays`, or 0 if under a year. */
export function anniversaryYear(ownedDays: number): number {
  return Math.floor(ownedDays / 365);
}
