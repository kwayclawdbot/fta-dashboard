import ProfileSurface from "@/components/you/ProfileSurface";
import ProfileSurfaceV2 from "@/components/you/ProfileSurfaceV2";
import { designV2Enabled as isDesignV2 } from "@/lib/design-flag";

/**
 * /progress — the member's PROFILE surface ("You"), the 5th nav slot's home.
 * Built to App Light board 07 "You · Profile", object for object: the conic
 * ring avatar, the dial beside the name, the two-card measure row, the
 * five-tile strip, the warm streak card and the dated positions list.
 *
 * DESIGN v2 BRANCH (thin, route-level): when the design-v2 flag is ON the same
 * board renders on the cc canvas (ProfileSurfaceV2) from the SAME real reads;
 * when OFF this route is byte-identical to before — ProfileSurface is untouched.
 *
 * COMPLIANCE (both paths): the board draws an `87 OPINION SCORE` dial,
 * `Accuracy 71%`, `Influence 1.8x`, `People Influenced 382`, a `Top 2% of
 * 25,842 members` percentile and a "Recent calls" ledger scored `✓ +6.4%` /
 * `✗ −2.1%`. Every one of those SHAPES is built. None of them carries a
 * performance number: the dial/ring renders XP progress to the next belt, the
 * influence card renders conviction, the percentile bars render the member's
 * own XP split, the accuracy tile renders research notes, and the calls ledger
 * renders the dated positions record. Percentile / influence-multiplier /
 * accuracy are OMITTED (no backend, no fake numbers). See ProfileSurface /
 * ProfileSurfaceV2 for the full object-by-object map and migration 196.
 */
export default function ProgressPage() {
  if (isDesignV2()) return <ProfileSurfaceV2 />;
  return <ProfileSurface />;
}
