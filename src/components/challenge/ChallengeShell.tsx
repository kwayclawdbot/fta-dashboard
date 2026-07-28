import Link from "next/link";
import type React from "react";

/**
 * The standalone frame every challenge-journey surface sits in.
 *
 * MODE: the challenge is a Cheat Code Club product, so the subtree is
 * `data-mode="club"` regardless of the member's usual mode (a Family-mode parent
 * doing the challenge is doing a Club thing). `--accent-gradient` is RE-DECLARED
 * here because it is declared on `:root` in terms of `--accent-a`/`--accent-b`;
 * setting the mode on a DESCENDANT therefore leaves `.cta-button` rendering
 * family gold. This bit two surfaces already — see CANVAS-V2-ADOPTION-PLAN §0.3.
 *
 * FORM: paper, grain, one column, generous measure. No card wraps the page —
 * the boards are composed from type, rules and objects, per the standing rule.
 *
 * CHROME (C16). The challenge routes live OUTSIDE the (dashboard) group, so
 * they get no sidebar, no top bar and no mobile tab bar. That is correct for
 * the funnel screens — a signup flow should not offer nine exits — but /hq and
 * the day missions are places a member lives in for five days, and they were
 * shipping with no masthead and no navigation of any kind: no title, no way
 * back to the app, nothing but the board and the browser's back button (which
 * a member arriving from an SMS link does not have).
 *
 * So every challenge surface now carries the same slim bar: the product's name
 * on the left (or the flow's back step, where one was already declared), and
 * ALWAYS a way back into the app on the right. It is one row of type on the
 * paper — not a card, not a nav — so it costs the boards nothing.
 */
export default function ChallengeShell({
  children,
  back,
  backLabel = "Back",
  /**
   * Where "the app" is from here. Defaults to the dashboard; a surface deeper
   * in the challenge (a day mission) points at Challenge HQ instead, so the
   * bar walks a member UP one level rather than dropping them out.
   */
  home = "/dashboard",
  homeLabel = "The app",
}: {
  children: React.ReactNode;
  back?: string;
  backLabel?: string;
  home?: string;
  homeLabel?: string;
}) {
  return (
    <div
      data-mode="club"
      className="f0-grain min-h-screen bg-paper"
      style={
        {
          // Re-declared locally: :root's definition does not follow a descendant
          // mode switch, and .cta-button reads it directly.
          "--accent-gradient": "linear-gradient(135deg, #FF5A00, #FF8A00)",
        } as React.CSSProperties
      }
    >
      <div className="mx-auto w-full max-w-[640px] px-5 pb-28 pt-7 sm:px-8 sm:pt-10">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-sand pb-3">
          {back ? (
            <Link
              href={back}
              className="f0-focus inline-flex min-w-0 items-center gap-1.5 text-eyebrow font-display font-bold uppercase text-soft transition-colors hover:text-ink"
            >
              ← {backLabel}
            </Link>
          ) : (
            <p className="min-w-0 truncate text-eyebrow font-display font-bold uppercase text-ink">
              The Challenge
            </p>
          )}
          <Link
            href={home}
            className="f0-focus inline-flex shrink-0 items-center gap-1.5 text-eyebrow font-display font-bold uppercase text-soft transition-colors hover:text-ink"
          >
            {homeLabel} →
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
