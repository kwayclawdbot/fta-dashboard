"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * THE UNLOCK LINE — the replacement for the full-page wall.
 *
 * A gate that still holds should not evict the surface behind it. The member
 * sees the REAL screen with live data and the last step withheld, and the thing
 * that says so is ONE line in the page's own voice: a hairline rule, a sentence
 * that names exactly what is missing, and the door.
 *
 * It is deliberately NOT a card. STANDING RULE (brand register): never a generic
 * card container. This is a rule and a sentence — the quietest object the board
 * has — so it can sit at the foot of a working surface, under a capped list, or
 * beneath a closed position without competing with the content it annotates.
 *
 * PRESENTATIONAL ONLY. Every entitlement check stays exactly where it was
 * (server routes, RLS, `can()`); this component renders no gate and grants no
 * access. It only says what a member would get.
 *
 * `tone`:
 *   "club" — the Club door (orange accent, the app's action colour).
 *   "fta"  — the FTA door. Quieter still: ink, not accent, because FTA is a
 *            second decision offered at a moment of desire, not a nag.
 */
export default function UnlockLine({
  children,
  cta,
  href = "/pricing",
  external = false,
  tone = "club",
  rule = true,
  className = "",
}: {
  /** The specific sentence — what this member is not seeing, in plain words. */
  children: React.ReactNode;
  /** Link label. Omit to make the whole line the link. */
  cta?: string;
  href?: string;
  external?: boolean;
  tone?: "club" | "fta";
  /** Draw the hairline above the line (off when the caller already has one). */
  rule?: boolean;
  className?: string;
}) {
  const accent = tone === "fta" ? "text-ink" : "text-accent";
  const linkClass = `f0-focus inline-flex items-center gap-1 whitespace-nowrap rounded-md font-display text-[12.5px] font-bold ${accent} transition-opacity hover:opacity-70`;

  const link = external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {cta}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </a>
  ) : (
    <Link href={href} className={linkClass}>
      {cta}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );

  // No CTA label → the sentence itself is the door (one target, no orphan verb).
  if (!cta) {
    const Whole = external ? "a" : Link;
    const props = external
      ? { href, target: "_blank", rel: "noopener noreferrer" }
      : { href };
    return (
      <p
        className={`${rule ? "border-t border-sand pt-3" : ""} mt-3 text-[12.5px] leading-relaxed text-soft ${className}`}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Whole
          {...(props as any)}
          className={`f0-focus rounded-md font-medium ${accent} underline decoration-current/30 underline-offset-2 transition-opacity hover:opacity-70`}
        >
          {children}
          <ArrowRight className="ml-1 inline-block h-3.5 w-3.5 align-[-2px]" aria-hidden />
        </Whole>
      </p>
    );
  }

  return (
    <div
      className={`${rule ? "border-t border-sand pt-3" : ""} mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 ${className}`}
    >
      <p className="min-w-[12rem] flex-1 text-[12.5px] leading-relaxed text-soft">
        {children}
      </p>
      {link}
    </div>
  );
}
