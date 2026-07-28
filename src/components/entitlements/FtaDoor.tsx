"use client";

import UnlockLine from "@/components/entitlements/UnlockLine";
import { wallFor } from "@/lib/entitlements/paywall";
import { useEntitlements } from "@/components/entitlements/EntitlementsProvider";

/**
 * THE FTA DOOR — one line, four placements.
 *
 * FTA ($2,997, the 6-week trade-ready academy) had no door anywhere in the app
 * except /upgrade itself. This is that door: ONE contextual sentence placed at
 * the four moments a member has just FELT the gap FTA fills — a position closed
 * by feel in the simulator, the foot of the chart, the foot of a ticker's
 * technicals, and the instant a lesson is marked complete.
 *
 * QUIET REGISTER. It is an <UnlockLine tone="fta">: a hairline, a sentence in
 * `text-soft`, and the door in ink — not accent, because FTA is a second
 * decision offered at a moment of desire, not a nag. Never a banner, never a
 * card, no urgency, no countdown.
 *
 * WHO NEVER SEES IT:
 *   • Existing FTA members (`realTier === "fta"`) — the purchase is already made
 *     and FTA access is lifetime, so the door would be noise.
 *   • KIDS. No commercial ask is ever put in front of a child, anywhere.
 *   • TEENS. FTA is family-wide and a teen inherits it, but the commercial
 *     decision belongs to the parent — so the door renders for `register ===
 *     "adult"` only.
 *   • Anyone outside the EntitlementsProvider: the context fails closed to a
 *     free ADULT default, so a stray mount would render the line. Callers must
 *     therefore sit under the (dashboard) layout, which provides the real
 *     server-computed snapshot. All four placements do.
 *
 * PURELY PRESENTATIONAL. No entitlement is granted, relaxed or checked for
 * ACCESS here — the FTA hub, the lesson gate, the ticker page and the games all
 * keep their own server-side gates exactly as they were. This component only
 * says, in one sentence, what a member does not yet have.
 *
 * The CTA label is the ratified `FEATURE_WALL.fta_section.cta`, never a new
 * string.
 */
export default function FtaDoor({
  line,
  className,
  rule = true,
}: {
  /** The moment-specific sentence — what this member just felt the edge of. */
  line: React.ReactNode;
  className?: string;
  /** Draw the hairline above (off when the caller already has one). */
  rule?: boolean;
}) {
  const { realTier, register } = useEntitlements();

  // Already bought it, or not the person who would buy it.
  if (realTier === "fta") return null;
  if (register !== "adult") return null;

  return (
    <UnlockLine
      tone="fta"
      href="/upgrade"
      cta={wallFor("fta_section").cta}
      rule={rule}
      className={className}
    >
      {line}
    </UnlockLine>
  );
}
