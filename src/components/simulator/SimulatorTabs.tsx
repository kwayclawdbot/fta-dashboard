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
 * CONTROL LANGUAGE: filled PILLS, matching the owner's mockup (boards 12–14
 * draw the subpage nav as pills, not as an underline rail). The active face is
 * the brand orange fill; the resting faces are white bordered pills. An
 * earlier pass shipped the underline rail; the owner rejected that reading.
 */
const TABS = [
  { href: "/simulator", label: "Trading floor", icon: LineChart },
  { href: "/simulator/lessons", label: "Pattern practice", icon: Target },
  { href: "/simulator/simbot", label: "Simbot", icon: Bot },
] as const;

export default function SimulatorTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Practice" className="club2-track -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
      {TABS.map((t) => {
        const active =
          t.href === "/simulator" ? pathname === "/simulator" : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`f0-focus inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11.5px] transition-colors ${
              active
                ? "bg-volt-500 font-extrabold text-[#1A1614]"
                : "border border-sand bg-card font-semibold text-soft shadow-soft hover:text-ink"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
