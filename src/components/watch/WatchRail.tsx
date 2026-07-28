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
   wrong here, because arrowing between these would fire a page navigation.

   GEOMETRY IS THE CANVAS'S: an orange pill on the current cell, the rest set in
   grey uppercase at 11px with .04em tracking, on no rule at all. That is what
   boards 06/17/18 draw under the wordmark, and the underline rail that used to
   stand in for it is gone.

   COLOUR: the pill rides `bg-accent` (--accent-solid) — club orange, family
   gold or FTA metallic per mode. Brand + action, by law.

   ── THE INLINE VARIANT, AND WHY IT EXISTS ─────────────────────────────────
   Every board that carries this rail ALSO carries a control row of its own —
   /watchlist has its filter chips, /alerts has its five sections, the club
   board has its sort. Stacked, that is two rows of rounded shapes under one
   wordmark, and a member cannot tell at a glance which row moves them to
   another screen and which row changes what is in front of them. The audit
   read the pair as one confused control, and it was right: they are two
   different axes wearing the same clothes.

   So the page keeps ONE control row — the one that acts on what is on screen —
   and the cross-surface rail drops to `variant="inline"`: a quiet line of text
   under the lede, set in the lede's own size and colour, with the current
   surface named in ink and its siblings as plain links. Nothing is lost (all
   three destinations are still one tap away) and nothing competes: the only
   pills left on the board belong to the board's own control.
   ══════════════════════════════════════════════════════════════════════════ */

export type WatchSurface = "board" | "community" | "kai";

export default function WatchRail({
  active,
  /** Kids and teens never reach /alerts (the route hard-redirects them), so the
   *  cell is omitted rather than rendered into a redirect. */
  showKai = true,
  /**
   * `pills` is the drawn rail. `inline` is the quiet text line a board uses
   * when it already owns a control row of its own — see the note above.
   */
  variant = "pills",
  className = "",
}: {
  active: WatchSurface;
  showKai?: boolean;
  variant?: "pills" | "inline";
  className?: string;
}) {
  const items: { id: WatchSurface; label: string; href: string }[] = [
    { id: "board", label: "Watchlist", href: "/watchlist" },
    { id: "community", label: "Club picks", href: "/watchlist/community" },
    ...(showKai
      ? [{ id: "kai" as WatchSurface, label: "Kai Watch", href: "/alerts" }]
      : []),
  ];

  // The quiet line. Set at the lede's size so it reads as part of the masthead
  // sentence rather than as a second control; the current surface is stated in
  // ink and NOT linked, because a link to the page you are standing on is the
  // same wasted tap the unbuilt OVERVIEW hub would have been.
  if (variant === "inline") {
    return (
      <nav
        aria-label="Watch"
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] leading-relaxed ${className}`}
      >
        {items.map((it, i) => {
          const on = it.id === active;
          return (
            <span key={it.id} className="inline-flex items-center gap-x-2">
              {i > 0 && (
                <span aria-hidden className="text-soft/45">
                  ·
                </span>
              )}
              {on ? (
                <span aria-current="page" className="font-semibold text-ink">
                  {it.label}
                </span>
              ) : (
                <Link
                  href={it.href}
                  className="f0-focus text-soft underline decoration-sand underline-offset-4 transition hover:text-ink hover:decoration-current"
                >
                  {it.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Watch"
      className={`club2-track flex items-center gap-3.5 overflow-x-auto ${className}`}
    >
      {items.map((it) => {
        const on = it.id === active;
        return (
          <Link
            key={it.id}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`f0-focus f0-press shrink-0 whitespace-nowrap rounded-full text-[10.5px] font-bold uppercase tracking-[0.06em] transition ${
              on
                ? "bg-accent px-3.5 py-1.5 text-night-950"
                : "px-0.5 py-1.5 tracking-[0.04em] text-soft hover:text-ink"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
