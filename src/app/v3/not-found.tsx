import Link from "next/link";
import AppShell from "@/ui-v3/components/AppShell";
import styles from "./not-found.module.css";

/**
 * The 404 for everything under /v3.
 *
 * Without this file a `notFound()` inside a v3 route falls through to the app's
 * root not-found, which is built in the OLD design system and links to old
 * routes (/dashboard, /discover). A member who taps a dead v3 link — a setup id
 * that no longer resolves, a stale Circle slug — would be handed a screen from a
 * different app and then sent out of v3 entirely.
 *
 * So this is a v3 screen: v3 tokens, the v3 shell with its nav still under the
 * member's thumb, and both exits pointing back into /v3.
 */
export default function V3NotFound() {
  return (
    <AppShell>
      <div className={styles.wrap}>
        <div className={styles.code} data-numeric>
          404
        </div>
        <h1 className={styles.title}>Nothing here</h1>
        <p className={styles.copy}>
          This link points at something that has moved, expired, or was never here. Alerts and
          Circles both run on a clock, so old links do go stale.
        </p>
        <div className={styles.actions}>
          <Link href="/v3" className={styles.primary}>
            Back to Home
          </Link>
          <Link href="/v3/discover" className={styles.secondary}>
            Discover
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
