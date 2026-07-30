"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

/**
 * The five-slot bottom nav. Glyphs are the artboard's own typographic marks —
 * not an icon set — so they stay as text.
 */
const ITEMS = [
  { href: "/v3", glyph: "⌂", label: "Home", owns: [] as string[] },
  /*
   * A ticker page is not its own nav destination — "03 Ticker NVDA" draws the
   * five-slot nav with DISCOVER lit, because opening a name is something you do
   * from Discover and the member has not left that part of the app. So the
   * Discover slot owns the /v3/ticker subtree.
   */
  { href: "/v3/discover", glyph: "◎", label: "Discover", owns: ["/v3/ticker"] },
  { href: "/v3/club", glyph: "✦", label: "Club", owns: [] as string[] },
  { href: "/v3/watch", glyph: "▣", label: "Watch", owns: [] as string[] },
  { href: "/v3/you", glyph: "◉", label: "You", owns: [] as string[] },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      {ITEMS.map((item) => {
        const active =
          item.href === "/v3"
            ? pathname === "/v3"
            : pathname.startsWith(item.href) || item.owns.some((p) => pathname.startsWith(p));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.slot} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <div className={styles.glyph} aria-hidden="true">
              {item.glyph}
            </div>
            <div className={styles.label}>{item.label}</div>
          </Link>
        );
      })}
    </nav>
  );
}
