import LiveSessionsSurface from "./LiveSessionsSurface";
import LiveSessionsSurfaceV2 from "./LiveSessionsSurfaceV2";
import { designV2Enabled as isDesignV2 } from "@/lib/design-flag";

/**
 * /live-sessions — the Club's live schedule + replay library.
 *
 * DESIGN v2 BRANCH (thin, route-level, mirrors /progress): when the design-v2
 * flag is ON the SAME real reads (live_sessions + session_rsvps + profiles +
 * tier) render on the cc canvas (LiveSessionsSurfaceV2) as boards L1/L2 — the
 * ON-AIR hero, the day-grouped schedule rows and the Pro-gated replay grid.
 * When OFF this route is byte-identical to before — LiveSessionsSurface is the
 * untouched v1 component (board 07). Every write is shared verbatim: the RSVP
 * insert/delete + XP award + push nudge, the Zoom join link, and the recording
 * player. No new backend.
 */
export default function LiveSessionsPage() {
  if (isDesignV2()) return <LiveSessionsSurfaceV2 />;
  return <LiveSessionsSurface />;
}
