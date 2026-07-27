import { redirect } from "next/navigation";

/**
 * `/parent-corner` → `/family/corner`.
 *
 * There were two Parent Corners: this one (the older and larger, holding the
 * education-first guidance, the weekly `fic_weeks` parent notes and a per-child
 * strip) and the canvas-designed Family board F8. Two destinations for one idea
 * is incoherent, so the CONTENT was folded into the better CONTAINER and this
 * route became a redirect.
 *
 * It is a redirect and NOT a deletion on purpose: the sidebar's Family group,
 * `ThisWeekPanel`'s "Parent Corner" link, the onboarding checklist step and any
 * bookmark a parent already made all resolve through here. The destination
 * enforces the gating (parents only) — this file deliberately does not check
 * anything itself, so there is exactly one place where that rule lives.
 *
 * Everything that used to render here now lives in:
 *   · src/app/(dashboard)/family/corner/page.tsx  — the surface
 *   · src/lib/family/parent-corner.ts             — ALWAYS_ON_GUIDANCE + the
 *                                                   weekly field labels
 *   · src/lib/family/queries.ts                   — getChildWeek
 */
export default function ParentCornerRedirect() {
  redirect("/family/corner");
}
