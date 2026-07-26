/**
 * ENTITLEMENTS — public surface. Import from "@/lib/entitlements".
 *
 * The single source of truth over the app's tier / challenge_pass / register
 * derivation. See MONETIZATION-GATES.md.
 */
export type { Feature, FeatureLevel, PricingRow } from "@/lib/entitlements/features";
export {
  FEATURE_ACCESS,
  PRICING_MATRIX,
  RESEARCH_FREE_WEEKLY_READS,
  WATCHLIST_FREE_ACTIVE,
} from "@/lib/entitlements/features";
export type { EntitlementState, ChallengeState } from "@/lib/entitlements/can";
export {
  can,
  hasClub,
  onChallengePass,
  getEntitlements,
} from "@/lib/entitlements/can";
export type { WallCopy } from "@/lib/entitlements/paywall";
export {
  CLUB_PRICE,
  KAI_WATCH_WALL,
  FAMILY_WALL,
  CLUB_INTELLIGENCE_WALL,
  RESEARCH_METER_WALL,
  FEATURE_WALL,
  wallFor,
} from "@/lib/entitlements/paywall";
