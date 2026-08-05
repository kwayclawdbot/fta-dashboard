import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import DestinationList, {
  type DestinationRowVM,
} from "@/ui-v3/components/DestinationList";
import styles from "./LiveSection.module.css";

/**
 * The Live entry on "04 Club Feed".
 *
 * INTERIM, AND UNMOCKED. No artboard draws Live, and the owner's interim IA
 * (2026-08-05) keeps the five-tab nav rather than spending a slot on it — so
 * Live is a section on Club that opens the existing session screens in old
 * chrome.
 *
 * With no board to translate, this is composed strictly from the grammar's
 * existing primitives (§9): SectionEyebrow plus a single DestinationList row —
 * the same object Watch's destinations draw. Nothing new is invented here.
 *
 * The eyebrow carries no "See all" action: the row IS the destination, so a
 * second link to the same place beside it would be the only accent in the
 * region spent saying twice what the row already says.
 */
export default function LiveSection({ row }: { row: DestinationRowVM }) {
  return (
    <section className={styles.section}>
      <SectionEyebrow>Live</SectionEyebrow>
      <DestinationList rows={[row]} spacing="underEyebrow" />
    </section>
  );
}
