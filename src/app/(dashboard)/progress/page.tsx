import ProfileSurface from "@/components/you/ProfileSurface";

/**
 * /progress — the member's PROFILE surface ("You"), the 5th nav slot's home.
 * Built to App Light board 07 "You · Profile", object for object: the conic
 * ring avatar, the dial beside the name, the two-card measure row, the
 * five-tile strip, the warm streak card and the dated positions list.
 *
 * COMPLIANCE: the board draws an `87 OPINION SCORE` dial, `Accuracy 71%`,
 * `Influence 1.8x`, `People Influenced 382`, a `Top 2% of 25,842 members`
 * percentile and a "Recent calls" ledger scored `✓ +6.4%` / `✗ −2.1%`. Every
 * one of those SHAPES is built. None of them carries a performance number: the
 * dial renders XP progress to the next belt, the influence card renders
 * conviction, the percentile bars render the member's own XP split, the
 * accuracy tile renders research notes, and the calls ledger renders the dated
 * positions record. See ProfileSurface for the full object-by-object map and
 * migration 196 for the reads that back it.
 */
export default function ProgressPage() {
  return <ProfileSurface />;
}
