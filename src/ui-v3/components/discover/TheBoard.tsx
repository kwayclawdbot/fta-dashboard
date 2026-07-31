import { DISCOVER_EMPTY } from "@/ui-v3/discover-copy";
import type { ScreenerCandidateVM } from "@/ui-v3/screener-filter";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import ScreenerRow, { ScreenerRowList } from "./ScreenerRow";
import styles from "./TheBoard.module.css";

/**
 * "THE BOARD" — the club's whole attention ledger, previewed in its own order.
 *
 * No artboard draws this section; it is composed under DESIGN-GRAMMAR §9 from
 * parts that already exist: a `SectionEyebrow` in Discover's accent/dim/gap-2
 * assignment, and board 15's ledger row (./ScreenerRow), unchanged. Nothing
 * visual is invented here — the only new thing on the screen is WHICH rows are
 * on it.
 *
 * WHY IT EXISTS. Every other band on Discover is a predicate over the ledger —
 * the fastest climbers, the ±20-point split, the two-week wake-ups — and each
 * can return nothing on a club this size. This one is the ledger itself, so the
 * screen has content at any club scale, and the member gets the actual answer to
 * "what is the Club watching" rather than four selections from it.
 *
 * THE DISCLAIMER IS NOT REPEATED HERE. `TRENDING_DISCLAIMER` sits once at the
 * foot of DiscoverScreen, covering every ranked band on the page including this
 * one.
 */
export default function TheBoard({ rows }: { rows: ScreenerCandidateVM[] }) {
  return (
    <section className={styles.section}>
      <SectionEyebrow
        labelTone="accent"
        caption="Every name the Club is tracking, by attention"
        captionGap={2}
        actionLabel={rows.length > 0 ? "See all" : undefined}
        actionHref="/v3/discover/screener"
        actionTone="dim"
      >
        The board
      </SectionEyebrow>

      {rows.length === 0 ? (
        // Empty here means the Club has not looked at a single name yet — the
        // universe is still screenable, so this points at the screener the way
        // "Rising fast" does.
        <EmptyNote action={{ label: "Screen the whole market", href: "/v3/discover/screener" }}>
          {DISCOVER_EMPTY.board}
        </EmptyNote>
      ) : (
        <ScreenerRowList>
          {rows.map((row) => (
            <ScreenerRow key={row.ticker} row={row} />
          ))}
        </ScreenerRowList>
      )}
    </section>
  );
}
