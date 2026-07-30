import Link from "next/link";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import TickerTile from "@/ui-v3/components/TickerTile";
import { TICKER_EMPTY, type ActiveCircleVM } from "@/ui-v3/ticker-data";
import styles from "./ActiveCircle.module.css";

/**
 * "ACTIVE CIRCLE" — the open Circle on this ticker, if there is one.
 *
 * The artboard's action reads "Join Circle". Joining is a WRITE, and v3 wires
 * no write paths on any screen yet (the Club composers are display-only for the
 * same reason), so the pill is the real destination instead: it opens the
 * Circle room, where joining actually lives. The box is the artboard's.
 *
 * The member row's four overlapped discs carry no identity on the artboard and
 * none is available here, so the row is the real member count with a pip cue,
 * exactly as the hero's watcher line resolves.
 */
export default function ActiveCircle({ circle }: { circle: ActiveCircleVM | null }) {
  return (
    <section className={styles.section}>
      <SectionEyebrow labelTone="accent">Active circle</SectionEyebrow>

      {circle === null ? (
        <EmptyNote>{TICKER_EMPTY.circle}</EmptyNote>
      ) : (
        <div className={styles.card}>
          <div className={styles.mark}>
            <TickerTile ticker={circle.ticker ?? circle.title} size="md" />
          </div>
          <div className={styles.body}>
            <div className={styles.title}>
              {circle.title}
              {circle.clock ? <span className={styles.clock}> · {circle.clock}</span> : null}
            </div>
            <div className={styles.members}>
              <div className={styles.pips} aria-hidden="true">
                {Array.from({ length: Math.min(4, Math.max(1, circle.members)) }, (_, i) => (
                  <span key={i} className={styles.pip} />
                ))}
              </div>
              <span className={styles.count} data-numeric>
                {circle.members.toLocaleString("en-US")} member
                {circle.members === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <Link href={`/v3/club/circles/${circle.slug}`} className={styles.action}>
            Open Circle
          </Link>
        </div>
      )}
    </section>
  );
}
