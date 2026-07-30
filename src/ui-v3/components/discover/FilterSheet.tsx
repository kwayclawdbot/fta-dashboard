import type { Sector } from "@/lib/screener-sectors";
import {
  CHG_OPTIONS,
  MCAP_OPTIONS,
  SIGNAL_OPTIONS,
  chgLabel,
  mcapLabel,
  sectorLabel,
  type ScreenerFilters,
} from "@/ui-v3/screener-filter";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import styles from "./FilterSheet.module.css";

/**
 * The "+ Filter" panel — the four predicates the data actually backs.
 *
 * NO ARTBOARD EXISTS FOR THIS, so it is composed strictly from the grammar
 * (DESIGN-GRAMMAR §9): a FLAT CARD, a SectionEyebrow per group, and option
 * PILLS that are the filter rail's own chip — selected pills wear the accent
 * outline the applied chips wear, unselected ones wear the neutral border of
 * "+ Filter". Nothing new is invented.
 *
 * It opens INLINE beneath the rail rather than as an overlay sheet. A modal
 * sheet would need a scrim, an elevation and an enter transition, none of which
 * exist in the token set — §5 is explicit that shadows are halos and nothing is
 * lifted off the page — so the panel is disclosed in place, where the rail it
 * belongs to and the results it changes both stay visible.
 *
 * EVERY OPTION IS A COLUMN THE DATA HAS. Sector, market cap and day change come
 * from `screener_metrics`; club signal is the trending row's bull share. The
 * sector list is only the sectors present in the candidate set, so no option can
 * return zero rows for want of data.
 *
 * Selecting the option already applied clears it — tapping "$10B" twice is the
 * same as tapping its chip's ✕, which is the behaviour a pill row implies.
 */
export default function FilterSheet({
  filters,
  sectors,
  onChange,
  onClose,
}: {
  filters: ScreenerFilters;
  sectors: Sector[];
  onChange: (next: ScreenerFilters) => void;
  onClose: () => void;
}) {
  const set = <K extends keyof ScreenerFilters>(key: K, value: ScreenerFilters[K]) =>
    onChange({ ...filters, [key]: filters[key] === value ? null : value });

  return (
    <div className={styles.panel}>
      {sectors.length > 0 ? (
        <div className={styles.group}>
          <SectionEyebrow>Sector</SectionEyebrow>
          <div className={styles.options}>
            {sectors.map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.option} ${filters.sector === s ? styles.on : ""}`}
                aria-pressed={filters.sector === s}
                onClick={() => set("sector", s)}
              >
                {sectorLabel(s)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.group}>
        <SectionEyebrow>Market cap over</SectionEyebrow>
        <div className={styles.options}>
          {MCAP_OPTIONS.map((v) => (
            <button
              key={v}
              type="button"
              className={`${styles.option} ${filters.minMcap === v ? styles.on : ""}`}
              aria-pressed={filters.minMcap === v}
              onClick={() => set("minMcap", v)}
              data-numeric
            >
              {mcapLabel(v)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <SectionEyebrow caption="Share of positioned members who are bullish">
          Club signal over
        </SectionEyebrow>
        <div className={styles.options}>
          {SIGNAL_OPTIONS.map((v) => (
            <button
              key={v}
              type="button"
              className={`${styles.option} ${filters.minSignal === v ? styles.on : ""}`}
              aria-pressed={filters.minSignal === v}
              onClick={() => set("minSignal", v)}
              data-numeric
            >
              {v}%
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <SectionEyebrow>Today</SectionEyebrow>
        <div className={styles.options}>
          {CHG_OPTIONS.map((v) => (
            <button
              key={v}
              type="button"
              className={`${styles.option} ${filters.minChg1d === v ? styles.on : ""}`}
              aria-pressed={filters.minChg1d === v}
              onClick={() => set("minChg1d", v)}
            >
              {chgLabel(v)}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className={styles.done} onClick={onClose}>
        Done
      </button>
    </div>
  );
}
