import EmptyNote from "@/ui-v3/components/EmptyNote";
import { DISCOVER_EMPTY } from "@/ui-v3/discover-copy";
import { SHOW_SAVE_SCREEN } from "@/ui-v3/launch-flags";
import type { ScreenerCandidateVM } from "@/ui-v3/screener-filter";
import ScreenerRow, { ScreenerRowList } from "./ScreenerRow";
import styles from "./ScreenerResults.module.css";

/**
 * The screener result list: a count/sort line, then one flat row per match.
 *
 * The row itself is ./ScreenerRow — shared verbatim with "The board" on 02
 * Discover, which previews the same ledger this screen filters.
 *
 * LAUNCH TRIM. The artboard's "Save screen" sits behind SHOW_SAVE_SCREEN
 * (src/ui-v3/launch-flags.ts). `screener_saved_screens` exists and the old
 * surface writes to it, but v3 has no saved-screens list to open, so the words
 * would be a button that does nothing — and now that the chips are live, that is
 * the only inert control left on the board.
 */
export default function ScreenerResults({
  rows,
  summary,
}: {
  rows: ScreenerCandidateVM[];
  summary: string;
}) {
  return (
    <>
      <div className={styles.head}>
        <span className={styles.summary} data-numeric>
          {summary}
        </span>
        {SHOW_SAVE_SCREEN ? <span className={styles.save}>Save screen</span> : null}
      </div>

      {rows.length === 0 ? <EmptyNote>{DISCOVER_EMPTY.screenerRows}</EmptyNote> : null}

      <ScreenerRowList>
        {rows.map((row) => (
          <ScreenerRow key={row.ticker} row={row} />
        ))}
      </ScreenerRowList>
    </>
  );
}
