"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, Target } from "lucide-react";

/**
 * Shared tab bar for the two faces of the simulator feature: the live Trading
 * Floor (/simulator) and Pattern Practice (/simulator/lessons). Rendered at the
 * top of both pages so they read as one destination with two tabs — Pattern
 * Practice is no longer a separate card in the Games arcade (audit item 12).
 */
const TABS = [
  { href: "/simulator", label: "Trading Floor", icon: LineChart },
  { href: "/simulator/lessons", label: "Pattern Practice", icon: Target },
] as const;

export default function SimulatorTabs() {
  const pathname = usePathname();
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-sand bg-paper p-1">
      {TABS.map((t) => {
        const active =
          t.href === "/simulator"
            ? pathname === "/simulator"
            : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-display font-semibold transition-colors ${
              active
                ? "bg-chip-amber text-gold-800"
                : "text-soft hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
