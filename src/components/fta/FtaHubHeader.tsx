"use client";

import Link from "next/link";
import { m } from "@/lib/motion";
import { GraduationCap, Radio, BookOpen, Film, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";

/**
 * The consistent gold-accent identity strip that tops every FTA hub page
 * (/fta/chat, /fta/courses, /fta/recordings). It anchors the member on the
 * premium "FTA — Trading Academy" side of the platform — FIC pages stay warm
 * paper with no strip — and carries a tab row across the three hub surfaces so
 * they feel like one destination. Gold gradient chrome, PRO chip, within the
 * token palette (works in both themes).
 */

const TABS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Traders Chat", href: "/fta/chat", icon: Radio },
  { label: "Course Library", href: "/fta/courses", icon: BookOpen },
  { label: "Recordings", href: "/fta/recordings", icon: Film },
];

export default function FtaHubHeader({
  title,
  subtitle,
  tone = "paper",
}: {
  title: string;
  subtitle?: string;
  /** "dark" tucks the strip onto the FTA chat's night surface. */
  tone?: "paper" | "dark";
}) {
  const pathname = usePathname();
  const dark = tone === "dark";

  return (
    <m.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border ${
        dark
          ? "border-ftagold-400/30 bg-gradient-to-br from-night-900 via-night-900 to-night-950"
          : "border-ftagold-400/40 bg-gradient-to-br from-ftagold-400/[0.14] via-ftagold-400/[0.05] to-transparent"
      }`}
    >
      <div className="p-4 lg:p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-ftagold-400 to-ftagold-600 text-white flex items-center justify-center shrink-0 shadow-soft">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-ftagold-600">
                FTA — Trading Academy
              </p>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-b from-ftagold-400 to-ftagold-600 text-white">
                PRO
              </span>
            </div>
            <h1 className={`font-display text-xl font-bold leading-snug ${dark ? "text-night-50" : "text-ink"}`}>
              {title}
            </h1>
            {subtitle && (
              <p className={`text-sm mt-0.5 ${dark ? "text-night-300" : "text-soft"}`}>{subtitle}</p>
            )}
          </div>
        </div>

        {/* Hub tab row — the three FTA surfaces, one tap apart. */}
        <div className="flex items-center gap-1.5 mt-4 -mb-0.5 overflow-x-auto">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold whitespace-nowrap transition-colors border ${
                  active
                    ? "bg-gradient-to-b from-ftagold-400 to-ftagold-600 text-white border-transparent shadow-soft"
                    : dark
                      ? "bg-night-950/60 text-night-200 border-night-700 hover:text-ftagold-400 hover:border-ftagold-400/40"
                      : "bg-paper/70 text-soft border-sand hover:text-ftagold-700 hover:border-ftagold-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </m.div>
  );
}
