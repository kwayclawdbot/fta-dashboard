"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * FAMILY REGISTER BRIDGE — lets Family Mode borrow the F0 surface vocabulary
 * (.f0-section-rule, .f0-ledger, .f0-ledger-row, .f0-hero-field) WITHOUT
 * borrowing the Club's colour.
 *
 * WHY THIS EXISTS
 * The F0 primitives in globals.css hardcode the volt ramp — the section-rule
 * tick is `linear-gradient(var(--color-volt-400), var(--color-volt-600))` and
 * the ledger-row hover is `color-mix(var(--color-volt-500) 6%)`. Those raw vars
 * are mode-INVARIANT (the `--color-volt-*` scale is declared constant in
 * @theme), so dropping an f0-* class onto a family surface would paint Club
 * orange onto the warm-gold family identity — the exact bleed Family Mode is
 * supposed to be immune to.
 *
 * Rather than fork the CSS (globals.css is owned by the Club lane), a family
 * surface spreads `familyRegister` on its root. That re-points the three volt
 * stops at the MODE-AWARE accent vars for that subtree only, so every F0
 * primitive inside renders in whatever register the shell is in:
 *   family → warm gold · fta → metallic gold · club → volt orange.
 * Composition is shared; colour stays the mode's own. Nothing outside the
 * subtree is affected, and no family colour token changes.
 */
export const familyRegister = {
  "--color-volt-400": "var(--accent-strong)",
  "--color-volt-500": "var(--accent-solid)",
  "--color-volt-600": "var(--accent-solid)",
} as CSSProperties;

/**
 * The section marker that replaces "bold 11px text floating above a grid":
 * a charged tick + small-caps eyebrow + hairline that runs to the edge.
 *
 * Pair with a trailing action by wrapping both in a flex row — the hairline is
 * a flex-1 pseudo-element, so it stretches to meet whatever sits beside it:
 *
 *   <div className="flex items-center gap-4">
 *     <SectionRule>Weekly Family Research</SectionRule>
 *     <Link …>See all</Link>
 *   </div>
 */
export function SectionRule({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`f0-section-rule flex-1 min-w-0 ${className}`}>
      <span className="text-eyebrow font-display font-bold uppercase text-midnight-300 whitespace-nowrap">
        {children}
      </span>
    </div>
  );
}
