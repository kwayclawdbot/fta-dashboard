export const dynamic = "force-dynamic";

import { redirectKids } from "@/lib/server/viewer-register";
import TradingFloorClient from "./TradingFloorClient";

/**
 * /simulator — the Trading Floor, behind a server-side register check.
 *
 * practiceGroup(false) has always dropped the Simulator subtab for young kids —
 * the floor runs live-feeling orders, positions and stops, and carries the FTA
 * door at its foot — but the ROUTE answered anyone who typed it. Hiding a nav
 * row is not a gate; this is (same pattern as /screener).
 *
 * SCOPED TO THIS ROUTE ON PURPOSE, NOT THE SEGMENT. `/simulator/lessons`
 * ("Pattern practice") is a genuine kid surface — the Kids Corner home and
 * KidTodayHero both send children straight to it — so a layout-level guard over
 * the whole `/simulator` segment would have closed a door the product
 * deliberately opens. Only the floor is gated.
 */
export default async function SimulatorPage() {
  await redirectKids();
  return <TradingFloorClient />;
}
