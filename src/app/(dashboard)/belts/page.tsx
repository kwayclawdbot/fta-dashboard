import type { Metadata } from "next";
import BeltLadder from "@/components/belts/BeltLadder";
import BeltLadderV2 from "@/components/belts/BeltLadderV2";
import { designV2Enabled as isDesignV2 } from "@/lib/design-flag";

export const metadata: Metadata = {
  title: "Belts",
  description: "The Cheat Code Club rank ladder — earned from reps, not follower counts.",
};

/**
 * /belts — the rank ladder, built to App Light board 22 "Belts · Rank System":
 * the "belts" wordmark with its back chevron, the stack of rung cards with belt
 * discs and share-of-club figures, the current rung as a warm glowing card with
 * a star pip and "— YOU ARE HERE", the "How belts show up" explainer card, and
 * the footer "Next:" bar with its mini meter.
 *
 * The ladder itself is the code's, not the canvas's: five belts (White →
 * Yellow → Blue → Purple → Black) derived from src/lib/belts.ts, and no belt is
 * gated on graded-call accuracy the way the board draws it — the gate line is
 * the belt's real XP range. Everything on the screen is a real read of
 * `xp_events` and the XP leaderboard RPC. See BeltLadder for the data contract.
 */
export default function BeltsPage() {
  if (isDesignV2()) return <BeltLadderV2 />;
  return <BeltLadder />;
}
