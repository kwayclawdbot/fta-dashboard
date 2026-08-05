import SectionEyebrow from "./SectionEyebrow";
import DestinationList, { type DestinationRowVM } from "./DestinationList";
import styles from "./LearnSection.module.css";

/**
 * The Learn entry on "01 Home".
 *
 * INTERIM, AND UNMOCKED. No artboard draws Learn, and the owner's interim IA
 * (2026-08-05) keeps the five-tab nav rather than spending a slot on it — so
 * Learn is a row on Home that opens the existing course screens in old chrome.
 *
 * Because there is no board to translate, this is composed strictly from the
 * grammar's existing primitives (§9): SectionEyebrow to open the section and a
 * single DestinationList row. Nothing new is invented — no new colour, radius,
 * type size, or container treatment appears here that Watch's destination rows
 * did not already draw.
 *
 * The caption carries a real value or nothing at all (§9.5). See home-data's
 * `mapLearn` for where it comes from and why it is often absent.
 */
export default function LearnSection({ row }: { row: DestinationRowVM }) {
  return (
    <section className={styles.section}>
      <SectionEyebrow>Learn</SectionEyebrow>
      <DestinationList rows={[row]} spacing="underEyebrow" />
    </section>
  );
}
