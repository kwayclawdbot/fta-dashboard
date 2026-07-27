"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, Target, Bot } from "lucide-react";

/**
 * The rail across the three faces of PRACTICE: the live Trading Floor
 * (/simulator), Pattern Practice (/simulator/lessons) and Simbot
 * (/simulator/simbot — the embedded price-action simulator). Rendered at the
 * top of each page so they read as one destination with tabs — Pattern Practice
 * is not a separate card in the Games arcade (audit item 12).
 *
 * It is a hairline-underscored rail, not a segmented pill box: the labels stay
 * in the ink/soft register so the rail reads as a set of headings, and the
 * active face is marked by a volt underscore (the action colour) plus weight.
 */
const TABS = [
  { href: "/simulator", label: "Trading floor", icon: LineChart },
  { href: "/simulator/lessons", label: "Pattern practice", icon: Target },
  { href: "/simulator/simbot", label: "Simbot", icon: Bot },
] as const;

export default function SimulatorTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Practice" className="flex gap-6 overflow-x-auto border-b border-sand sm:gap-8">
      {TABS.map((t) => {
        const active =
          t.href === "/simulator" ? pathname === "/simulator" : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`f0-focus relative -mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap pb-3 font-display text-[13px] font-extrabold uppercase tracking-[0.08em] transition-colors ${
              active ? "text-ink" : "text-soft hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.label}
            {active && <span className="f0-seg-bar bg-accent" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}
