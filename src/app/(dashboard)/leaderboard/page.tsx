import LeaderboardSurface from "./LeaderboardSurface";
import LeaderboardSurfaceV2 from "./LeaderboardSurfaceV2";
import { designV2Enabled as isDesignV2 } from "@/lib/design-flag";

/**
 * /leaderboard — the tri-period XP ladder (club register R1 + family R2).
 *
 * DESIGN v2 BRANCH (thin, route-level, mirrors /progress): when the design-v2
 * flag is ON the SAME definer RPCs (xp_leaderboard_individuals / _families,
 * mig. 099) + the SAME staff/fixture exclusions render on the cc canvas
 * (LeaderboardSurfaceV2) as boards R1/R2 — script "the ladder", period pills
 * over the real trailing windows, belt-ringed rows, XP ⚡ mono, the pinned YOU
 * row, and the family ladder in family mode. When OFF this route is
 * byte-identical to before — LeaderboardSurface is the untouched v1 component.
 *
 * HONESTY (both paths, carried from v1): no accuracy %, no win rate, no "graded
 * calls · % hit" meta — those columns do not exist in the RPC payload and would
 * be a fabricated performance claim. Rank = XP over the window, and the surface
 * says so. Rank MOVEMENT is shown as the layout-FLIP travel when a window
 * switches (the real, honest signal); no invented per-row ▲/▼ delta ships.
 */
export default function LeaderboardPage() {
  if (isDesignV2()) return <LeaderboardSurfaceV2 />;
  return <LeaderboardSurface />;
}
