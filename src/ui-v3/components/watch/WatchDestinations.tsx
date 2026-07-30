import Link from "next/link";
import type { WatchDestinationVM } from "@/ui-v3/watch-data";
import styles from "./WatchDestinations.module.css";

/**
 * The four rows the Watch overview opens with. Each is a destination plus the
 * one number that says why you'd go there.
 *
 * A row whose caption has no real source arrives with `caption: null` and
 * renders the title alone rather than a made-up count.
 */
export default function WatchDestinations({ rows }: { rows: WatchDestinationVM[] }) {
  return (
    <div className={styles.list}>
      {rows.map((row) => {
        const inner = (
          <>
            <span className={styles.glyph} aria-hidden="true">
              {row.glyph}
            </span>
            <span className={styles.copy}>
              <span className={styles.title}>{row.title}</span>
              {row.caption ? <span className={styles.caption}>{row.caption}</span> : null}
            </span>
            {row.badge !== null ? (
              <span className={styles.badge} data-numeric>
                {row.badge}
              </span>
            ) : (
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            )}
          </>
        );

        // No v3 artboard exists for three of the four destinations, so they are
        // rendered as inert rows until those screens land — never as links to
        // an old-app route, which would break out of v3.
        return row.href ? (
          <Link key={row.title} href={row.href} className={styles.row}>
            {inner}
          </Link>
        ) : (
          <div key={row.title} className={styles.row}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
