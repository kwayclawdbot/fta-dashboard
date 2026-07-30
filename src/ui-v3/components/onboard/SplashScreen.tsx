"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "./BrandMark";
import styles from "./SplashScreen.module.css";

/**
 * "09 Splash", translated from the artboard.
 *
 * The board is a held beat: mark, wordmark, tagline, and a progress bar over
 * "Reading the room…". A splash that holds forever is a dead end, so this one
 * advances to sign-in on its own — and the bar is wired to that wait rather than
 * being a decorative 60% (a determinate bar measuring nothing is the kind of
 * placeholder the grammar's rule 9.5 exists to stop).
 *
 * The whole screen is also a link, so nobody has to sit through the beat, and
 * the route still works with JavaScript off. Under `prefers-reduced-motion` the
 * bar fills without animating; the navigation is unchanged either way.
 */
const HOLD_MS = 1400;

export default function SplashScreen({ next }: { next: string }) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace(next), HOLD_MS);
    return () => clearTimeout(t);
  }, [router, next]);

  return (
    <Link href={next} className={styles.screen}>
      <BrandMark size="splash" />

      <div className={styles.wordmark}>Cheat Code</div>
      <div className={styles.club}>Club</div>
      <div className={styles.tagline}>trade with your people</div>

      <div className={styles.footer}>
        <div className={styles.track}>
          <div className={styles.fill} />
        </div>
        <div className={styles.status}>Reading the room…</div>
      </div>
    </Link>
  );
}
