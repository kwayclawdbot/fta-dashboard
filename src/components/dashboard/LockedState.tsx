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
 * player, and assorted one-offs. They now all render this shared structure — a
 * glyph, an optional eyebrow, a title, a body, an optional primary CTA, and
 * optional secondary content underneath.
 *
 * This is CONSOLIDATION, not redesign: every caller passes its OWN approved
 * copy, icon and CTA. `UpsellCard` is the free-tier variant and renders through
 * this under the hood, so the free door and the FTA door and the kid door all
 * share one silhouette while keeping their own words.
 *
 * BOARD VOCABULARY (canvas v2). The wall was the pre-canvas paper card box with a centred
 * badge and a gradient `.cta-button` — the pre-canvas chrome. It is now the
 * board's ONE tinted accent object per screen: `.club-b-warm` (peach wash to the
 * card colour, warm hairline, 16px radius), a round orange `.club-b-orb`
 * carrying the feature's glyph, the section-mark eyebrow in tracked mono caps,
 * a display-caps headline, a short honest lede, and a full-width SOLID orange
 * button — the same silhouette the reference board draws for its pricing card.
 * Left-aligned, because the board's commercial card is left-aligned.
 *
 * COMPACT BY DESIGN: this thing routinely renders inside somebody else's page
 * (a walled section on research, a locked room), so the padding and type sit a
 * step below a page masthead. It states the door, it does not become the page.
 *
 * `surface` swaps the ground so the same structure sits correctly on both the
 * warm paper pages and the deliberate dark islands (`night-island` — the board's
 * treatment for immersive/live moments) without either page looking wrong.
 *
 * THE GATE IS NOT HERE. This file is presentation only: it renders the wall its
 * caller asked for and knows nothing about who passes. Every entitlement branch
 * is unchanged.
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
  /** Stamp the small lock badge on the glyph (a genuine lock). A "not-ready"
   *  state — the kid "unlocks soon" screen — leaves this off. */
  lockBadge?: boolean;
  /** Glyph treatment: "gold" for real locks (the orange action orb), "amber"
   *  for coming-soon / kid states (a quiet well — nothing to act on yet). */
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
  const isAction = tone === "gold";

  const CtaInner = cta ? (
    <>
      {cta.icon ? <cta.icon className="h-4 w-4" /> : null}
      {cta.label}
      {cta.icon ? null : <ArrowRight className="h-4 w-4" />}
    </>
  ) : null;

  const ctaClass =
    "f0-focus f0-press mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 font-display text-[14.5px] font-extrabold uppercase tracking-[0.05em] text-[color:var(--accent-on)]";

  return (
    <div className={`mx-auto max-w-lg py-6 ${className}`}>
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          isDark
            ? "night-island f0-grain relative px-6 py-7 sm:px-7"
            : "club-b-warm f0-grain px-5 py-6 sm:px-6"
        }
      >
        <div className="flex items-start gap-3.5">
          {/* The board's round action orb carries the feature's own glyph. A
              not-yet state gets the quiet well instead — there is nothing to
              act on, so nothing wears the action colour. */}
          <span
            className={`relative grid h-11 w-11 shrink-0 place-items-center ${
              isAction ? "club-b-orb" : "club-b-chip"
            }`}
          >
            <Icon className={`h-5 w-5 ${isAction ? "" : "text-soft"}`} aria-hidden />
            {lockBadge && (
              <span
                className={`absolute -bottom-1 -right-1 grid h-[18px] w-[18px] place-items-center rounded-full ${
                  isDark
                    ? "bg-[color:var(--island)] text-[color:var(--island-ink)]"
                    : "bg-card text-ink"
                }`}
              >
                <Lock className="h-2.5 w-2.5" aria-hidden />
                <span className="sr-only">Locked</span>
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p
                className={`font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] ${
                  isDark ? "opacity-70" : "text-accent"
                }`}
              >
                {eyebrow}
              </p>
            )}
            <h2
              className={`mt-1 font-display text-[20px] font-extrabold uppercase leading-[1.1] ${
                isDark ? "" : "text-ink"
              }`}
            >
              {title}
            </h2>
            <p
              className={`mt-2 text-[13.5px] leading-relaxed ${
                isDark ? "opacity-70" : "text-soft"
              }`}
            >
              {body}
            </p>
          </div>
        </div>

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
