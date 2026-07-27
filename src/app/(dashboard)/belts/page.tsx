import type { Metadata } from "next";
import BeltLadder from "@/components/belts/BeltLadder";

export const metadata: Metadata = {
  title: "Belts",
  description: "The Cheat Code Club rank ladder — earned from reps, not follower counts.",
};

/**
 * /belts — the rank ladder (canvas v2, App board 22).
 *
 * Belt data already shipped (src/lib/belts.ts, BeltBadge, the avatar belt dot);
 * this is the destination it never had. Everything on it is a real read of
 * `xp_events` and the XP leaderboard RPC — see BeltLadder for the data contract.
 */
export default function BeltsPage() {
  return <BeltLadder />;
}
