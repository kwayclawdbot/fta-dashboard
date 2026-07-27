import ProfileSurface from "@/components/you/ProfileSurface";

/**
 * /progress — the member's PROFILE surface ("You"), the 5th nav slot's home.
 * Canvas v2, App Light board 07.
 *
 * Built on the F0 vocabulary: one obsidian identity hero, hairline ledgers,
 * section rules, a measure strip, and the canvas ticker tile for positions. No
 * card grids, no radial gauges. Every number is a real read; anything the feed
 * can't supply renders "—".
 *
 * COMPLIANCE: the canvas draws an `87 OPINION SCORE` dial, `Accuracy 71%`,
 * `Influence 1.8x`, `People Influenced 382` and a scored "Recent calls" ledger
 * on this exact board. None of them ship — a published hit rate, or any score
 * derived from one, is a performance claim on the app's most shareable surface.
 * Conviction and participation ship instead. See ProfileSurface for the full
 * reasoning and migration 196 for the reads that back it.
 */
export default function ProgressPage() {
  return <ProfileSurface />;
}
