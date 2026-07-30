import Link from "next/link";
import TickerTile from "@/ui-v3/components/TickerTile";
import type { SetupTeaserVM } from "@/ui-v3/watch-data";
import styles from "./SetupTeaserRow.module.css";

/**
 * A setup below the fold: name, met/total, and its remaining horizon.
 *
 * The horizon is the setup's own expiry, so it is omitted rather than guessed
 * when a setup carries no expiry.
 */
export default function SetupTeaserRow({ setup }: { setup: SetupTeaserVM }) {
  const inner = (
    <>
      <TickerTile ticker={setup.ticker} size="sm" />
      <span className={styles.text}>
        <strong className={styles.name}>{setup.title}</strong> · {setup.met}/{setup.total}{" "}
        conditions
      </span>
      {setup.horizonLabel ? (
        <span className={styles.horizon} data-numeric>
          {setup.horizonLabel}
        </span>
      ) : null}
    </>
  );

  return setup.href ? (
    <Link href={setup.href} className={styles.row}>
      {inner}
    </Link>
  ) : (
    <div className={styles.row}>{inner}</div>
  );
}
