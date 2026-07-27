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
 */
export default function ChallengeShell({
  children,
  back,
  backLabel = "Back",
}: {
  children: React.ReactNode;
  back?: string;
  backLabel?: string;
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
        {back && (
          <Link
            href={back}
            className="f0-focus mb-6 inline-flex items-center gap-1.5 text-eyebrow font-display font-bold uppercase text-soft transition-colors hover:text-ink"
          >
            ← {backLabel}
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}
