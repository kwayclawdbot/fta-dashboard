"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "@/lib/motion";
import ScrollRow from "@/components/canvas2/ScrollRow";

/**
 * THE FTA DESK — the masthead that tops /fta/chat, /fta/courses, /fta/recordings.
 *
 * FTA is the PREMIUM TIER and it must not read as a reskin of the Club. The
 * canvas language is the same (display type, hairlines, eyebrows, section rules
 * — no card containers), but the FTA desk states itself with a HARD SPLIT: a
 * full-bleed metallic rule across the top, the eyebrow in the mono register, and
 * the title at display-1 with one annotated word. Where a Club surface leads
 * with warm paper, the desk leads with metal.
 *
 * WHAT WAS HERE BEFORE: a rounded gradient CARD with a gold-gradient icon tile,
 * a PRO pill, and a row of pill tabs — three of the four patterns the brand
 * register bans (generic card container, filled pill soup, chrome badge). The
 * hierarchy now comes from the rule, the type scale and the metal, so the strip
 * carries more weight while drawing less furniture.
 *
 * METAL, NOT ORANGE: DashboardShell stamps data-mode="fta" on every /fta route,
 * and globals.css re-points --accent-* to the metal sheen for that mode — so
 * `bg-accent` and `.f0-seg-bar` are metallic here for free. Where a stop must be
 * metallic REGARDLESS of the surrounding register, use the dedicated `ftagold-*`
 * ramp (--fg*), which is mode-invariant and already lifts in dark.
 *
 * TABS: three real destinations, so these are LINKS with aria-current, not a
 * radiogroup. They reuse the shared `.f0-seg-bar` geometry (a 3px bar on a
 * hairline rail) so the FTA rail and every other rail in the app are visibly
 * one mechanism. Three long labels overflow at 390px, so the track is a
 * <ScrollRow> — the peek alone is too quiet to read as "this scrolls", and the
 * hand-rolled fade this used to carry never cleared at the end of the track,
 * so it promised a scroll that was already finished.
 */

const TABS: { label: string; href: string }[] = [
  { label: "Traders Chat", href: "/fta/chat" },
  { label: "Course Library", href: "/fta/courses" },
  { label: "Recordings", href: "/fta/recordings" },
];

export default function FtaHubHeader({
  title,
  /** The ONE word that carries the drawn annotation. */
  mark,
  subtitle,
  aside,
}: {
  title: string;
  mark?: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <m.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* The hard split. A 3px metallic rule is the desk's signature — it is the
          one piece of chrome on the surface and it is a RULE, not a box. */}
      <div className="metal-gold h-[3px] w-full rounded-full" aria-hidden />

      <div className="mt-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-eyebrow font-semibold uppercase tracking-[0.18em] text-ftagold-700">
            FTA · Family Trading Academy
          </p>
          <h1 className="mt-2.5 font-display text-display-1 font-extrabold uppercase leading-[1.05] text-ink">
            {title}
            {mark && (
              <>
                {" "}
                <span className="f0-underline-mark">{mark}</span>
              </>
            )}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-soft">{subtitle}</p>
          )}
        </div>
        {aside && <div className="shrink-0 pt-1">{aside}</div>}
      </div>

      {/* The desk's three rooms. */}
      <nav aria-label="FTA desk" className="mt-7">
        <ScrollRow className="flex gap-7 border-b border-sand">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`f0-focus relative -mb-px shrink-0 whitespace-nowrap pb-3 font-display text-[13px] font-extrabold uppercase tracking-[0.1em] transition-colors ${
                  active ? "text-ink" : "text-soft hover:text-ink"
                }`}
              >
                {t.label}
                {active && <span className="f0-seg-bar metal-gold" aria-hidden />}
              </Link>
            );
          })}
        </ScrollRow>
      </nav>
    </m.header>
  );
}
