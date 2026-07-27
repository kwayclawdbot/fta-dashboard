import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════
   WATCH RAIL — canvas boards 06 / 17 / 18.

   All three "watch" boards are drawn under ONE masthead with one rail across
   the top (OVERVIEW · WATCHLIST · KAI WATCH · ALERTS). In the shipped app those
   destinations are three real routes — /watchlist, /watchlist/community and
   /alerts — that had no relationship on screen at all: each one restated the
   whole hierarchy from scratch, so moving between them read as leaving one
   product for another rather than as changing tabs inside one.

   The canvas's fourth cell (OVERVIEW) is deliberately not built. It is a hub
   over four rows, two of which have no data source in this app (an earnings
   calendar, which the plan already records as sourceless). A hub over two live
   destinations is a wasted tap.

   IT IS NAVIGATION, NOT TABS. Real anchors, `aria-current="page"`, no
   radiogroup and no roving tabindex — the SegmentedRail keyboard model would be
   wrong here, because arrowing between these would fire a page navigation. What
   is shared with SegmentedRail is the GEOMETRY only: the same hairline, the same
   3px `.f0-seg-bar`, the same uppercase display cell, so a member cannot tell
   from looking that one rail is a control and the other is a route.

   COLOUR: the bar rides `bg-accent` (--accent-solid), which is club orange /
   family gold / FTA metallic per mode. Brand + action, by law.
   ══════════════════════════════════════════════════════════════════════════ */

export type WatchSurface = "board" | "community" | "kai";

export default function WatchRail({
  active,
  /** Kids and teens never reach /alerts (the route hard-redirects them), so the
   *  cell is omitted rather than rendered into a redirect. */
  showKai = true,
  className = "",
}: {
  active: WatchSurface;
  showKai?: boolean;
  className?: string;
}) {
  const items: { id: WatchSurface; label: string; href: string }[] = [
    { id: "board", label: "My board", href: "/watchlist" },
    { id: "community", label: "The club's board", href: "/watchlist/community" },
    ...(showKai
      ? [{ id: "kai" as WatchSurface, label: "Kai Watch", href: "/alerts" }]
      : []),
  ];

  return (
    <nav
      aria-label="Watch"
      className={`club2-track flex gap-7 overflow-x-auto border-b border-sand ${className}`}
    >
      {items.map((it) => {
        const on = it.id === active;
        return (
          <Link
            key={it.id}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`f0-focus relative -mb-px shrink-0 whitespace-nowrap pb-3 font-display text-[11px] font-extrabold uppercase tracking-[0.12em] transition-colors ${
              on ? "text-ink" : "text-soft hover:text-ink"
            }`}
          >
            {it.label}
            {on && <span className="f0-seg-bar bg-accent" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}
