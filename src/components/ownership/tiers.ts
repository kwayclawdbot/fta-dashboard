/**
 * Ownership Cards — hold-tier + value-club visual system.
 *
 * Locked decision #8: the card visually accumulates history. Hold-age tiers
 * escalate the FRAME (border weight, metallic frame, foil intensity, corner
 * ornament, a small tier wordmark). Value clubs (+25/+50/+100) are understated
 * achievement marks, never casino energy. Accumulating, never regressing.
 */

import type { HoldTier, ValueClub } from "@/lib/ownership/types";

export interface TierVisual {
  /** Rank for ordering / "never regress" comparisons. */
  rank: number;
  /** Small engraved wordmark on the card foot (empty for issued). */
  wordmark: string;
  /** Frame padding (the metallic border thickness), px. */
  framePx: number;
  /** CSS background for the frame ring behind the face. */
  frameBg: string;
  /** Outer glow around the whole card. */
  glow: string;
  /** Foil sheen intensity 0..1 (drives the moving highlight strength). */
  foil: number;
  /** Legacy-only always-on diagonal foil band. */
  engraved: boolean;
}

const HAIRLINE = "rgba(244,241,234,0.16)";
const METAL =
  "linear-gradient(135deg, #FFF3C4 0%, #E6B84D 30%, #9c7a2a 52%, #E6B84D 78%, #FFF6CE 100%)";
const STEEL =
  "linear-gradient(135deg, rgba(244,241,234,0.55) 0%, rgba(244,241,234,0.14) 40%, rgba(244,241,234,0.5) 100%)";

export const TIER_VISUALS: Record<HoldTier, TierVisual> = {
  issued: {
    rank: 0,
    wordmark: "",
    framePx: 1,
    frameBg: HAIRLINE,
    glow: "0 24px 60px -30px rgba(0,0,0,0.85)",
    foil: 0.16,
    engraved: false,
  },
  days_100: {
    rank: 1,
    wordmark: "100 DAYS HELD",
    framePx: 1.5,
    frameBg: `linear-gradient(135deg, rgba(244,241,234,0.34), ${HAIRLINE} 60%, rgba(244,241,234,0.28))`,
    glow: "0 26px 64px -30px rgba(0,0,0,0.85)",
    foil: 0.24,
    engraved: false,
  },
  year_1: {
    rank: 2,
    wordmark: "1 YEAR HOLDER",
    framePx: 2,
    frameBg: STEEL,
    glow: "0 28px 70px -32px rgba(0,0,0,0.9)",
    foil: 0.34,
    engraved: false,
  },
  days_1000: {
    rank: 3,
    wordmark: "1000 DAYS HELD",
    framePx: 2.5,
    frameBg: METAL,
    glow: "0 30px 80px -34px rgba(0,0,0,0.92), 0 0 0 0.5px rgba(230,184,77,0.35)",
    foil: 0.46,
    engraved: false,
  },
  legacy: {
    rank: 4,
    wordmark: "LEGACY HOLDER",
    framePx: 3,
    frameBg: METAL,
    glow:
      "0 34px 90px -34px rgba(0,0,0,0.94), 0 0 34px -6px rgba(230,184,77,0.30), 0 0 0 0.5px rgba(230,184,77,0.5)",
    foil: 0.6,
    engraved: true,
  },
};

export const HOLD_TIER_ORDER: HoldTier[] = [
  "issued",
  "days_100",
  "year_1",
  "days_1000",
  "legacy",
];

/** Human label for a tier (timeline / detail rows). */
export function tierLabel(tier: HoldTier): string {
  return TIER_VISUALS[tier].wordmark || "ISSUED";
}

export interface ClubVisual {
  label: string; // "+25"
  full: string; // "+25% Club"
}

export const CLUB_VISUALS: Record<ValueClub, ClubVisual> = {
  gain_25: { label: "+25", full: "+25% Club" },
  gain_50: { label: "+50", full: "+50% Club" },
  gain_100: { label: "+100", full: "+100% Club" },
};

export const VALUE_CLUB_ORDER: ValueClub[] = ["gain_25", "gain_50", "gain_100"];

/** Clubs in canonical order (so the marks always read low→high). */
export function orderedClubs(clubs: ValueClub[]): ValueClub[] {
  const set = new Set(clubs);
  return VALUE_CLUB_ORDER.filter((c) => set.has(c));
}
