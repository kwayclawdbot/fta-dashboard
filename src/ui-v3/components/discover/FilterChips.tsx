import type { FilterChipVM } from "@/ui-v3/discover-data";
import styles from "./FilterChips.module.css";

/**
 * The screener's applied-filter rail: each active filter is an accent-outlined
 * chip carrying a dismiss glyph, followed by the neutral "+ Filter" chip.
 *
 * The chips describe the query the rows below were actually fetched with, so
 * their labels come from the adapter, not from this component.
 */
export default function FilterChips({ chips }: { chips: FilterChipVM[] }) {
  return (
    <div className={styles.rail}>
      {chips.map((chip) => (
        <span key={chip.label} className={styles.chip}>
          {chip.label} <span aria-hidden="true">✕</span>
        </span>
      ))}
      <span className={`${styles.chip} ${styles.add}`}>+ Filter</span>
    </div>
  );
}
