import type { FilterKey, ScreenerChipVM } from "@/ui-v3/screener-filter";
import styles from "./FilterChips.module.css";

/**
 * The screener's applied-filter rail: one accent-outlined chip per ACTIVE
 * predicate, each carrying a working dismiss glyph, followed by the neutral
 * "+ Filter" chip that opens the panel.
 *
 * These used to be three `<span>`s built from a hardcoded constant, with a ✕ that
 * was a glyph and nothing else. Every chip here is now a button: the ✕ clears
 * that one predicate and the rows re-screen underneath. The labels are derived
 * from the filter state by `chipsFor`, so a chip cannot describe a screen the
 * results were not filtered by.
 *
 * An empty rail is a real state — "no filters, everything the Club is watching" —
 * and it renders as just the "+ Filter" chip rather than as a missing row.
 */
export default function FilterChips({
  chips,
  onRemove,
  onOpen,
  open,
}: {
  chips: ScreenerChipVM[];
  onRemove: (key: FilterKey) => void;
  onOpen: () => void;
  open: boolean;
}) {
  return (
    <div className={styles.rail}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={styles.chip}
          onClick={() => onRemove(chip.key)}
          aria-label={`Remove filter ${chip.label}`}
        >
          {chip.label} <span aria-hidden="true">✕</span>
        </button>
      ))}
      <button
        type="button"
        className={`${styles.chip} ${styles.add} ${open ? styles.addOpen : ""}`}
        onClick={onOpen}
        aria-expanded={open}
      >
        + Filter
      </button>
    </div>
  );
}
