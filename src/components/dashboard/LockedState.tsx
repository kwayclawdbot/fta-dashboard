"use client";

import Link from "next/link";
import { m } from "@/lib/motion";
import { Lock, ArrowRight, type LucideIcon } from "lucide-react";

/**
 * The ONE locked / gated / not-ready presentational primitive for the club.
 *
 * Before this, four treatments diverged (UX audit #22): the free-tier
 * `UpsellCard`, the FTA "Session Locked / Join the next cohort" card on
 * live-sessions, the kid "this adventure unlocks soon" screen on the lesson
 * player, and assorted one-offs. They now all render this shared full-card
 * structure — a badge (optionally lock-stamped), an optional eyebrow, a title,
 * a body, an optional primary CTA, and optional secondary content underneath.
 *
 * This is CONSOLIDATION, not redesign: every caller passes its OWN approved
 * copy, icon and CTA. `UpsellCard` is the free-tier variant and renders through
 * this under the hood, so the free door and the FTA door and the kid door all
 * share one silhouette while keeping their own words.
 *
 * `surface` swaps the card chrome so the same structure sits correctly on both
 * the light "paper" pages (courses / lesson) and the dark "midnight" pages
 * (live-sessions) without either page looking wrong.
 */

export interface LockedStateCta {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Render as a plain <a> (external checkout) rather than a next/link <Link>. */
  external?: boolean;
}

export interface LockedStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
  eyebrow?: string;
  cta?: LockedStateCta;
  /** Stamp the small lock badge on the icon (a genuine lock). A "not-ready"
   *  state — the kid "unlocks soon" screen — leaves this off. */
  lockBadge?: boolean;
  /** Badge accent: "gold" for real locks, "amber" for coming-soon / kid. */
  tone?: "gold" | "amber";
  /** Card chrome for the host page. */
  surface?: "paper" | "midnight";
  /** Extra content under the CTA (e.g. the free-tier secondary links). */
  children?: React.ReactNode;
  className?: string;
}

export default function LockedState({
  icon: Icon,
  title,
  body,
  eyebrow,
  cta,
  lockBadge = true,
  tone = "gold",
  surface = "paper",
  children,
  className = "",
}: LockedStateProps) {
  const isDark = surface === "midnight";
  const badgeBg = tone === "amber" ? "bg-chip-amber" : "bg-gold-400/15";
  const badgeIcon = tone === "amber" ? "text-gold-600" : "text-gold-700";

  const CtaInner = cta ? (
    <>
      {cta.icon ? <cta.icon className="w-4 h-4" /> : null}
      {cta.label}
      {cta.icon ? null : <ArrowRight className="w-4 h-4" />}
    </>
  ) : null;

  const ctaClass =
    "cta-button mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px]";

  return (
    <div className={`max-w-lg mx-auto py-6 ${className}`}>
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          isDark
            ? "rounded-2xl border border-midnight-800/60 bg-midnight-900/40 p-8 text-center"
            : "paper-card p-8 text-center"
        }
      >
        <div
          className={`w-14 h-14 mx-auto rounded-2xl ${badgeBg} flex items-center justify-center mb-4 relative`}
        >
          <Icon className={`w-7 h-7 ${badgeIcon}`} />
          {lockBadge && (
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-midnight-900 ring-2 ring-paper flex items-center justify-center">
              <Lock className="w-3 h-3 text-gold-600" />
            </span>
          )}
        </div>

        {eyebrow && (
          <span className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-gold-700">
            {eyebrow}
          </span>
        )}
        <h2
          className={`font-display text-2xl font-bold mt-1.5 ${
            isDark ? "text-midnight-100" : "text-ink"
          }`}
        >
          {title}
        </h2>
        <p
          className={`text-sm mt-2.5 max-w-sm mx-auto leading-relaxed ${
            isDark ? "text-midnight-400" : "text-soft"
          }`}
        >
          {body}
        </p>

        {cta &&
          (cta.external ? (
            <a href={cta.href} className={ctaClass}>
              {CtaInner}
            </a>
          ) : (
            <Link href={cta.href} className={ctaClass}>
              {CtaInner}
            </Link>
          ))}

        {children}
      </m.div>
    </div>
  );
}
