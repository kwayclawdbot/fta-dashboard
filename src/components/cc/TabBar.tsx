"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Diamond, Monitor, CircleUser } from "lucide-react";

const TABS = [
  { href: "/cc", label: "Home", icon: Home },
  { href: "/cc/discover", label: "Discover", icon: Compass },
  { href: "/cc/club", label: "Club", icon: Diamond },
  { href: "/cc/watch", label: "Watch", icon: Monitor },
  { href: "/cc/you", label: "You", icon: CircleUser },
] as const;

/** Bottom 5-tab bar. Active tab = signal orange, inactive = dim. */
export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-40 mt-auto border-t border-[var(--cc-line)] bg-[var(--cc-bg)]/95 backdrop-blur">
      <div className="flex items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/cc" ? pathname === "/cc" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1"
            >
              <Icon
                className="h-[18px] w-[18px]"
                style={{ color: active ? "var(--cc-orange)" : "var(--cc-dim)" }}
                strokeWidth={active ? 2.4 : 1.8}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? "var(--cc-orange)" : "var(--cc-dim)" }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
