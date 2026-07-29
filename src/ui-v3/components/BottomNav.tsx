"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

/**
 * The five-slot bottom nav. Glyphs are the artboard's own typographic marks —
 * not an icon set — so they stay as text.
 */
const ITEMS = [
  { href: "/v3", glyph: "⌂", label: "Home" },
  { href: "/v3/discover", glyph: "◎", label: "Discover" },
  { href: "/v3/club", glyph: "✦", label: "Club" },
  { href: "/v3/watch", glyph: "▣", label: "Watch" },
  { href: "/v3/you", glyph: "◉", label: "You" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      {ITEMS.map((item) => {
        const active = item.href === "/v3" ? pathname === "/v3" : pathname.startsWith(item.href);
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
